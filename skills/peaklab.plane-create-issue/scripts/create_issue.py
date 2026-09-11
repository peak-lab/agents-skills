#!/usr/bin/env python3
"""Validate and create at most one Plane work item for a request ID."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import secrets
import sys
import urllib.error
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID


PLANE_API_DIR = Path(__file__).resolve().parents[2] / "peaklab.plane-api"
sys.path.insert(0, str(PLANE_API_DIR))

from plane_client import PlaneConfigError, load_plane_client  # noqa: E402


VALID_PRIORITIES = {"none", "urgent", "high", "medium", "low"}
ALLOWED_FIELDS = {
    "name",
    "description_html",
    "state",
    "assignees",
    "priority",
    "labels",
    "parent",
    "estimate_point",
    "type",
    "module",
    "start_date",
    "target_date",
}
ID_FIELDS = {"state", "parent", "type", "module"}
ID_LIST_FIELDS = {"assignees", "labels"}
DATE_FIELDS = {"start_date", "target_date"}
COLLECTIONS = ("work-items", "issues")
REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,128}$")
STATE_HOME = Path(os.environ.get("XDG_STATE_HOME", Path.home() / ".local/state"))
DEFAULT_ATTEMPT_DIR = STATE_HOME / "plane-create-issue/attempts"


class PayloadError(ValueError):
    """Raised when a work-item payload is invalid."""


class CollectionDiscoveryError(RuntimeError):
    """Raised when no supported Plane work-item collection is available."""


class AttemptStateError(RuntimeError):
    """Raised when a request ID is already pending, uncertain, or incompatible."""


class CreationRejectedError(RuntimeError):
    """Raised when Plane deterministically rejects a creation request."""

    def __init__(self, status_code: int):
        self.status_code = status_code
        super().__init__(f"Plane rejected creation with HTTP {status_code}")


class CreationOutcomeError(RuntimeError):
    """Raised when a POST was dispatched but its outcome is uncertain."""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate and create one Plane work item from JSON."
    )
    parser.add_argument("payload", help="Path to a JSON payload, or - for stdin")
    parser.add_argument(
        "--request-id",
        help="Unique stable ID for this user request; required for creation",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate without loading config, writing attempt state, or calling Plane",
    )
    parser.add_argument(
        "--allow-legacy-issues",
        action="store_true",
        help=argparse.SUPPRESS,
    )
    return parser.parse_args()


def load_payload(path: str) -> dict[str, Any]:
    if path == "-":
        payload = json.load(sys.stdin)
    else:
        with Path(path).open(encoding="utf-8") as payload_file:
            payload = json.load(payload_file)

    if not isinstance(payload, dict):
        raise PayloadError("Payload must be a JSON object")
    return payload


def normalize_resource_id(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise PayloadError(f"Field '{field}' must be a non-empty Plane UUID string")
    normalized = value.strip()
    try:
        UUID(normalized)
    except ValueError as error:
        raise PayloadError(f"Field '{field}' must be a Plane UUID string") from error
    return normalized


def normalize_payload(payload: dict[str, Any]) -> dict[str, Any]:
    unknown = sorted(set(payload) - ALLOWED_FIELDS)
    if unknown:
        raise PayloadError(f"Unsupported field(s): {', '.join(unknown)}")

    name = payload.get("name")
    if not isinstance(name, str) or not name.strip():
        raise PayloadError("Required field 'name' must be a non-empty string")

    description = payload.get("description_html", "<p></p>")
    if not isinstance(description, str):
        raise PayloadError("Field 'description_html' must be a string")

    priority = payload.get("priority", "none")
    if not isinstance(priority, str) or priority.lower() not in VALID_PRIORITIES:
        choices = ", ".join(sorted(VALID_PRIORITIES))
        raise PayloadError(f"Field 'priority' must be one of: {choices}")

    normalized: dict[str, Any] = {
        "name": name.strip(),
        "description_html": description,
        "priority": priority.lower(),
    }

    for field in ID_FIELDS:
        value = payload.get(field)
        if value is None or value == "":
            continue
        normalized[field] = normalize_resource_id(value, field)

    for field in ID_LIST_FIELDS:
        value = payload.get(field)
        if value is None:
            continue
        if not isinstance(value, list):
            raise PayloadError(f"Field '{field}' must be an array of Plane UUIDs")
        normalized[field] = [normalize_resource_id(item, field) for item in value]

    estimate = payload.get("estimate_point")
    if estimate is not None:
        if isinstance(estimate, str) and re.fullmatch(r"[0-7]", estimate):
            estimate = int(estimate)
        if isinstance(estimate, bool) or not isinstance(estimate, int) or not 0 <= estimate <= 7:
            raise PayloadError("Field 'estimate_point' must be an integer from 0 to 7")
        normalized["estimate_point"] = estimate

    for field in DATE_FIELDS:
        value = payload.get(field)
        if value is None or value == "":
            continue
        if not isinstance(value, str):
            raise PayloadError(f"Field '{field}' must use YYYY-MM-DD")
        try:
            parsed = date.fromisoformat(value)
        except ValueError as error:
            raise PayloadError(f"Field '{field}' must use YYYY-MM-DD") from error
        if parsed.isoformat() != value:
            raise PayloadError(f"Field '{field}' must use YYYY-MM-DD")
        normalized[field] = value

    return normalized


def validate_result(result: Any) -> dict[str, Any]:
    if not isinstance(result, dict):
        raise CreationOutcomeError(
            "Plane returned an invalid creation response; do not retry automatically"
        )

    issue_id = result.get("id")
    sequence_id = result.get("sequence_id")
    try:
        valid_issue_id = isinstance(issue_id, str) and bool(issue_id.strip()) and bool(UUID(issue_id))
    except ValueError:
        valid_issue_id = False

    valid_sequence = (
        isinstance(sequence_id, int)
        and not isinstance(sequence_id, bool)
        and sequence_id > 0
    )
    if not valid_issue_id or not valid_sequence:
        raise CreationOutcomeError(
            "Plane returned an incomplete creation response; do not retry automatically"
        )
    return result


def collection_path(client: Any, collection: str) -> str:
    return f"{client.project.path}/{collection}/"


def discover_collection(client: Any, allow_legacy: bool = False) -> str:
    work_items_path = f"{collection_path(client, 'work-items')}?limit=1&per_page=1"
    try:
        client.request("GET", work_items_path)
        return "work-items"
    except urllib.error.HTTPError as error:
        if error.code not in {404, 405}:
            raise

    legacy_path = f"{collection_path(client, 'issues')}?limit=1&per_page=1"
    try:
        client.request("GET", legacy_path)
    except urllib.error.HTTPError as error:
        if error.code in {404, 405}:
            raise CollectionDiscoveryError(
                "Plane exposes neither /work-items/ nor /issues/"
            ) from error
        raise
    return "issues"


def create_once(client: Any, collection: str, payload: dict[str, Any]) -> dict[str, Any]:
    try:
        result = client.request("POST", collection_path(client, collection), payload)
    except urllib.error.HTTPError as error:
        if 400 <= error.code < 500:
            raise CreationRejectedError(error.code) from error
        raise CreationOutcomeError(
            "Plane creation outcome is uncertain; do not retry automatically"
        ) from error
    except Exception as error:
        raise CreationOutcomeError(
            "Plane creation outcome is uncertain; do not retry automatically"
        ) from error
    return validate_result(result)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def payload_digest(payload: dict[str, Any]) -> str:
    encoded = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


class AttemptStore:
    """Atomic request receipt store that blocks concurrent or repeated POSTs."""

    def __init__(self, root: Path | None = None):
        self.root = Path(root or DEFAULT_ATTEMPT_DIR)

    def _ensure_root(self) -> None:
        self.root.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(self.root, 0o700)

    def _path(self, project: Any, request_id: str) -> Path:
        if not isinstance(request_id, str) or not REQUEST_ID_RE.fullmatch(request_id):
            raise AttemptStateError(
                "Request ID must use 1-128 letters, numbers, dots, colons, underscores, or hyphens"
            )
        identity = "\0".join(
            (project.host, project.workspace, project.project_id, request_id)
        )
        key = hashlib.sha256(identity.encode("utf-8")).hexdigest()
        return self.root / f"{key}.json"

    def acquire(
        self,
        project: Any,
        request_id: str,
        payload: dict[str, Any],
    ) -> tuple[Path, dict[str, Any] | None]:
        self._ensure_root()
        path = self._path(project, request_id)
        digest = payload_digest(payload)
        record = {
            "version": 1,
            "status": "pending",
            "request_id": request_id,
            "project": {
                "host": project.host,
                "workspace": project.workspace,
                "project_id": project.project_id,
            },
            "payload_sha256": digest,
            "started_at": utc_now(),
        }

        try:
            descriptor = os.open(
                path,
                os.O_WRONLY | os.O_CREAT | os.O_EXCL,
                0o600,
            )
        except FileExistsError:
            existing = self._read(path)
            if existing.get("payload_sha256") != digest:
                raise AttemptStateError(
                    "Request ID already exists with a different payload"
                )
            if existing.get("status") == "created":
                if (
                    existing.get("collection") not in COLLECTIONS
                    or not isinstance(existing.get("result"), dict)
                ):
                    raise AttemptStateError("Created attempt receipt is invalid")
                return path, existing
            status = existing.get("status", "invalid")
            raise AttemptStateError(
                f"Request ID is already {status}; reconcile it before any retry"
            )

        with os.fdopen(descriptor, "w", encoding="utf-8") as attempt_file:
            json.dump(record, attempt_file, ensure_ascii=False, indent=2)
            attempt_file.flush()
            os.fsync(attempt_file.fileno())
        self._sync_directory()
        return path, None

    def _read(self, path: Path) -> dict[str, Any]:
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise AttemptStateError(
                f"Attempt receipt is unreadable: {path}"
            ) from error
        if not isinstance(record, dict):
            raise AttemptStateError(f"Attempt receipt is invalid: {path}")
        return record

    def _update(self, path: Path, **values: Any) -> None:
        record = self._read(path)
        record.update(values)
        temporary = path.with_name(
            f".{path.name}.{os.getpid()}.{secrets.token_hex(4)}.tmp"
        )
        try:
            descriptor = os.open(
                temporary,
                os.O_WRONLY | os.O_CREAT | os.O_EXCL,
                0o600,
            )
            with os.fdopen(descriptor, "w", encoding="utf-8") as attempt_file:
                json.dump(record, attempt_file, ensure_ascii=False, indent=2)
                attempt_file.flush()
                os.fsync(attempt_file.fileno())
            os.replace(temporary, path)
            self._sync_directory()
        finally:
            temporary.unlink(missing_ok=True)

    def _sync_directory(self) -> None:
        flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0)
        descriptor = os.open(self.root, flags)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)

    def mark_created(
        self,
        path: Path,
        collection: str,
        result: dict[str, Any],
    ) -> None:
        self._update(
            path,
            status="created",
            collection=collection,
            result=result,
            completed_at=utc_now(),
        )

    def mark_rejected(self, path: Path, status_code: int) -> None:
        self._update(
            path,
            status="rejected",
            http_status=status_code,
            completed_at=utc_now(),
        )

    def mark_uncertain(self, path: Path, error: Exception) -> None:
        self._update(
            path,
            status="uncertain",
            error_type=type(error).__name__,
            completed_at=utc_now(),
        )


def run_creation(
    client: Any,
    payload: dict[str, Any],
    request_id: str,
    attempt_store: AttemptStore,
    allow_legacy: bool = False,
) -> tuple[str, dict[str, Any], bool]:
    collection = discover_collection(client, allow_legacy=allow_legacy)
    attempt_path, existing = attempt_store.acquire(
        client.project,
        request_id,
        payload,
    )
    if existing is not None:
        return (
            existing["collection"],
            validate_result(existing["result"]),
            True,
        )

    try:
        result = create_once(client, collection, payload)
    except CreationRejectedError as error:
        try:
            attempt_store.mark_rejected(attempt_path, error.status_code)
        except Exception:
            pass
        raise
    except CreationOutcomeError as error:
        try:
            attempt_store.mark_uncertain(attempt_path, error)
        except Exception:
            pass
        raise

    try:
        attempt_store.mark_created(attempt_path, collection, result)
    except Exception as error:
        raise CreationOutcomeError(
            "Plane created the work item but its receipt could not be persisted; do not retry"
        ) from error
    return collection, result, False


def project_prefix(client: Any) -> str:
    try:
        project = client.request("GET", f"{client.project.path}/")
    except Exception:
        return ""
    return project.get("identifier", "") if isinstance(project, dict) else ""


def print_result(
    client: Any,
    collection: str,
    result: dict[str, Any],
    replayed: bool,
) -> None:
    issue_id = result["id"]
    print("CREATED=1")
    print(f"REPLAYED={int(replayed)}")
    print(f"COLLECTION={collection}")
    print(f"PREFIX={project_prefix(client)}")
    print(f"SEQ_ID={result['sequence_id']}")
    print(f"ISSUE_ID={issue_id}")
    print(f"URL={client.project.issue_url(issue_id)}")


def main() -> int:
    args = parse_args()

    try:
        payload = normalize_payload(load_payload(args.payload))
    except (OSError, json.JSONDecodeError, PayloadError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2

    if args.dry_run:
        print("VALID=1")
        print(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True))
        return 0

    if not args.request_id:
        print("ERROR: --request-id is required for creation", file=sys.stderr)
        return 2

    try:
        client = load_plane_client()
    except PlaneConfigError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 3

    try:
        collection, result, replayed = run_creation(
            client,
            payload,
            args.request_id,
            AttemptStore(),
            allow_legacy=args.allow_legacy_issues,
        )
    except (
        CollectionDiscoveryError,
        urllib.error.HTTPError,
        urllib.error.URLError,
        TimeoutError,
        json.JSONDecodeError,
        UnicodeDecodeError,
        OSError,
    ) as error:
        print(f"ERROR: Plane collection discovery failed before creation: {error}", file=sys.stderr)
        return 4
    except CreationRejectedError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        print(
            "No work item was created by this rejected request. Correct the payload and use a new request ID.",
            file=sys.stderr,
        )
        return 6
    except CreationOutcomeError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 5
    except AttemptStateError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 7

    print_result(client, collection, result, replayed)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
