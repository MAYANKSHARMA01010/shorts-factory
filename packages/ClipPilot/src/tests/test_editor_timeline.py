"""Tests for the programmatic timeline editor (palmier-pro parity): the data model
+ non-destructive edit operations (add/insert/remove/move/split/ripple/properties)."""
from __future__ import annotations

import unittest

from clippilot.editor import timeline as T


def _clip(start, dur, ref="m", mtype="video"):
    return T.Clip(media_ref=ref, media_type=mtype, start_frame=start, duration_frames=dur)


class TestModelRoundTrip(unittest.TestCase):
    def test_to_from_dict(self):
        tl = T.Timeline(fps=30, width=1080, height=1920)
        T.add_clip(tl, 0, _clip(0, 90))
        T.add_text(tl, 1, 0, 60, "HELLO")
        d = tl.to_dict()
        tl2 = T.Timeline.from_dict(d)
        self.assertEqual(tl2.fps, 30)
        self.assertEqual(len(tl2.tracks), 2)
        self.assertEqual(tl2.tracks[0].clips[0].duration_frames, 90)
        self.assertEqual(tl2.tracks[1].clips[0].text_content, "HELLO")
        self.assertEqual(d["total_frames"], 90)

    def test_clip_end_frame(self):
        self.assertEqual(_clip(30, 60).end_frame, 90)


class TestPlacement(unittest.TestCase):
    def test_add_clip_sorts(self):
        tl = T.Timeline()
        T.add_clip(tl, 0, _clip(100, 50))
        T.add_clip(tl, 0, _clip(0, 50))
        starts = [c.start_frame for c in tl.tracks[0].clips]
        self.assertEqual(starts, [0, 100])

    def test_overwrite_trims_overlap(self):
        tl = T.Timeline()
        T.add_clip(tl, 0, _clip(0, 100))          # [0,100)
        T.add_clip(tl, 0, _clip(50, 100))         # [50,150) overwrites tail of first
        clips = tl.tracks[0].clips
        self.assertEqual(clips[0].end_frame, 50)  # first trimmed to [0,50)
        self.assertEqual((clips[1].start_frame, clips[1].end_frame), (50, 150))

    def test_overwrite_splits_enclosing(self):
        tl = T.Timeline()
        T.add_clip(tl, 0, _clip(0, 200))          # big clip
        T.add_clip(tl, 0, _clip(80, 40))          # lands in the middle → splits into 3
        spans = [(c.start_frame, c.end_frame) for c in tl.tracks[0].clips]
        self.assertIn((0, 80), spans)
        self.assertIn((80, 120), spans)
        self.assertIn((120, 200), spans)

    def test_insert_ripples_right(self):
        tl = T.Timeline()
        T.add_clip(tl, 0, _clip(0, 50))
        T.add_clip(tl, 0, _clip(50, 50))
        T.insert_clip(tl, 0, 50, _clip(0, 30, ref="ins"))
        spans = [(c.media_ref, c.start_frame) for c in tl.tracks[0].clips]
        self.assertEqual(spans, [("m", 0), ("ins", 50), ("m", 80)])  # second pushed 30 right


class TestMutation(unittest.TestCase):
    def test_remove(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, _clip(0, 50))
        self.assertEqual(T.remove_clips(tl, [c.id]), 1)
        self.assertEqual(tl.tracks[0].clips, [])

    def test_move_to_other_track_and_frame(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, _clip(0, 50))
        self.assertTrue(T.move_clip(tl, c.id, to_track=1, to_frame=100))
        self.assertEqual(tl.tracks[0].clips, [])
        moved = tl.tracks[1].clips[0]
        self.assertEqual(moved.start_frame, 100)

    def test_split(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, _clip(0, 100))
        res = T.split_clip(tl, c.id, 40)
        self.assertIsNotNone(res)
        left, right = res
        self.assertEqual((left.start_frame, left.duration_frames), (0, 40))
        self.assertEqual((right.start_frame, right.duration_frames), (40, 60))
        self.assertEqual(right.trim_start_frame, 40)        # source in-point advanced

    def test_split_out_of_bounds_returns_none(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, _clip(0, 100))
        self.assertIsNone(T.split_clip(tl, c.id, 0))        # at the start → invalid
        self.assertIsNone(T.split_clip(tl, c.id, 100))      # at the end → invalid

    def test_set_properties_scalars_and_transform(self):
        tl = T.Timeline()
        c = T.add_clip(tl, 0, _clip(0, 100))
        n = T.set_clip_properties(tl, [c.id], speed=2.0, volume=0.5,
                                  transform={"center_x": 0.25, "width": 0.5})
        self.assertEqual(n, 1)
        self.assertEqual(c.speed, 2.0)
        self.assertEqual(c.volume, 0.5)
        self.assertEqual(c.transform.center_x, 0.25)
        self.assertEqual(c.transform.width, 0.5)

    def test_ripple_delete_closes_gap(self):
        tl = T.Timeline()
        T.add_clip(tl, 0, _clip(0, 50))
        T.add_clip(tl, 0, _clip(50, 50))           # [50,100)
        removed = T.ripple_delete_range(tl, 0, 10, 30)   # cut 20 frames
        self.assertEqual(removed, 20)
        # second clip pulled left by 20 → [30,80)
        last = tl.tracks[0].clips[-1]
        self.assertEqual((last.start_frame, last.end_frame), (30, 80))


if __name__ == "__main__":
    unittest.main(verbosity=2)
