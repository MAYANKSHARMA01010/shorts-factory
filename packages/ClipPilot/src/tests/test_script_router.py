"""Tests for the multi-intent script router (ViMax script_planner parity)."""
from __future__ import annotations

import json
import unittest

from clippilot.generate import script as S


class TestClassifyIntent(unittest.TestCase):
    def test_heuristic_motion(self):
        self.assertEqual(S.classify_intent("how to bake sourdough"), "motion")
        self.assertEqual(S.classify_intent("5 ways to save money"), "motion")

    def test_heuristic_narrative(self):
        self.assertEqual(S.classify_intent("the story of a man who built a boat"), "narrative")

    def test_heuristic_default_montage(self):
        self.assertEqual(S.classify_intent("the northern lights"), "montage")

    def test_claude_classification(self):
        self.assertEqual(S.classify_intent("x", generate_fn=lambda p: "  MOTION  "), "motion")

    def test_claude_garbage_falls_back_to_heuristic(self):
        self.assertEqual(S.classify_intent("how to fish", generate_fn=lambda p: "???"), "motion")


class TestIntentScripts(unittest.TestCase):
    def _mock(self):
        return lambda p: json.dumps({"title": "T", "script": "Hook. A point. Follow."})

    def test_each_mode_generates(self):
        for m in ("narrative", "motion", "montage"):
            r = S.generate_script("the deep ocean", generate_fn=self._mock(), mode=m)
            self.assertIsNone(r.get("_fallback"))
            self.assertEqual(r["title"], "T")

    def test_auto_classifies_then_generates(self):
        r = S.generate_script("how to fish", generate_fn=self._mock(), mode="auto")
        self.assertEqual(r["title"], "T")

    def test_intent_prompts_distinct(self):
        self.assertIn("STORY-DRIVEN", S.build_intent_prompt("x", "narrative"))
        self.assertIn("KINETIC", S.build_intent_prompt("x", "motion"))
        self.assertIn("EVOCATIVE", S.build_intent_prompt("x", "montage"))

    def test_unknown_intent_no_generator_falls_back(self):
        r = S.generate_script("x", generate_fn=None, mode="montage")
        self.assertTrue(r.get("_fallback"))             # template fallback without a key


if __name__ == "__main__":
    unittest.main(verbosity=2)
