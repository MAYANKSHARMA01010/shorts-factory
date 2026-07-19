"""Regression tests for the 10 bugs the adversarial editor review found + fixed."""
from __future__ import annotations

import json
import os
import tempfile
import unittest

from clippilot.editor import keyframes as KF
from clippilot.editor import project as P
from clippilot.editor import render as R
from clippilot.editor import timeline as T


class TestKeyframeArity(unittest.TestCase):
    def _clip(self):
        tl = T.Timeline()
        return tl, T.add_clip(tl, 0, T.Clip(media_ref="m", start_frame=0, duration_frames=60))

    def test_rejects_too_few_columns(self):
        tl, c = self._clip()
        self.assertFalse(T.set_keyframes(tl, c.id, "position", [[0, 0.5], [30, 0.7]]))  # arity 2
        self.assertFalse(T.set_keyframes(tl, c.id, "opacity", [[0], [30]]))             # arity 1

    def test_accepts_correct_columns(self):
        tl, c = self._clip()
        self.assertTrue(T.set_keyframes(tl, c.id, "position", [[0, 0.2, 0.5], [60, 0.8, 0.5]]))

    def test_sampling_defensive_on_bad_rows(self):
        self.assertEqual(KF.sample([[0, 0.5]], "linear", 0, idx=1), 0.0)     # missing column
        self.assertEqual(KF.ffmpeg_expr([[0, 0.5]], "linear", 1, 0.0, 30), "0")


class TestAudioSpeedChain(unittest.TestCase):
    def test_atempo_chains_beyond_range(self):
        self.assertEqual(R._atempo_chain(3.0), ["atempo=2.0000", "atempo=1.5000"])
        self.assertEqual(R._atempo_chain(0.25), ["atempo=0.5000", "atempo=0.5000"])

    def test_atempo_within_range_single(self):
        self.assertEqual(R._atempo_chain(1.5), ["atempo=1.5000"])


class TestNonDictJson(unittest.TestCase):
    def test_from_dict_tolerates_non_dict(self):
        self.assertEqual(T.Timeline.from_dict(123).tracks, [])
        self.assertEqual(T.Timeline.from_dict([1, 2]).tracks, [])
        self.assertEqual(T.Timeline.from_dict("x").tracks, [])

    def test_load_project_non_dict_no_crash(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "p.json")
            open(p, "w").write("123")
            self.assertEqual(P.load_project(p).tracks, [])

    def test_undo_corrupt_snapshot_no_crash(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "p.json")
            open(p, "w").write("{}")
            open(str(P._undo_path(p)), "w").write(json.dumps(["123"]))  # corrupt non-dict snapshot
            self.assertIsNotNone(P.undo(p))                              # restores empty, no crash


class TestEdlSourceOut(unittest.TestCase):
    def test_edl_includes_source_out(self):
        tl = T.Timeline()
        T.add_clip(tl, 0, T.Clip(media_ref="v", start_frame=0, duration_frames=50, trim_end_frame=100))
        with tempfile.TemporaryDirectory() as d:
            out = P.export_edl(tl, os.path.join(d, "e.json"))
            self.assertEqual(json.loads(open(out).read())["events"][0]["source_out"], 100)


class TestTypeCoercion(unittest.TestCase):
    def test_move_clip_string_args(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, T.Clip(media_ref="m", start_frame=0, duration_frames=60))
        self.assertTrue(T.move_clip(tl, c.id, to_track="1", to_frame="30"))
        self.assertEqual(tl.tracks[1].clips[0].start_frame, 30)

    def test_set_properties_coerces_int_and_float(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, T.Clip(media_ref="m", start_frame=0, duration_frames=60))
        T.set_clip_properties(tl, [c.id], duration_frames=30.5, speed="2", trim_start_frame="5")
        self.assertEqual(c.duration_frames, 30)        # int, not 30.5
        self.assertEqual(c.speed, 2.0)                 # float
        self.assertEqual(c.trim_start_frame, 5)
        self.assertIsInstance(c.end_frame, int)        # frame math stays integer


if __name__ == "__main__":
    unittest.main(verbosity=2)
