"""Phase 1 tests for transcription helpers. The real faster-whisper run downloads
a model, so it's gated behind CLIPPILOT_RUN_WHISPER=1; the pure helpers always run.
"""
from __future__ import annotations

import os
import unittest

from clippilot.media import transcribe as tr


class TestTranscribeHelpers(unittest.TestCase):
    def test_excerpt_for_window(self):
        segs = [
            {"start": 0.0, "end": 2.0, "text": "hello there"},
            {"start": 2.0, "end": 4.0, "text": "second line"},
            {"start": 4.0, "end": 6.0, "text": "third"},
        ]
        self.assertEqual(tr.excerpt_for_window(segs, 0.0, 2.0), "hello there")
        self.assertIn("second line", tr.excerpt_for_window(segs, 1.5, 3.0))
        self.assertEqual(tr.excerpt_for_window(segs, 10.0, 12.0), "")

    def test_segments_to_cues_drops_empty(self):
        segs = [{"start": 0, "end": 1, "text": "a"}, {"start": 1, "end": 2, "text": ""}]
        cues = tr.segments_to_cues(segs)
        self.assertEqual(len(cues), 1)
        self.assertEqual(cues[0]["text"], "a")

    def test_missing_file_graceful(self):
        out = tr.transcribe("does_not_exist_999.mp4")
        self.assertFalse(out["available"])

    def test_whisper_available_is_bool(self):
        self.assertIsInstance(tr.whisper_available(), bool)


@unittest.skipUnless(os.environ.get("CLIPPILOT_RUN_WHISPER") == "1",
                     "set CLIPPILOT_RUN_WHISPER=1 to run the real model (downloads weights)")
class TestRealTranscribe(unittest.TestCase):
    def test_transcribe_runs(self):
        import tempfile

        from clippilot.media import ffmpeg as ffm
        if not ffm.ffmpeg_available():
            self.skipTest("ffmpeg not available")
        with tempfile.TemporaryDirectory() as d:
            sample = os.path.join(d, "s.mp4")
            ffm.run_ffmpeg([
                "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
                "-c:a", "aac", "-t", "3", "-y", sample,
            ], timeout=120)
            out = tr.transcribe(sample, model_size="tiny")
            self.assertTrue(out["available"])
            self.assertIn("segments", out)
            self.assertIsInstance(out["segments"], list)


if __name__ == "__main__":
    unittest.main(verbosity=2)
