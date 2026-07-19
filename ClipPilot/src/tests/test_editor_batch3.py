"""Tests for batch-3 deep-mine additions: per-clip color grading + film grain
(OpenShot presets → ffmpeg eq/colortemperature/noise) and manim easing functions."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.editor import keyframes as KF
from clippilot.editor import render as R
from clippilot.editor import timeline as T


class TestColorGrade(unittest.TestCase):
    def test_eq_filter_built(self):
        f = R._color_filters({"saturation": 0.0, "contrast": 1.2})
        self.assertEqual(f, ["eq=contrast=1.200:saturation=0.000"])

    def test_temperature_and_grain(self):
        f = R._color_filters({"temperature": 5500, "grain": 8})
        self.assertIn("colortemperature=temperature=5500", f)
        self.assertIn("noise=alls=8:allf=t", f)

    def test_preset_by_name(self):
        self.assertTrue(R._color_filters("cinematic"))      # named preset resolves
        self.assertEqual(R._color_filters("nonsense"), [])

    def test_empty_no_filters(self):
        self.assertEqual(R._color_filters(None), [])
        self.assertEqual(R._color_filters({}), [])

    def test_applied_in_video_chain(self):
        tl = T.Timeline()
        c = T.Clip(media_ref="m", media_type="video", start_frame=0, duration_frames=30,
                   color={"saturation": 1.4})
        self.assertIn("eq=saturation=1.400", R._video_chain("1:v", "v1", c, tl))

    def test_settable_via_properties_and_json(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, T.Clip(media_ref="m", start_frame=0, duration_frames=30))
        T.set_clip_properties(tl, [c.id], color={"saturation": 1.3, "temperature": 5500})
        self.assertEqual(c.color["temperature"], 5500)
        tl2 = T.Timeline.from_dict(tl.to_dict())
        self.assertEqual(tl2.tracks[0].clips[0].color["saturation"], 1.3)
        T.set_clip_properties(tl, [c.id], color=None)
        self.assertIsNone(c.color)


class TestManimEasings(unittest.TestCase):
    def test_registered(self):
        for e in ("ease_in", "ease_out", "ease_in_out", "there_and_back", "rush_into", "overshoot"):
            self.assertIn(e, KF.INTERP)

    def test_ease_in_is_slow_start(self):
        self.assertAlmostEqual(KF.sample([[0, 0.0], [30, 1.0]], "ease_in", 15), 0.25)   # 0.5^2

    def test_ease_out_is_slow_end(self):
        self.assertAlmostEqual(KF.sample([[0, 0.0], [30, 1.0]], "ease_out", 15), 0.75)

    def test_there_and_back_returns(self):
        s = KF.sample([[0, 0.0], [30, 1.0]], "there_and_back", 15)
        self.assertGreater(s, 0.9)                          # peaks mid
        self.assertLess(KF.sample([[0, 0.0], [30, 1.0]], "there_and_back", 29), 0.1)  # back to ~0

    def test_baked_easing_expr_bounded(self):
        e = KF.ffmpeg_expr([[0, 0.0], [30, 1.0]], "ease_out", 0, 0.0, 30)
        self.assertLessEqual(e.count("if("), KF._MAX_EXPR_KF + 1)
        self.assertIn("lt(t,", e)


@unittest.skipUnless(os.environ.get("CLIPPILOT_RUN_RENDER") == "1",
                     "render test — set CLIPPILOT_RUN_RENDER=1")
class TestColorRender(unittest.TestCase):
    def test_grade_renders(self):
        from clippilot.editor.render import render_timeline
        from clippilot.media.ffmpeg import run_ffmpeg
        d = tempfile.mkdtemp(prefix="colortest_")
        src = os.path.join(d, "s.mp4")
        run_ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=320x568:rate=30:duration=1", "-pix_fmt",
                    "yuv420p", "-y", src])
        tl = T.Timeline(fps=30, width=320, height=568)
        c = T.Clip(media_ref=src, media_type="video", start_frame=0, duration_frames=30,
                   color={"saturation": 0.0, "contrast": 1.2})
        T.add_clip(tl, 0, c)
        out = render_timeline(tl, os.path.join(d, "o.mp4"))
        self.assertTrue(out and os.path.exists(out))


if __name__ == "__main__":
    unittest.main(verbosity=2)
