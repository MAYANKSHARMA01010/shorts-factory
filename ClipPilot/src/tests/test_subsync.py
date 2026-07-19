"""Tests for subtitle↔audio resync (ffsubsync FFT-aligner port) + SRT parsing."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.media import edit, subsync


class TestAligner(unittest.TestCase):
    FPS = 50

    def _speech(self, dur=40.0):
        # speech present in [10,15] and [22,28]
        sil = [{"start": 0.0, "end": 10.0}, {"start": 15.0, "end": 22.0}, {"start": 28.0, "end": dur}]
        return subsync.speech_mask_from_silences(sil, dur, self.FPS)

    def test_recovers_positive_offset(self):
        speech = self._speech()
        cues = [{"start": 7.0, "end": 12.0, "text": "a"}, {"start": 19.0, "end": 25.0, "text": "b"}]
        subs = subsync.sub_mask_from_cues(cues, 40.0, self.FPS)
        self.assertAlmostEqual(subsync.find_offset_frames(speech, subs) / self.FPS, 3.0, delta=0.2)

    def test_recovers_negative_offset(self):
        speech = self._speech()
        cues = [{"start": 13.0, "end": 18.0, "text": "a"}, {"start": 25.0, "end": 31.0, "text": "b"}]
        subs = subsync.sub_mask_from_cues(cues, 40.0, self.FPS)
        self.assertAlmostEqual(subsync.find_offset_frames(speech, subs) / self.FPS, -3.0, delta=0.2)

    def test_zero_masks_give_zero(self):
        import numpy as np
        self.assertEqual(subsync.find_offset_frames(np.zeros(100), np.zeros(100)), 0)

    def test_resync_cues_shifts_and_clamps(self):
        out = subsync.resync_cues([{"start": 1.0, "end": 2.0, "text": "x"}], -5.0)
        self.assertEqual(out[0]["start"], 0.0)       # clamped at 0
        self.assertGreaterEqual(out[0]["end"], 0.05)


class TestSrtParse(unittest.TestCase):
    def test_write_then_parse_roundtrip(self):
        cues = [{"start": 1.5, "end": 3.0, "text": "hello"}, {"start": 3.0, "end": 4.25, "text": "world"}]
        with tempfile.TemporaryDirectory() as d:
            p = edit.write_srt(cues, os.path.join(d, "t.srt"))
            parsed = edit.parse_srt(p)
            self.assertEqual(len(parsed), 2)
            self.assertAlmostEqual(parsed[0]["start"], 1.5, places=2)
            self.assertEqual(parsed[1]["text"], "world")

    def test_parse_missing_file(self):
        self.assertEqual(edit.parse_srt("no_such.srt"), [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
