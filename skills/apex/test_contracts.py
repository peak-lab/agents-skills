"""Static guards for APEX's written workflow contracts, not an agent-runtime test."""

import unittest
from pathlib import Path

ROOT = Path(__file__).parent


def read(relative_path: str) -> str:
    return (ROOT / relative_path).read_text()


class ApexContractTests(unittest.TestCase):
    def test_reused_non_auto_plan_requires_matching_approval_revision(self):
        initialization = read("steps/step-00-init.md")
        planning = read("steps/step-02-plan.md")

        self.assertIn("{approved_plan_revision}", initialization)
        self.assertIn("requires approval for its current revision", initialization)
        self.assertIn("return `needs_confirmation`", planning)
        self.assertIn("Any plan amendment invalidates approval", planning)

    def test_material_plan_changes_reenter_revision_gate_before_more_edits(self):
        execution = read("steps/step-03-execute.md")
        resolution = read("steps/step-06-resolve.md")

        for contract in (execution, resolution):
            self.assertIn("recompute `{plan_revision}`", contract)
            self.assertIn("before further edits", contract)
            self.assertIn("`needs_confirmation`", contract)

    def test_no_test_dominates_every_test_phase(self):
        skill = read("SKILL.md")
        planning = read("steps/step-02-plan.md")
        execution = read("steps/step-03-execute.md")
        team_execution = read("steps/step-03-execute-teams.md")
        legacy_tests = read("steps/step-07-tests.md") + read(
            "steps/step-08-run-tests.md"
        )

        self.assertIn("`-T` dominates", skill)
        self.assertIn("tests disabled (`-T`)", planning)
        self.assertIn("If tests are disabled, do not create or modify tests", execution)
        self.assertIn(
            "When tests are disabled, explicitly forbid test edits", team_execution
        )
        self.assertGreaterEqual(legacy_tests.count("If tests are disabled"), 2)

    def test_test_quality_invariants_are_kept_in_planning_and_execution(self):
        planning = read("steps/step-02-plan.md")
        execution = read("steps/step-03-execute.md")

        for contract in (planning, execution):
            self.assertIn("public observable seam", contract)
            self.assertIn("independently of production logic", contract)
            self.assertIn("genuine external boundaries", contract)

    def test_legacy_resume_is_exact_then_unique_prefix_and_fails_closed(self):
        initialization = read("steps/step-00-init.md")
        finishing = read("steps/step-09-finish.md")

        self.assertIn("Prefer an exact modern task", initialization)
        self.assertIn("Resume only one unique prefix match", initialization)
        self.assertIn("If several match", initialization)
        self.assertIn("If none match", initialization)
        self.assertIn("{resume_lookup_failed}=true", finishing)


if __name__ == "__main__":
    unittest.main()
