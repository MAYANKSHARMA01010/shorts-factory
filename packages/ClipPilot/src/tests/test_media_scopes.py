"""Tests for Lumetri Scopes (waveform/vectorscope/histogram/parade) — Premiere parity."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.media import scopes as SC


class TestScopeVf(unittest.TestCase):
    def test_known_types(self):
        self.assertIn("waveform", SC.scope_vf("waveform"))
        self.assertIn("vectorscope", SC.scope_vf("vectorscope"))
        self.assertIn("histogram", SC.scope_vf("histogram"))
        self.assertIn("parade", SC.scope_vf("rgbparade"))

    def test_unknown_falls_back_to_waveform(self):
        self.assertEqual(SC.scope_vf("nope"), SC.SCOPES["waveform"])

    def test_missing_input(self):
        self.assertIsNone(SC.generate_scope("/no/file.mp4",
                                            os.path.join(tempfile.mkdtemp(), "s.png")))


@unittest.skipUnless(os.environ.get("CLIPPILOT_RUN_RENDER") == "1",
                     "render test — set CLIPPILOT_RUN_RENDER=1")
class TestScopeRender(unittest.TestCase):
    def test_each_scope_type_produces_image(self):
        from clippilot.media.ffmpeg import run_ffmpeg
        d = tempfile.mkdtemp(prefix="scopetest_")
        src = os.path.join(d, "s.mp4")
        run_ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=320x568:rate=30:duration=1",
                    "-pix_fmt", "yuv420p", "-y", src])
        for st in ("waveform", "rgbparade", "vectorscope", "histogram", "levels"):
            out = SC.generate_scope(src, os.path.join(d, f"{st}.png"), scope_type=st)
            self.assertTrue(out and os.path.exists(out), f"{st} scope not produced")
            self.assertGreater(os.path.getsize(out), 200, f"{st} scope is empty")  # a real PNG


if __name__ == "__main__":
    unittest.main(verbosity=2)
