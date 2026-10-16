#!/usr/bin/env python3
"""Non-networked tests for the Plane Intake idea helper."""

from __future__ import annotations

import argparse
import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

import intake_idea


class FakeProject:
    host = "plane.example"
    workspace = "acme"
    project_id = "proj"
    path = "/workspaces/acme/projects/proj"


class FakeClient:
    def __init__(self, labels=None, intake=None):
        self.project = FakeProject()
        self.labels = labels or [{"id": "l1", "name": "source/interne"}]
        self.intake = intake or []
        self.calls = []

    def results(self, path):
        if path.endswith("/labels/"):
            return list(self.labels)
        if path.endswith("/intake-issues/"):
            return list(self.intake)
        raise AssertionError(path)

    def request(self, method, path, data=None):
        self.calls.append((method, path, data))
        if method == "GET":
            return {"identifier": "ACME"}
        if method == "POST" and path.endswith("/labels/"):
            label = {"id": f"l{len(self.labels) + 1}", "name": data["name"]}
            self.labels.append(label)
            return label
        if method == "POST" and path.endswith("/intake-issues/"):
            return {"issue": "iss", "issue_detail": {"sequence_id": 42}}
        if method == "PATCH":
            return {"labels": data["labels"]}
        raise AssertionError((method, path))


def run(func, args, client):
    out = io.StringIO()
    with redirect_stdout(out):
        code = func(args, client)
    return code, [json.loads(line) for line in out.getvalue().splitlines()]


class CreateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.html = Path(self.tmp.name) / "idea.html"
        self.html.write_text("<p>idea</p>", encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def args(self, **kw):
        base = {"title": "Better export", "html_file": str(self.html), "labels": "", "dry_run": False}
        base.update(kw)
        return argparse.Namespace(**base)

    def test_prefixes_title_once_and_creates_pending_entry(self):
        client = FakeClient()
        code, [result] = run(intake_idea.create, self.args(title="[Idée] Better export"), client)
        self.assertEqual(code, 0)
        self.assertEqual(result["title"], "[Idée] Better export")
        self.assertEqual(result["id"], "ACME-42")
        post = next(c for c in client.calls if c[1].endswith("/intake-issues/"))
        self.assertEqual(post[2]["issue"]["priority"], "none")

    def test_labels_go_through_work_items_and_missing_label_is_created(self):
        client = FakeClient()
        _, [result] = run(intake_idea.create, self.args(labels="source/interne, alice-feedback-1009"), client)
        patch_call = next(c for c in client.calls if c[0] == "PATCH")
        self.assertEqual(patch_call[1], f"{FakeProject.path}/work-items/iss/")
        self.assertEqual(result["labels"], ["source/interne", "alice-feedback-1009"])

    def test_dry_run_does_not_touch_plane(self):
        client = FakeClient()
        code, [result] = run(intake_idea.create, self.args(dry_run=True, labels="a"), client)
        self.assertEqual(code, 0)
        self.assertEqual(result["labels"], ["a"])
        self.assertEqual(client.calls, [])


class ListTests(unittest.TestCase):
    def entry(self, name, status=-2, labels=()):
        return {"issue": name, "status": status,
                "issue_detail": {"name": name, "sequence_id": 1, "label_ids": list(labels)}}

    def test_keeps_only_pending_ideas_with_label(self):
        client = FakeClient(intake=[
            self.entry("[Idée] kept", labels=["l1"]),
            self.entry("[Idée] other label"),
            self.entry("[Idée] accepted", status=1, labels=["l1"]),
            self.entry("[Problème] customer form", labels=["l1"]),
        ])
        args = argparse.Namespace(label="source/interne", all_states=False)
        code, results = run(intake_idea.list_ideas, args, client)
        self.assertEqual(code, 0)
        self.assertEqual([r["title"] for r in results], ["[Idée] kept"])

    def test_unknown_label_fails(self):
        args = argparse.Namespace(label="missing", all_states=False)
        with redirect_stdout(io.StringIO()):
            self.assertEqual(intake_idea.list_ideas(args, FakeClient()), 1)


if __name__ == "__main__":
    unittest.main()
