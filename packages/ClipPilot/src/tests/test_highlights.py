"""Tests for the highlight planner — ranking, duration bounds, overlap dropping."""
from __future__ import annotations

import unittest

from clippilot.highlights import plan_highlights, signal_highlights


class TestPlanHighlights(unittest.TestCase):
    def test_ranks_by_score_and_caps_top_n(self):
        cands = [
            {"start": 0, "end": 20, "score": 0.3, "reasons": ["a"]},
            {"start": 100, "end": 120, "score": 0.9, "reasons": ["b"]},
            {"start": 200, "end": 220, "score": 0.6, "reasons": ["c"]},
            {"start": 300, "end": 320, "score": 0.1, "reasons": ["d"]},
        ]
        plan = plan_highlights(cands, duration=600, top_n=2)
        self.assertEqual(len(plan), 2)
        # the two highest scores (0.9, 0.6) selected, returned in chronological order
        self.assertEqual([p["start"] for p in plan], [100.0, 200.0])
        self.assertTrue(all("duration" in p for p in plan))

    def test_drops_overlaps_keeping_higher_score(self):
        cands = [
            {"start": 10, "end": 40, "score": 0.5, "reasons": ["lo"]},
            {"start": 20, "end": 50, "score": 0.9, "reasons": ["hi"]},  # overlaps the first
        ]
        plan = plan_highlights(cands, duration=600)
        self.assertEqual(len(plan), 1)
        self.assertEqual(plan[0]["reasons"], ["hi"])  # higher score wins

    def test_trims_too_long_and_extends_too_short(self):
        plan = plan_highlights([
            {"start": 0, "end": 200, "score": 1.0},     # 200s → trimmed to max 60
            {"start": 300, "end": 305, "score": 0.9},   # 5s → extended to min 15
        ], duration=1000, min_s=15, max_s=60)
        by_start = {p["start"]: p for p in plan}
        self.assertEqual(by_start[0.0]["duration"], 60.0)
        self.assertEqual(by_start[300.0]["duration"], 15.0)

    def test_clamps_to_source_duration_and_slides_start(self):
        # span near the end, extended past the source → clamp end, slide start back
        plan = plan_highlights([{"start": 95, "end": 98, "score": 1.0}],
                               duration=100, min_s=15, max_s=60)
        self.assertEqual(len(plan), 1)
        self.assertLessEqual(plan[0]["end"], 100.0)
        self.assertGreaterEqual(plan[0]["duration"], 15.0 - 0.001)

    def test_ignores_invalid_spans(self):
        plan = plan_highlights([
            {"start": 50, "end": 30, "score": 1.0},     # end <= start → dropped
            {"start": "x", "end": "y", "score": 1.0},   # non-numeric → dropped
        ], duration=600)
        self.assertEqual(plan, [])

    def test_empty(self):
        self.assertEqual(plan_highlights([], duration=600), [])


class TestSignalHighlights(unittest.TestCase):
    def test_low_silence_window_scores_higher(self):
        # 0-30 is mostly silent; 30-120 has speech → later windows should win
        signals = {"silences": [{"start": 0.0, "end": 28.0}], "scene_cuts": []}
        cands = signal_highlights(signals, duration=120.0, target_s=30.0, stride_s=15.0)
        self.assertTrue(cands)
        first = cands[0]                       # window [0,30] — heavily silent
        speechy = max(cands, key=lambda c: c["score"])
        self.assertGreater(speechy["score"], first["score"])
        self.assertTrue(all(c["reasons"] for c in cands))   # never a bare timestamp

    def test_scene_cut_bonus(self):
        no_cut = signal_highlights({"silences": [], "scene_cuts": []}, duration=60.0)
        with_cut = signal_highlights({"silences": [], "scene_cuts": [0.0]}, duration=60.0)
        self.assertGreaterEqual(with_cut[0]["score"], no_cut[0]["score"])

    def test_zero_duration(self):
        self.assertEqual(signal_highlights({"silences": []}, duration=0), [])

    def test_feeds_plan_highlights(self):
        signals = {"silences": [{"start": 50, "end": 70}], "scene_cuts": [0, 80]}
        plan = plan_highlights(signal_highlights(signals, 120.0), duration=120.0, top_n=2)
        self.assertTrue(plan)
        self.assertLessEqual(len(plan), 2)
        # non-overlapping after planning
        if len(plan) == 2:
            self.assertLessEqual(plan[0]["end"], plan[1]["start"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
