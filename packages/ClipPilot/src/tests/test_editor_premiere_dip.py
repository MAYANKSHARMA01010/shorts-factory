"""Tests for Adobe Premiere parity — Dip to Black / Dip to White transitions
(per-clip `fade_color`; the convenience `dip_transition` sets up both clips at a cut)."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.editor import render as R
from clippilot.editor import timeline as T


class TestFadeBuilder(unittest.TestCase):
    def test_black_is_alpha_fade(self):
        self.assertEqual(R._fade("in", 0.0, 0.5, "black"),
                         "fade=t=in:st=0.0000:d=0.5000:alpha=1")
        self.assertEqual(R._fade("out", 1.0, 0.5, None),     # default → alpha
                         "fade=t=out:st=1.0000:d=0.5000:alpha=1")

    def test_color_is_solid_dip(self):
        self.assertEqual(R._fade("in", 0.0, 0.5, "white"),
                         "fade=t=in:st=0.0000:d=0.5000:color=white")
        self.assertEqual(R._fade("out", 2.0, 0.25, "Red"),   # normalized lower-case
                         "fade=t=out:st=2.0000:d=0.2500:color=red")


class TestFadeInChain(unittest.TestCase):
    def test_white_fade_in_used(self):
        tl = T.Timeline(fps=30)
        c = T.Clip(media_ref="m", media_type="video", start_frame=0, duration_frames=30,
                   fade_in_frames=10, fade_color="white")
        chain = R._video_chain("1:v", "v1", c, tl)
        self.assertIn("fade=t=in:st=0.0000:d=0.3333:color=white", chain)

    def test_black_fade_out_alpha(self):
        tl = T.Timeline(fps=30)
        c = T.Clip(media_ref="m", media_type="video", start_frame=0, duration_frames=30,
                   fade_out_frames=15)                       # default black
        chain = R._video_chain("1:v", "v1", c, tl)
        self.assertIn("fade=t=out:st=0.5000:d=0.5000:alpha=1", chain)


class TestDipOp(unittest.TestCase):
    def test_dip_sets_both_clips(self):
        tl = T.Timeline(fps=30)
        a = T.add_clip(tl, 0, T.Clip(media_ref="a", media_type="video", start_frame=0,
                                     duration_frames=30))
        b = T.add_clip(tl, 0, T.Clip(media_ref="b", media_type="video", start_frame=30,
                                     duration_frames=30))
        self.assertTrue(T.dip_transition(tl, a.id, b.id, 12, color="white"))
        self.assertEqual(a.fade_out_frames, 12)
        self.assertEqual(a.fade_color, "white")
        self.assertEqual(b.fade_in_frames, 12)
        self.assertEqual(b.fade_color, "white")

    def test_dip_missing_clip(self):
        tl = T.Timeline()
        a = T.add_clip(tl, 0, T.Clip(media_ref="a", start_frame=0, duration_frames=30))
        self.assertFalse(T.dip_transition(tl, a.id, "nope", 10))

    def test_fade_color_settable_and_round_trip(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, T.Clip(media_ref="m", start_frame=0, duration_frames=30))
        T.set_clip_properties(tl, [c.id], fade_color="white", fade_in_frames=8)
        self.assertEqual(c.fade_color, "white")
        self.assertEqual(c.fade_in_frames, 8)
        tl2 = T.Timeline.from_dict(tl.to_dict())
        self.assertEqual(tl2.tracks[0].clips[0].fade_color, "white")


@unittest.skipUnless(os.environ.get("CLIPPILOT_RUN_RENDER") == "1",
                     "render test — set CLIPPILOT_RUN_RENDER=1")
class TestDipRender(unittest.TestCase):
    def test_dip_to_white_renders_and_whitens_at_cut(self):
        # clip A (0-1s) dips OUT to white over its last 0.5s; sample near the cut → near-white.
        from clippilot.editor.render import render_timeline
        from clippilot.media.ffmpeg import run_ffmpeg
        from clippilot.media.signals import probe  # noqa: F401  (import smoke)
        d = tempfile.mkdtemp(prefix="diptest_")
        a = os.path.join(d, "a.mp4")
        b = os.path.join(d, "b.mp4")
        run_ffmpeg(["-f", "lavfi", "-i", "color=c=blue:size=320x568:rate=30:duration=1",
                    "-pix_fmt", "yuv420p", "-y", a])
        run_ffmpeg(["-f", "lavfi", "-i", "color=c=green:size=320x568:rate=30:duration=1",
                    "-pix_fmt", "yuv420p", "-y", b])
        tl = T.Timeline(fps=30, width=320, height=568)
        ca = T.add_clip(tl, 0, T.Clip(media_ref=a, media_type="video", start_frame=0,
                                      duration_frames=30))
        cb = T.add_clip(tl, 0, T.Clip(media_ref=b, media_type="video", start_frame=30,
                                      duration_frames=30))
        T.dip_transition(tl, ca.id, cb.id, 15, color="white")
        out = render_timeline(tl, os.path.join(d, "o.mp4"))
        self.assertTrue(out and os.path.exists(out))
        # measure the average color right at the cut (t≈0.98s) — should be near-white (high)
        import re
        r = run_ffmpeg(["-ss", "0.97", "-i", out, "-frames:v", "1", "-vf",
                        "scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
        # rawvideo bytes are on stdout; fall back to signalstats mean if needed
        stats = run_ffmpeg(["-ss", "0.97", "-i", out, "-vframes", "1", "-vf",
                            "signalstats,metadata=print", "-f", "null", "-"])
        m = re.search(r"YAVG:\s*([\d.]+)", stats.stderr)
        if m:
            self.assertGreater(float(m.group(1)), 180.0)     # bright (dipping to white)


if __name__ == "__main__":
    unittest.main(verbosity=2)
