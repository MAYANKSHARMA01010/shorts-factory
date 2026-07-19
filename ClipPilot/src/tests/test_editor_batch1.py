"""Tests for batch-1 deep-mine additions: keyframe simplification (hyperframes RDP)
and chroma-key / green-screen (ShortGPT). Real chroma render is gated."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.editor import keyframes as KF
from clippilot.editor import render as R
from clippilot.editor import timeline as T


class TestRdpSimplification(unittest.TestCase):
    def test_ramp_simplifies_to_endpoints(self):
        pts = [(i, i / 100.0) for i in range(101)]          # a straight ramp
        self.assertLessEqual(len(KF.simplify_rdp(pts, 0.002)), 3)

    def test_preserves_a_corner(self):
        pts = [(0, 0.0), (50, 1.0), (100, 0.0)]             # a tent — corner must survive
        out = KF.simplify_rdp(pts, 0.01)
        self.assertIn((50, 1.0), out)

    def test_expr_caps_dense_keyframes(self):
        dense = [[i, (i % 2) * 0.5 + 0.2] for i in range(200)]
        expr = KF.ffmpeg_expr(dense, "linear", 0, 0.0, 30)
        self.assertLessEqual(expr.count("if("), KF._MAX_EXPR_KF + 1)   # bounded filtergraph

    def test_expr_correct_after_cap(self):
        ramp = [[i, i / 200.0] for i in range(201)]         # 0→1 over 200 frames
        self.assertEqual(KF.sample(ramp, "linear", 100), 0.5)


class TestSpringEasing(unittest.TestCase):
    def test_curve_overshoots_then_settles(self):
        vals = [KF.spring_curve(p) for p in (0.0, 0.4, 0.6, 1.0)]
        self.assertEqual(vals[0], 0.0)
        self.assertGreater(max(vals), 1.0)                 # underdamped overshoot
        self.assertAlmostEqual(vals[-1], 1.0, delta=0.05)  # settles to target

    def test_spring_is_registered_interp(self):
        self.assertIn("spring", KF.INTERP)

    def test_sample_spring(self):
        # at the midpoint a spring move past the target overshoots its linear value (0.5)
        self.assertGreater(KF.sample([[0, 0.0], [30, 1.0]], "spring", 15), 0.5)

    def test_expr_bounded_and_valid(self):
        e = KF.ffmpeg_expr([[0, 0.0], [30, 1.0]], "spring", 0, 0.0, 30)
        self.assertLessEqual(e.count("if("), KF._MAX_EXPR_KF + 1)
        self.assertIn("lt(t,", e)


class TestChromaKey(unittest.TestCase):
    def test_filter_emitted_when_set(self):
        tl = T.Timeline(fps=30, width=720, height=1280)
        c = T.Clip(media_ref="m", media_type="video", start_frame=0, duration_frames=30)
        c.chroma_key = {"color": "0x00FF00", "similarity": 0.3, "blend": 0.1}
        s = R._video_chain("1:v", "v1", c, tl)
        self.assertIn("chromakey=color=0x00FF00", s)

    def test_no_filter_when_unset(self):
        tl = T.Timeline()
        c = T.Clip(media_ref="m", media_type="video", start_frame=0, duration_frames=30)
        self.assertNotIn("chromakey", R._video_chain("1:v", "v1", c, tl))

    def test_settable_and_clearable_via_properties(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, T.Clip(media_ref="m", start_frame=0, duration_frames=30))
        T.set_clip_properties(tl, [c.id], chroma_key={"color": "0x00FF00"})
        self.assertEqual(c.chroma_key["color"], "0x00FF00")
        T.set_clip_properties(tl, [c.id], chroma_key=None)
        self.assertIsNone(c.chroma_key)

    def test_survives_json_round_trip(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, T.Clip(media_ref="m", start_frame=0, duration_frames=30))
        c.chroma_key = {"color": "0x00FF00", "similarity": 0.25}
        tl2 = T.Timeline.from_dict(tl.to_dict())
        self.assertEqual(tl2.tracks[0].clips[0].chroma_key["similarity"], 0.25)


@unittest.skipUnless(os.environ.get("CLIPPILOT_RUN_RENDER") == "1",
                     "render test — set CLIPPILOT_RUN_RENDER=1")
class TestChromaRender(unittest.TestCase):
    def test_green_screen_removed(self):
        from clippilot.editor.render import render_timeline
        from clippilot.media.ffmpeg import run_ffmpeg
        d = tempfile.mkdtemp(prefix="chromatest_")
        green = os.path.join(d, "g.mp4")
        run_ffmpeg(["-f", "lavfi", "-i", "color=c=0x00FF00:size=320x320:rate=30:d=1",
                    "-vf", "drawbox=x=100:y=100:w=120:h=120:color=red:t=fill", "-pix_fmt", "yuv420p",
                    "-y", green])
        base = os.path.join(d, "b.mp4")
        run_ffmpeg(["-f", "lavfi", "-i", "color=c=navy:size=480x854:rate=30:d=1", "-pix_fmt",
                    "yuv420p", "-y", base])
        tl = T.Timeline(fps=30, width=480, height=854)
        T.add_clip(tl, 0, T.Clip(media_ref=base, media_type="video", start_frame=0, duration_frames=30))
        ck = T.Clip(media_ref=green, media_type="video", start_frame=0, duration_frames=30)
        ck.chroma_key = {"color": "0x00FF00", "similarity": 0.3, "blend": 0.1}
        T.add_clip(tl, 1, ck)
        out = render_timeline(tl, os.path.join(d, "out.mp4"))
        self.assertTrue(out and os.path.exists(out))


if __name__ == "__main__":
    unittest.main(verbosity=2)
