"""Tests for the TikTok-style caption port (faithful to remotion's tiktok.test.ts)."""
from __future__ import annotations

import math
import unittest

from clippilot.media import captions as cap


class TestTikTokCaptions(unittest.TestCase):
    # The exact input/expected from remotion packages/captions/src/test/tiktok.test.ts
    CAPS = [
        {"text": "Using", "start_ms": 40, "end_ms": 300},
        {"text": " Remotion's", "start_ms": 300, "end_ms": 900},
        {"text": " TikTok", "start_ms": 900, "end_ms": 1260},
        {"text": " template,", "start_ms": 1260, "end_ms": 1950},
    ]

    def test_matches_remotion_reference(self):
        pages = cap.create_tiktok_style_captions(self.CAPS, combine_within_ms=500)["pages"]
        self.assertEqual(len(pages), 2)
        self.assertEqual(pages[0]["text"], "Using Remotion's")
        self.assertEqual(pages[0]["start_ms"], 40)
        self.assertEqual(pages[0]["duration_ms"], 860)
        self.assertEqual(pages[0]["tokens"], [
            {"text": "Using", "from_ms": 40, "to_ms": 300},
            {"text": " Remotion's", "from_ms": 300, "to_ms": 900},
        ])
        self.assertEqual(pages[1]["text"], "TikTok template,")
        self.assertEqual(pages[1]["start_ms"], 900)
        self.assertEqual(pages[1]["duration_ms"], 1050)
        self.assertEqual(pages[1]["tokens"], [
            {"text": "TikTok", "from_ms": 900, "to_ms": 1260},
            {"text": " template,", "from_ms": 1260, "to_ms": 1950},
        ])

    def test_large_combine_window_merges_into_one_page(self):
        pages = cap.create_tiktok_style_captions(self.CAPS, combine_within_ms=100000)["pages"]
        self.assertEqual(len(pages), 1)
        self.assertEqual(pages[0]["text"], "Using Remotion's TikTok template,")

    def test_empty(self):
        self.assertEqual(cap.create_tiktok_style_captions([], 500)["pages"], [])

    def test_trailing_whitespace_token_keeps_finite_duration(self):
        caps = [{"text": "long", "start_ms": 0, "end_ms": 4000},
                {"text": " ", "start_ms": 4000, "end_ms": 4100}]
        pages = cap.create_tiktok_style_captions(caps, combine_within_ms=500)["pages"]
        self.assertTrue(pages)
        self.assertTrue(all(math.isfinite(p["duration_ms"]) for p in pages))

    def test_captions_from_words_dicts_and_objects(self):
        class W:
            def __init__(self, word, start, end):
                self.word, self.start, self.end = word, start, end
        caps = cap.captions_from_words([
            {"word": " hi", "start": 0.04, "end": 0.30},
            W(" there", 0.30, 0.90),
        ])
        self.assertEqual(caps[0], {"text": " hi", "start_ms": 40, "end_ms": 300})
        self.assertEqual(caps[1], {"text": " there", "start_ms": 300, "end_ms": 900})

    def test_cues_for_clip_offsets_to_clip_local_time(self):
        # words in SOURCE seconds; clip spans [2.0, 3.5)
        words = [
            {"text": "Using", "start": 2.04, "end": 2.30},
            {"text": " Remotion's", "start": 2.30, "end": 2.90},
            {"text": " TikTok", "start": 2.90, "end": 3.26},
            {"text": " later", "start": 9.00, "end": 9.40},  # outside the clip → dropped
        ]
        cues = cap.cues_for_clip(words, 2.0, 3.5, combine_within_ms=2000)
        self.assertTrue(cues)
        self.assertAlmostEqual(cues[0]["start"], 0.04, places=3)  # 2.04s - 2.0 offset
        joined = " ".join(c["text"] for c in cues)
        self.assertIn("Using", joined)
        self.assertNotIn("later", joined)  # word outside the window excluded

    def test_cues_for_clip_empty_when_no_words_in_window(self):
        words = [{"text": "hi", "start": 10.0, "end": 10.4}]
        self.assertEqual(cap.cues_for_clip(words, 0.0, 5.0), [])

    def test_pages_for_clip_keeps_tokens_clip_local(self):
        words = [
            {"text": " deep", "start": 10.0, "end": 10.5},
            {"text": " ocean", "start": 10.5, "end": 11.1},
            {"text": " glow", "start": 11.1, "end": 11.8},
        ]
        pages = cap.pages_for_clip(words, 10.0, 13.0)
        self.assertTrue(pages)
        self.assertEqual(pages[0]["start"], 0.0)              # shifted to clip-local
        toks = pages[0]["tokens"]
        self.assertEqual(toks[0]["from_ms"], 0)               # first word at t=0 in the clip
        self.assertTrue(all(t["from_ms"] >= 0 for t in toks))

    def test_pages_for_clip_empty_without_speech(self):
        self.assertEqual(cap.pages_for_clip([{"text": "x", "start": 50, "end": 51}], 0, 5), [])

    def test_pages_to_cues_offset_and_clamp(self):
        pages = [
            {"text": "a", "start_ms": 2000, "duration_ms": 500, "tokens": []},
            {"text": "b", "start_ms": 2500, "duration_ms": math.inf, "tokens": []},
        ]
        cues = cap.pages_to_cues(pages, offset_s=2.0, default_dur_s=2.0)
        self.assertEqual(cues[0]["start"], 0.0)          # 2.0s - 2.0 offset
        self.assertAlmostEqual(cues[0]["end"], 0.5)
        self.assertAlmostEqual(cues[1]["start"], 0.5)
        self.assertAlmostEqual(cues[1]["end"], 2.5)       # inf duration → default 2.0


if __name__ == "__main__":
    unittest.main(verbosity=2)
