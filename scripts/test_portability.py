import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import check_portability  # noqa: E402


class PortabilityFixture:
    def __init__(self, root: Path):
        self.root = root
        self.dependencies: dict[str, list[str]] = {}
        self.skills: list[str] = []
        self.readme_extra = ""

    def add_skill(
        self,
        name: str,
        body: str = "",
        resources: dict[str, str] | None = None,
    ) -> None:
        skill_dir = self.root / name
        skill_dir.mkdir(parents=True)
        (skill_dir / "SKILL.md").write_text(
            f"---\nname: {name}\n---\n\n{body}\n",
            encoding="utf-8",
        )
        for relative_path, content in (resources or {}).items():
            resource = skill_dir / relative_path
            resource.parent.mkdir(parents=True, exist_ok=True)
            resource.write_text(content, encoding="utf-8")
        self.skills.append(name)

    def validate(self) -> list[check_portability.ValidationError]:
        (self.root / "skill-dependencies.json").write_text(
            json.dumps(self.dependencies),
            encoding="utf-8",
        )
        (self.root / "README.md").write_text(
            "\n".join(
                [*(f"`{name}`" for name in self.skills), self.readme_extra]
            ),
            encoding="utf-8",
        )
        return check_portability.validate(self.root)


class RecursiveResourceValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.fixture = PortabilityFixture(Path(self.temp_dir.name))

    def tearDown(self):
        self.temp_dir.cleanup()

    def error_codes(self) -> set[str]:
        return {error.code for error in self.fixture.validate()}

    def test_detects_missing_link_from_nested_resource(self):
        self.fixture.add_skill(
            "caller",
            "Read [the guide](references/guide.md).",
            {"references/guide.md": "Continue with [details](missing.md)."},
        )

        self.assertIn("local-link-missing", self.error_codes())

    def test_detects_undeclared_cross_skill_link_from_nested_resource(self):
        self.fixture.add_skill(
            "caller",
            "Read [the guide](references/guide.md).",
            {
                "references/guide.md": (
                    "Use [the shared contract](../../dependency/references/shared.md)."
                )
            },
        )
        self.fixture.add_skill(
            "dependency",
            resources={"references/shared.md": "Shared contract."},
        )

        self.assertIn("cross-skill-dependency-missing", self.error_codes())

    def test_accepts_valid_composed_bundle_with_direct_dependency(self):
        self.fixture.add_skill(
            "caller",
            "Read [the guide](references/guide.md).",
            {
                "references/guide.md": (
                    "Use [the shared contract](../../dependency/references/shared.md)."
                )
            },
        )
        self.fixture.add_skill(
            "dependency",
            resources={"references/shared.md": "Shared contract."},
        )
        self.fixture.dependencies["caller"] = ["dependency"]

        self.assertEqual(self.fixture.validate(), [])

    def test_detects_undeclared_installed_skill_path(self):
        self.fixture.add_skill(
            "caller",
            "Read `~/.agents/skills/dependency/references/shared.md`.",
        )
        self.fixture.add_skill("dependency")

        self.assertIn("installed-skill-dependency-missing", self.error_codes())

    def test_accepts_declared_installed_skill_path(self):
        self.fixture.add_skill(
            "caller",
            "Read `~/.agents/skills/dependency/references/shared.md`.",
        )
        self.fixture.add_skill("dependency")
        self.fixture.dependencies["caller"] = ["dependency"]

        self.assertEqual(self.fixture.validate(), [])

    def test_rejects_executing_skill_uri_as_a_path(self):
        self.fixture.add_skill(
            "caller",
            'Run `rtk python3 "skill://caller/scripts/helper.py" --check`.',
        )

        self.assertIn("executable-skill-uri", self.error_codes())

    def test_accepts_executing_a_resolved_skill_path(self):
        self.fixture.add_skill(
            "caller",
            'Resolve the resource first, then run `python3 "$SKILL_DIR/scripts/helper.py"`.',
        )

        self.assertEqual(self.fixture.validate(), [])

    def test_accepts_non_executable_skill_uri_mention(self):
        self.fixture.add_skill(
            "caller",
            "The URI `skill://caller/scripts/helper.py` identifies a resource to resolve.",
        )

        self.assertEqual(self.fixture.validate(), [])

    def test_accepts_same_skill_resource_links(self):
        self.fixture.add_skill(
            "caller",
            "Read [the guide](references/guide.md).",
            {
                "references/guide.md": "Read [more](nested/more.md#section).",
                "references/nested/more.md": "## Section",
            },
        )

        self.assertEqual(self.fixture.validate(), [])

    def test_ignores_external_anchor_placeholder_and_example_links(self):
        self.fixture.add_skill(
            "caller",
            "\n".join(
                (
                    "[External](https://example.com/docs)",
                    "[Anchor](#section)",
                    "![Runtime image]($IMAGE_URL)",
                    "[Placeholder](<path>)",
                    "```markdown",
                    "[Example only](references/not-a-real-file.md)",
                    "```",
                )
            ),
        )

        self.assertEqual(self.fixture.validate(), [])

    def test_detects_machine_specific_path_in_nested_resource(self):
        self.fixture.add_skill(
            "caller",
            "Read [the guide](references/guide.md).",
            {"references/guide.md": "Open `/Users/alice/private/config.json`."},
        )

        errors = self.fixture.validate()

        self.assertIn("machine-specific-home", {error.code for error in errors})
        self.assertTrue(
            any(error.path == Path("caller/references/guide.md") for error in errors)
        )

    def test_detects_machine_specific_path_in_python_helper(self):
        self.fixture.add_skill(
            "caller",
            resources={"scripts/helper.py": "ROOT = '/Users/alice/private'"},
        )

        errors = self.fixture.validate()

        self.assertIn("machine-specific-home", {error.code for error in errors})
        self.assertTrue(
            any(error.path == Path("caller/scripts/helper.py") for error in errors)
        )

    def test_detects_missing_link_from_readme(self):
        self.fixture.add_skill("caller")
        self.fixture.readme_extra = "[Missing guide](docs/missing.md)"

        self.assertIn("local-link-missing", self.error_codes())

    def test_accepts_document_link_to_bundled_repository_file(self):
        self.fixture.add_skill("caller")
        docs = self.fixture.root / "docs"
        docs.mkdir()
        (docs / "guide.md").write_text(
            "Read [the package](../caller/SKILL.md).",
            encoding="utf-8",
        )
        self.fixture.readme_extra = "[Team guide](docs/guide.md)"

        self.assertEqual(self.fixture.validate(), [])

    def test_rejects_link_that_escapes_the_distribution(self):
        outside = (
            Path(self.temp_dir.name).parent
            / f"{Path(self.temp_dir.name).name}-outside.md"
        )
        outside.write_text("Outside.", encoding="utf-8")
        self.addCleanup(outside.unlink, missing_ok=True)
        self.fixture.add_skill("caller", f"[Outside](../../{outside.name})")

        self.assertIn("local-link-outside-distribution", self.error_codes())

    def test_requires_name_in_bounded_frontmatter(self):
        skill_dir = self.fixture.root / "caller"
        skill_dir.mkdir()
        (skill_dir / "SKILL.md").write_text(
            "# Invalid skill\n\nname: caller\n",
            encoding="utf-8",
        )
        self.fixture.skills.append("caller")

        self.assertIn("skill-name-missing", self.error_codes())


class RepositoryValidationTests(unittest.TestCase):
    def test_repository_is_a_valid_composed_bundle(self):
        root = Path(__file__).resolve().parents[1]

        self.assertEqual(check_portability.validate(root), [])


if __name__ == "__main__":
    unittest.main()
