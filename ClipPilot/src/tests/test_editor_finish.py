"""Tests for palmier #6: export presets (codec), undo stack, EDL export, captions-into-
timeline. Pure where possible; real HEVC render + whisper captions are gated."""
from __future__ import annotations

import json
import os
import tempfile
import unittest

from clippilot.editor import project as P
from clippilot.editor import render as R
from clippilot.editor import timeline as T


class TestExportPresets(unittest.TestCase):
    def test_codec_map(self):
        self.assertIn("libx264", R._CODECS["h264"][0])
        self.assertIn("libx265", R._CODECS["hevc"][0])
        self.assertEqual(R._CODECS["prores"][1], "mov")


class TestUndoStack(unittest.TestCase):
    def test_push_then_undo_restores(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "p.json")
            tl = T.Timeline()
            T.add_clip(tl, 0, T.Clip(media_ref="a", start_frame=0, duration_frames=30))
            P.save_project(tl, path)              # state v1 (1 clip)
            P.push_undo(path)                     # snapshot v1
            T.add_clip(tl, 0, T.Clip(media_ref="b", start_frame=30, duration_frames=30))
            P.save_project(tl, path)              # state v2 (2 clips)
            restored = P.undo(path)               # back to v1
            self.assertIsNotNone(restored)
            self.assertEqual(len(restored.all_clips()), 1)

    def test_undo_empty_returns_none(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertIsNone(P.undo(os.path.join(d, "nope.json")))

    def test_mcp_undo_flow(self):
        from clippilot.mcp_server import server as S
        with tempfile.TemporaryDirectory() as d:
            proj = os.path.join(d, "p.json")
            S._h_editor_new({"project": proj})
            S._h_editor_add_clip({"project": proj, "media_ref": "a", "start_frame": 0,
                                  "duration_frames": 30})
            S._h_editor_undo({"project": proj})
            tl = S._h_editor_get({"project": proj})
            self.assertEqual(sum(len(t["clips"]) for t in tl["tracks"]), 0)


class TestEdlExport(unittest.TestCase):
    def test_edl_lists_events(self):
        tl = T.Timeline(fps=30)
        T.add_clip(tl, 0, T.Clip(media_ref="v.mp4", start_frame=10, duration_frames=50,
                                 trim_start_frame=5))
        with tempfile.TemporaryDirectory() as d:
            out = P.export_edl(tl, os.path.join(d, "e.json"))
            edl = json.loads(open(out, encoding="utf-8").read())
            self.assertEqual(edl["format"], "clippilot-edl-v1")
            ev = edl["events"][0]
            self.assertEqual((ev["source"], ev["record_in"], ev["record_out"], ev["source_in"]),
                             ("v.mp4", 10, 60, 5))


class TestCaptionsIntoTimeline(unittest.TestCase):
    def test_graceful_without_media(self):
        from clippilot.editor.captions import captions_to_timeline
        tl = T.Timeline()
        self.assertEqual(captions_to_timeline(tl, "no_such_media.mp4"), 0)


@unittest.skipUnless(os.environ.get("CLIPPILOT_RUN_E2E") == "1",
                     "needs TTS + whisper — set CLIPPILOT_RUN_E2E=1")
class TestCaptionsReal(unittest.TestCase):
    def test_transcript_becomes_text_clips(self):
        from clippilot.editor.captions import captions_to_timeline
        from clippilot.media import tts
        from clippilot.media.transcribe import whisper_available
        if not (tts.tts_available() and whisper_available()):
            self.skipTest("TTS/whisper unavailable")
        d = tempfile.mkdtemp(prefix="capts_")
        wav = os.path.join(d, "n.wav")
        tts.synthesize("The ocean is deep and full of wonders.", wav)
        tl = T.Timeline(fps=30)
        n = captions_to_timeline(tl, wav, track_index=2)
        self.assertGreater(n, 0)
        self.assertTrue(any(c.media_type == "text" for c in tl.all_clips()))


if __name__ == "__main__":
    unittest.main(verbosity=2)
