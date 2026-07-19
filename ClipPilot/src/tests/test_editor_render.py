"""Tests for the timeline renderer (palmier-pro export parity). Pure filter-string
builders are unit-tested; the real composite render is gated behind CLIPPILOT_RUN_RENDER."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.editor import render as R
from clippilot.editor import timeline as T


class TestFilterBuilders(unittest.TestCase):
    def setUp(self):
        self.tl = T.Timeline(fps=30, width=1000, height=2000)

    def test_px_from_transform(self):
        c = T.Clip(start_frame=0, duration_frames=30)
        c.transform = T.Transform(center_x=0.5, center_y=0.5, width=0.5, height=0.25)
        w, h, x, y = R._px(c, self.tl)
        self.assertEqual((w, h), (500, 500))          # 0.5*1000, 0.25*2000
        self.assertEqual((x, y), (250, 750))          # centered

    def test_video_chain_core(self):
        c = T.Clip(media_ref="m", start_frame=30, duration_frames=60, opacity=0.5,
                   fade_in_frames=15)
        s = R._video_chain("1:v", "v1", c, self.tl)
        self.assertIn("scale=", s)
        self.assertIn("colorchannelmixer=aa=0.500", s)   # opacity
        self.assertIn("setpts=(PTS-STARTPTS)", s)        # speed+shift
        self.assertIn("fade=t=in", s)                    # fade-in
        self.assertTrue(s.startswith("[1:v]") and s.endswith("[v1]"))

    def test_video_chain_omits_opacity_when_full(self):
        c = T.Clip(media_ref="m", start_frame=0, duration_frames=30)  # opacity 1.0
        self.assertNotIn("colorchannelmixer", R._video_chain("0:v", "v0", c, self.tl))

    def test_audio_chain(self):
        c = T.Clip(media_ref="m", media_type="audio", start_frame=30, duration_frames=60,
                   volume=0.4, speed=1.5)
        s = R._audio_chain("1:a", "a1", c, self.tl)
        self.assertIn("adelay=1000|1000", s)             # 30 frames / 30fps = 1000ms
        self.assertIn("volume=0.400", s)
        self.assertIn("atempo=1.500", s)


@unittest.skipUnless(os.environ.get("CLIPPILOT_RUN_RENDER") == "1",
                     "render test — set CLIPPILOT_RUN_RENDER=1")
class TestRealComposite(unittest.TestCase):
    def test_renders_multitrack(self):
        from clippilot.media import signals
        from clippilot.media.ffmpeg import run_ffmpeg
        d = tempfile.mkdtemp(prefix="edrendertest_")
        a = os.path.join(d, "a.mp4")
        run_ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=480x360:rate=30:duration=2",
                    "-pix_fmt", "yuv420p", "-y", a])
        tl = T.Timeline(fps=30, width=720, height=1280)
        T.add_clip(tl, 0, T.Clip(media_ref=a, media_type="video", start_frame=0, duration_frames=60))
        pip = T.Clip(media_ref=a, media_type="video", start_frame=0, duration_frames=60, opacity=0.8)
        pip.transform = T.Transform(center_x=0.5, center_y=0.3, width=0.4, height=0.2)
        T.add_clip(tl, 1, pip)
        T.add_text(tl, 2, 0, 60, "HELLO")
        out = R.render_timeline(tl, os.path.join(d, "out.mp4"))
        self.assertTrue(out and os.path.exists(out))
        self.assertAlmostEqual(signals.probe(out).duration_s, 2.0, delta=0.5)


if __name__ == "__main__":
    unittest.main(verbosity=2)
