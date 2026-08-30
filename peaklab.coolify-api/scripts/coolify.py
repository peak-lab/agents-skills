#!/usr/bin/env python3
"""Small, safe Coolify API helper for agent workflows.

The script intentionally exposes only narrow operations. It loads Coolify
credentials from project/user agent env files without printing secrets.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


FINAL_STATUSES = {"finished", "failed", "cancelled", "canceled"}
SECRET_PATTERN = re.compile(
    r"(?i)(token|secret|password|key|database_url)(=|:)[^\s]+"
)


def load_settings() -> None:
    """Priority: project .env, ~/.agents/.env, then local harness settings."""

    def load_env_file(path: Path) -> None:
        if not path.exists():
            return
        for line in path.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                key, _, value = line.partition("=")
                if key.strip().startswith("COOLIFY"):
                    os.environ.setdefault(key.strip(), value.strip().strip("\"'"))

    load_env_file(Path.cwd() / ".env")
    load_env_file(Path.home() / ".agents" / ".env")

    settings_files = [
        Path.cwd() / ".codex" / "settings.local.json",
        Path.cwd() / ".claude" / "settings.local.json",
    ]
    for path in settings_files:
        if not path.exists():
            continue
        data = json.loads(path.read_text())
        for key, value in data.get("env", {}).items():
            if key.startswith("COOLIFY"):
                os.environ.setdefault(key, value)


def load_aliases() -> dict[str, str]:
    raw = os.environ.get("COOLIFY_APP_ALIASES", "").strip()
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid COOLIFY_APP_ALIASES JSON: {exc}") from exc
    if not isinstance(data, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in data.items()):
        raise SystemExit("COOLIFY_APP_ALIASES must be a JSON object of string aliases")
    return data


def redact(value: Any) -> Any:
    if isinstance(value, str):
        value = re.sub(r"https://[^\s@]+@github\.com", "https://[redacted]@github.com", value)
        return SECRET_PATTERN.sub(r"\1\2[redacted]", value)
    if isinstance(value, list):
        return [redact(item) for item in value]
    if isinstance(value, dict):
        out: dict[str, Any] = {}
        for key, item in value.items():
            if any(word in key.lower() for word in ("token", "secret", "password", "key")):
                out[key] = "[redacted]" if item else item
            else:
                out[key] = redact(item)
        return out
    return value


class Coolify:
    def __init__(self) -> None:
        load_settings()
        self.url = os.environ.get("COOLIFY_URL", "").rstrip("/")
        self.token = os.environ.get("COOLIFY_TOKEN", "")
        self.aliases = load_aliases()
        if not self.url or not self.token:
            raise SystemExit("Missing COOLIFY_URL or COOLIFY_TOKEN")

    def request(self, method: str, path: str, data: dict[str, Any] | None = None) -> Any:
        req = urllib.request.Request(
            f"{self.url}{path}",
            method=method,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
            },
        )
        if data is not None:
            req.data = json.dumps(data).encode()
        try:
            text = urllib.request.urlopen(req, timeout=60).read().decode()
        except urllib.error.HTTPError as exc:
            body = exc.read().decode(errors="replace")
            raise SystemExit(f"Coolify HTTP {exc.code}: {redact(body)}") from exc
        return json.loads(text) if text else None

    def apps(self) -> list[dict[str, Any]]:
        data = self.request("GET", "/applications")
        if not isinstance(data, list):
            raise SystemExit("Unexpected /applications response")
        return data

    def app_uuid(self, selector: str) -> str:
        if re.fullmatch(r"[a-z0-9]{20,}", selector):
            return selector
        target = self.aliases.get(selector, selector)
        matches = [app for app in self.apps() if app.get("name") == target]
        if not matches:
            raise SystemExit(f"Application not found: {selector}")
        if len(matches) > 1:
            raise SystemExit(f"Application selector is ambiguous: {selector}")
        return str(matches[0]["uuid"])

    def deploy(self, selector: str, force: bool) -> list[str]:
        uuid = self.app_uuid(selector)
        query = urllib.parse.urlencode({"uuid": uuid, "force": str(force).lower()})
        data = self.request("GET", f"/deploy?{query}")
        deployments = data.get("deployments", []) if isinstance(data, dict) else []
        ids = [item.get("deployment_uuid") for item in deployments if item.get("deployment_uuid")]
        if not ids:
            raise SystemExit(f"Deployment was not queued: {redact(data)}")
        return ids

    def deployment(self, deployment_uuid: str) -> dict[str, Any]:
        data = self.request("GET", f"/deployments/{urllib.parse.quote(deployment_uuid)}")
        if not isinstance(data, dict):
            raise SystemExit("Unexpected deployment response")
        return data

    def wait(self, deployment_uuids: list[str], interval: int = 5, timeout: int = 900) -> list[dict[str, Any]]:
        started = time.time()
        remaining = set(deployment_uuids)
        final: list[dict[str, Any]] = []
        last: dict[str, str] = {}
        while remaining:
            if time.time() - started > timeout:
                raise SystemExit(f"Timed out waiting for: {', '.join(sorted(remaining))}")
            for deployment_uuid in list(remaining):
                dep = self.deployment(deployment_uuid)
                status = str(dep.get("status") or "unknown")
                if last.get(deployment_uuid) != status:
                    print(json.dumps({"deployment_uuid": deployment_uuid, "status": status}))
                    last[deployment_uuid] = status
                if status in FINAL_STATUSES:
                    final.append(dep)
                    remaining.remove(deployment_uuid)
            if remaining:
                time.sleep(interval)
        return final

    def upsert_env(self, app: str, key: str, value: str, preview: bool) -> dict[str, Any]:
        uuid = self.app_uuid(app)
        payload = {
            "key": key,
            "value": value,
            "is_preview": preview,
            "is_literal": False,
            "is_multiline": False,
            "is_shown_once": False,
        }
        try:
            resp = self.request("PATCH", f"/applications/{uuid}/envs", payload)
            action = "updated"
        except SystemExit as exc:
            if "Coolify HTTP 404" not in str(exc):
                raise
            resp = self.request("POST", f"/applications/{uuid}/envs", payload)
            action = "created"
        return {"action": action, "key": key, "preview": preview, "uuid": resp.get("uuid") if isinstance(resp, dict) else None}


def print_json(data: Any) -> None:
    print(json.dumps(redact(data), ensure_ascii=False, indent=2))


def deployment_summary(dep: dict[str, Any]) -> dict[str, Any]:
    return {
        "deployment_uuid": dep.get("deployment_uuid") or dep.get("uuid"),
        "status": dep.get("status"),
        "application_name": dep.get("application_name") or dep.get("application", {}).get("name"),
        "commit": dep.get("commit"),
        "created_at": dep.get("created_at"),
        "finished_at": dep.get("finished_at"),
    }


def cmd_apps(client: Coolify, args: argparse.Namespace) -> None:
    apps = client.apps()
    if args.filter:
        apps = [app for app in apps if args.filter.lower() in str(app).lower()]
    print_json([
        {
            "name": app.get("name"),
            "uuid": app.get("uuid"),
            "fqdn": app.get("fqdn"),
            "git_branch": app.get("git_branch"),
            "base_directory": app.get("base_directory"),
            "build_command": app.get("build_command"),
            "start_command": app.get("start_command"),
        }
        for app in apps
    ])


def cmd_deploy(client: Coolify, args: argparse.Namespace) -> None:
    deployment_uuids: list[str] = []
    for app in args.apps:
        deployment_uuids.extend(client.deploy(app, args.force))
    print_json({"queued": deployment_uuids})
    if args.wait:
        final = client.wait(deployment_uuids, timeout=args.timeout)
        print_json([deployment_summary(dep) for dep in final])


def cmd_status(client: Coolify, args: argparse.Namespace) -> None:
    dep = client.deployment(args.deployment_uuid)
    print_json(dep if args.full else deployment_summary(dep))


def cmd_upsert_env(client: Coolify, args: argparse.Namespace) -> None:
    previews = [False, True] if args.both else [args.preview]
    print_json([client.upsert_env(args.app, args.key, args.value, preview) for preview in previews])


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Safe Coolify API helper")
    sub = parser.add_subparsers(dest="command", required=True)

    apps = sub.add_parser("apps", help="List applications without secrets")
    apps.add_argument("--filter", default="")
    apps.set_defaults(func=cmd_apps)

    deploy = sub.add_parser("deploy", help="Queue deployments")
    deploy.add_argument("apps", nargs="+", help="App name/uuid or COOLIFY_APP_ALIASES key")
    deploy.add_argument("--force", action="store_true")
    deploy.add_argument("--wait", action="store_true")
    deploy.add_argument("--timeout", type=int, default=900)
    deploy.set_defaults(func=cmd_deploy)

    status = sub.add_parser("status", help="Read deployment status/logs")
    status.add_argument("deployment_uuid")
    status.add_argument("--full", action="store_true", help="Print full redacted Coolify payload")
    status.set_defaults(func=cmd_status)

    env = sub.add_parser("upsert-env", help="Create or update one application env var")
    env.add_argument("app")
    env.add_argument("key")
    env.add_argument("value")
    env.add_argument("--preview", action="store_true")
    env.add_argument("--both", action="store_true")
    env.set_defaults(func=cmd_upsert_env)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    client = Coolify()
    args.func(client, args)


if __name__ == "__main__":
    main()
