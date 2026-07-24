"""Tests for narration TTS (Chatterbox primary, edge-tts fallback; no SAPI).
Pure timing + availability always run; real synthesis is opt-in via
CLIPPILOT_RUN_RENDER=1 (loads a model / hits the network)."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.media import tts

_LIVE = os.environ.get("CLIPPILOT_RUN_RENDER") == "1"


class TestWordTimings(unittest.TestCase):
    def test_proportional_and_ordered(self):
        caps = tts.word_timings("hello brave new world", duration_s=4.0)
        self.assertEqual(len(caps), 4)
        self.assertEqual(caps[0]["text"], "hello")          # first has no leading space
        self.assertEqual(caps[1]["text"], " brave")          # later tokens keep leading space
        self.assertEqual(caps[0]["start_ms"], 0)
        # monotonic non-overlapping
        for a, b in zip(caps, caps[1:]):
            self.assertLessEqual(a["end_ms"], b["start_ms"] + 1)
        self.assertAlmostEqual(caps[-1]["end_ms"], 4000, delta=50)

    def test_empty(self):
        self.assertEqual(tts.word_timings("", 3.0), [])
        self.assertEqual(tts.word_timings("hi", 0.0), [])


class TestEngineSurface(unittest.TestCase):
    def test_list_voices_is_list(self):
        self.assertIsInstance(tts.list_voices(), list)

    def test_availability_flags_are_bools(self):
        self.assertIsInstance(tts.tts_available(), bool)
        self.assertIsInstance(tts.chatterbox_available(), bool)
        self.assertIsInstance(tts.edge_available(), bool)
        # tts_available is exactly "some engine is usable"
        self.assertEqual(tts.tts_available(),
                         tts.chatterbox_available() or tts.edge_available())

    def test_no_sapi_surface_remains(self):
        # SAPI removed completely — these names must not exist anymore.
        self.assertFalse(hasattr(tts, "sapi_available"))
        self.assertFalse(hasattr(tts, "_ps_lit"))


@unittest.skipUnless(_LIVE and tts.tts_available(),
                     "set CLIPPILOT_RUN_RENDER=1 (real synthesis: Chatterbox model / edge network)")
class TestRealTTS(unittest.TestCase):
    def test_synthesize_wav(self):
        from clippilot.media import ffmpeg as ffm, signals
        with tempfile.TemporaryDirectory() as d:
            wav = os.path.join(d, "tts.wav")
            res = tts.synthesize("Hello, this is ClipPilot speaking.", wav)
            self.assertTrue(res["available"], res.get("reason"))
            self.assertTrue(os.path.exists(wav))
            self.assertGreater(os.path.getsize(wav), 0)
            self.assertIn(res.get("engine"), ("chatterbox", "edge"))
            if ffm.ffmpeg_available():
                self.assertGreater(signals.probe(wav).duration_s, 0.3)


if __name__ == "__main__":
    unittest.main(verbosity=2)
