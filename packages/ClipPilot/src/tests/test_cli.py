"""CLI wiring tests (argument parsing) — no heavy pipeline execution."""
from __future__ import annotations

import unittest

import os
import tempfile

from clippilot.cli import build_parser, main


class TestCliParser(unittest.TestCase):
    def test_demo_short_wired(self):
        a = build_parser().parse_args(["demo-short", "secrets of the ocean"])
        self.assertEqual(a.topic, "secrets of the ocean")
        self.assertEqual(a.func.__name__, "cmd_demo_short")
        self.assertFalse(a.open)
        self.assertTrue(build_parser().parse_args(["demo-short", "x", "--open"]).open)

    def test_enqueue_folder_wired(self):
        a = build_parser().parse_args(["enqueue-folder", "--folder", "C:/clips"])
        self.assertEqual(a.folder, "C:/clips")
        self.assertEqual(a.func.__name__, "cmd_enqueue_folder")

    def test_publish_reel_wired(self):
        a = build_parser().parse_args(["publish-reel", "--url", "https://x/v.mp4", "--caption", "hi"])
        self.assertEqual((a.url, a.caption, a.func.__name__),
                         ("https://x/v.mp4", "hi", "cmd_publish_reel"))

    def test_resync_srt_wired(self):
        a = build_parser().parse_args(["resync-srt", "--srt", "c.srt", "--audio", "a.mp4"])
        self.assertEqual((a.srt, a.audio, a.func.__name__), ("c.srt", "a.mp4", "cmd_resync_srt"))

    def test_facts_flags_wired(self):
        p = build_parser()
        d = p.parse_args(["demo-short", "octopuses", "--facts", "5"])
        self.assertEqual((d.topic, d.facts), ("octopuses", 5))
        s = p.parse_args(["profile-save", "--name", "F", "--mode", "facts", "--facts-count", "6"])
        self.assertEqual((s.mode, s.facts_count), ("facts", 6))

    def test_caption_skin_flags_wired(self):
        p = build_parser()
        self.assertEqual(p.parse_args(["demo-short", "x", "--skin", "opaque_box"]).skin, "opaque_box")
        self.assertEqual(p.parse_args(["profile-save", "--name", "F", "--skin", "neon_pop"]).skin, "neon_pop")

    def test_download_flags_wired(self):
        p = build_parser()
        d = p.parse_args(["download", "--url", "https://x/v.mp4", "--max-height", "720"])
        self.assertEqual((d.url, d.max_height, d.func.__name__), ("https://x/v.mp4", 720, "cmd_download"))
        e = p.parse_args(["enqueue-url", "--url", "https://x/v.mp4", "--section", "A"])
        self.assertEqual((e.url, e.section, e.func.__name__), ("https://x/v.mp4", "A", "cmd_enqueue_url"))

    def test_cutout_flags_wired(self):
        a = build_parser().parse_args(["cutout", "--image", "p.jpg", "--bg", "b.png", "--out", "o.png"])
        self.assertEqual((a.image, a.bg, a.out, a.func.__name__), ("p.jpg", "b.png", "o.png", "cmd_cutout"))

    def test_explainer_flags_wired(self):
        a = build_parser().parse_args(["explainer", "--title", "T", "--bullets", "a;b", "--out", "e.mp4"])
        self.assertEqual((a.title, a.bullets, a.out, a.func.__name__), ("T", "a;b", "e.mp4", "cmd_explainer"))

    def test_editor_render_flags_wired(self):
        a = build_parser().parse_args(["editor-render", "--project", "p.json", "--out", "o.mp4"])
        self.assertEqual((a.project, a.out, a.func.__name__), ("p.json", "o.mp4", "cmd_editor_render"))

    def test_profile_commands_wired(self):
        p = build_parser()
        self.assertEqual(p.parse_args(["profile-list"]).func.__name__, "cmd_profile_list")
        a = p.parse_args(["profile-save", "--name", "X", "--section", "B", "--seconds", "20"])
        self.assertEqual((a.name, a.section, a.seconds), ("X", "B", 20))
        self.assertEqual(p.parse_args(["profile-delete", "--name", "X"]).func.__name__, "cmd_profile_delete")
        ep = p.parse_args(["enqueue-profile", "--source", "t", "--profile", "X"])
        self.assertEqual((ep.source, ep.profile), ("t", "X"))


class TestCliProfilesFunctional(unittest.TestCase):
    def setUp(self):
        self._prev = os.environ.get("CLIPPILOT_DATA")
        self._tmp = tempfile.TemporaryDirectory(prefix="clippilot_cliprof_", ignore_cleanup_errors=True)
        os.environ["CLIPPILOT_DATA"] = self._tmp.name

    def tearDown(self):
        if self._prev is None:
            os.environ.pop("CLIPPILOT_DATA", None)
        else:
            os.environ["CLIPPILOT_DATA"] = self._prev
        self._tmp.cleanup()

    def test_approve_bad_id_is_clean_error_not_traceback(self):
        # ValueError from the queue must surface as exit 1, not a raw traceback
        self.assertEqual(main(["approve", "999999"]), 1)

    def test_save_list_enqueue_roundtrip(self):
        from clippilot.profiles import get_profile
        self.assertEqual(main(["profile-save", "--name", "Acme", "--section", "B", "--channel", "yt1"]), 0)
        self.assertEqual(main(["profile-list"]), 0)
        self.assertEqual(main(["enqueue-profile", "--source", "a topic", "--profile", "Acme"]), 0)
        self.assertIsNotNone(get_profile("Acme"))
        self.assertEqual(main(["profile-delete", "--name", "Acme"]), 0)
        self.assertIsNone(get_profile("Acme"))

    def test_core_commands_present(self):
        cases = {
            "init": ["init"], "run": ["run"], "status": ["status"], "doctor": ["doctor"],
            "demo": ["demo"], "list": ["list"], "show": ["show", "1"],
            "enqueue": ["enqueue", "--source", "x"], "approve": ["approve", "1"],
            "reject": ["reject", "1"], "strike": ["strike", "ch"],
            "demo-short": ["demo-short", "t"], "enqueue-folder": ["enqueue-folder", "--folder", "d"],
        }
        p = build_parser()
        for argv in cases.values():
            self.assertTrue(hasattr(p.parse_args(argv), "func"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
