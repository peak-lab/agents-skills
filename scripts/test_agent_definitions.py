from __future__ import annotations

import html
import re
import tomllib
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CLAUDE = ROOT / "agents" / "claude"
CODEX = ROOT / "agents" / "codex"
INTENT_PATTERN = re.compile(r"intent: (deep|standard)")
ROUTING_PATTERN = re.compile(r"<routing_intent>(deep|standard)</routing_intent>")
EXPECTED = {
    "code-reviewer": ("deep", "opus", "high", "gpt-5.6-sol", "high"),
    "issue-resolver": ("deep", "opus", "high", "gpt-5.6-sol", "high"),
    "issue-resolver-deep": ("deep", "opus", "high", "gpt-5.6-sol", "high"),
    "issue-qa-reviewer": ("deep", "opus", "high", "gpt-5.6-sol", "high"),
    "issue-ship-watcher": ("standard", "sonnet", "medium", "gpt-5.6-terra", "medium"),
    "plane-epic-planner": ("deep", "opus", "high", "gpt-5.6-sol", "high"),
    "plane-issue-worker": ("standard", "sonnet", "medium", "gpt-5.6-terra", "medium"),
    "plane-ship-watcher": ("standard", "sonnet", "medium", "gpt-5.6-terra", "medium"),
    "plane-story-planner": ("deep", "opus", "high", "gpt-5.6-sol", "high"),
    "implementer": ("standard", "sonnet", "medium", "gpt-5.6-terra", "medium"),
}


def claude_frontmatter(text: str) -> dict[str, str]:
    frontmatter = text.split("---", 2)[1]
    return dict(line.split(": ", 1) for line in frontmatter.strip().splitlines())


class AgentDefinitionTests(unittest.TestCase):
    def test_role_sets_and_routing_are_in_parity(self) -> None:
        self.assertEqual({path.stem for path in CLAUDE.glob("*.md")}, set(EXPECTED))
        self.assertEqual({path.stem for path in CODEX.glob("*.toml")}, set(EXPECTED))

        for name, (intent, claude_model, claude_effort, codex_model, codex_effort) in EXPECTED.items():
            claude_text = (CLAUDE / f"{name}.md").read_text(encoding="utf-8")
            claude = claude_frontmatter(claude_text)
            codex = tomllib.loads((CODEX / f"{name}.toml").read_text(encoding="utf-8"))
            self.assertEqual(claude["name"], name)
            self.assertEqual(codex["name"], name)
            self.assertEqual(claude["model"], claude_model)
            self.assertEqual(claude["effort"], claude_effort)
            self.assertEqual(codex["model"], codex_model)
            self.assertEqual(codex["model_reasoning_effort"], codex_effort)
            self.assertEqual(INTENT_PATTERN.search(claude_text).group(1), intent)
            self.assertEqual(ROUTING_PATTERN.search(codex["developer_instructions"]).group(1), intent)

    def test_every_adapter_requires_a_resolved_skill_contract(self) -> None:
        for path in [*CLAUDE.glob("*.md"), *CODEX.glob("*.toml")]:
            self.assertIn("Resolve installed", path.read_text(encoding="utf-8"), path)
            self.assertNotIn("skill://", path.read_text(encoding="utf-8"), path)
            self.assertIn("peaklab:NAME", path.read_text(encoding="utf-8"), path)

    def test_role_instructions_match_across_hosts(self) -> None:
        for name in EXPECTED:
            claude_text = (CLAUDE / f"{name}.md").read_text(encoding="utf-8")
            claude_body = claude_text.split("---", 2)[2]
            claude_body = re.sub(r"<!-- intent: .*? -->", "", claude_body)
            codex = tomllib.loads((CODEX / f"{name}.toml").read_text(encoding="utf-8"))
            codex_body = ROUTING_PATTERN.sub("", codex["developer_instructions"])
            self.assertEqual(
                " ".join(html.unescape(claude_body).replace("`", "").split()),
                " ".join(html.unescape(codex_body).replace("`", "").split()),
                name,
            )


if __name__ == "__main__":
    unittest.main()
