"""Tests for the caption-skin registry (hyperframes/VideoCaptioner/remotion recipes,
libass-verified) and its wiring through edit/config/profiles."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.config import Settings
from clippilot.media import edit
from clippilot.profiles import Profile


class TestSkinRegistry(unittest.TestCase):
    def test_all_skins_have_required_fields(self):
        for key, s in edit.CAPTION_SKINS.items():
            m = edit.skin_style(key)
            for f in ("font", "fontsize", "primary", "outline", "border_style", "margin_v"):
                self.assertIn(f, m, f"{key} missing {f}")

    def test_static_box_skin(self):
        s = edit.skin_style("opaque_box")
        self.assertEqual(s["border_style"], 3)          # opaque box
        self.assertEqual(s["back_colour"], "&HC8141414")
        self.assertIn("fad", s["prefix"])               # soft fade-in

    def test_karaoke_neon_skin(self):
        s = edit.skin_style("neon_pop")
        self.assertTrue(s["kf"])                         # \kf sweep, not \k snap
        self.assertEqual(s["primary"], "&H00F0FF00")     # electric cyan
        self.assertIn("neon_pop", edit.KARAOKE_SKINS)

    def test_unknown_skin_falls_back_to_defaults(self):
        s = edit.skin_style("does_not_exist")
        self.assertEqual(s["font"], edit.ASS_DEFAULTS["font"])


class TestSkinRendering(unittest.TestCase):
    def test_prefix_applied_to_each_static_line(self):
        cues = [{"start": 0.0, "end": 1.0, "text": "hi"}]
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "s.ass")
            edit.write_ass(cues, p, **edit.skin_style("kinetic_pop"))
            content = open(p, encoding="utf-8").read()
            self.assertIn(r"\fscx60", content)           # the scale-pop prefix
            self.assertIn("Impact", content)             # the mapped Windows font
            self.assertIn(",1,", content)                # BorderStyle 1 in the Style line

    def test_box_style_line_uses_border3(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "b.ass")
            edit.write_ass([{"start": 0, "end": 1, "text": "x"}], p, **edit.skin_style("opaque_box"))
            content = open(p, encoding="utf-8").read()
            self.assertIn("&HC8141414", content)         # charcoal box fill
            self.assertRegex(content, r"Style: Default,.*,3,\d+,\d+,2,")  # BorderStyle 3

    def test_karaoke_kf_vs_k(self):
        pages = [{"start": 0.0, "end": 1.0, "tokens": [
            {"text": "a", "from_ms": 0, "to_ms": 500}, {"text": "b", "from_ms": 500, "to_ms": 1000}]}]
        with tempfile.TemporaryDirectory() as d:
            neon = os.path.join(d, "n.ass")
            edit.write_ass_karaoke(pages, neon, **edit.skin_style("neon_pop"))
            self.assertIn(r"\kf", open(neon, encoding="utf-8").read())
            yellow = os.path.join(d, "y.ass")
            edit.write_ass_karaoke(pages, yellow, **edit.skin_style("karaoke_yellow"))
            yc = open(yellow, encoding="utf-8").read()
            self.assertIn(r"\k", yc)
            self.assertNotIn(r"\kf", yc)                 # yellow uses snap, not sweep


class TestSkinSettings(unittest.TestCase):
    def test_settings_caption_skin_roundtrip(self):
        self.assertEqual(Settings().caption_skin, "karaoke_yellow")
        self.assertEqual(Settings.from_dict({"caption_skin": "neon_pop"}).caption_skin, "neon_pop")

    def test_profile_caption_skin_roundtrip(self):
        pr = Profile.from_dict(Profile(name="x", caption_skin="opaque_box").to_dict())
        self.assertEqual(pr.caption_skin, "opaque_box")


if __name__ == "__main__":
    unittest.main(verbosity=2)
