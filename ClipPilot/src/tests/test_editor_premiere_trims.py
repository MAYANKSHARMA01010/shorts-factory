"""Tests for Adobe Premiere parity — the slip / roll / slide trim edit tools (pure
timeline ops). These complete the editor's edit-operation set."""
from __future__ import annotations

import unittest

from clippilot.editor import timeline as T


def _abc(fps=30):
    """A timeline with three adjacent clips A[0-30] B[30-60] C[60-90] on track 0,
    each trimmed into a longer source."""
    tl = T.Timeline(fps=fps)
    a = T.add_clip(tl, 0, T.Clip(media_ref="a", media_type="video", start_frame=0,
                                 duration_frames=30, trim_start_frame=20))
    b = T.add_clip(tl, 0, T.Clip(media_ref="b", media_type="video", start_frame=30,
                                 duration_frames=30, trim_start_frame=20))
    c = T.add_clip(tl, 0, T.Clip(media_ref="c", media_type="video", start_frame=60,
                                 duration_frames=30, trim_start_frame=20))
    return tl, a, b, c


class TestSlip(unittest.TestCase):
    def test_slip_changes_only_source_in_point(self):
        tl, a, b, c = _abc()
        self.assertTrue(T.slip_clip(tl, b.id, 5))
        self.assertEqual(b.trim_start_frame, 25)         # source in moved
        self.assertEqual(b.start_frame, 30)              # position unchanged
        self.assertEqual(b.duration_frames, 30)          # duration unchanged

    def test_slip_clamps_at_zero(self):
        tl, a, b, c = _abc()
        T.slip_clip(tl, b.id, -100)
        self.assertEqual(b.trim_start_frame, 0)

    def test_slip_missing(self):
        tl, a, b, c = _abc()
        self.assertFalse(T.slip_clip(tl, "nope", 5))


class TestRoll(unittest.TestCase):
    def test_roll_moves_cut(self):
        tl, a, b, c = _abc()
        # roll the A|B cut right by 10: A grows, B shrinks + its in-point advances
        self.assertTrue(T.roll_edit(tl, a.id, 10))
        self.assertEqual(a.duration_frames, 40)          # A: 0-40
        self.assertEqual(b.start_frame, 40)              # B starts later
        self.assertEqual(b.duration_frames, 20)          # B shorter
        self.assertEqual(b.trim_start_frame, 30)         # B in-point advanced 20→30
        self.assertEqual(c.start_frame, 60)              # C untouched

    def test_roll_clamped(self):
        tl, a, b, c = _abc()
        T.roll_edit(tl, a.id, 1000)                      # can't shrink B below 1 frame
        self.assertEqual(b.duration_frames, 1)
        self.assertEqual(a.duration_frames, 59)

    def test_roll_requires_adjacent_next(self):
        tl, a, b, c = _abc()
        self.assertFalse(T.roll_edit(tl, c.id, 5))       # C has no next clip


class TestSlide(unittest.TestCase):
    def test_slide_moves_clip_and_trims_neighbors(self):
        tl, a, b, c = _abc()
        self.assertTrue(T.slide_clip(tl, b.id, 8))       # slide B right by 8
        self.assertEqual(a.duration_frames, 38)          # A extends to fill
        self.assertEqual(b.start_frame, 38)              # B moved, content unchanged
        self.assertEqual(b.duration_frames, 30)
        self.assertEqual(b.trim_start_frame, 20)         # B's source unchanged (slide ≠ slip)
        self.assertEqual(c.start_frame, 68)              # C head trimmed to follow
        self.assertEqual(c.duration_frames, 22)
        self.assertEqual(c.trim_start_frame, 28)         # C in-point advanced
        # outer edges fixed: A.start and C.end unchanged
        self.assertEqual(a.start_frame, 0)
        self.assertEqual(c.end_frame, 90)

    def test_slide_requires_both_neighbors(self):
        tl, a, b, c = _abc()
        self.assertFalse(T.slide_clip(tl, a.id, 5))      # A has no previous
        self.assertFalse(T.slide_clip(tl, c.id, 5))      # C has no next

    def test_slide_clamped(self):
        tl, a, b, c = _abc()
        T.slide_clip(tl, b.id, 1000)                     # can't shrink C below 1
        self.assertEqual(c.duration_frames, 1)
        self.assertEqual(c.end_frame, 90)                # C end still fixed


if __name__ == "__main__":
    unittest.main(verbosity=2)
