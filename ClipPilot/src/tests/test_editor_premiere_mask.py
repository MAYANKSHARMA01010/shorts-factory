"""Tests for Adobe Premiere parity — region masks: blur / pixelate a rectangular
region of a clip (face/logo privacy blur). Built via a split→crop→process→overlay
subgraph in render._region_subgraph, added with the editor_blur_region MCP tool."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.editor import render as R
from clippilot.editor import timeline as T


class TestRegionDetection(unittest.TestCase):
    def test_region_effects_filtered(self):
        eff = [{"type": "gaussian_blur", "amount": 4}, {"type": "region_blur", "x": 0.1},
               {"type": "region_pixelate", "x": 0.5}]
        regions = R._region_effects(eff)
        self.assertEqual([r["type"] for r in regions], ["region_blur", "region_pixelate"])
        # region effects do NOT appear in the linear chain (handled by the subgraph)
        self.assertIsNone(R._one_effect({"type": "region_blur"}, 100, 100))

    def test_none_when_no_regions(self):
        self.assertEqual(R._region_effects([{"type": "invert"}]), [])
        self.assertEqual(R._region_effects(None), [])


class TestRegionSubgraph(unittest.TestCase):
    def test_blur_subgraph(self):
        tl = T.Timeline(width=320, height=568)
        c = T.Clip(media_ref="m", media_type="video", start_frame=0, duration_frames=30)
        nodes = R._region_subgraph("v1", "out", c, tl,
                                   [{"type": "region_blur", "x": 0.25, "y": 0.1,
                                     "w": 0.5, "h": 0.3, "amount": 20}], 0)
        graph = ";".join(nodes)
        self.assertIn("[v1]split[rb0_0][rs0_0]", graph)
        self.assertIn("crop=160:170:80:57,gblur=sigma=20.00", graph)   # 0.5*320, 0.3*568, 0.25*320, round(0.1*568)
        self.assertIn("overlay=x=80:y=57:format=auto[out]", graph)

    def test_pixelate_subgraph(self):
        tl = T.Timeline(width=320, height=568)
        c = T.Clip(media_ref="m", media_type="video", start_frame=0, duration_frames=30)
        nodes = R._region_subgraph("v1", "out", c, tl,
                                   [{"type": "region_pixelate", "x": 0.0, "y": 0.0,
                                     "w": 0.5, "h": 0.5, "amount": 10}], 1)
        graph = ";".join(nodes)
        self.assertIn("scale=iw/10:ih/10:flags=neighbor", graph)

    def test_two_regions_chain(self):
        tl = T.Timeline(width=320, height=568)
        c = T.Clip(media_ref="m", media_type="video", start_frame=0, duration_frames=30)
        nodes = R._region_subgraph("v1", "out", c, tl,
                                   [{"type": "region_blur", "x": 0.0, "y": 0.0, "w": 0.3, "h": 0.3},
                                    {"type": "region_blur", "x": 0.6, "y": 0.6, "w": 0.3, "h": 0.3}], 2)
        graph = ";".join(nodes)
        self.assertIn("[rg2_0]", graph)         # first region's output feeds the second
        self.assertTrue(graph.rstrip().endswith("[out]"))

    def test_ellipse_adds_feathered_alpha(self):
        tl = T.Timeline(width=320, height=568)
        c = T.Clip(media_ref="m", media_type="video", start_frame=0, duration_frames=30)
        nodes = R._region_subgraph("v1", "out", c, tl,
                                   [{"type": "region_blur", "x": 0.2, "y": 0.2, "w": 0.4, "h": 0.4,
                                     "shape": "ellipse", "amount": 20}], 0)
        graph = ";".join(nodes)
        self.assertIn("gblur=sigma=20.00", graph)
        self.assertIn("format=rgba,geq=", graph)         # elliptical alpha mask applied
        self.assertIn("a='255*(1-clip(", graph)

    def test_clamped_within_layer(self):
        tl = T.Timeline(width=320, height=568)
        c = T.Clip(media_ref="m", media_type="video", start_frame=0, duration_frames=30)
        # region extends past the right/bottom edge → crop dims clamped within the layer
        nodes = R._region_subgraph("v1", "out", c, tl,
                                   [{"type": "region_blur", "x": 0.9, "y": 0.9, "w": 0.5, "h": 0.5}], 0)
        graph = ";".join(nodes)
        self.assertNotIn("crop=-", graph)       # no negative dims


class TestMaskOp(unittest.TestCase):
    def test_blur_region_via_add_effect(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, T.Clip(media_ref="m", start_frame=0, duration_frames=30))
        T.add_effect(tl, [c.id], {"type": "region_blur", "x": 0.3, "y": 0.2, "w": 0.4, "h": 0.4,
                                  "amount": 25})
        self.assertEqual(c.effects[0]["type"], "region_blur")
        # survives the normal FX-stack round trip
        tl2 = T.Timeline.from_dict(tl.to_dict())
        self.assertEqual(tl2.tracks[0].clips[0].effects[0]["w"], 0.4)


@unittest.skipUnless(os.environ.get("CLIPPILOT_RUN_RENDER") == "1",
                     "render test — set CLIPPILOT_RUN_RENDER=1")
class TestMaskRender(unittest.TestCase):
    def test_region_blur_and_pixelate_render(self):
        from clippilot.editor.render import render_timeline
        from clippilot.media.ffmpeg import run_ffmpeg
        d = tempfile.mkdtemp(prefix="masktest_")
        src = os.path.join(d, "s.mp4")
        run_ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=320x568:rate=30:duration=1",
                    "-pix_fmt", "yuv420p", "-y", src])
        tl = T.Timeline(fps=30, width=320, height=568)
        c = T.Clip(media_ref=src, media_type="video", start_frame=0, duration_frames=30,
                   effects=[{"type": "region_blur", "x": 0.1, "y": 0.1, "w": 0.4, "h": 0.3,
                             "amount": 18},
                            {"type": "region_pixelate", "x": 0.55, "y": 0.6, "w": 0.35, "h": 0.3,
                             "amount": 12, "shape": "ellipse"}])     # elliptical pixelate (face blur)
        T.add_clip(tl, 0, c)
        out = render_timeline(tl, os.path.join(d, "o.mp4"))
        self.assertTrue(out and os.path.exists(out))


if __name__ == "__main__":
    unittest.main(verbosity=2)
