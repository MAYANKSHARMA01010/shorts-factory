"""Tests for keyframe animation (palmier setKeyframes parity): sampling, the ffmpeg
expression compiler, and the set_keyframes op. Animated render is gated."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.editor import keyframes as KF
from clippilot.editor import timeline as T


class TestSampling(unittest.TestCase):
    def test_linear_midpoint(self):
        self.assertAlmostEqual(KF.sample([[0, 0.0], [30, 1.0]], "linear", 15), 0.5)

    def test_hold_steps(self):
        self.assertEqual(KF.sample([[0, 0.0], [30, 1.0]], "hold", 29), 0.0)

    def test_smooth_is_eased(self):
        # smoothstep(0.5) == 0.5 but the curve differs from linear at 0.25
        self.assertLess(KF.sample([[0, 0.0], [30, 1.0]], "smooth", 7.5), 0.25)

    def test_clamps_at_ends(self):
        self.assertEqual(KF.sample([[10, 0.2], [40, 0.9]], "linear", 0), 0.2)
        self.assertEqual(KF.sample([[10, 0.2], [40, 0.9]], "linear", 100), 0.9)

    def test_second_column_position(self):
        # position rows [frame, x, y] — idx=1 reads y
        self.assertAlmostEqual(KF.sample([[0, 0.2, 0.4], [20, 0.8, 0.6]], "linear", 10, idx=1), 0.5)


class TestExprCompiler(unittest.TestCase):
    def test_uses_variable(self):
        e = KF.ffmpeg_expr([[0, 0.0], [30, 1.0]], "linear", 0, 0.0, 30, var="T")
        self.assertIn("lt(T,", e)
        self.assertNotIn("lt(t,", e)

    def test_single_keyframe_is_constant(self):
        self.assertEqual(KF.ffmpeg_expr([[0, 0.7]], "linear", 0, 0.0, 30), "0.70000")

    def test_default_var_is_t(self):
        self.assertIn("lt(t,", KF.ffmpeg_expr([[0, 0.0], [30, 1.0]], "linear", 0, 0.0, 30))


class TestSetKeyframesOp(unittest.TestCase):
    def test_sets_track_on_clip(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, T.Clip(media_ref="m", start_frame=0, duration_frames=60))
        self.assertTrue(T.set_keyframes(tl, c.id, "opacity", [[0, 0.0], [30, 1.0]], "linear"))
        tr = KF.get_track(c, "opacity")
        self.assertIsNotNone(tr)
        self.assertEqual(tr[1], "linear")

    def test_bad_property_rejected(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, T.Clip(media_ref="m", start_frame=0, duration_frames=60))
        self.assertFalse(T.set_keyframes(tl, c.id, "nonsense", [[0, 1]]))

    def test_persists_through_json(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, T.Clip(media_ref="m", start_frame=0, duration_frames=60))
        T.set_keyframes(tl, c.id, "position", [[0, 0.2, 0.5], [60, 0.8, 0.5]], "smooth")
        tl2 = T.Timeline.from_dict(tl.to_dict())
        self.assertIn("position", tl2.tracks[0].clips[0].keyframes)


@unittest.skipUnless(os.environ.get("CLIPPILOT_RUN_RENDER") == "1",
                     "render test — set CLIPPILOT_RUN_RENDER=1")
class TestAnimatedRender(unittest.TestCase):
    def test_fade_and_move_renders(self):
        from clippilot.editor.render import render_timeline
        from clippilot.media import signals
        from clippilot.media.ffmpeg import run_ffmpeg
        d = tempfile.mkdtemp(prefix="kfrendertest_")
        base = os.path.join(d, "b.mp4")
        pip = os.path.join(d, "p.mp4")
        run_ffmpeg(["-f", "lavfi", "-i", "color=c=navy:size=480x854:rate=30", "-t", "2",
                    "-pix_fmt", "yuv420p", "-y", base])
        run_ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=200x200:rate=30:duration=2",
                    "-pix_fmt", "yuv420p", "-y", pip])
        tl = T.Timeline(fps=30, width=480, height=854)
        T.add_clip(tl, 0, T.Clip(media_ref=base, media_type="video", start_frame=0, duration_frames=60))
        p = T.Clip(media_ref=pip, media_type="video", start_frame=0, duration_frames=60)
        p.transform = T.Transform(center_x=0.3, center_y=0.5, width=0.4, height=0.25)
        T.add_clip(tl, 1, p)
        T.set_keyframes(tl, p.id, "opacity", [[0, 0.0], [30, 1.0]], "linear")
        T.set_keyframes(tl, p.id, "position", [[0, 0.3, 0.5], [60, 0.7, 0.5]], "linear")
        out = render_timeline(tl, os.path.join(d, "out.mp4"))
        self.assertTrue(out and os.path.exists(out))
        self.assertAlmostEqual(signals.probe(out).duration_s, 2.0, delta=0.5)


if __name__ == "__main__":
    unittest.main(verbosity=2)
