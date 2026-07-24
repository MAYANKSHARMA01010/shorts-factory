"""Tests for the hosted generation hooks (palmier generateVideo/Audio parity) + their
editor-timeline integration. No real network — no-key paths + parsers + mocked happy path."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.generate import gen_audio as GA
from clippilot.generate import gen_video as GV


class TestGenVideo(unittest.TestCase):
    def setUp(self):
        self._k = os.environ.pop("GEN_VIDEO_API_KEY", None)

    def tearDown(self):
        if self._k is not None:
            os.environ["GEN_VIDEO_API_KEY"] = self._k

    def test_no_key_noop(self):
        self.assertFalse(GV.gen_video_available())
        self.assertIsNone(GV.generate_video("x", tempfile.mktemp()))

    def test_response_parsers(self):
        self.assertEqual(GV._parse_video_response({"data": [{"url": "http://x/v.mp4"}]}), "http://x/v.mp4")
        self.assertEqual(GV._parse_video_response({"output": "http://x/o.mp4"}), "http://x/o.mp4")
        self.assertEqual(GV._parse_video_response({"output": ["http://x/l.mp4"]}), "http://x/l.mp4")
        self.assertEqual(GV._parse_video_response({"video": {"url": "http://x/w.mp4"}}), "http://x/w.mp4")
        self.assertIsNone(GV._parse_video_response({}))


class TestGenAudio(unittest.TestCase):
    def setUp(self):
        self._k = os.environ.pop("GEN_AUDIO_API_KEY", None)

    def tearDown(self):
        if self._k is not None:
            os.environ["GEN_AUDIO_API_KEY"] = self._k

    def test_no_key_noop(self):
        self.assertFalse(GA.gen_audio_available())
        self.assertIsNone(GA.generate_audio("hello", tempfile.mktemp()))

    def test_url_parser(self):
        self.assertEqual(GA._parse_audio_url({"audio_url": "http://x/a.mp3"}), "http://x/a.mp3")
        self.assertEqual(GA._parse_audio_url({"audio": {"url": "http://x/b.mp3"}}), "http://x/b.mp3")
        self.assertIsNone(GA._parse_audio_url({}))


class TestEditorGenerationIntegration(unittest.TestCase):
    def setUp(self):
        self._d = tempfile.TemporaryDirectory()
        self.proj = os.path.join(self._d.name, "p.json")
        from clippilot.mcp_server import server as S
        self.S = S
        S._h_editor_new({"project": self.proj})

    def tearDown(self):
        os.environ.pop("GEN_IMAGE_API_KEY", None)
        self._d.cleanup()

    def test_no_key_errors(self):
        self.assertIn("error", self.S._h_editor_generate_image({"project": self.proj, "prompt": "a cat"}))

    def test_mocked_image_added_as_clip(self):
        import clippilot.generate.gen_image as GI
        os.environ["GEN_IMAGE_API_KEY"] = "test"

        def fake(prompt, out):
            with open(out, "wb") as f:
                f.write(b"x" * 100)
            return out                       # the real generate_image returns the PATH

        orig = GI.generate_image
        GI.generate_image = fake
        try:
            r = self.S._h_editor_generate_image({"project": self.proj, "prompt": "a cat",
                                                 "duration_frames": 60})
            self.assertTrue(r.get("added_clip_id"))
            self.assertTrue(os.path.exists(r["media"]))
            # persisted as an image clip
            from clippilot.editor.project import load_project
            clips = load_project(self.proj).all_clips()
            self.assertTrue(any(c.media_type == "image" for c in clips))
        finally:
            GI.generate_image = orig

    def test_gen_tools_registered(self):
        self.assertIn("editor_generate_image", self.S.TOOLS)
        self.assertIn("editor_generate_video", self.S.TOOLS)


if __name__ == "__main__":
    unittest.main(verbosity=2)
