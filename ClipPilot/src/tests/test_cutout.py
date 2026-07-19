"""Tests for subject-cutout b-roll (backgroundremover technique). The rembg cutout
needs a 176MB model, so the default suite tests guards + the ffmpeg COMPOSITE step
(render-gated, with a synthetic transparent PNG). Real rembg is verified out-of-band."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.media import cutout


class TestCutoutGuards(unittest.TestCase):
    def test_available_is_bool(self):
        self.assertIsInstance(cutout.cutout_available(), bool)

    def test_remove_background_missing_file(self):
        self.assertIsNone(cutout.remove_background("no_such.jpg", tempfile.mktemp(suffix=".png")))

    def test_composite_missing_inputs(self):
        self.assertIsNone(cutout.composite_over("no_a.png", "no_b.png", tempfile.mktemp()))


@unittest.skipUnless(os.environ.get("CLIPPILOT_RUN_RENDER") == "1",
                     "render test — set CLIPPILOT_RUN_RENDER=1")
class TestCompositeRender(unittest.TestCase):
    def test_composite_over_background(self):
        from clippilot.media.ffmpeg import run_ffmpeg
        d = tempfile.mkdtemp(prefix="cutouttest_")
        # synthetic transparent subject: a red disc on a transparent canvas (RGBA)
        subj = os.path.join(d, "subj.png")
        run_ffmpeg(["-f", "lavfi", "-i", "color=c=black:s=400x400",
                    "-vf", "format=rgba,geq=r=255:g=30:b=30:a='if(lt((X-200)^2+(Y-200)^2,30000),255,0)'",
                    "-frames:v", "1", "-y", subj])
        bg = os.path.join(d, "bg.png")
        run_ffmpeg(["-f", "lavfi", "-i", "color=c=0x16213e:s=1080x1920", "-frames:v", "1", "-y", bg])
        out = cutout.composite_over(subj, bg, os.path.join(d, "out.png"))
        self.assertTrue(out and os.path.exists(out))
        self.assertGreater(os.path.getsize(out), 5000)


if __name__ == "__main__":
    unittest.main(verbosity=2)
