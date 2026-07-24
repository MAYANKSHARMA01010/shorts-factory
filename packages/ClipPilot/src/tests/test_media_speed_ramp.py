"""Tests for speed ramps / time remapping (Premiere parity) — trim+setpts+concat
pre-process baking variable within-clip speed into a new video file."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.media import speed_ramp as SR


class TestRampMath(unittest.TestCase):
    def test_output_frames(self):
        segs = [{"start_frame": 0, "end_frame": 30, "speed": 1.0},     # 30 → 30
                {"start_frame": 30, "end_frame": 45, "speed": 0.5},    # 15 → 30 (slow-mo)
                {"start_frame": 45, "end_frame": 105, "speed": 2.0}]   # 60 → 30 (fast)
        self.assertEqual(SR.ramp_output_frames(segs, 30), 90)

    def test_zero_length_segments_ignored(self):
        segs = [{"start_frame": 0, "end_frame": 0, "speed": 1.0},
                {"start_frame": 0, "end_frame": 30, "speed": 1.0}]
        self.assertEqual(SR.ramp_output_frames(segs, 30), 30)


class TestRampFilter(unittest.TestCase):
    def test_filtergraph_built(self):
        segs = [{"start_frame": 0, "end_frame": 30, "speed": 1.0},
                {"start_frame": 30, "end_frame": 60, "speed": 0.5}]
        fg = SR._ramp_filter(segs, 30)
        self.assertIn("[0:v]trim=0.0000:1.0000,setpts=(PTS-STARTPTS)/1.0000[rv0]", fg)
        self.assertIn("[0:v]trim=1.0000:2.0000,setpts=(PTS-STARTPTS)/0.5000[rv1]", fg)
        self.assertIn("[rv0][rv1]concat=n=2:v=1:a=0", fg)

    def test_speed_clamped(self):
        fg = SR._ramp_filter([{"start_frame": 0, "end_frame": 30, "speed": 999}], 30)
        self.assertIn("setpts=(PTS-STARTPTS)/20.0000", fg)            # clamped to 20x

    def test_empty_returns_none(self):
        self.assertIsNone(SR._ramp_filter([], 30))
        self.assertIsNone(SR._ramp_filter([{"start_frame": 5, "end_frame": 5}], 30))

    def test_missing_input(self):
        self.assertIsNone(SR.speed_ramp("/no/file.mp4", os.path.join(tempfile.mkdtemp(), "o.mp4"),
                                        [{"start_frame": 0, "end_frame": 30, "speed": 1}], 30))


@unittest.skipUnless(os.environ.get("CLIPPILOT_RUN_RENDER") == "1",
                     "render test — set CLIPPILOT_RUN_RENDER=1")
class TestRampRender(unittest.TestCase):
    def test_ramp_changes_duration_as_predicted(self):
        from clippilot.media.ffmpeg import run_ffmpeg
        from clippilot.media.signals import probe
        d = tempfile.mkdtemp(prefix="ramptest_")
        src = os.path.join(d, "s.mp4")
        # 4s source @30fps = 120 frames
        run_ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=320x568:rate=30:duration=4",
                    "-pix_fmt", "yuv420p", "-y", src])
        # 30f normal + 15f at 0.5x (→30) + 30f at 2x (→15)  = 75 output frames = 2.5s
        segs = [{"start_frame": 0, "end_frame": 30, "speed": 1.0},
                {"start_frame": 30, "end_frame": 45, "speed": 0.5},
                {"start_frame": 45, "end_frame": 75, "speed": 2.0}]
        out = SR.speed_ramp(src, os.path.join(d, "ramped.mp4"), segs, 30)
        self.assertTrue(out and os.path.exists(out))
        self.assertEqual(SR.ramp_output_frames(segs, 30), 75)
        self.assertAlmostEqual(probe(out).duration_s, 75 / 30, delta=0.2)   # ~2.5s


if __name__ == "__main__":
    unittest.main(verbosity=2)
