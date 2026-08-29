#!/usr/bin/env python3
"""Shared Plane API configuration and HTTP helpers."""
import email.utils
import json
import math
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import timezone
from pathlib import Path


PLANE_ENV_KEYS = ("PLANE_TOKEN", "PLANE_PROJECT")
PLANE_OPTIONAL_ENV_KEYS = (
    "PLANE_DEFAULT_ASSIGNEE",
    "PLANE_DEFAULT_STATE",
    "PLANE_MERGED_STATE",
    "PLANE_RELEASED_STATE",
    "PLANE_BLOCKED_STATE",
)
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
INVALID_JSON_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
RETRY_DELAYS = (2.0, 5.0, 15.0, 30.0)
MAX_RETRY_DELAY = max(RETRY_DELAYS)
MAX_REQUEST_ATTEMPTS = len(RETRY_DELAYS) + 1
RETRYABLE_HTTP_CODES = frozenset((429, 500, 502, 503, 504))


class PlaneConfigError(ValueError):
    """Raised when Plane credentials or project configuration are invalid."""


@dataclass(frozen=True)
class PlaneProject:
    host: str
    workspace: str
    project_id: str

    @property
    def base_url(self):
        return f"https://{self.host}/api/v1"

    @property
    def path(self):
        return f"/workspaces/{self.workspace}/projects/{self.project_id}"

    def issue_url(self, issue_id):
        return (
            f"https://{self.host}/{self.workspace}/projects/"
            f"{self.project_id}/issues/?issue={issue_id}"
        )


@dataclass(frozen=True)
class PlaneConfig:
    token: str
    project: PlaneProject
    defaults: dict = field(default_factory=dict)


class PlaneConfigLoader:
    """Loads Plane credentials from the supported project/global sources."""

    def __init__(self, cwd=None, home=None):
        self.cwd = Path(cwd or os.getcwd())
        self.home = Path(home or Path.home())

    def load(self):
        env = self.read_env()
        token = env.get("PLANE_TOKEN")
        project_url = env.get("PLANE_PROJECT")
        if not token or not project_url:
            raise PlaneConfigError(
                "PLANE_TOKEN and PLANE_PROJECT must be set in Plane config"
            )
        return PlaneConfig(
            token=token,
            project=parse_project_url(project_url),
            defaults={
                key: env[key] for key in PLANE_OPTIONAL_ENV_KEYS if env.get(key)
            },
        )

    def read_env(self):
        """Return Plane settings from the first source holding every required key.

        Optional keys are read from that same source, so credentials and the defaults
        that go with them always come from one file rather than being merged across
        several with surprising precedence.
        """
        sources = (
            self._dotenv_env(self.cwd / ".env"),
            self._dotenv_env(self.home / ".agents/.env"),
            self._settings_env(self.cwd / ".claude/settings.local.json"),
            self._settings_env(self.home / ".claude/settings.local.json"),
        )
        for source in sources:
            if not self._missing_required(source):
                keys = PLANE_ENV_KEYS + PLANE_OPTIONAL_ENV_KEYS
                return {key: source[key] for key in keys if source.get(key)}
        return {}

    def _missing_required(self, env_vars):
        return any(not env_vars.get(key) for key in PLANE_ENV_KEYS)

    def _settings_env(self, path):
        if not path.exists():
            return {}
        try:
            with path.open() as settings_file:
                config = json.load(settings_file)
        except (OSError, json.JSONDecodeError):
            return {}

        return {
            key: value
            for key, value in config.get("env", {}).items()
            if key.startswith("PLANE_")
        }

    def _dotenv_env(self, path):
        if not path.exists():
            return {}

        env_vars = {}
        try:
            with path.open() as env_file:
                for line in env_file:
                    key, separator, value = line.strip().partition("=")
                    if key.startswith("PLANE_") and separator:
                        env_vars[key] = value.strip().strip('"\'')
        except OSError:
            return {}

        return env_vars


def parse_project_url(url):
    match = re.match(r"https://([^/]+)/([^/]+)/projects/([^/]+)(?:/|$)", url)
    if not match:
        raise PlaneConfigError(f"Cannot parse PLANE_PROJECT URL: {url}")
    return PlaneProject(
        host=match.group(1),
        workspace=match.group(2),
        project_id=match.group(3),
    )


class PlaneClient:
    """Small HTTP client for Plane API calls."""

    def __init__(self, config):
        self.config = config

    @property
    def project(self):
        return self.config.project

    def request(self, method, path, data=None, timeout=30):
        req = urllib.request.Request(
            f"{self.project.base_url}{path}",
            method=method,
            headers={
                "User-Agent": USER_AGENT,
                "x-api-key": self.config.token,
            },
        )
        if data is not None:
            req.add_header("Content-Type", "application/json")
            req.data = json.dumps(data).encode("utf-8")

        response = self._urlopen_with_retry(req, timeout)
        raw = INVALID_JSON_CONTROL_CHARS.sub("", response.read().decode())
        return json.loads(raw)

    @staticmethod
    def _urlopen_with_retry(req, timeout, attempts=MAX_REQUEST_ATTEMPTS):
        """Retry rate limits and transient server failures with bounded backoff."""
        attempts = max(1, min(attempts, MAX_REQUEST_ATTEMPTS))
        for attempt in range(attempts):
            try:
                return urllib.request.urlopen(req, timeout=timeout)
            except urllib.error.HTTPError as error:
                should_retry = (
                    error.code in RETRYABLE_HTTP_CODES and attempt < attempts - 1
                )
                retry_after = None
                if should_retry:
                    headers = error.headers or {}
                    retry_after = _retry_after_delay(headers.get("Retry-After"))
                _close_http_error(error)
                if not should_retry:
                    raise
                time.sleep(
                    min(retry_after, MAX_RETRY_DELAY)
                    if retry_after is not None
                    else RETRY_DELAYS[attempt]
                )

    def results(self, path, max_pages=100):
        """Return every row for a list endpoint, following Plane's cursor pagination.

        Plane answers list endpoints with a cursor envelope. Returning only the first
        page silently truncates callers that page explicitly or that outgrow the
        server-side per_page default, so walk the cursor until it is exhausted.
        """
        collected = []
        cursor = None
        seen_cursors = set()

        for _ in range(max_pages):
            response = self.request("GET", _with_cursor(path, cursor))

            if isinstance(response, list):
                return collected + response
            if not isinstance(response, dict):
                break

            collected.extend(response.get("results", []))

            if not response.get("next_page_results"):
                break

            cursor = response.get("next_cursor")
            if not cursor or cursor in seen_cursors:
                break
            seen_cursors.add(cursor)

        return collected


def _with_cursor(path, cursor):
    if not cursor:
        return path
    separator = "&" if "?" in path else "?"
    return f"{path}{separator}cursor={urllib.parse.quote(cursor, safe='')}"


def _retry_after_delay(value, now=None):
    if value is None:
        return None

    try:
        delay = float(value)
    except (TypeError, ValueError):
        pass
    else:
        return delay if math.isfinite(delay) and delay >= 0 else None

    try:
        retry_at = email.utils.parsedate_to_datetime(value)
    except (TypeError, ValueError, OverflowError):
        return None
    if retry_at is None:
        return None
    if retry_at.tzinfo is None:
        retry_at = retry_at.replace(tzinfo=timezone.utc)

    delay = retry_at.timestamp() - (time.time() if now is None else now)
    return max(0.0, delay) if math.isfinite(delay) else None


def _close_http_error(error):
    try:
        error.close()
    except Exception:
        pass


def load_plane_client(cwd=None):
    return PlaneClient(PlaneConfigLoader(cwd=cwd).load())
