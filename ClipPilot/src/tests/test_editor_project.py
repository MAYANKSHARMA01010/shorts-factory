"""Tests for editor project persistence + the MCP editor tools (palmier parity).
These are pure (no ffmpeg) — the render tool is covered in test_editor_render."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.editor import timeline as T
from clippilot.editor.project import load_project, save_project
from clippilot.mcp_server import server as S


class TestProjectPersistence(unittest.TestCase):
    def test_round_trip(self):
        tl = T.Timeline(fps=24, width=720, height=1280)
        T.add_clip(tl, 0, T.Clip(media_ref="a.mp4", start_frame=0, duration_frames=48))
        with tempfile.TemporaryDirectory() as d:
            p = save_project(tl, os.path.join(d, "p.json"))
            tl2 = load_project(p)
            self.assertEqual(tl2.fps, 24)
            self.assertEqual(tl2.tracks[0].clips[0].media_ref, "a.mp4")

    def test_load_missing_returns_fresh(self):
        self.assertEqual(load_project("nope.json").tracks, [])


class TestEditorMcpTools(unittest.TestCase):
    def setUp(self):
        self._d = tempfile.TemporaryDirectory()
        self.proj = os.path.join(self._d.name, "p.json")

    def tearDown(self):
        self._d.cleanup()

    def test_full_edit_flow_persists(self):
        S._h_editor_new({"project": self.proj, "fps": 30, "width": 1080, "height": 1920})
        r = S._h_editor_add_clip({"project": self.proj, "media_ref": "v.mp4",
                                  "start_frame": 0, "duration_frames": 90})
        cid = r["added_clip_id"]
        self.assertTrue(cid)
        sp = S._h_editor_split({"project": self.proj, "clip_id": cid, "at_frame": 45})
        self.assertEqual(len(sp["split_ids"]), 2)
        upd = S._h_editor_set_properties({"project": self.proj, "clip_ids": [sp["split_ids"][1]],
                                          "opacity": 0.5, "speed": 2.0})
        self.assertEqual(upd["updated"], 1)
        # persisted: reload and check the property stuck
        tl = load_project(self.proj)
        found = tl.find_clip(sp["split_ids"][1])
        self.assertIsNotNone(found)
        self.assertEqual(found[1].opacity, 0.5)
        self.assertEqual(found[1].speed, 2.0)

    def test_remove_and_ripple(self):
        S._h_editor_new({"project": self.proj})
        a = S._h_editor_add_clip({"project": self.proj, "media_ref": "a", "start_frame": 0,
                                  "duration_frames": 50})["added_clip_id"]
        S._h_editor_add_clip({"project": self.proj, "media_ref": "b", "track_index": 0,
                              "start_frame": 50, "duration_frames": 50})
        rd = S._h_editor_ripple_delete({"project": self.proj, "track_index": 0, "start": 10, "end": 30})
        self.assertEqual(rd["frames_removed"], 20)
        rm = S._h_editor_remove({"project": self.proj, "clip_ids": [a]})
        self.assertGreaterEqual(rm["removed"], 1)

    def test_split_bad_frame_errors(self):
        S._h_editor_new({"project": self.proj})
        cid = S._h_editor_add_clip({"project": self.proj, "media_ref": "a", "start_frame": 0,
                                    "duration_frames": 50})["added_clip_id"]
        self.assertIn("error", S._h_editor_split({"project": self.proj, "clip_id": cid, "at_frame": 0}))

    def test_editor_tools_registered(self):
        for name in ("editor_new", "editor_get_timeline", "editor_add_clip", "editor_add_text",
                     "editor_set_clip_properties", "editor_split_clip", "editor_remove_clips",
                     "editor_move_clip", "editor_ripple_delete", "editor_render"):
            self.assertIn(name, S.TOOLS)
            self.assertIn("handler", S.TOOLS[name])


if __name__ == "__main__":
    unittest.main(verbosity=2)
