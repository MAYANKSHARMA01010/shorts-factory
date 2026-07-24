"""Tests for Adobe Premiere parity — opacity blend modes on overlay clips.

A clip with `blend_mode` (multiply/screen/overlay/…) is composited with an
alpha-aware ffmpeg `blend` recipe (position on transparent canvas → blend RGB →
re-composite through the layer's own alpha) instead of a plain overlay."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.editor import render as R
from clippilot.editor import timeline as T


class TestBlendModeMapping(unittest.TestCase):
    def test_known_modes_map(self):
        for name, ff in [("multiply", "multiply"), ("screen", "screen"), ("overlay", "overlay"),
                         ("color_dodge", "dodge"), ("color_burn", "burn"), ("add", "addition"),
                         ("hard_light", "hardlight"), ("soft_light", "softlight")]:
            self.assertEqual(R._blend_mode(T.Clip(blend_mode=name)), ff)

    def test_normalization_and_normal(self):
        self.assertEqual(R._blend_mode(T.Clip(blend_mode="Hard-Light")), "hardlight")
        self.assertEqual(R._blend_mode(T.Clip(blend_mode="SCREEN")), "screen")
        self.assertIsNone(R._blend_mode(T.Clip(blend_mode="normal")))
        self.assertIsNone(R._blend_mode(T.Clip(blend_mode=None)))
        self.assertIsNone(R._blend_mode(T.Clip(blend_mode="bogus")))   # unknown → normal overlay


class TestCompositeNodes(unittest.TestCase):
    def test_normal_clip_single_overlay(self):
        tl = T.Timeline()
        c = T.Clip(media_ref="m", media_type="video", start_frame=0, duration_frames=30)
        nodes = R._composite_nodes("base0", "v1", "b1", c, tl, 0)
        self.assertEqual(len(nodes), 1)
        self.assertIn("overlay=x=", nodes[0])
        self.assertNotIn("blend=", nodes[0])

    def test_blend_clip_uses_blend_recipe(self):
        tl = T.Timeline()
        c = T.Clip(media_ref="m", media_type="video", start_frame=0, duration_frames=30,
                   blend_mode="screen")
        nodes = R._composite_nodes("base0", "v1", "b1", c, tl, 2)
        graph = ";".join(nodes)
        self.assertIn("blend=all_mode=screen", graph)
        self.assertIn("alphaextract", graph)        # alpha-aware
        self.assertIn("alphamerge", graph)
        self.assertIn("[base0]split", graph)         # base reused for blend + composite
        self.assertTrue(graph.rstrip().endswith("[b1]"))   # terminates on the next-base label

    def test_blend_respects_enable_window(self):
        tl = T.Timeline()
        c = T.Clip(media_ref="m", media_type="video", start_frame=30, duration_frames=30,
                   blend_mode="multiply")
        graph = ";".join(R._composite_nodes("b3", "v9", "b4", c, tl, 3))
        self.assertIn("enable='between(t,1.0000,2.0000)'", graph)   # 30..60 frames @30fps


class TestBlendModeModel(unittest.TestCase):
    def test_set_and_clear_via_properties(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, T.Clip(media_ref="m", start_frame=0, duration_frames=30))
        T.set_clip_properties(tl, [c.id], blend_mode="screen")
        self.assertEqual(c.blend_mode, "screen")
        T.set_clip_properties(tl, [c.id], blend_mode="")          # empty clears → normal
        self.assertIsNone(c.blend_mode)

    def test_json_round_trip(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, T.Clip(media_ref="m", start_frame=0, duration_frames=30,
                                     blend_mode="overlay"))
        tl2 = T.Timeline.from_dict(tl.to_dict())
        self.assertEqual(tl2.tracks[0].clips[0].blend_mode, "overlay")


@unittest.skipUnless(os.environ.get("CLIPPILOT_RUN_RENDER") == "1",
                     "render test — set CLIPPILOT_RUN_RENDER=1")
class TestBlendRender(unittest.TestCase):
    _SIZE = "size=320x568:rate=30:duration=1"

    def _src(self, d, name, lavfi):
        from clippilot.media.ffmpeg import run_ffmpeg
        p = os.path.join(d, name)
        run_ffmpeg(["-f", "lavfi", "-i", lavfi, "-pix_fmt", "yuv420p", "-y", p])
        return p

    def test_screen_blend_two_layers_renders(self):
        from clippilot.editor.render import render_timeline
        d = tempfile.mkdtemp(prefix="blendtest_")
        base = self._src(d, "base.mp4", f"color=c=gray:{self._SIZE}")
        top = self._src(d, "top.mp4", f"testsrc2={self._SIZE}")
        tl = T.Timeline(fps=30, width=320, height=568)
        T.add_clip(tl, 0, T.Clip(media_ref=base, media_type="video", start_frame=0,
                                 duration_frames=30))
        T.add_clip(tl, 1, T.Clip(media_ref=top, media_type="video", start_frame=0,
                                  duration_frames=30, blend_mode="screen"))
        out = render_timeline(tl, os.path.join(d, "o.mp4"))
        self.assertTrue(out and os.path.exists(out))

    def test_multiply_with_fade_renders(self):
        from clippilot.editor.render import render_timeline
        d = tempfile.mkdtemp(prefix="blendtest2_")
        base = self._src(d, "base.mp4", f"testsrc2={self._SIZE}")
        top = self._src(d, "top.mp4", f"color=c=orange:{self._SIZE}")
        tl = T.Timeline(fps=30, width=320, height=568)
        T.add_clip(tl, 0, T.Clip(media_ref=base, media_type="video", start_frame=0,
                                 duration_frames=30))
        T.add_clip(tl, 1, T.Clip(media_ref=top, media_type="video", start_frame=0,
                                  duration_frames=30, blend_mode="multiply",
                                  fade_in_frames=10, opacity=0.8))
        out = render_timeline(tl, os.path.join(d, "o.mp4"))
        self.assertTrue(out and os.path.exists(out))


if __name__ == "__main__":
    unittest.main(verbosity=2)
