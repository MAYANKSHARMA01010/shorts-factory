"""Phase 1 media tests: real ffmpeg signal extraction against a generated sample.

Skipped automatically if ffmpeg isn't available. Generates a 6 s clip whose
first half is `testsrc` and second half is `testsrc2` (a hard visual cut) plus a
440 Hz tone, then asserts probe/scene/silence/loudness/keyframe all work.

Run from src/:  python -m unittest discover -s tests
"""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.media import ffmpeg as ffm
from clippilot.media import signals


@unittest.skipUnless(ffm.ffmpeg_available(), "ffmpeg not available")
class TestRealSignals(unittest.TestCase):
    tmpdir: tempfile.TemporaryDirectory
    sample: str

    @classmethod
    def setUpClass(cls):
        cls.tmpdir = tempfile.TemporaryDirectory(prefix="clippilot_media_")
        cls.sample = os.path.join(cls.tmpdir.name, "sample.mp4")
        r = ffm.run_ffmpeg([
            "-f", "lavfi", "-i", "testsrc=duration=3:size=320x240:rate=30",
            "-f", "lavfi", "-i", "testsrc2=duration=3:size=320x240:rate=30",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=6",
            "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v]",
            "-map", "[v]", "-map", "2:a",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
            "-t", "6", "-y", cls.sample,
        ], timeout=120)
        if not os.path.exists(cls.sample):
            raise unittest.SkipTest(f"could not generate sample (ffmpeg rc={r.returncode}):\n{r.stderr[-800:]}")

    @classmethod
    def tearDownClass(cls):
        cls.tmpdir.cleanup()

    def test_probe_metadata(self):
        m = signals.probe(self.sample)
        self.assertAlmostEqual(m.duration_s, 6.0, delta=0.6)
        self.assertEqual(m.resolution, "320x240")
        self.assertTrue(m.has_audio)
        self.assertGreater(m.fps, 20)

    def test_scene_detection_finds_the_cut(self):
        scenes = signals.detect_scenes(self.sample, threshold=0.3)
        self.assertIsInstance(scenes, list)
        # the testsrc -> testsrc2 boundary (~3.0s) is a hard visual change
        self.assertGreaterEqual(len(scenes), 1, f"expected >=1 scene cut, got {scenes}")

    def test_loudness_measurable(self):
        lufs = signals.measure_loudness(self.sample)
        self.assertIsNotNone(lufs)
        self.assertLess(lufs, 0)  # LUFS for real audio is negative

    def test_silence_returns_list(self):
        sil = signals.detect_silence(self.sample)
        self.assertIsInstance(sil, list)  # continuous tone => likely empty, but must not error

    def test_keyframe_extraction(self):
        out = os.path.join(self.tmpdir.name, "kf.jpg")
        got = signals.extract_keyframe(self.sample, t=1.0, out_path=out, width=256)
        self.assertEqual(got, out)
        self.assertTrue(os.path.exists(out))
        self.assertGreater(os.path.getsize(out), 0)

    def test_extract_signals_aggregate(self):
        sig = signals.extract_signals(self.sample)
        self.assertTrue(sig["available"])
        self.assertEqual(sig["source"]["resolution"], "320x240")
        self.assertGreaterEqual(sig["shot_count"], 1)
        self.assertIn("integrated_lufs", sig)


class TestSignalsGracefulFallback(unittest.TestCase):
    def test_missing_file_is_graceful(self):
        sig = signals.extract_signals("does_not_exist_12345.mp4")
        self.assertFalse(sig["available"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
