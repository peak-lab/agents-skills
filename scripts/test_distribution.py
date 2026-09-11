"""Guard the shared catalogue and Claude plugin packaging contract."""

import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class DistributionTests(unittest.TestCase):
    def test_plugin_lists_every_claude_agent_once(self):
        plugin = json.loads((ROOT / ".claude-plugin/plugin.json").read_text())
        expected = {
            "./" + path.relative_to(ROOT).as_posix()
            for path in (ROOT / "agents/claude").glob("*.md")
        }
        self.assertTrue(expected)
        self.assertEqual(set(plugin["agents"]), expected)
        self.assertEqual(len(plugin["agents"]), len(expected))

    def test_marketplace_points_to_shared_plugin(self):
        plugin = json.loads((ROOT / ".claude-plugin/plugin.json").read_text())
        marketplace = json.loads((ROOT / ".claude-plugin/marketplace.json").read_text())
        self.assertEqual(len(marketplace["plugins"]), 1)
        self.assertEqual(marketplace["plugins"][0]["name"], plugin["name"])
        self.assertEqual(marketplace["plugins"][0]["source"], "./")
        self.assertNotIn("hooks", plugin)

    def test_only_one_skill_source_tree(self):
        self.assertFalse(list(ROOT.glob("*/SKILL.md")))
        skills = list((ROOT / "skills").glob("*/SKILL.md"))
        self.assertTrue(skills)
        plugin = json.loads((ROOT / ".claude-plugin/plugin.json").read_text())
        self.assertNotIn("skills", plugin)  # Use Claude's default skills/ discovery.


if __name__ == "__main__":
    unittest.main()
