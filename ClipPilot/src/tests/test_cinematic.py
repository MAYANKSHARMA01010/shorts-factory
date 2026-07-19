"""Tests for the cinematic prompt-builder (Open-Generative-AI vocab) + its
conservative wiring into b-roll stock search (enriched-then-bare fallback)."""
from __future__ import annotations

import os
import unittest

from clippilot.generate import broll, cinematic


class TestPromptBuilder(unittest.TestCase):
    def test_prompt_has_subject_and_cinematic(self):
        p = cinematic.build_visual_prompt("a quiet forest lake", mood="calm")
        self.assertIn("a quiet forest lake", p)
        self.assertTrue(p.endswith("cinematic"))

    def test_mood_maps_to_lighting(self):
        self.assertIn("soft natural light", cinematic.build_visual_prompt("x", mood="calm"))
        self.assertIn("dramatic high contrast", cinematic.build_visual_prompt("x", mood="epic"))

    def test_deterministic(self):
        self.assertEqual(cinematic.build_visual_prompt("city skyline"),
                         cinematic.build_visual_prompt("city skyline"))

    def test_empty_subject_safe(self):
        self.assertIn("abstract background", cinematic.build_visual_prompt(""))


class TestSearchEnrichment(unittest.TestCase):
    def test_enrich_appends_one_booster(self):
        out = cinematic.enrich_term("ocean waves")
        self.assertTrue(out.startswith("ocean waves "))
        self.assertIn(out.split("ocean waves ", 1)[1], cinematic.SEARCH_BOOST)

    def test_enrich_empty_stays_empty(self):
        self.assertEqual(cinematic.enrich_term(""), "")

    def test_enrich_terms_preserves_count(self):
        self.assertEqual(len(cinematic.enrich_terms(["a", "b", "c"])), 3)


class TestCinematicFetchFallback(unittest.TestCase):
    def setUp(self):
        self._saved = os.environ.pop("PEXELS_API_KEY", None)
        self._orig = broll.image_urls
        # bare query → a result; any cinematic-boosted (multi-word) query → nothing
        broll.image_urls = lambda q, limit=4: ([] if any(b in q for b in cinematic.SEARCH_BOOST)
                                               else ["http://x/a.jpg"])

    def tearDown(self):
        broll.image_urls = self._orig
        if self._saved is not None:
            os.environ["PEXELS_API_KEY"] = self._saved
        else:
            os.environ.pop("PEXELS_API_KEY", None)

    def test_bing_path_stays_bare(self):
        # No Pexels key → never enrich (Bing returns garbage for multi-word queries)
        self.assertEqual(broll._image_urls_cinematic("ocean waves", 1, True), ["http://x/a.jpg"])
        self.assertEqual(broll._image_urls_cinematic("ocean waves", 1, False), ["http://x/a.jpg"])

    def test_pexels_path_enriches_then_falls_back(self):
        # With a Pexels key it tries the enriched query first; here that returns [],
        # so it must fall back to the bare query (never fewer results).
        os.environ["PEXELS_API_KEY"] = "test"
        self.assertEqual(broll._image_urls_cinematic("ocean waves", 1, True), ["http://x/a.jpg"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
