"""Tests for Adobe Premiere parity — Lumetri Creative LUT / Look (.cube 3D LUTs).

A clip's color.lut is a built-in look name (generated into an identity grid) or a .cube
file path; render copies/generates it into the workdir and applies `lut3d=<barename>`."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.editor import lut as L
from clippilot.editor import render as R
from clippilot.editor import timeline as T


class TestGenerateCube(unittest.TestCase):
    def test_writes_valid_cube(self):
        d = tempfile.mkdtemp(prefix="cube_")
        p = L.generate_cube("teal_orange", os.path.join(d, "t.cube"), size=9)
        self.assertTrue(p and os.path.exists(p))
        text = open(p).read().splitlines()
        self.assertEqual(text[0], "LUT_3D_SIZE 9")
        data = [ln for ln in text if ln and not ln.startswith("LUT_3D_SIZE")]
        self.assertEqual(len(data), 9 ** 3)               # size^3 entries
        for ln in data[:50]:                              # all components within [0,1]
            r, g, b = map(float, ln.split())
            self.assertTrue(0.0 <= r <= 1.0 and 0.0 <= g <= 1.0 and 0.0 <= b <= 1.0)

    def test_bw_is_grayscale(self):
        # for the bw look every entry has r == g == b
        d = tempfile.mkdtemp(prefix="cube_")
        p = L.generate_cube("bw", os.path.join(d, "bw.cube"), size=5)
        for ln in [x for x in open(p).read().splitlines() if x and x[0].isdigit()][:30]:
            r, g, b = map(float, ln.split())
            self.assertAlmostEqual(r, g, places=4)
            self.assertAlmostEqual(g, b, places=4)

    def test_unknown_look(self):
        self.assertIsNone(L.generate_cube("nope", os.path.join(tempfile.mkdtemp(), "x.cube")))


class TestResolveLut(unittest.TestCase):
    def test_builtin_generated(self):
        d = tempfile.mkdtemp(prefix="rlut_")
        name = L.resolve_lut("warm", d, 3)
        self.assertEqual(name, "lut_3.cube")
        self.assertTrue(os.path.exists(os.path.join(d, "lut_3.cube")))

    def test_file_copied(self):
        d = tempfile.mkdtemp(prefix="rlut_")
        src = os.path.join(d, "mylook.cube")
        L.generate_cube("cool", src, size=5)
        name = L.resolve_lut(src, d, 7)
        self.assertEqual(name, "lut_7.cube")
        self.assertTrue(os.path.exists(os.path.join(d, "lut_7.cube")))

    def test_bad_refs(self):
        d = tempfile.mkdtemp(prefix="rlut_")
        self.assertIsNone(L.resolve_lut("", d, 0))
        self.assertIsNone(L.resolve_lut("/no/such/file.cube", d, 1))
        self.assertIsNone(L.resolve_lut(None, d, 2))      # type: ignore[arg-type]


class TestLutInColorFilters(unittest.TestCase):
    def test_lut3d_emitted_with_name(self):
        fl = R._color_filters({"saturation": 1.2}, lut_name="lut_0.cube")
        self.assertIn("lut3d=lut_0.cube", ";".join(fl))
        self.assertIn("eq=saturation=1.200", ";".join(fl))

    def test_lut3d_alone(self):
        self.assertEqual(R._color_filters(None, lut_name="lut_2.cube"), ["lut3d=lut_2.cube"])

    def test_no_lut_without_name(self):
        # raw color.lut alone does NOT emit lut3d (must be resolved to a workdir file first)
        self.assertEqual(R._color_filters({"lut": "warm"}), [])

    def test_video_chain_threads_lut(self):
        tl = T.Timeline()
        c = T.Clip(media_ref="m", media_type="video", start_frame=0, duration_frames=30)
        self.assertIn("lut3d=lut_5.cube", R._video_chain("1:v", "v1", c, tl, lut_name="lut_5.cube"))


class TestApplyLutOp(unittest.TestCase):
    def test_apply_and_clear_merges_color(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, T.Clip(media_ref="m", start_frame=0, duration_frames=30,
                                     color={"saturation": 1.3}))
        self.assertEqual(T.apply_lut(tl, [c.id], "teal_orange"), 1)
        self.assertEqual(c.color["lut"], "teal_orange")
        self.assertEqual(c.color["saturation"], 1.3)      # existing grade preserved
        T.apply_lut(tl, [c.id], None)
        self.assertNotIn("lut", c.color)
        self.assertEqual(c.color["saturation"], 1.3)

    def test_apply_to_clip_without_color(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, T.Clip(media_ref="m", start_frame=0, duration_frames=30))
        T.apply_lut(tl, [c.id], "vintage")
        self.assertEqual(c.color, {"lut": "vintage"})


@unittest.skipUnless(os.environ.get("CLIPPILOT_RUN_RENDER") == "1",
                     "render test — set CLIPPILOT_RUN_RENDER=1")
class TestLutRender(unittest.TestCase):
    def test_builtin_look_renders(self):
        from clippilot.editor.render import render_timeline
        from clippilot.media.ffmpeg import run_ffmpeg
        d = tempfile.mkdtemp(prefix="luttest_")
        src = os.path.join(d, "s.mp4")
        run_ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=320x568:rate=30:duration=1",
                    "-pix_fmt", "yuv420p", "-y", src])
        tl = T.Timeline(fps=30, width=320, height=568)
        c = T.Clip(media_ref=src, media_type="video", start_frame=0, duration_frames=30,
                   color={"lut": "teal_orange"})
        T.add_clip(tl, 0, c)
        out = render_timeline(tl, os.path.join(d, "o.mp4"))
        self.assertTrue(out and os.path.exists(out))

    def test_file_lut_renders(self):
        from clippilot.editor.render import render_timeline
        from clippilot.media.ffmpeg import run_ffmpeg
        d = tempfile.mkdtemp(prefix="luttest2_")
        src = os.path.join(d, "s.mp4")
        run_ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=320x568:rate=30:duration=1",
                    "-pix_fmt", "yuv420p", "-y", src])
        cube = os.path.join(d, "look.cube")
        L.generate_cube("warm", cube, size=17)
        tl = T.Timeline(fps=30, width=320, height=568)
        c = T.Clip(media_ref=src, media_type="video", start_frame=0, duration_frames=30,
                   color={"lut": cube, "contrast": 1.1})
        T.add_clip(tl, 0, c)
        out = render_timeline(tl, os.path.join(d, "o.mp4"))
        self.assertTrue(out and os.path.exists(out))


if __name__ == "__main__":
    unittest.main(verbosity=2)
