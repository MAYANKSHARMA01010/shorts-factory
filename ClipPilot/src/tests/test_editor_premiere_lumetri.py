"""Tests for Adobe Premiere parity — advanced Lumetri color: RGB Curves and Color
Wheels (Lift/Gamma/Gain), extending the clip `color` grade in render._color_filters."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.editor import render as R
from clippilot.editor import timeline as T


class TestCurves(unittest.TestCase):
    def test_curves_filter_built(self):
        f = R._curves_filter({"master": "0/0 0.5/0.4 1/1", "red": "0/0.1 1/1"})
        self.assertIn("curves=", f)
        self.assertIn("m='0/0 0.5/0.4 1/1'", f)
        self.assertIn("r='0/0.1 1/1'", f)

    def test_channel_aliases(self):
        f = R._curves_filter({"green": "0/0 1/1", "b": "0/0 1/0.9"})
        self.assertIn("g='0/0 1/1'", f)
        self.assertIn("b='0/0 1/0.9'", f)

    def test_invalid_curves(self):
        self.assertIsNone(R._curves_filter(None))
        self.assertIsNone(R._curves_filter({}))
        self.assertIsNone(R._curves_filter({"bogus": "0/0 1/1"}))   # unknown channel dropped
        self.assertIsNone(R._curves_filter({"red": 123}))           # non-string points dropped


class TestColorWheels(unittest.TestCase):
    def test_lift_gamma_gain(self):
        f = R._wheels_filter({"lift": [0.2, 0.0, -0.1], "gamma_rgb": [0.0, 0.1, 0.0],
                              "gain": [-0.1, 0.0, 0.2]})
        self.assertIn("colorbalance=", f)
        self.assertIn("rs=0.200", f)    # lift → shadows
        self.assertIn("gm=0.100", f)    # gamma → midtones
        self.assertIn("bh=0.200", f)    # gain → highlights

    def test_partial_wheels(self):
        f = R._wheels_filter({"lift": [0.3, 0.3, 0.3]})
        self.assertEqual(f, "colorbalance=rs=0.300:gs=0.300:bs=0.300")

    def test_clamp_and_invalid(self):
        f = R._wheels_filter({"gain": [9, -9, 0]})
        self.assertIn("rh=1.000", f)
        self.assertIn("gh=-1.000", f)
        self.assertIsNone(R._wheels_filter({}))
        self.assertIsNone(R._wheels_filter({"lift": [1, 2]}))         # need 3 components
        self.assertIsNone(R._wheels_filter({"lift": ["x", "y", "z"]}))  # non-numeric


class TestColorIntegration(unittest.TestCase):
    def test_curves_and_wheels_in_color_filters(self):
        fl = R._color_filters({"saturation": 1.2, "curves": {"master": "0/0 0.5/0.6 1/1"},
                               "lift": [0.1, 0.0, 0.0]})
        joined = ";".join(fl)
        self.assertIn("eq=saturation=1.200", joined)
        self.assertIn("curves=m='0/0 0.5/0.6 1/1'", joined)
        self.assertIn("colorbalance=rs=0.100", joined)

    def test_bad_scalar_does_not_crash(self):
        # non-numeric scalar grade values are coerced to defaults, not raised
        self.assertEqual(R._color_filters({"brightness": "oops"}), [])

    def test_applied_in_video_chain(self):
        tl = T.Timeline()
        c = T.Clip(media_ref="m", media_type="video", start_frame=0, duration_frames=30,
                   color={"curves": {"blue": "0/0 1/0.8"}, "gain": [0.0, 0.0, 0.2]})
        chain = R._video_chain("1:v", "v1", c, tl)
        self.assertIn("curves=b='0/0 1/0.8'", chain)
        self.assertIn("colorbalance=", chain)

    def test_settable_and_round_trip(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, T.Clip(media_ref="m", start_frame=0, duration_frames=30))
        T.set_clip_properties(tl, [c.id], color={"curves": {"red": "0/0 1/1"}, "lift": [0.1, 0.1, 0.1]})
        tl2 = T.Timeline.from_dict(tl.to_dict())
        self.assertEqual(tl2.tracks[0].clips[0].color["curves"]["red"], "0/0 1/1")


@unittest.skipUnless(os.environ.get("CLIPPILOT_RUN_RENDER") == "1",
                     "render test — set CLIPPILOT_RUN_RENDER=1")
class TestLumetriRender(unittest.TestCase):
    def test_curves_and_wheels_render(self):
        from clippilot.editor.render import render_timeline
        from clippilot.media.ffmpeg import run_ffmpeg
        d = tempfile.mkdtemp(prefix="lumetritest_")
        src = os.path.join(d, "s.mp4")
        run_ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=320x568:rate=30:duration=1",
                    "-pix_fmt", "yuv420p", "-y", src])
        tl = T.Timeline(fps=30, width=320, height=568)
        c = T.Clip(media_ref=src, media_type="video", start_frame=0, duration_frames=30,
                   color={"curves": {"master": "0/0 0.5/0.35 1/1", "red": "0/0.05 1/1"},
                          "lift": [0.1, 0.0, -0.1], "gain": [-0.05, 0.0, 0.15]})
        T.add_clip(tl, 0, c)
        out = render_timeline(tl, os.path.join(d, "o.mp4"))
        self.assertTrue(out and os.path.exists(out))


if __name__ == "__main__":
    unittest.main(verbosity=2)
