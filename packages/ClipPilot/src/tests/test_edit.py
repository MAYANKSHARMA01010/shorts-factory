"""Phase 1 tests for real clip/caption/compose (ffmpeg). Skipped without ffmpeg."""
from __future__ import annotations

import os
import tempfile
import unittest

from clippilot.media import edit
from clippilot.media import ffmpeg as ffm
from clippilot.media import signals

_RENDER = os.environ.get("CLIPPILOT_RUN_RENDER") == "1"  # heavy ffmpeg renders are opt-in


def _gen(path: str, dur: int = 4) -> bool:
    r = ffm.run_ffmpeg([
        "-f", "lavfi", "-i", f"testsrc=duration={dur}:size=640x480:rate=30",
        "-f", "lavfi", "-i", f"sine=frequency=440:duration={dur}",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
        "-t", str(dur), "-y", path,
    ], timeout=120)
    return os.path.exists(path)


@unittest.skipUnless(_RENDER and ffm.ffmpeg_available(), "set CLIPPILOT_RUN_RENDER=1 (renders video)")
class TestEdit(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix="clippilot_edit_")
        cls.src = os.path.join(cls.tmp.name, "src.mp4")
        if not _gen(cls.src, 4):
            raise unittest.SkipTest("could not generate sample")

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_clip_reframes_to_vertical(self):
        out = os.path.join(self.tmp.name, "clip.mp4")
        got = edit.clip_segment(self.src, 0.5, 2.5, out)  # 2s clip
        self.assertEqual(got, out)
        m = signals.probe(out)
        self.assertEqual(m.resolution, "1080x1920")
        self.assertAlmostEqual(m.duration_s, 2.0, delta=0.5)

    def test_clip_no_reframe_keeps_size(self):
        out = os.path.join(self.tmp.name, "clip_h.mp4")
        edit.clip_segment(self.src, 0.0, 1.0, out, vertical=False)
        self.assertEqual(signals.probe(out).resolution, "640x480")

    def test_caption_burn_in(self):
        clip = os.path.join(self.tmp.name, "c2.mp4")
        edit.clip_segment(self.src, 0.0, 2.0, clip)
        srt = edit.write_srt([
            {"start": 0.0, "end": 1.0, "text": "Hello"},
            {"start": 1.0, "end": 2.0, "text": "World"},
        ], os.path.join(self.tmp.name, "caps.srt"))
        self.assertTrue(os.path.exists(srt))
        out = os.path.join(self.tmp.name, "captioned.mp4")
        got = edit.burn_subtitles(clip, srt, out)
        self.assertEqual(got, out)
        self.assertGreater(os.path.getsize(out), 0)

    def test_add_bgm_mixes_music_under_narration(self):
        bgm = os.path.join(self.tmp.name, "bgm.wav")
        ffm.run_ffmpeg(["-f", "lavfi", "-i", "sine=frequency=110:duration=2", "-y", bgm], timeout=30)
        out = os.path.join(self.tmp.name, "bgm_out.mp4")
        got = edit.add_bgm(self.src, bgm, out, volume=0.1)
        self.assertEqual(got, out)
        m = signals.probe(out)
        self.assertTrue(m.has_audio)
        self.assertAlmostEqual(m.duration_s, signals.probe(self.src).duration_s, delta=0.6)

    def test_add_bgm_missing_file_returns_none(self):
        self.assertIsNone(edit.add_bgm(self.src, "no_such_music.mp3",
                                       os.path.join(self.tmp.name, "x.mp4")))

    def test_concat(self):
        a = os.path.join(self.tmp.name, "a.mp4")
        b = os.path.join(self.tmp.name, "b.mp4")
        edit.clip_segment(self.src, 0.0, 1.0, a, vertical=False)
        edit.clip_segment(self.src, 1.0, 2.0, b, vertical=False)
        out = os.path.join(self.tmp.name, "joined.mp4")
        got = edit.concat_clips([a, b], out)
        self.assertEqual(got, out)
        self.assertAlmostEqual(signals.probe(out).duration_s, 2.0, delta=0.6)

    def test_srt_timestamp_format(self):
        self.assertEqual(edit._srt_ts(0.0), "00:00:00,000")
        self.assertEqual(edit._srt_ts(61.5), "00:01:01,500")
        self.assertEqual(edit._srt_ts(3661.25), "01:01:01,250")

    def test_caption_burn_in_ass(self):
        clip = os.path.join(self.tmp.name, "c3.mp4")
        edit.clip_segment(self.src, 0.0, 2.0, clip)
        ass = edit.write_ass([
            {"start": 0.0, "end": 1.0, "text": "hello there"},
            {"start": 1.0, "end": 2.0, "text": "big bold"},
        ], os.path.join(self.tmp.name, "caps.ass"))
        out = os.path.join(self.tmp.name, "captioned_ass.mp4")
        got = edit.burn_subtitles(clip, ass, out)   # .ass → no force_style
        self.assertEqual(got, out)
        self.assertGreater(os.path.getsize(out), 0)


class TestAssStyling(unittest.TestCase):
    """Pure ASS generation (no ffmpeg) — the big-bold vertical caption style."""

    def test_ass_timestamp_format(self):
        self.assertEqual(edit._ass_ts(0.0), "0:00:00.00")
        self.assertEqual(edit._ass_ts(61.5), "0:01:01.50")
        self.assertEqual(edit._ass_ts(3661.25), "1:01:01.25")

    def test_write_ass_has_playres_and_big_style(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            p = edit.write_ass([{"start": 0.0, "end": 1.0, "text": "hi there"}],
                               os.path.join(d, "x.ass"), width=1080, height=1920)
            text = open(p, encoding="utf-8").read()
            self.assertIn("PlayResX: 1080", text)
            self.assertIn("PlayResY: 1920", text)
            self.assertIn(f"Default,Arial,{edit.ASS_DEFAULTS['fontsize']}", text)  # big font
            self.assertIn("Dialogue:", text)
            self.assertIn("HI THERE", text)        # uppercase applied
            self.assertGreaterEqual(edit.ASS_DEFAULTS["fontsize"], 72)   # genuinely big

    def test_write_ass_can_disable_uppercase(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            p = edit.write_ass([{"start": 0.0, "end": 1.0, "text": "Keep Case"}],
                               os.path.join(d, "x.ass"), uppercase=False)
            self.assertIn("Keep Case", open(p, encoding="utf-8").read())

    def test_karaoke_text_k_tags_match_word_gaps(self):
        page = {"start": 0.0, "end": 1.9, "tokens": [
            {"text": "deep", "from_ms": 0, "to_ms": 500},
            {"text": "ocean", "from_ms": 500, "to_ms": 1100},
            {"text": "glow", "from_ms": 1100, "to_ms": 1900},
        ]}
        text = edit._karaoke_text(page, uppercase=True)
        self.assertIn("{\\k0}DEEP", text)       # first word pops immediately
        self.assertIn("{\\k50}OCEAN", text)     # 500ms later → 50 cs
        self.assertIn("{\\k60}GLOW", text)      # +600ms → 60 cs

    def test_srt_ts_rounds_with_carry(self):
        self.assertEqual(edit._srt_ts(5.9996), "00:00:06,000")   # no ",1000" overflow
        self.assertEqual(edit._srt_ts(59.9999), "00:01:00,000")
        self.assertEqual(edit._srt_ts(0.0), "00:00:00,000")
        self.assertEqual(edit._srt_ts(-3.0), "00:00:00,000")     # clamped

    def test_write_ass_karaoke_has_highlight_colour_and_k(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            p = edit.write_ass_karaoke(
                [{"start": 0.0, "end": 1.0, "tokens": [{"text": "hi", "from_ms": 0, "to_ms": 500}]}],
                os.path.join(d, "k.ass"))
            text = open(p, encoding="utf-8").read()
            self.assertIn("\\k", text)                              # karaoke timing present
            self.assertIn(edit.ASS_KARAOKE_DEFAULTS["primary"], text)  # the highlight colour
            self.assertIn("PlayResY: 1920", text)


if __name__ == "__main__":
    unittest.main(verbosity=2)
