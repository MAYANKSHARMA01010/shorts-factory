"""Tests for free-archive motion b-roll (Pexels/Pixabay video parsers + selection)
and the motion-montage assembly. Render test gated behind CLIPPILOT_RUN_RENDER."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.generate import broll


class TestVideoParsers(unittest.TestCase):
    def test_pexels_prefers_portrait(self):
        data = {"videos": [{"duration": 10, "video_files": [
            {"link": "http://p/land.mp4", "width": 1920, "height": 1080},
            {"link": "http://p/port.mp4", "width": 1080, "height": 1920}]}]}
        self.assertEqual(broll._parse_pexels_videos(data, 1), ["http://p/port.mp4"])

    def test_pexels_skips_too_short(self):
        data = {"videos": [{"duration": 1, "video_files": [
            {"link": "http://p/x.mp4", "width": 1080, "height": 1920}]}]}
        self.assertEqual(broll._parse_pexels_videos(data, 4, min_duration=3), [])

    def test_pixabay_picks_largest_available(self):
        data = {"hits": [{"videos": {"large": {"url": "http://px/l.mp4"},
                                     "small": {"url": "http://px/s.mp4"}}}]}
        self.assertEqual(broll._parse_pixabay_videos(data, 1), ["http://px/l.mp4"])

    def test_parsers_tolerate_empty(self):
        self.assertEqual(broll._parse_pexels_videos({}, 4), [])
        self.assertEqual(broll._parse_pixabay_videos({}, 4), [])


class TestMotionSelection(unittest.TestCase):
    def setUp(self):
        self._saved = {k: os.environ.pop(k, None) for k in ("PEXELS_API_KEY", "PIXABAY_API_KEY")}

    def tearDown(self):
        for k, v in self._saved.items():
            if v is not None:
                os.environ[k] = v

    def test_no_keys_no_motion(self):
        self.assertEqual(broll.motion_clip_urls("ocean", 1), [])

    def test_fetch_motion_none_without_keys(self):
        res = broll.fetch_motion_broll(["ocean", "city"], tempfile.mkdtemp())
        self.assertEqual(res["kind"], "none")
        self.assertEqual(res["paths"], [])


@unittest.skipUnless(os.environ.get("CLIPPILOT_RUN_RENDER") == "1",
                     "render test — set CLIPPILOT_RUN_RENDER=1")
class TestMontageRender(unittest.TestCase):
    def test_montage_matches_audio_duration(self):
        from clippilot.generate.assemble import assemble_motion_montage
        from clippilot.media import signals
        from clippilot.media.ffmpeg import run_ffmpeg
        d = tempfile.mkdtemp(prefix="montagetest_")
        wav = os.path.join(d, "n.wav")
        run_ffmpeg(["-f", "lavfi", "-i", "sine=frequency=300:duration=4", "-y", wav])
        clips = []
        for i, sz in enumerate(["1280x720", "640x480"]):
            c = os.path.join(d, f"c{i}.mp4")
            run_ffmpeg(["-f", "lavfi", "-i", f"testsrc2=size={sz}:rate=24:duration=3",
                        "-pix_fmt", "yuv420p", "-y", c])
            clips.append(c)
        out = assemble_motion_montage(clips, wav, os.path.join(d, "m.mp4"))
        self.assertTrue(out and os.path.exists(out))
        self.assertAlmostEqual(signals.probe(out).duration_s, 4.0, delta=0.6)


if __name__ == "__main__":
    unittest.main(verbosity=2)
