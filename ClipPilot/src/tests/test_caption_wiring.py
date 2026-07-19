"""Tests for wiring karaoke captions into the engine: the `_caption` runner +
the captioned-clip preference in the controller/publish.
"""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot import config as cfg
from clippilot.media import ffmpeg as ffm
from clippilot.models import Job
from clippilot.runners import _caption
from clippilot.ui.controller import AppController


class TestCaptionRunner(unittest.TestCase):
    def test_stub_fallback_without_clips_or_words(self):
        job = Job(id=1, payload={"clip": {"clips": ["x.mp4"]}, "transcribe": {}})
        r = _caption(job, None)
        self.assertFalse(r["available"])
        self.assertEqual(r["clips"], ["x.mp4"])  # passthrough so publish still has a clip

    @unittest.skipUnless(ffm.ffmpeg_available(), "ffmpeg not available")
    def test_burns_real_clip(self):
        prev = os.environ.get("CLIPPILOT_DATA")
        tmp = tempfile.TemporaryDirectory(prefix="clippilot_cap_", ignore_cleanup_errors=True)
        os.environ["CLIPPILOT_DATA"] = tmp.name
        try:
            sample = os.path.join(tmp.name, "clip0.mp4")
            ffm.run_ffmpeg([
                "-f", "lavfi", "-i", "testsrc=duration=2:size=320x240:rate=30",
                "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
                "-t", "2", "-y", sample,
            ], timeout=120)
            if not os.path.exists(sample):
                self.skipTest("could not generate sample clip")
            job = Job(id=7, payload={
                "clip": {"clips": [sample], "segments": [{"path": sample, "start": 0.0, "end": 2.0}]},
                "transcribe": {"words": [
                    {"text": "Hello", "start": 0.10, "end": 0.60},
                    {"text": " world", "start": 0.60, "end": 1.20},
                    {"text": " now", "start": 1.20, "end": 1.80},
                ]},
            })
            r = _caption(job, None)
            self.assertTrue(r["available"])
            self.assertTrue(r["captioned"], "expected at least one captioned clip")
            self.assertTrue(os.path.exists(r["captioned"][0]))
            self.assertGreater(os.path.getsize(r["captioned"][0]), 0)
        finally:
            if prev is None:
                os.environ.pop("CLIPPILOT_DATA", None)
            else:
                os.environ["CLIPPILOT_DATA"] = prev
            tmp.cleanup()


class TestCaptionedClipPreference(unittest.TestCase):
    def test_controller_prefers_captioned_clips(self):
        ctrl = AppController(queue=None)  # clips_for doesn't touch the queue
        job = Job(payload={"caption": {"clips": ["cap.mp4"]}, "clip": {"clips": ["bare.mp4"]}})
        self.assertEqual(ctrl.clips_for(job), ["cap.mp4"])

    def test_controller_falls_back_to_bare_clips(self):
        ctrl = AppController(queue=None)
        job = Job(payload={"clip": {"clips": ["bare.mp4"]}})
        self.assertEqual(ctrl.clips_for(job), ["bare.mp4"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
