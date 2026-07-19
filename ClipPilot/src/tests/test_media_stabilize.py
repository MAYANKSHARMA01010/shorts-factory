"""Tests for the Warp Stabilizer (ffmpeg vidstab two-pass) — Premiere parity."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.media import stabilize as S


class TestStabilizeBuilders(unittest.TestCase):
    def test_detect_vf(self):
        self.assertEqual(S._detect_vf("t.trf", 7),
                         "vidstabdetect=shakiness=7:accuracy=15:result=t.trf")

    def test_transform_vf_with_sharpen(self):
        vf = S._transform_vf("t.trf", 12, 0.0, True)
        self.assertIn("vidstabtransform=input=t.trf:smoothing=12:zoom=0.0", vf)
        self.assertIn("optzoom=1", vf)
        self.assertIn("unsharp=", vf)

    def test_transform_vf_no_sharpen(self):
        self.assertNotIn("unsharp", S._transform_vf("t.trf", 10, 0.0, False))

    def test_missing_input_returns_none(self):
        self.assertIsNone(S.stabilize_video("/no/such/file.mp4",
                                            os.path.join(tempfile.mkdtemp(), "o.mp4")))


@unittest.skipUnless(os.environ.get("CLIPPILOT_RUN_RENDER") == "1",
                     "render test — set CLIPPILOT_RUN_RENDER=1")
class TestStabilizeRender(unittest.TestCase):
    def test_available(self):
        self.assertTrue(S.vidstab_available())

    def test_two_pass_produces_valid_video(self):
        from clippilot.media.ffmpeg import run_ffmpeg
        from clippilot.media.signals import probe
        d = tempfile.mkdtemp(prefix="stabtest_")
        # synthesize a "shaky" clip: a scene that pans/jitters (crop window moves over a larger source)
        src = os.path.join(d, "shaky.mp4")
        run_ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=480x854:rate=30:duration=2",
                    "-vf", "crop=320:568:20*sin(2*PI*t*3)+80:20*cos(2*PI*t*3)+143",
                    "-pix_fmt", "yuv420p", "-y", src])
        out = S.stabilize_video(src, os.path.join(d, "stable.mp4"), smoothing=15, shakiness=8)
        self.assertTrue(out and os.path.exists(out))
        info = probe(out)
        self.assertGreater(info.duration_s, 1.0)         # ~2s preserved
        # the temporary transforms file is cleaned up
        self.assertFalse(os.path.exists(os.path.join(d, "stable.trf")))


if __name__ == "__main__":
    unittest.main(verbosity=2)
