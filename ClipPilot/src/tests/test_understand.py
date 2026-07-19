"""Phase 1 tests for understand_video assembly (real ffmpeg, no ML/Claude yet)."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot import understand
from clippilot.media import ffmpeg as ffm


def _gen_sample(path: str) -> bool:
    r = ffm.run_ffmpeg([
        "-f", "lavfi", "-i", "testsrc=duration=3:size=320x240:rate=30",
        "-f", "lavfi", "-i", "testsrc2=duration=3:size=320x240:rate=30",
        "-f", "lavfi", "-i", "sine=frequency=440:duration=6",
        "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v]",
        "-map", "[v]", "-map", "2:a", "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-t", "6", "-y", path,
    ], timeout=120)
    return os.path.exists(path)


@unittest.skipUnless(ffm.ffmpeg_available(), "ffmpeg not available")
class TestUnderstand(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix="clippilot_understand_")
        cls.sample = os.path.join(cls.tmp.name, "sample.mp4")
        if not _gen_sample(cls.sample):
            raise unittest.SkipTest("could not generate sample")

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_understand_video_real(self):
        out = os.path.join(self.tmp.name, "kf")
        u = understand.understand_video(self.sample, out_dir=out)
        self.assertEqual(u.source.resolution, "320x240")
        self.assertTrue(u.source.has_audio)
        self.assertGreaterEqual(len(u.scenes), 1)
        self.assertGreaterEqual(len(u.keyframe_paths), 1)
        self.assertTrue(all(os.path.exists(p) for p in u.keyframe_paths))
        # deterministic fields filled; semantic ones deferred to Claude
        self.assertIn("pending Claude", u.summary)

    def test_understanding_meta(self):
        m = understand.understanding_meta(self.sample)
        self.assertTrue(m["available"])
        self.assertGreaterEqual(m["planned_keyframes"], 1)
        self.assertTrue(m["has_audio"])

    def test_unavailable_source_is_graceful(self):
        u = understand.understand_video("nope_missing_999.mp4")
        self.assertIn("unavailable", u.summary)


if __name__ == "__main__":
    unittest.main(verbosity=2)
