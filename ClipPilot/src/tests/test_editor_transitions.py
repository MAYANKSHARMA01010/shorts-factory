"""Tests for clip-to-clip transitions (MoneyPrinterPlus/moviepy technique): crossfade
(fade) + slide_* via the overlay model. Real crossfade render is gated."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.editor import render as R
from clippilot.editor import timeline as T


class TestTransitionModel(unittest.TestCase):
    def test_lead_for_valid_transition(self):
        c = T.Clip(media_ref="m", start_frame=60, duration_frames=60,
                   transition={"type": "fade", "duration_frames": 15})
        self.assertEqual(R._transition_lead(c), 15)

    def test_lead_zero_without_transition(self):
        self.assertEqual(R._transition_lead(T.Clip(media_ref="m", start_frame=0, duration_frames=30)), 0)

    def test_unknown_type_no_lead(self):
        c = T.Clip(media_ref="m", start_frame=0, duration_frames=30,
                   transition={"type": "bogus", "duration_frames": 10})
        self.assertEqual(R._transition_lead(c), 0)

    def test_settable_and_clearable(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, T.Clip(media_ref="m", start_frame=0, duration_frames=30))
        T.set_clip_properties(tl, [c.id], transition={"type": "slide_left", "duration_frames": 12})
        self.assertEqual(c.transition["type"], "slide_left")
        T.set_clip_properties(tl, [c.id], transition=None)
        self.assertIsNone(c.transition)

    def test_json_round_trip(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, T.Clip(media_ref="m", start_frame=60, duration_frames=60))
        c.transition = {"type": "fade", "duration_frames": 20}
        tl2 = T.Timeline.from_dict(tl.to_dict())
        self.assertEqual(tl2.tracks[0].clips[0].transition["duration_frames"], 20)


class TestTransitionFilters(unittest.TestCase):
    def setUp(self):
        self.tl = T.Timeline(fps=30, width=720, height=1280)

    def test_fade_starts_early_and_crossfades(self):
        c = T.Clip(media_ref="m", media_type="video", start_frame=60, duration_frames=60,
                   transition={"type": "fade", "duration_frames": 30})
        s = R._video_chain("1:v", "v1", c, self.tl)
        # effective start = (60-30)/30 = 1.0s; a fade-in over the lead window
        self.assertIn("setpts=(PTS-STARTPTS)/1.0+1.0000/TB", s)
        self.assertIn("fade=t=in:st=1.0000:d=1.0000", s)

    def test_slide_left_animates_position(self):
        c = T.Clip(media_ref="m", media_type="video", start_frame=30, duration_frames=30,
                   transition={"type": "slide_left", "duration_frames": 15})
        ox, _oy = R._overlay_xy(c, self.tl)
        self.assertIn("clip(", ox)                       # animated x expression


@unittest.skipUnless(os.environ.get("CLIPPILOT_RUN_RENDER") == "1",
                     "render test — set CLIPPILOT_RUN_RENDER=1")
class TestTransitionRender(unittest.TestCase):
    def test_crossfade_renders_full_duration(self):
        from clippilot.editor.render import render_timeline
        from clippilot.media import signals
        from clippilot.media.ffmpeg import run_ffmpeg
        d = tempfile.mkdtemp(prefix="xfadetest_")
        a, b = os.path.join(d, "a.mp4"), os.path.join(d, "b.mp4")
        run_ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=480x854:rate=30:duration=2", "-pix_fmt",
                    "yuv420p", "-y", a])
        run_ffmpeg(["-f", "lavfi", "-i", "mandelbrot=size=480x854:rate=30", "-t", "2", "-pix_fmt",
                    "yuv420p", "-y", b])
        tl = T.Timeline(fps=30, width=480, height=854)
        T.add_clip(tl, 0, T.Clip(media_ref=a, media_type="video", start_frame=0, duration_frames=30))
        cb = T.Clip(media_ref=b, media_type="video", start_frame=30, duration_frames=30,
                    transition={"type": "fade", "duration_frames": 15})
        T.add_clip(tl, 0, cb)
        out = render_timeline(tl, os.path.join(d, "o.mp4"))
        self.assertTrue(out and os.path.exists(out))
        self.assertAlmostEqual(signals.probe(out).duration_s, 2.0, delta=0.4)


if __name__ == "__main__":
    unittest.main(verbosity=2)
