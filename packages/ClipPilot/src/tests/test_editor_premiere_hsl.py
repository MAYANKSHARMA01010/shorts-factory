"""Tests for Adobe Premiere parity — Lumetri HSL Secondary (qualify by colour family
and adjust only those pixels), via ffmpeg `selectivecolor`."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.editor import render as R
from clippilot.editor import timeline as T


class TestSelectiveFilter(unittest.TestCase):
    def test_built(self):
        f = R._selective_filter({"blues": [0.2, -0.1, 0.0, 0.3], "reds": [0.0, 0.0, 0.0, -0.2]})
        self.assertIn("selectivecolor=", f)
        self.assertIn("blues=0.200 -0.100 0.000 0.300", f)
        self.assertIn("reds=0.000 0.000 0.000 -0.200", f)

    def test_three_components_ok(self):
        f = R._selective_filter({"greens": [0.1, 0.2, 0.3]})
        self.assertIn("greens=0.100 0.200 0.300", f)

    def test_invalid_dropped(self):
        self.assertIsNone(R._selective_filter(None))
        self.assertIsNone(R._selective_filter({}))
        self.assertIsNone(R._selective_filter({"bogusfamily": [0, 0, 0]}))   # unknown family
        self.assertIsNone(R._selective_filter({"reds": [0, 0]}))             # too few components

    def test_clamped(self):
        f = R._selective_filter({"blues": [9, -9, 0]})
        self.assertIn("blues=1.000 -1.000 0.000", f)

    def test_in_color_filters_and_chain(self):
        fl = R._color_filters({"saturation": 1.1, "selective": {"blues": [0.0, 0.0, 0.0, 0.4]}})
        joined = ";".join(fl)
        self.assertIn("eq=saturation=1.100", joined)
        self.assertIn("selectivecolor=blues=0.000 0.000 0.000 0.400", joined)


class TestSelectiveOp(unittest.TestCase):
    def test_merges_into_color(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, T.Clip(media_ref="m", start_frame=0, duration_frames=30,
                                     color={"saturation": 1.2}))
        self.assertEqual(T.selective_color(tl, [c.id], "blues", [0.0, 0.0, 0.0, 0.5]), 1)
        self.assertEqual(c.color["saturation"], 1.2)       # existing grade preserved
        self.assertEqual(c.color["selective"]["blues"], [0.0, 0.0, 0.0, 0.5])
        # a second family merges, not replaces
        T.selective_color(tl, [c.id], "reds", [0.2, 0.0, 0.0])
        self.assertIn("blues", c.color["selective"])
        self.assertIn("reds", c.color["selective"])

    def test_bad_values_no_op(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, T.Clip(media_ref="m", start_frame=0, duration_frames=30))
        self.assertEqual(T.selective_color(tl, [c.id], "blues", [0.1]), 0)

    def test_round_trip(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, T.Clip(media_ref="m", start_frame=0, duration_frames=30))
        T.selective_color(tl, [c.id], "greens", [0.0, 0.0, 0.3])
        tl2 = T.Timeline.from_dict(tl.to_dict())
        self.assertEqual(tl2.tracks[0].clips[0].color["selective"]["greens"], [0.0, 0.0, 0.3])


@unittest.skipUnless(os.environ.get("CLIPPILOT_RUN_RENDER") == "1",
                     "render test — set CLIPPILOT_RUN_RENDER=1")
class TestHslRender(unittest.TestCase):
    def test_selective_color_renders(self):
        from clippilot.editor.render import render_timeline
        from clippilot.media.ffmpeg import run_ffmpeg
        d = tempfile.mkdtemp(prefix="hsltest_")
        src = os.path.join(d, "s.mp4")
        run_ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=320x568:rate=30:duration=1",
                    "-pix_fmt", "yuv420p", "-y", src])
        tl = T.Timeline(fps=30, width=320, height=568)
        c = T.Clip(media_ref=src, media_type="video", start_frame=0, duration_frames=30,
                   color={"selective": {"blues": [0.0, 0.0, 0.0, 0.6],   # darken blues
                                        "reds": [-0.3, 0.0, 0.0, 0.0]}})  # push reds toward cyan
        T.add_clip(tl, 0, c)
        out = render_timeline(tl, os.path.join(d, "o.mp4"))
        self.assertTrue(out and os.path.exists(out))


if __name__ == "__main__":
    unittest.main(verbosity=2)
