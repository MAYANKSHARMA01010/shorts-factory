"""Tests for Adobe Premiere parity — the per-clip video effect stack
(Blur & Sharpen / Stylize / Distort / Image Control) and the geometric flip fix.

Effects are an ordered list `Clip.effects=[{type,...params}]` compiled to ffmpeg
filters in `render._video_chain`, settable via set_clip_properties (replace stack)
or add_effect (append one) / the editor_add_effect MCP tool."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.editor import render as R
from clippilot.editor import timeline as T


class TestEffectBuilders(unittest.TestCase):
    def test_blur_sharpen(self):
        self.assertEqual(R._one_effect({"type": "gaussian_blur", "amount": 12}, 100, 100),
                         "gblur=sigma=12.000")
        self.assertEqual(R._one_effect({"type": "box_blur", "amount": 6}, 100, 100), "boxblur=6:1")
        self.assertEqual(R._one_effect({"type": "sharpen", "amount": 2}, 100, 100),
                         "unsharp=5:5:2.000:5:5:0.0")

    def test_stylize(self):
        self.assertEqual(R._one_effect({"type": "invert"}, 10, 10), "negate")
        self.assertEqual(R._one_effect({"type": "grayscale"}, 10, 10), "hue=s=0")
        self.assertTrue(R._one_effect({"type": "sepia"}, 10, 10).startswith("colorchannelmixer="))
        self.assertEqual(R._one_effect({"type": "edges"}, 10, 10), "edgedetect=mode=colormix:high=0.4")
        self.assertEqual(R._one_effect({"type": "hflip"}, 10, 10), "hflip")
        self.assertEqual(R._one_effect({"type": "vflip"}, 10, 10), "vflip")

    def test_param_effects(self):
        self.assertEqual(R._one_effect({"type": "hue", "degrees": 90}, 10, 10), "hue=h=90.0")
        self.assertEqual(R._one_effect({"type": "vibrance", "amount": 1.0}, 10, 10),
                         "vibrance=intensity=1.000")
        self.assertEqual(R._one_effect({"type": "vignette"}, 10, 10), "vignette=angle=0.6280")
        self.assertEqual(R._one_effect({"type": "noise", "amount": 30}, 10, 10),
                         "noise=alls=30:allf=t")

    def test_pixelate_uses_canvas_size(self):
        self.assertEqual(R._one_effect({"type": "pixelate", "size": 8}, 320, 568),
                         "scale=iw/8:ih/8:flags=neighbor,scale=320:568:flags=neighbor")

    def test_clamping_and_defaults(self):
        # out-of-range / missing / non-numeric params are clamped or defaulted, never crash
        self.assertEqual(R._one_effect({"type": "gaussian_blur", "amount": 9999}, 10, 10),
                         "gblur=sigma=100.000")
        self.assertEqual(R._one_effect({"type": "gaussian_blur", "amount": "oops"}, 10, 10),
                         "gblur=sigma=8.000")            # default
        self.assertEqual(R._one_effect({"type": "gaussian_blur"}, 10, 10), "gblur=sigma=8.000")

    def test_unknown_and_malformed_dropped(self):
        self.assertIsNone(R._one_effect({"type": "nope"}, 10, 10))
        self.assertIsNone(R._one_effect("not a dict", 10, 10))
        self.assertIsNone(R._one_effect({}, 10, 10))

    def test_effect_filters_orders_and_filters(self):
        fx = [{"type": "gaussian_blur", "amount": 4}, {"type": "bogus"}, {"type": "invert"}]
        self.assertEqual(R._effect_filters(fx, 10, 10), ["gblur=sigma=4.000", "negate"])
        self.assertEqual(R._effect_filters(None, 10, 10), [])      # not a list → []


class TestEffectsInChain(unittest.TestCase):
    def test_stack_applied_after_color(self):
        tl = T.Timeline()
        c = T.Clip(media_ref="m", media_type="video", start_frame=0, duration_frames=30,
                   color={"saturation": 1.4},
                   effects=[{"type": "gaussian_blur", "amount": 5}, {"type": "grayscale"}])
        chain = R._video_chain("1:v", "v1", c, tl)
        self.assertIn("eq=saturation=1.400", chain)
        self.assertIn("gblur=sigma=5.000", chain)
        self.assertIn("hue=s=0", chain)
        # effects come after the color grade in the chain
        self.assertLess(chain.index("saturation"), chain.index("gblur"))

    def test_transform_flips_now_applied(self):
        tl = T.Timeline()
        c = T.Clip(media_ref="m", media_type="video", start_frame=0, duration_frames=30,
                   transform=T.Transform(flip_h=True, flip_v=True))
        chain = R._video_chain("1:v", "v1", c, tl)
        self.assertIn("hflip", chain)
        self.assertIn("vflip", chain)

    def test_no_effects_no_change(self):
        tl = T.Timeline()
        c = T.Clip(media_ref="m", media_type="video", start_frame=0, duration_frames=30)
        chain = R._video_chain("1:v", "v1", c, tl)
        self.assertNotIn("gblur", chain)
        self.assertNotIn("negate", chain)


class TestEffectOps(unittest.TestCase):
    def test_add_effect_appends(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, T.Clip(media_ref="m", start_frame=0, duration_frames=30))
        self.assertEqual(T.add_effect(tl, [c.id], {"type": "sharpen", "amount": 1.5}), 1)
        self.assertEqual(T.add_effect(tl, [c.id], {"type": "vignette"}), 1)
        self.assertEqual([e["type"] for e in c.effects], ["sharpen", "vignette"])  # order preserved

    def test_add_effect_requires_type(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, T.Clip(media_ref="m", start_frame=0, duration_frames=30))
        self.assertEqual(T.add_effect(tl, [c.id], {"amount": 4}), 0)   # no type → no-op
        self.assertEqual(T.add_effect(tl, ["nonexistent"], {"type": "invert"}), 0)
        self.assertEqual(c.effects, [])

    def test_set_properties_replaces_and_clears(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, T.Clip(media_ref="m", start_frame=0, duration_frames=30))
        T.set_clip_properties(tl, [c.id], effects=[{"type": "invert"}, {"type": "junk", "bad": 1}])
        self.assertEqual([e["type"] for e in c.effects], ["invert", "junk"])  # kept as dicts (render drops junk)
        T.set_clip_properties(tl, [c.id], effects=None)
        self.assertEqual(c.effects, [])

    def test_json_round_trip_and_malformed(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, T.Clip(media_ref="m", start_frame=0, duration_frames=30,
                                     effects=[{"type": "pixelate", "size": 12}]))
        tl2 = T.Timeline.from_dict(tl.to_dict())
        self.assertEqual(tl2.tracks[0].clips[0].effects[0]["type"], "pixelate")
        # a malformed effects value (not a list, or non-dict items) is sanitized on load
        bad = tl.to_dict()
        bad["tracks"][0]["clips"][0]["effects"] = "oops"
        self.assertEqual(T.Timeline.from_dict(bad).tracks[0].clips[0].effects, [])
        bad["tracks"][0]["clips"][0]["effects"] = [{"type": "ok"}, 5, "x"]
        self.assertEqual(T.Timeline.from_dict(bad).tracks[0].clips[0].effects, [{"type": "ok"}])


@unittest.skipUnless(os.environ.get("CLIPPILOT_RUN_RENDER") == "1",
                     "render test — set CLIPPILOT_RUN_RENDER=1")
class TestEffectsRender(unittest.TestCase):
    def test_blur_vignette_pixelate_render(self):
        from clippilot.editor.render import render_timeline
        from clippilot.media.ffmpeg import run_ffmpeg
        d = tempfile.mkdtemp(prefix="fxtest_")
        src = os.path.join(d, "s.mp4")
        run_ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=320x568:rate=30:duration=1",
                    "-pix_fmt", "yuv420p", "-y", src])
        tl = T.Timeline(fps=30, width=320, height=568)
        c = T.Clip(media_ref=src, media_type="video", start_frame=0, duration_frames=30,
                   effects=[{"type": "gaussian_blur", "amount": 6}, {"type": "vignette"},
                            {"type": "pixelate", "size": 6}])
        T.add_clip(tl, 0, c)
        out = render_timeline(tl, os.path.join(d, "o.mp4"))
        self.assertTrue(out and os.path.exists(out))

    def test_sepia_edges_flip_render(self):
        from clippilot.editor.render import render_timeline
        from clippilot.media.ffmpeg import run_ffmpeg
        d = tempfile.mkdtemp(prefix="fxtest2_")
        src = os.path.join(d, "s.mp4")
        run_ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=320x568:rate=30:duration=1",
                    "-pix_fmt", "yuv420p", "-y", src])
        tl = T.Timeline(fps=30, width=320, height=568)
        c = T.Clip(media_ref=src, media_type="video", start_frame=0, duration_frames=30,
                   transform=T.Transform(flip_h=True),
                   effects=[{"type": "sepia"}, {"type": "edges"}])
        T.add_clip(tl, 0, c)
        out = render_timeline(tl, os.path.join(d, "o.mp4"))
        self.assertTrue(out and os.path.exists(out))


if __name__ == "__main__":
    unittest.main(verbosity=2)
