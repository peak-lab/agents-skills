#!/usr/bin/env python3
"""Validate that the public skill collection is self-contained and portable."""

from __future__ import annotations

import json
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "skill-dependencies.json"
NAME_PATTERN = re.compile(r'^name:\s*["\']?([^"\'\s]+)', re.MULTILINE)
SKILL_CALL_PATTERN = re.compile(r'Skill\(\s*["\']([^"\']+)["\']')
INSTALLED_SKILL_PATTERN = re.compile(r"~/.agents/skills/([A-Za-z0-9_.-]+)")
LEGACY_NAME_PATTERNS = (
    re.compile(r"\bpeaklab\.do-issue\b"),
    re.compile(r"\bpeaklab\.create-issue\b"),
    re.compile(r"(?<!peaklab\.)\bglitchtip-do-issue\b"),
)
MACHINE_PATH_PATTERN = re.compile(r"/(?:Users|home)/[^/\s`]+/")


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def main() -> int:
    errors: list[str] = []
    skills: dict[str, Path] = {}
    texts: dict[str, str] = {}

    for skill_file in sorted(ROOT.glob("*/SKILL.md")):
        text = skill_file.read_text(encoding="utf-8")
        match = NAME_PATTERN.search(text)
        if match is None:
            fail(errors, f"{skill_file.relative_to(ROOT)}: missing frontmatter name")
            continue
        name = match.group(1)
        if name != skill_file.parent.name:
            fail(errors, f"{skill_file.relative_to(ROOT)}: name {name!r} must match its directory")
        if name in skills:
            fail(errors, f"duplicate skill name: {name}")
        skills[name] = skill_file
        texts[name] = text

    dependencies = json.loads(MANIFEST.read_text(encoding="utf-8"))
    for caller, required in dependencies.items():
        if caller not in skills:
            fail(errors, f"dependency manifest references missing caller: {caller}")
        for dependency in required:
            if dependency not in skills:
                fail(errors, f"{caller}: missing bundled dependency {dependency}")

    declared_pairs = {(caller, dependency) for caller, required in dependencies.items() for dependency in required}
    for caller, text in texts.items():
        for dependency in SKILL_CALL_PATTERN.findall(text):
            if dependency == "name":
                continue
            if dependency not in skills:
                fail(errors, f"{caller}: Skill() invokes missing dependency {dependency}")
            elif (caller, dependency) not in declared_pairs:
                fail(errors, f"{caller}: Skill() dependency {dependency} is absent from the manifest")

        for dependency in INSTALLED_SKILL_PATTERN.findall(text):
            if dependency not in skills:
                fail(errors, f"{caller}: installed-skill path references missing dependency {dependency}")

        for legacy_pattern in LEGACY_NAME_PATTERNS:
            match = legacy_pattern.search(text)
            if match:
                fail(errors, f"{caller}: stale legacy name {match.group(0)}")
        if MACHINE_PATH_PATTERN.search(text):
            fail(errors, f"{caller}: machine-specific home path found")

    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    for name in skills:
        if f"`{name}`" not in readme:
            fail(errors, f"README does not list {name}")

    if errors:
        print("Portability check failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(f"Portability check passed: {len(skills)} skills, {len(declared_pairs)} declared dependencies")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
