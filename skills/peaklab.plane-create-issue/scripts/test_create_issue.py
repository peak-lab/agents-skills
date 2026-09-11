#!/usr/bin/env python3
"""Non-networked tests for the Plane work-item creation helper and skill."""

from __future__ import annotations

import json
import io
import tempfile
import unittest
import xml.etree.ElementTree as ET
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

import create_issue
from plane_client import PlaneConfigError, PlaneConfigLoader


ISSUE_ID = "11111111-1111-4111-8111-111111111111"
STATE_ID = "22222222-2222-4222-8222-222222222222"


class FakeHttpError(Exception):
    def __init__(self, code: int):
        self.code = code


class FakeProject:
    host = "plane.example"
    workspace = "acme"
    project_id = "33333333-3333-4333-8333-333333333333"
    path = f"/workspaces/{workspace}/projects/{project_id}"

    @staticmethod
    def issue_url(issue_id: str) -> str:
        return f"https://plane.example/acme/projects/project-id/issues/?issue={issue_id}"


class FakeClient:
    def __init__(
        self,
        legacy_only: bool = False,
        discovery_status: int | None = None,
        post_error: Exception | None = None,
        result: object | None = None,
    ):
        self.legacy_only = legacy_only
        self.discovery_status = discovery_status
        self.post_error = post_error
        self.result = result or {"id": ISSUE_ID, "sequence_id": 42}
        self.project = FakeProject()
        self.calls: list[tuple[str, str, object]] = []

    def request(self, method: str, path: str, data=None):
        self.calls.append((method, path, data))
        if method == "GET" and self.discovery_status is not None:
            raise FakeHttpError(self.discovery_status)
        if method == "GET" and "/work-items/" in path and self.legacy_only:
            raise FakeHttpError(404)
        if method == "POST":
            if self.post_error is not None:
                raise self.post_error
            return self.result
        return {"results": []}


class NormalizePayloadTests(unittest.TestCase):
    def test_applies_safe_defaults(self):
        self.assertEqual(
            create_issue.normalize_payload({"name": "  fix: example  "}),
            {
                "name": "fix: example",
                "description_html": "<p></p>",
                "priority": "none",
            },
        )

    def test_normalizes_ids_estimate_and_dates(self):
        payload = create_issue.normalize_payload(
            {
                "name": "Example",
                "state": STATE_ID,
                "estimate_point": "5",
                "start_date": "2026-07-13",
                "target_date": "2026-07-20",
            }
        )
        self.assertEqual(payload["state"], STATE_ID)
        self.assertEqual(payload["estimate_point"], 5)

    def test_rejects_unknown_fields(self):
        with self.assertRaisesRegex(create_issue.PayloadError, "Unsupported field"):
            create_issue.normalize_payload({"name": "Example", "cycle": "invented"})

    def test_rejects_invalid_priority(self):
        with self.assertRaisesRegex(create_issue.PayloadError, "priority"):
            create_issue.normalize_payload({"name": "Example", "priority": "critical"})

    def test_rejects_unicode_digit_estimate(self):
        with self.assertRaisesRegex(create_issue.PayloadError, "estimate_point"):
            create_issue.normalize_payload({"name": "Example", "estimate_point": "²"})

    def test_rejects_whitespace_or_non_uuid_ids(self):
        for value in ("   ", "todo"):
            with self.subTest(value=value):
                with self.assertRaisesRegex(create_issue.PayloadError, "UUID"):
                    create_issue.normalize_payload({"name": "Example", "state": value})


class ConfigIsolationTests(unittest.TestCase):
    def test_partial_local_config_cannot_exfiltrate_global_token(self):
        with tempfile.TemporaryDirectory() as cwd, tempfile.TemporaryDirectory() as home:
            Path(cwd, ".env").write_text(
                "PLANE_PROJECT=https://attacker.example/acme/projects/project-id/issues/\n",
                encoding="utf-8",
            )
            global_dir = Path(home, ".agents")
            global_dir.mkdir()
            Path(global_dir, ".env").write_text(
                "PLANE_TOKEN=global-secret\n"
                "PLANE_PROJECT=https://trusted.example/acme/projects/project-id/issues/\n",
                encoding="utf-8",
            )

            config = PlaneConfigLoader(cwd=cwd, home=home).load()

            self.assertEqual(config.token, "global-secret")
            self.assertEqual(config.project.host, "trusted.example")

    def test_split_config_without_complete_source_is_rejected(self):
        with tempfile.TemporaryDirectory() as cwd, tempfile.TemporaryDirectory() as home:
            Path(cwd, ".env").write_text(
                "PLANE_PROJECT=https://plane.example/acme/projects/project-id/issues/\n",
                encoding="utf-8",
            )
            global_dir = Path(home, ".agents")
            global_dir.mkdir()
            Path(global_dir, ".env").write_text("PLANE_TOKEN=secret\n", encoding="utf-8")

            with self.assertRaises(PlaneConfigError):
                PlaneConfigLoader(cwd=cwd, home=home).load()


class CreationTests(unittest.TestCase):
    def run_with_store(self, client: FakeClient, root: Path, request_id: str = "session-1"):
        payload = create_issue.normalize_payload({"name": "Example"})
        return create_issue.run_creation(
            client,
            payload,
            request_id,
            create_issue.AttemptStore(root),
            allow_legacy=client.legacy_only,
        )

    def test_prefers_work_items_and_replay_posts_once(self):
        with tempfile.TemporaryDirectory() as directory:
            client = FakeClient()
            first = self.run_with_store(client, Path(directory))
            second = self.run_with_store(client, Path(directory))

            self.assertEqual(first[0], "work-items")
            self.assertFalse(first[2])
            self.assertTrue(second[2])
            self.assertEqual(sum(call[0] == "POST" for call in client.calls), 1)

    def test_falls_back_to_legacy_automatically_before_single_post(self):
        with tempfile.TemporaryDirectory() as directory:
            client = FakeClient(legacy_only=True)
            with patch.object(create_issue.urllib.error, "HTTPError", FakeHttpError):
                payload = create_issue.normalize_payload({"name": "Example"})
                collection, _, _ = create_issue.run_creation(
                    client,
                    payload,
                    "session-1",
                    create_issue.AttemptStore(Path(directory)),
                )

            self.assertEqual(collection, "issues")
            self.assertEqual(sum(call[0] == "POST" for call in client.calls), 1)

    def test_auth_discovery_error_never_falls_back_or_posts(self):
        client = FakeClient(discovery_status=401)
        with patch.object(create_issue.urllib.error, "HTTPError", FakeHttpError):
            with self.assertRaises(FakeHttpError):
                create_issue.discover_collection(client)

        self.assertEqual(len(client.calls), 1)
        self.assertEqual(sum(call[0] == "POST" for call in client.calls), 0)

    def test_missing_current_and_legacy_collections_never_posts(self):
        client = FakeClient(discovery_status=404)
        with patch.object(create_issue.urllib.error, "HTTPError", FakeHttpError):
            with self.assertRaises(create_issue.CollectionDiscoveryError):
                create_issue.discover_collection(client)

        self.assertEqual(len(client.calls), 2)
        self.assertEqual(sum(call[0] == "POST" for call in client.calls), 0)

    def test_ambiguous_post_exception_is_recorded_and_blocks_replay(self):
        with tempfile.TemporaryDirectory() as directory:
            client = FakeClient(post_error=UnicodeDecodeError("utf-8", b"x", 0, 1, "bad"))
            root = Path(directory)
            with self.assertRaises(create_issue.CreationOutcomeError):
                self.run_with_store(client, root)
            with self.assertRaisesRegex(create_issue.AttemptStateError, "uncertain"):
                self.run_with_store(client, root)

            self.assertEqual(sum(call[0] == "POST" for call in client.calls), 1)

    def test_deterministic_4xx_is_recorded_and_blocks_same_request_id(self):
        with tempfile.TemporaryDirectory() as directory:
            client = FakeClient(post_error=FakeHttpError(422))
            root = Path(directory)
            with patch.object(create_issue.urllib.error, "HTTPError", FakeHttpError):
                with self.assertRaises(create_issue.CreationRejectedError):
                    self.run_with_store(client, root)
                with self.assertRaisesRegex(create_issue.AttemptStateError, "rejected"):
                    self.run_with_store(client, root)

            self.assertEqual(sum(call[0] == "POST" for call in client.calls), 1)

    def test_rejects_malformed_success_response_and_blocks_replay(self):
        with tempfile.TemporaryDirectory() as directory:
            client = FakeClient(result={"id": True, "sequence_id": False})
            root = Path(directory)
            with self.assertRaises(create_issue.CreationOutcomeError):
                self.run_with_store(client, root)
            with self.assertRaises(create_issue.AttemptStateError):
                self.run_with_store(client, root)

            self.assertEqual(sum(call[0] == "POST" for call in client.calls), 1)

    def test_concurrent_pending_attempt_blocks_second_caller(self):
        with tempfile.TemporaryDirectory() as directory:
            store = create_issue.AttemptStore(Path(directory))
            payload = create_issue.normalize_payload({"name": "Example"})
            store.acquire(FakeProject(), "session-1", payload)

            with self.assertRaisesRegex(create_issue.AttemptStateError, "pending"):
                store.acquire(FakeProject(), "session-1", payload)


class SkillStructureTests(unittest.TestCase):
    def test_skill_is_xml_routed_and_creation_is_canonical(self):
        skill_root = Path(__file__).resolve().parents[1]
        skill_text = Path(skill_root, "SKILL.md").read_text(encoding="utf-8")
        _, frontmatter, body = skill_text.split("---", 2)

        self.assertIn('name: "peaklab.plane-create-issue"', frontmatter)
        self.assertIn('Bash(rtk :*)', frontmatter)
        self.assertFalse(any(line.startswith("#") for line in body.splitlines()))
        for tag in ("objective", "quick_start", "success_criteria"):
            self.assertIn(f"<{tag}>", body)
        ET.fromstring(f"<root>{body}</root>")

        plane_api_root = skill_root.parent / "peaklab.plane-api"
        plane_api_skill = Path(plane_api_root, "SKILL.md").read_text(encoding="utf-8")
        self.assertIn("peaklab.plane-create-issue", plane_api_skill)
        self.assertFalse(Path(plane_api_root, "create_issue.py").exists())

        commands_root = skill_root.parents[1] / "commands"
        wrappers = [
            path
            for path in commands_root.glob("*.md")
            if "peaklab.plane-create-issue" in path.read_text(encoding="utf-8")
        ]
        self.assertEqual(wrappers, [])

    def test_dry_run_does_not_load_plane_config(self):
        with tempfile.TemporaryDirectory() as directory:
            payload_path = Path(directory, "payload.json")
            payload_path.write_text(json.dumps({"name": "Example"}), encoding="utf-8")
            with (
                patch.object(create_issue, "load_plane_client") as loader,
                patch.object(
                    create_issue.sys,
                    "argv",
                    ["create_issue.py", "--dry-run", str(payload_path)],
                ),
                redirect_stdout(io.StringIO()),
            ):
                self.assertEqual(create_issue.main(), 0)
            loader.assert_not_called()


if __name__ == "__main__":
    unittest.main()
