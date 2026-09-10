#!/usr/bin/env python3
"""Validate that the public skill collection is self-contained and portable."""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
FRONTMATTER_PATTERN = re.compile(
    r"\A---[ \t]*\r?\n(?P<body>.*?)\r?\n---[ \t]*(?:\r?\n|\Z)", re.DOTALL
)
NAME_PATTERN = re.compile(r'^name:\s*["\']?([^"\'\s]+)', re.MULTILINE)
SKILL_CALL_PATTERN = re.compile(r'Skill\(\s*["\']([^"\']+)["\']')
INSTALLED_SKILL_PATTERN = re.compile(r"~/.agents/skills/([A-Za-z0-9_.-]+)")
EXECUTABLE_SKILL_URI_PATTERN = re.compile(
    r"(?<![\w.-])"
    r"(?:rtk[ \t]+(?:proxy[ \t]+)?)?"
    r"(?:python(?:3(?:\.\d+)?)?|bash|sh|node|bun|deno|ruby|php|perl|source)"
    r"[ \t]+(?:-[^\s`\"']+[ \t]+)*[\"']?skill://[A-Za-z0-9_.-]+(?:/[^\s`\"']*)?"
)
INLINE_LINK_PATTERN = re.compile(
    r"!?\[[^\]\n]*\]\(\s*(<[^>\n]+>|[^)\s]+)(?:\s+[^)]*)?\)"
)
REFERENCE_LINK_PATTERN = re.compile(
    r"^[ \t]{0,3}\[[^\]\n]+\]:\s*(<[^>\n]+>|\S+)", re.MULTILINE
)
INLINE_CODE_PATTERN = re.compile(r"`[^`\n]*`")
LEGACY_NAME_PATTERNS = (
    re.compile(r"\bpeaklab\.do-issue\b"),
    re.compile(r"\bpeaklab\.create-issue\b"),
    re.compile(r"(?<!peaklab\.)\bglitchtip-do-issue\b"),
)
MACHINE_PATH_PATTERN = re.compile(r"/(?:Users|home)/[^/\s`]+/")
TEXT_RESOURCE_SUFFIXES = frozenset(
    {
        ".cfg",
        ".ini",
        ".js",
        ".json",
        ".jsx",
        ".md",
        ".mjs",
        ".py",
        ".sh",
        ".toml",
        ".ts",
        ".tsx",
        ".txt",
        ".yaml",
        ".yml",
    }
)


@dataclass(frozen=True)
class ValidationError:
    code: str
    message: str
    path: Path | None = None

    def __str__(self) -> str:
        if self.path is None:
            return self.message
        return f"{self.path}: {self.message}"


def add_error(
    errors: list[ValidationError],
    code: str,
    message: str,
    path: Path | None = None,
) -> None:
    errors.append(ValidationError(code=code, message=message, path=path))


def without_fenced_code(text: str) -> str:
    lines: list[str] = []
    fence: tuple[str, int] | None = None

    for line in text.splitlines():
        stripped = line.lstrip()
        marker = re.match(r"(`{3,}|~{3,})", stripped)
        if fence is not None:
            if (
                marker
                and marker.group(1)[0] == fence[0]
                and len(marker.group(1)) >= fence[1]
            ):
                fence = None
            continue
        if marker:
            fence = (marker.group(1)[0], len(marker.group(1)))
            continue
        lines.append(line)

    return "\n".join(lines)


def markdown_link_targets(text: str) -> list[str]:
    prose = INLINE_CODE_PATTERN.sub("", without_fenced_code(text))
    targets = [match.group(1) for match in INLINE_LINK_PATTERN.finditer(prose)]
    targets.extend(match.group(1) for match in REFERENCE_LINK_PATTERN.finditer(prose))
    return targets


def frontmatter_name(text: str) -> str | None:
    frontmatter = FRONTMATTER_PATTERN.match(text)
    if frontmatter is None:
        return None
    match = NAME_PATTERN.search(frontmatter.group("body"))
    return match.group(1) if match else None


def is_placeholder(target: str) -> bool:
    return (
        target.startswith("#")
        or "$" in target
        or "{" in target
        or "}" in target
        or target in {"...", "<path>", "<url>"}
    )


def validate_local_link(
    *,
    root: Path,
    source: Path,
    owner: str | None,
    target: str,
    skills: dict[str, Path],
    declared_pairs: set[tuple[str, str]],
    errors: list[ValidationError],
) -> None:
    if is_placeholder(target):
        return
    target = target[1:-1] if target.startswith("<") and target.endswith(">") else target
    if is_placeholder(target) or target.startswith("//"):
        return

    parsed = urlsplit(target)
    if parsed.scheme and parsed.scheme != "file":
        return
    if parsed.netloc:
        return

    link_path = unquote(parsed.path)
    if not link_path:
        return

    candidate = Path(link_path)
    if not candidate.is_absolute():
        candidate = source.parent / candidate
    candidate = candidate.resolve(strict=False)
    source_path = source.relative_to(root)

    try:
        relative_target = candidate.relative_to(root)
    except ValueError:
        add_error(
            errors,
            "local-link-outside-distribution",
            f"local Markdown link escapes the distribution: {target}",
            source_path,
        )
        return

    if owner is not None:
        target_owner = relative_target.parts[0] if relative_target.parts else ""
        if target_owner not in skills:
            add_error(
                errors,
                "local-link-outside-distribution",
                f"local Markdown link targets an unbundled path: {target}",
                source_path,
            )
            return

        if target_owner != owner and (owner, target_owner) not in declared_pairs:
            add_error(
                errors,
                "cross-skill-dependency-missing",
                f"link to {target_owner} requires a direct dependency declaration",
                source_path,
            )

    if not candidate.exists():
        add_error(
            errors,
            "local-link-missing",
            f"local Markdown link target does not exist: {target}",
            source_path,
        )


def validate(root: Path) -> list[ValidationError]:
    root = root.resolve()
    manifest = root / "skill-dependencies.json"
    errors: list[ValidationError] = []
    skills: dict[str, Path] = {}

    for skill_file in sorted(root.glob("*/SKILL.md")):
        text = skill_file.read_text(encoding="utf-8")
        relative_skill_file = skill_file.relative_to(root)
        name = frontmatter_name(text)
        if name is None:
            add_error(
                errors,
                "skill-name-missing",
                "missing frontmatter name",
                relative_skill_file,
            )
            continue
        if name != skill_file.parent.name:
            add_error(
                errors,
                "skill-name-directory-mismatch",
                f"name {name!r} must match its directory",
                relative_skill_file,
            )
        if name in skills:
            add_error(errors, "skill-name-duplicate", f"duplicate skill name: {name}")
        skills[name] = skill_file

    dependencies = json.loads(manifest.read_text(encoding="utf-8"))
    for caller, required in dependencies.items():
        if caller not in skills:
            add_error(
                errors,
                "manifest-caller-missing",
                f"dependency manifest references missing caller: {caller}",
            )
        for dependency in required:
            if dependency not in skills:
                add_error(
                    errors,
                    "manifest-dependency-missing",
                    f"{caller}: missing bundled dependency {dependency}",
                )

    declared_pairs = {
        (caller, dependency)
        for caller, required in dependencies.items()
        for dependency in required
    }

    for owner, skill_file in skills.items():
        for markdown_file in sorted(skill_file.parent.rglob("*.md")):
            text = markdown_file.read_text(encoding="utf-8")
            relative_markdown_file = markdown_file.relative_to(root)

            for dependency in SKILL_CALL_PATTERN.findall(text):
                if dependency == "name":
                    continue
                if dependency not in skills:
                    add_error(
                        errors,
                        "skill-call-target-missing",
                        f"Skill() invokes missing dependency {dependency}",
                        relative_markdown_file,
                    )
                elif (owner, dependency) not in declared_pairs:
                    add_error(
                        errors,
                        "skill-call-dependency-missing",
                        f"Skill() dependency {dependency} is absent from the manifest",
                        relative_markdown_file,
                    )

            for dependency in INSTALLED_SKILL_PATTERN.findall(text):
                if dependency not in skills:
                    add_error(
                        errors,
                        "installed-skill-target-missing",
                        "installed-skill path references missing dependency "
                        f"{dependency}",
                        relative_markdown_file,
                    )
                elif dependency != owner and (owner, dependency) not in declared_pairs:
                    add_error(
                        errors,
                        "installed-skill-dependency-missing",
                        f"installed-skill dependency {dependency} is absent from the manifest",
                        relative_markdown_file,
                    )

            if EXECUTABLE_SKILL_URI_PATTERN.search(text):
                add_error(
                    errors,
                    "executable-skill-uri",
                    "skill:// URI is passed directly to a command instead of a resolved path",
                    relative_markdown_file,
                )

            for legacy_pattern in LEGACY_NAME_PATTERNS:
                match = legacy_pattern.search(text)
                if match:
                    add_error(
                        errors,
                        "legacy-skill-name",
                        f"stale legacy name {match.group(0)}",
                        relative_markdown_file,
                    )
            for target in markdown_link_targets(text):
                validate_local_link(
                    root=root,
                    source=markdown_file,
                    owner=owner,
                    target=target,
                    skills=skills,
                    declared_pairs=declared_pairs,
                    errors=errors,
                )

        for resource in sorted(skill_file.parent.rglob("*")):
            if not resource.is_file() or resource.suffix.lower() not in TEXT_RESOURCE_SUFFIXES:
                continue
            text = resource.read_text(encoding="utf-8")
            if MACHINE_PATH_PATTERN.search(text):
                add_error(
                    errors,
                    "machine-specific-home",
                    "machine-specific home path found",
                    resource.relative_to(root),
                )

    readme_path = root / "README.md"
    readme = readme_path.read_text(encoding="utf-8")
    for name in skills:
        if f"`{name}`" not in readme:
            add_error(
                errors,
                "readme-skill-missing",
                f"README does not list {name}",
                Path("README.md"),
            )

    documentation = [readme_path]
    docs_dir = root / "docs"
    if docs_dir.is_dir():
        documentation.extend(sorted(docs_dir.rglob("*.md")))
    for document in documentation:
        text = document.read_text(encoding="utf-8")
        relative_document = document.relative_to(root)
        if MACHINE_PATH_PATTERN.search(text):
            add_error(
                errors,
                "machine-specific-home",
                "machine-specific home path found",
                relative_document,
            )
        for target in markdown_link_targets(text):
            validate_local_link(
                root=root,
                source=document,
                owner=None,
                target=target,
                skills=skills,
                declared_pairs=declared_pairs,
                errors=errors,
            )

    return errors


def main() -> int:
    errors = validate(ROOT)

    if errors:
        print("Portability check failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    skill_count = len(tuple(ROOT.glob("*/SKILL.md")))
    dependencies = json.loads(
        (ROOT / "skill-dependencies.json").read_text(encoding="utf-8")
    )
    dependency_count = sum(len(required) for required in dependencies.values())
    print(
        f"Portability check passed: {skill_count} skills, "
        f"{dependency_count} declared dependencies"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
