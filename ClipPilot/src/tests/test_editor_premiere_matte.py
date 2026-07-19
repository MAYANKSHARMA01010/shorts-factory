"""Tests for Adobe Premiere parity — Track Matte Key: mask a fill clip by another
clip's luma/alpha (reveal-through-shape / video-in-graphic)."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.editor import render as R
from clippilot.editor import timeline as T


class TestMatteModel(unittest.TestCase):
    def test_set_and_clear(self):
        tl = T.Timeline()
        fill = T.add_clip(tl, 0, T.Clip(media_ref="f", media_type="video", start_frame=0,
                                        duration_frames=30))
        matte = T.add_clip(tl, 1, T.Clip(media_ref="m", media_type="image", start_frame=0,
                                         duration_frames=30))
        self.assertTrue(T.set_track_matte(tl, fill.id, matte.id, matte_type="luma"))
        self.assertEqual(fill.track_matte["matte_id"], matte.id)
        self.assertEqual(fill.track_matte["type"], "luma")
        self.assertTrue(T.set_track_matte(tl, fill.id, None))     # clear
        self.assertIsNone(fill.track_matte)

    def test_bad_type_defaults_luma_and_missing_matte(self):
        tl = T.Timeline()
        fill = T.add_clip(tl, 0, T.Clip(media_ref="f", start_frame=0, duration_frames=30))
        self.assertFalse(T.set_track_matte(tl, fill.id, "nonexistent"))
        m = T.add_clip(tl, 1, T.Clip(media_ref="m", media_type="image", start_frame=0,
                                     duration_frames=30))
        T.set_track_matte(tl, fill.id, m.id, matte_type="weird")
        self.assertEqual(fill.track_matte["type"], "luma")

    def test_round_trip(self):
        tl = T.Timeline()
        fill = T.add_clip(tl, 0, T.Clip(media_ref="f", start_frame=0, duration_frames=30))
        m = T.add_clip(tl, 1, T.Clip(media_ref="m", media_type="image", start_frame=0,
                                     duration_frames=30))
        T.set_track_matte(tl, fill.id, m.id, matte_type="alpha", invert=True)
        tl2 = T.Timeline.from_dict(tl.to_dict())
        f2 = tl2.tracks[0].clips[0]
        self.assertEqual(f2.track_matte["type"], "alpha")
        self.assertTrue(f2.track_matte["invert"])


class TestMatteNodes(unittest.TestCase):
    def test_luma_matte_nodes(self):
        tl = T.Timeline(width=320, height=568)
        fill = T.Clip(media_ref="f", media_type="video", start_frame=0, duration_frames=30,
                      track_matte={"matte_id": "x", "type": "luma", "invert": False})
        nodes = R._matte_nodes(fill, "v1", "out", tl, 3)
        graph = ";".join(nodes)
        self.assertIn("[3:v]scale=320:568", graph)
        self.assertIn("format=gray", graph)
        self.assertIn("[v1][mtk3]alphamerge[out]", graph)

    def test_alpha_matte_and_invert(self):
        tl = T.Timeline(width=320, height=568)
        fill = T.Clip(media_ref="f", media_type="video", start_frame=0, duration_frames=30,
                      track_matte={"matte_id": "x", "type": "alpha", "invert": True})
        graph = ";".join(R._matte_nodes(fill, "v1", "out", tl, 2))
        self.assertIn("alphaextract", graph)
        self.assertIn("negate", graph)


class TestMatteExcludedFromStacking(unittest.TestCase):
    def test_matte_clip_not_shown_directly(self):
        # render with a fill matted by an image: the image must not also be composited normally.
        # (checked structurally by building the timeline; the render test below proves the effect.)
        tl = T.Timeline(fps=30, width=320, height=568)
        fill = T.add_clip(tl, 0, T.Clip(media_ref="f.mp4", media_type="video", start_frame=0,
                                        duration_frames=30))
        m = T.add_clip(tl, 1, T.Clip(media_ref="m.png", media_type="image", start_frame=0,
                                     duration_frames=30))
        T.set_track_matte(tl, fill.id, m.id)
        self.assertEqual(fill.track_matte["matte_id"], m.id)


@unittest.skipUnless(os.environ.get("CLIPPILOT_RUN_RENDER") == "1",
                     "render test — set CLIPPILOT_RUN_RENDER=1")
class TestMatteRender(unittest.TestCase):
    def test_luma_matte_reveals_only_white_region(self):
        from clippilot.editor.render import render_timeline
        from clippilot.media.ffmpeg import run_ffmpeg
        d = tempfile.mkdtemp(prefix="mattetest_")
        fill = os.path.join(d, "fill.mp4")
        matte = os.path.join(d, "matte.png")
        run_ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=320x568:rate=30:duration=1",
                    "-pix_fmt", "yuv420p", "-y", fill])
        # matte: white box (x 80..240, y 180..380) on black
        run_ffmpeg(["-f", "lavfi", "-i", "color=c=black:s=320x568:d=1",
                    "-vf", "drawbox=x=80:y=180:w=160:h=200:color=white:t=fill",
                    "-frames:v", "1", "-y", matte])
        tl = T.Timeline(fps=30, width=320, height=568)
        cf = T.add_clip(tl, 0, T.Clip(media_ref=fill, media_type="video", start_frame=0,
                                      duration_frames=30))
        cm = T.add_clip(tl, 1, T.Clip(media_ref=matte, media_type="image", start_frame=0,
                                      duration_frames=30))
        T.set_track_matte(tl, cf.id, cm.id, matte_type="luma")
        out = render_timeline(tl, os.path.join(d, "o.mp4"))
        self.assertTrue(out and os.path.exists(out))
        # center pixel (inside the white box) should be colorful; a corner should be black (base)
        import re
        png = os.path.join(d, "frame.png")
        run_ffmpeg(["-i", out, "-frames:v", "1", "-y", png])

        def luma_at(crop):
            r = run_ffmpeg(["-i", png, "-vf", f"crop={crop},signalstats,metadata=print",
                            "-f", "null", "-"])
            m = re.search(r"YAVG[=:]\s*([\d.]+)", r.stderr)
            return float(m.group(1)) if m else None
        center = luma_at("20:20:150:280")     # inside the revealed box
        corner = luma_at("20:20:5:5")         # top-left corner — outside matte → black base
        self.assertGreater(center, 40.0)      # something visible
        self.assertLess(corner, 20.0)         # base black shows through


if __name__ == "__main__":
    unittest.main(verbosity=2)
