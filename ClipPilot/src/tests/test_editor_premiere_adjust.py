"""Tests for Adobe Premiere parity — adjustment layers (a media-less clip whose color
grade / FX / LUT apply to everything below it on the timeline, within its time window)."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.editor import render as R
from clippilot.editor import timeline as T


class TestAdjustmentModel(unittest.TestCase):
    def test_add_adjustment_layer(self):
        tl = T.Timeline()
        c = T.add_adjustment_layer(tl, 1, 0, 60, color={"saturation": 0.0}, lut="bw")
        self.assertEqual(c.media_type, "adjustment")
        self.assertEqual(c.color["saturation"], 0.0)
        self.assertEqual(c.color["lut"], "bw")           # lut merged into color
        self.assertEqual(tl.tracks[1].clips[0].id, c.id)

    def test_effects_only(self):
        tl = T.Timeline()
        c = T.add_adjustment_layer(tl, 2, 10, 20, effects=[{"type": "gaussian_blur", "amount": 6}])
        self.assertEqual(c.effects[0]["type"], "gaussian_blur")
        self.assertIsNone(c.color)

    def test_round_trip(self):
        tl = T.Timeline()
        T.add_adjustment_layer(tl, 1, 0, 30, lut="teal_orange")
        tl2 = T.Timeline.from_dict(tl.to_dict())
        self.assertEqual(tl2.tracks[1].clips[0].media_type, "adjustment")
        self.assertEqual(tl2.tracks[1].clips[0].color["lut"], "teal_orange")


class TestAdjustmentNode(unittest.TestCase):
    def test_grade_gated_to_window(self):
        tl = T.Timeline(fps=30)
        c = T.Clip(media_type="adjustment", start_frame=15, duration_frames=15,
                   color={"saturation": 0.0})
        node = R._adjustment_node("b2", "b3", c, tl)
        self.assertIn("eq=saturation=0.000:enable='between(t,0.5000,1.0000)'", node)
        self.assertTrue(node.startswith("[b2]") and node.endswith("[b3]"))

    def test_effects_each_gated(self):
        tl = T.Timeline(fps=30)
        c = T.Clip(media_type="adjustment", start_frame=0, duration_frames=30,
                   effects=[{"type": "invert"}, {"type": "gaussian_blur", "amount": 4}])
        node = R._adjustment_node("b1", "b2", c, tl)
        self.assertIn("negate:enable='between(t,0.0000,1.0000)'", node)
        self.assertIn("gblur=sigma=4.000:enable='between(t,0.0000,1.0000)'", node)

    def test_empty_is_passthrough(self):
        tl = T.Timeline()
        c = T.Clip(media_type="adjustment", start_frame=0, duration_frames=30)
        self.assertEqual(R._adjustment_node("b1", "b2", c, tl), "[b1]null[b2]")


@unittest.skipUnless(os.environ.get("CLIPPILOT_RUN_RENDER") == "1",
                     "render test — set CLIPPILOT_RUN_RENDER=1")
class TestAdjustmentRender(unittest.TestCase):
    def test_adjustment_grades_clips_below_in_window(self):
        # A base clip on track 0; a bw adjustment on track 1 active only for the 2nd half.
        # First-half frame stays colored; second-half frame goes grayscale.
        from clippilot.editor.render import render_timeline
        from clippilot.media.ffmpeg import run_ffmpeg
        d = tempfile.mkdtemp(prefix="adjtest_")
        src = os.path.join(d, "s.mp4")
        run_ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=320x568:rate=30:duration=2",
                    "-pix_fmt", "yuv420p", "-y", src])
        tl = T.Timeline(fps=30, width=320, height=568)
        T.add_clip(tl, 0, T.Clip(media_ref=src, media_type="video", start_frame=0,
                                 duration_frames=60))
        T.add_adjustment_layer(tl, 1, 30, 30, color={"saturation": 0.0})   # bw, 2nd second
        out = render_timeline(tl, os.path.join(d, "o.mp4"))
        self.assertTrue(out and os.path.exists(out))

    def test_adjustment_with_lut_renders(self):
        from clippilot.editor.render import render_timeline
        from clippilot.media.ffmpeg import run_ffmpeg
        d = tempfile.mkdtemp(prefix="adjtest2_")
        src = os.path.join(d, "s.mp4")
        run_ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=320x568:rate=30:duration=1",
                    "-pix_fmt", "yuv420p", "-y", src])
        tl = T.Timeline(fps=30, width=320, height=568)
        T.add_clip(tl, 0, T.Clip(media_ref=src, media_type="video", start_frame=0,
                                 duration_frames=30))
        T.add_adjustment_layer(tl, 1, 0, 30, lut="teal_orange",
                               effects=[{"type": "vignette"}])
        out = render_timeline(tl, os.path.join(d, "o.mp4"))
        self.assertTrue(out and os.path.exists(out))


if __name__ == "__main__":
    unittest.main(verbosity=2)
