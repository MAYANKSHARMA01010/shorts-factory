"""Tests for facts-mode script generation (ShortGPT FactsShortEngine technique)."""
from __future__ import annotations

import json
import unittest

from clippilot.generate import script
from clippilot.profiles import Profile


class TestFactsMode(unittest.TestCase):
    def test_fallback_lists_n_numbered_facts(self):
        r = script.generate_script("the moon", mode="facts", facts_count=4)
        self.assertTrue(r.get("_fallback"))
        self.assertTrue(all(f"Number {i}" in r["script"] for i in range(1, 5)))
        self.assertIn("4 facts about the moon", r["title"])

    def test_llm_output_parsed(self):
        mock = lambda p: json.dumps({"title": "T", "script": "a. b. c. Follow."})  # noqa: E731
        r = script.generate_script("x", generate_fn=mock, mode="facts", facts_count=3)
        self.assertIsNone(r.get("_fallback"))
        self.assertEqual(r["title"], "T")

    def test_bad_llm_output_falls_back(self):
        r = script.generate_script("x", generate_fn=lambda p: "not json", mode="facts", facts_count=2)
        self.assertTrue(r.get("_fallback"))

    def test_prompt_states_exact_count(self):
        self.assertIn("exactly 6", script.build_facts_prompt("x", 6))

    def test_standard_mode_unchanged(self):
        r = script.generate_script("x", mode="standard")
        self.assertNotIn("Number 1", r["script"])  # not a facts list

    def test_profile_carries_mode(self):
        pr = Profile.from_dict(Profile(name="z", mode="facts", facts_count=7).to_dict())
        self.assertEqual((pr.mode, pr.facts_count), ("facts", 7))

    def test_core_subject_strips_facts_framing(self):
        self.assertEqual(script._core_subject("3 mind-blowing facts about octopuses"), "octopuses")
        self.assertEqual(script._core_subject("5 facts about the ocean"), "the ocean")
        self.assertEqual(script._core_subject("octopuses"), "octopuses")  # plain topic unchanged

    def test_facts_topic_not_recursive(self):
        # "N facts about X" topic must not become "N things about N facts about X"
        r = script.generate_script("4 facts about volcanoes", mode="facts", facts_count=4)
        self.assertIn("volcanoes", r["script"])
        self.assertNotIn("facts about 4", r["script"].lower())
        self.assertEqual(r["title"], "4 facts about volcanoes")


if __name__ == "__main__":
    unittest.main(verbosity=2)
