"""Tests for Adobe Premiere parity — Essential Graphics: text background boxes +
drop shadows (caption-highlight style) and shape clips (rect/ellipse banners)."""
from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

from clippilot.editor import render as R
from clippilot.editor import timeline as T


class TestTextBoxShadow(unittest.TestCase):
    def _draw(self, style):
        tl = T.Timeline(fps=30, width=320, height=568)
        c = T.Clip(media_type="text", start_frame=0, duration_frames=30,
                   text_content="Hi", text_style=style)
        d = tempfile.mkdtemp(prefix="dt_")
        # _drawtext needs a font; if none, returns None — guard
        return R._drawtext(c, tl, Path(d), 0)

    def test_box_and_shadow_options(self):
        s = self._draw(T.TextStyle(box=True, box_color="#112233", box_opacity=0.7, box_border=20,
                                   shadow=True, shadow_color="#000000", shadow_x=4, shadow_y=5,
                                   border_width=8, border_color="#FF0000"))
        if s is None:
            self.skipTest("no font available")
        self.assertIn("box=1", s)
        self.assertIn("boxcolor=0x112233@0.70", s)
        self.assertIn("boxborderw=20", s)
        self.assertIn("shadowcolor=0x000000", s)
        self.assertIn("shadowx=4", s)
        self.assertIn("shadowy=5", s)
        self.assertIn("borderw=8", s)
        self.assertIn("bordercolor=0xFF0000", s)

    def test_no_box_no_shadow_by_default(self):
        s = self._draw(T.TextStyle())
        if s is None:
            self.skipTest("no font available")
        self.assertNotIn("box=1", s)
        self.assertNotIn("shadowx", s)
        self.assertIn("borderw=6", s)                    # default stroke


class TestShapeModel(unittest.TestCase):
    def test_add_shape(self):
        tl = T.Timeline()
        c = T.add_shape(tl, 1, 0, 60, shape_type="rect", fill="#FF0000",
                        transform=T.Transform(center_y=0.85, width=0.9, height=0.12))
        self.assertEqual(c.media_type, "shape")
        self.assertEqual(c.shape, {"type": "rect", "fill": "#FF0000"})
        self.assertEqual(c.transform.height, 0.12)

    def test_invalid_shape_type_defaults_rect(self):
        tl = T.Timeline()
        c = T.add_shape(tl, 1, 0, 30, shape_type="hexagon")
        self.assertEqual(c.shape["type"], "rect")

    def test_round_trip_and_sanitize(self):
        tl = T.Timeline()
        T.add_shape(tl, 1, 0, 30, shape_type="ellipse", fill="#00FF00")
        tl2 = T.Timeline.from_dict(tl.to_dict())
        self.assertEqual(tl2.tracks[1].clips[0].shape["type"], "ellipse")
        bad = tl.to_dict()
        bad["tracks"][1]["clips"][0]["shape"] = "oops"
        self.assertIsNone(T.Timeline.from_dict(bad).tracks[1].clips[0].shape)


class TestShapeChain(unittest.TestCase):
    def test_rect_chain(self):
        tl = T.Timeline(fps=30, width=320, height=568)
        c = T.Clip(media_type="shape", start_frame=30, duration_frames=30, opacity=0.8,
                   shape={"type": "rect", "fill": "#FF8800"},
                   transform=T.Transform(width=0.5, height=0.2))
        chain = R._shape_chain("shp0", c, tl)
        self.assertIn("color=c=0xFF8800:s=160x114", chain)   # 0.5*320, 0.2*568
        self.assertIn("colorchannelmixer=aa=0.800", chain)
        self.assertIn("setpts=PTS-STARTPTS+1.0000/TB", chain)  # start 30f @30fps
        self.assertTrue(chain.endswith("[shp0]"))

    def test_ellipse_has_alpha_mask(self):
        tl = T.Timeline(fps=30, width=320, height=320)
        c = T.Clip(media_type="shape", start_frame=0, duration_frames=30,
                   shape={"type": "ellipse", "fill": "#FFFFFF"},
                   transform=T.Transform(width=0.5, height=0.5))
        chain = R._shape_chain("shp0", c, tl)
        self.assertIn("geq=", chain)
        self.assertIn("a=", chain)


@unittest.skipUnless(os.environ.get("CLIPPILOT_RUN_RENDER") == "1",
                     "render test — set CLIPPILOT_RUN_RENDER=1")
class TestGraphicsRender(unittest.TestCase):
    def test_shapes_and_caption_box_render(self):
        from clippilot.editor.render import render_timeline
        from clippilot.media.ffmpeg import run_ffmpeg
        d = tempfile.mkdtemp(prefix="egtest_")
        src = os.path.join(d, "s.mp4")
        run_ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=320x568:rate=30:duration=1",
                    "-pix_fmt", "yuv420p", "-y", src])
        tl = T.Timeline(fps=30, width=320, height=568)
        T.add_clip(tl, 0, T.Clip(media_ref=src, media_type="video", start_frame=0, duration_frames=30))
        # a lower-third banner (rect) + an ellipse badge
        T.add_shape(tl, 1, 0, 30, "rect", "#000000",
                    transform=T.Transform(center_y=0.85, width=0.95, height=0.14))
        T.add_shape(tl, 1, 0, 30, "ellipse", "#FF3366",
                    transform=T.Transform(center_x=0.85, center_y=0.15, width=0.2, height=0.11))
        # a caption with a background box + shadow
        T.add_text(tl, 2, 0, 30, "BREAKING",
                   style=T.TextStyle(box=True, box_color="#FF0000", box_opacity=0.8, shadow=True))
        out = render_timeline(tl, os.path.join(d, "o.mp4"))
        self.assertTrue(out and os.path.exists(out))


if __name__ == "__main__":
    unittest.main(verbosity=2)
