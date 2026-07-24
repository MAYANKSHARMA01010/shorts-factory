"""Tests for Section B/C generation (topic → script → TTS → video) + its engine
wiring (the _ingest runner setting media_path, _media_path threading).
"""
from __future__ import annotations

import os
import tempfile
import types
import unittest
from pathlib import Path

from clippilot import config as cfg
from clippilot.generate import assemble, pipeline, script
from clippilot.media import ffmpeg as ffm
from clippilot.media import tts
from clippilot.models import Job, Section
from clippilot.runners import _ingest, _media_path

# Heavy/networked render tests are opt-in so the default suite stays fast + offline.
_RENDER = os.environ.get("CLIPPILOT_RUN_RENDER") == "1"


class TestScript(unittest.TestCase):
    def test_fallback_without_generator(self):
        out = script.generate_script("quantum tunneling", generate_fn=None)
        self.assertTrue(out["_fallback"])
        self.assertIn("quantum tunneling", out["script"])
        self.assertLessEqual(len(out["title"]), 100)

    def test_mock_generator_parsed(self):
        gen = lambda p: '{"title":"Why X","script":"Hook. A real point. Follow for more."}'
        out = script.generate_script("X", generate_fn=gen)
        self.assertEqual(out["title"], "Why X")
        self.assertIn("real point", out["script"])
        self.assertNotIn("_fallback", out)

    def test_bad_json_falls_back(self):
        out = script.generate_script("X", generate_fn=lambda p: "not json")
        self.assertTrue(out["_fallback"])

    def test_generator_exception_falls_back(self):
        def boom(_):
            raise RuntimeError("llm down")
        self.assertTrue(script.generate_script("X", generate_fn=boom)["_fallback"])

    def test_fallback_varies_by_topic(self):
        a = script.generate_script("ancient rome", generate_fn=None)["script"]
        b = script.generate_script("deep sea fish", generate_fn=None)["script"]
        self.assertNotEqual(a, b)                 # not identical boilerplate every time
        self.assertIn("ancient rome", a)
        self.assertIn("deep sea fish", b)


class TestIngestWiring(unittest.TestCase):
    def test_media_path_prefers_ingest_then_source(self):
        j1 = Job(source_ref="topic only", payload={"ingest": {"media_path": "/gen/short.mp4"}})
        self.assertEqual(_media_path(j1), "/gen/short.mp4")
        j2 = Job(source_ref="C:/owned.mp4", payload={})
        self.assertEqual(_media_path(j2), "C:/owned.mp4")

    def test_section_a_ingest_uses_source(self):
        job = Job(id=1, section=Section.PAID_CLIPPING, source_ref="C:/owned.mp4")
        out = _ingest(job, queue=None)  # Section A returns before touching queue
        self.assertEqual(out["media_path"], "C:/owned.mp4")
        self.assertFalse(out["generated"])


class TestAssembleHelpers(unittest.TestCase):
    def test_wrap_title_caps_lines(self):
        from clippilot.generate.assemble import _wrap_title
        wrapped = _wrap_title("word " * 40, width=10, max_lines=3)
        self.assertLessEqual(len(wrapped.splitlines()), 3)


@unittest.skipUnless(_RENDER and ffm.ffmpeg_available(), "set CLIPPILOT_RUN_RENDER=1 (renders video)")
class TestAssemble(unittest.TestCase):
    def _wav(self, d: str) -> str:
        wav = os.path.join(d, "n.wav")
        ffm.run_ffmpeg(["-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-y", wav], timeout=60)
        return wav

    def test_assemble_short_makes_vertical_video(self):
        with tempfile.TemporaryDirectory(prefix="clippilot_asm_") as d:
            wav = self._wav(d)
            if not os.path.exists(wav):
                self.skipTest("could not generate wav")
            out = os.path.join(d, "short.mp4")
            res = assemble.assemble_short(wav, out)
            self.assertTrue(res and os.path.exists(res))
            self.assertGreater(os.path.getsize(res), 0)

    def test_assemble_with_title_card(self):
        with tempfile.TemporaryDirectory(prefix="clippilot_title_") as d:
            wav = self._wav(d)
            if not os.path.exists(wav):
                self.skipTest("could not generate wav")
            out = os.path.join(d, "short.mp4")
            res = assemble.assemble_short(wav, out, title="Three Surprising Facts About Octopuses")
            self.assertTrue(res and os.path.exists(res))
            # when drawtext + a font are available, the rich (title-card) path runs
            if assemble._has("drawtext") and assemble._font():
                self.assertTrue(os.path.exists(os.path.join(d, "title.txt")))
                self.assertTrue(os.path.exists(os.path.join(d, "font.ttf")))

    def test_solid_fallback_when_gradient_disabled(self):
        with tempfile.TemporaryDirectory(prefix="clippilot_solid_") as d:
            wav = self._wav(d)
            if not os.path.exists(wav):
                self.skipTest("could not generate wav")
            out = os.path.join(d, "short.mp4")
            res = assemble.assemble_short(wav, out, style="solid", bg_color="navy")
            self.assertTrue(res and os.path.exists(res))


@unittest.skipUnless(_RENDER and ffm.ffmpeg_available() and tts.tts_available(),
                     "set CLIPPILOT_RUN_RENDER=1 (TTS + render)")
class TestGenerateShortAndSectionBIngest(unittest.TestCase):
    """Verifies the generate→TTS→assemble→ingest wiring. B-roll sourcing is stubbed
    OFF (no live network) so this is deterministic — the gradient path still renders
    a real video; b-roll itself is covered by mocked unit tests + manual renders."""

    def setUp(self):
        from clippilot.generate import broll
        self._broll = broll
        self._orig = (broll.fetch_timed_broll, broll.fetch_broll)
        broll.fetch_timed_broll = lambda *a, **k: {"kind": "none", "segments": []}
        broll.fetch_broll = lambda *a, **k: {"kind": "none", "paths": [], "keywords": []}

    def tearDown(self):
        self._broll.fetch_timed_broll, self._broll.fetch_broll = self._orig

    def test_generate_short_real(self):
        with tempfile.TemporaryDirectory(prefix="clippilot_gen_") as d:
            res = pipeline.generate_short("the speed of light", d, generate_fn=None)
            self.assertTrue(res["available"], res.get("reason"))
            self.assertTrue(os.path.exists(res["video_path"]))
            self.assertGreater(res["duration_s"], 0)

    def test_section_b_ingest_generates_media(self):
        prev = os.environ.get("CLIPPILOT_DATA")
        tmp = tempfile.TemporaryDirectory(prefix="clippilot_bgen_", ignore_cleanup_errors=True)
        os.environ["CLIPPILOT_DATA"] = tmp.name
        try:
            job = Job(id=3, section=Section.FACELESS_FUNNEL, source_ref="a fun science fact")
            q = types.SimpleNamespace(settings=cfg.Settings())
            out = _ingest(job, queue=q)
            self.assertTrue(out["generated"], out.get("reason"))
            self.assertTrue(os.path.exists(out["media_path"]))
            self.assertEqual(_media_path(job_with(out)), out["media_path"])
        finally:
            if prev is None:
                os.environ.pop("CLIPPILOT_DATA", None)
            else:
                os.environ["CLIPPILOT_DATA"] = prev
            tmp.cleanup()


def job_with(ingest_result: dict) -> Job:
    return Job(source_ref="topic", payload={"ingest": ingest_result})


if __name__ == "__main__":
    unittest.main(verbosity=2)
