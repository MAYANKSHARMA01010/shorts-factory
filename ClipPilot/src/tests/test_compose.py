"""Tests for the compose stage (finalize: passthrough / optional concat) and the
compose-first clip preference."""
from __future__ import annotations

import os
import tempfile
import types
import unittest

from clippilot.media import ffmpeg as ffm
from clippilot.models import Job
from clippilot.runners import _compose
from clippilot.ui.controller import AppController


def _q(compose_concat: bool = False):
    return types.SimpleNamespace(settings=types.SimpleNamespace(compose_concat=compose_concat))


class TestCompose(unittest.TestCase):
    def test_passthrough_forwards_clips(self):
        job = Job(id=1, payload={"caption": {"clips": ["a.mp4", "b.mp4"]}})
        out = _compose(job, _q(compose_concat=False))
        self.assertTrue(out["available"])
        self.assertEqual(out["mode"], "passthrough")
        self.assertEqual(out["clips"], ["a.mp4", "b.mp4"])

    def test_no_clips_is_stub(self):
        job = Job(id=1, payload={"clip": {"stub": True}})
        out = _compose(job, _q())
        self.assertFalse(out["available"])
        self.assertEqual(out["clips"], [])

    def test_concat_flag_without_real_files_falls_back_to_passthrough(self):
        # concat requested but the clip paths don't exist → safe passthrough
        job = Job(id=1, payload={"caption": {"clips": ["x.mp4", "y.mp4"]}})
        out = _compose(job, _q(compose_concat=True))
        self.assertEqual(out["mode"], "passthrough")

    @unittest.skipUnless(ffm.ffmpeg_available(), "ffmpeg not available")
    def test_concat_stitches_real_clips(self):
        prev = os.environ.get("CLIPPILOT_DATA")
        tmp = tempfile.TemporaryDirectory(prefix="clippilot_compose_", ignore_cleanup_errors=True)
        os.environ["CLIPPILOT_DATA"] = tmp.name
        try:
            clips = []
            for i in range(2):
                p = os.path.join(tmp.name, f"c{i}.mp4")
                ffm.run_ffmpeg([
                    "-f", "lavfi", "-i", f"testsrc=duration=1:size=320x240:rate=30",
                    "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
                    "-t", "1", "-y", p,
                ], timeout=120)
                if os.path.exists(p):
                    clips.append(p)
            if len(clips) < 2:
                self.skipTest("could not generate sample clips")
            job = Job(id=9, payload={"caption": {"clips": clips}})
            out = _compose(job, _q(compose_concat=True))
            self.assertEqual(out["mode"], "concat")
            self.assertEqual(len(out["clips"]), 1)
            self.assertTrue(os.path.exists(out["clips"][0]))
        finally:
            if prev is None:
                os.environ.pop("CLIPPILOT_DATA", None)
            else:
                os.environ["CLIPPILOT_DATA"] = prev
            tmp.cleanup()


class TestComposePreference(unittest.TestCase):
    def test_controller_prefers_compose_clips(self):
        ctrl = AppController(queue=None)
        job = Job(payload={"compose": {"clips": ["final.mp4"]},
                           "caption": {"clips": ["cap.mp4"]},
                           "clip": {"clips": ["bare.mp4"]}})
        self.assertEqual(ctrl.clips_for(job), ["final.mp4"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
