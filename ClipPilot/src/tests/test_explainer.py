"""Tests for explainer/diagram clips (manim's role, ffmpeg-native). Render gated."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.generate import explainer


class TestExplainerGuards(unittest.TestCase):
    def test_manim_available_is_bool(self):
        self.assertIsInstance(explainer.manim_available(), bool)


@unittest.skipUnless(os.environ.get("CLIPPILOT_RUN_RENDER") == "1",
                     "render test — set CLIPPILOT_RUN_RENDER=1")
class TestExplainerRender(unittest.TestCase):
    def test_renders_card_of_expected_duration(self):
        from clippilot.media import signals
        d = tempfile.mkdtemp(prefix="explainertest_")
        out = explainer.explainer_clip("Why the sky is blue",
                                       ["Sunlight is white", "Air scatters blue", "Eyes see blue"],
                                       os.path.join(d, "ex.mp4"), duration=4.0)
        self.assertTrue(out and os.path.exists(out))
        self.assertAlmostEqual(signals.probe(out).duration_s, 4.0, delta=0.6)


if __name__ == "__main__":
    unittest.main(verbosity=2)
