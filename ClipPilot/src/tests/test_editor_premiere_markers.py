"""Tests for Adobe Premiere parity — timeline markers + chapter export
(YouTube description timestamps and FFMETADATA chapter blocks)."""
from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

from clippilot.editor import timeline as T
from clippilot.editor.project import export_chapters


def _read(p: str) -> str:
    return Path(p).read_text(encoding="utf-8")


class TestMarkers(unittest.TestCase):
    def test_add_sorts_by_frame(self):
        tl = T.Timeline(fps=30)
        T.add_marker(tl, 90, name="B")
        T.add_marker(tl, 0, name="A")
        T.add_marker(tl, 45, name="mid")
        self.assertEqual([m["name"] for m in tl.markers], ["A", "mid", "B"])
        self.assertEqual(tl.markers[0]["frame"], 0)

    def test_defaults_and_range(self):
        tl = T.Timeline()
        m = T.add_marker(tl, 30, duration_frames=15)
        self.assertEqual(m["color"], "green")
        self.assertEqual(m["duration_frames"], 15)
        self.assertEqual(m["name"], "")

    def test_remove_and_clear(self):
        tl = T.Timeline()
        for f in (0, 30, 60):
            T.add_marker(tl, f, name=str(f))
        self.assertEqual(T.remove_markers(tl, [30]), 1)
        self.assertEqual([m["frame"] for m in tl.markers], [0, 60])
        self.assertEqual(T.clear_markers(tl), 2)
        self.assertEqual(tl.markers, [])

    def test_json_round_trip_and_sanitize(self):
        tl = T.Timeline()
        T.add_marker(tl, 30, name="Intro")
        tl2 = T.Timeline.from_dict(tl.to_dict())
        self.assertEqual(tl2.markers[0]["name"], "Intro")
        bad = tl.to_dict()
        bad["markers"] = "oops"
        self.assertEqual(T.Timeline.from_dict(bad).markers, [])
        bad["markers"] = [{"frame": 0, "name": "ok"}, 5, "x"]
        self.assertEqual(len(T.Timeline.from_dict(bad).markers), 1)


class TestChapterExport(unittest.TestCase):
    def _tl(self):
        tl = T.Timeline(fps=30)
        # add clips so total_frames covers the markers
        T.add_clip(tl, 0, T.Clip(media_ref="m", media_type="video", start_frame=0,
                                 duration_frames=3690))   # 123s
        T.add_marker(tl, 0, name="Intro")
        T.add_marker(tl, 900, name="Part One")            # 30s
        T.add_marker(tl, 3600, name="Outro")              # 120s
        return tl

    def test_youtube_format(self):
        d = tempfile.mkdtemp(prefix="chap_")
        out = export_chapters(self._tl(), os.path.join(d, "ch.txt"), fmt="youtube")
        lines = _read(out).strip().splitlines()
        self.assertEqual(lines[0], "0:00 Intro")
        self.assertEqual(lines[1], "0:30 Part One")
        self.assertEqual(lines[2], "2:00 Outro")

    def test_youtube_hours(self):
        tl = T.Timeline(fps=30)
        T.add_clip(tl, 0, T.Clip(media_ref="m", media_type="video", start_frame=0,
                                 duration_frames=30 * 3700))
        T.add_marker(tl, 30 * 3661, name="Late")          # 1:01:01
        out = export_chapters(tl, os.path.join(tempfile.mkdtemp(), "ch.txt"))
        self.assertIn("1:01:01 Late", _read(out))

    def test_ffmetadata_format(self):
        d = tempfile.mkdtemp(prefix="chap_")
        out = export_chapters(self._tl(), os.path.join(d, "ch.txt"), fmt="ffmetadata")
        text = _read(out)
        self.assertTrue(text.startswith(";FFMETADATA1"))
        self.assertIn("[CHAPTER]", text)
        self.assertIn("TIMEBASE=1/1000", text)
        self.assertIn("START=0", text)
        self.assertIn("title=Intro", text)
        self.assertIn("title=Outro", text)

    def test_title_fallback(self):
        tl = T.Timeline(fps=30)
        T.add_clip(tl, 0, T.Clip(media_ref="m", media_type="video", start_frame=0,
                                 duration_frames=300))
        T.add_marker(tl, 0)                               # no name/comment
        out = export_chapters(tl, os.path.join(tempfile.mkdtemp(), "ch.txt"))
        self.assertIn("0:00 Chapter 1", _read(out))


if __name__ == "__main__":
    unittest.main(verbosity=2)
