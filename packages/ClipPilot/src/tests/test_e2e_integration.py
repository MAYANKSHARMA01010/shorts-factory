"""Real end-to-end integration: a genuine source video through the WHOLE engine
with real ffmpeg + faster-whisper (no mocks, no API key).

Self-contained: it synthesizes a narrated clip with SAPI TTS, muxes it into a
test video, then drains the pipeline and asserts a real captioned vertical clip
lands on disk and the job parks at the approval gate. Opt-in (downloads a whisper
model on first run):

    $env:CLIPPILOT_RUN_E2E="1"; $env:CLIPPILOT_WHISPER_MODEL="tiny"
    python -m unittest tests.test_e2e_integration -v
"""
from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

from clippilot import config as cfg
from clippilot import db as dbmod
from clippilot.engine import Engine
from clippilot.media import ffmpeg as ffm
from clippilot.media import transcribe as tr
from clippilot.media import tts
from clippilot.models import JobStatus, RightsTag, Section, Stage
from clippilot.queue import JobQueue
from clippilot.ui.controller import AppController

_ENABLED = (os.environ.get("CLIPPILOT_RUN_E2E") == "1"
            and ffm.ffmpeg_available() and tts.tts_available() and tr.whisper_available())


@unittest.skipUnless(_ENABLED, "set CLIPPILOT_RUN_E2E=1 (needs ffmpeg + TTS + whisper)")
class TestRealPipeline(unittest.TestCase):
    def setUp(self):
        self._prev = os.environ.get("CLIPPILOT_DATA")
        self._tmp = tempfile.TemporaryDirectory(prefix="clippilot_e2e_", ignore_cleanup_errors=True)
        os.environ["CLIPPILOT_DATA"] = self._tmp.name
        os.environ.setdefault("CLIPPILOT_WHISPER_MODEL", "tiny")

    def tearDown(self):
        if self._prev is None:
            os.environ.pop("CLIPPILOT_DATA", None)
        else:
            os.environ["CLIPPILOT_DATA"] = self._prev
        self._tmp.cleanup()

    def _make_source(self) -> str:
        narration = ("This is a ClipPilot test clip. The quick brown fox jumps over "
                     "the lazy dog. Subscribe for more amazing content.")
        wav = os.path.join(self._tmp.name, "n.wav")
        self.assertTrue(tts.synthesize(narration, wav).get("available"), "TTS failed")
        src = os.path.join(self._tmp.name, "source.mp4")
        ffm.run_ffmpeg([
            "-f", "lavfi", "-i", "testsrc=size=640x480:rate=30",
            "-i", wav, "-shortest",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
            "-y", src,
        ], timeout=180)
        return src

    def test_full_pipeline_produces_captioned_clip(self):
        src = self._make_source()
        self.assertTrue(os.path.exists(src), "could not build source video")

        q = JobQueue(dbmod.connect(cfg.db_path()), cfg.Settings())  # gate ON
        ctrl = AppController(q)
        eng = Engine(q)
        job = q.enqueue(src, section=Section.PAID_CLIPPING,
                        rights_tag=RightsTag.OWNED, channel="yt_test")
        eng.drain()
        job = q.get(job.id)

        # Parked at the human gate after the whole real chain ran.
        self.assertEqual(job.status, JobStatus.BLOCKED_APPROVAL)
        self.assertEqual(job.stage, Stage.APPROVAL)

        # Each real stage produced real output.
        self.assertTrue(job.payload["extract_signals"]["available"])
        self.assertTrue(job.payload["transcribe"]["available"])
        self.assertTrue(job.payload["understand"]["available"])
        self.assertTrue(job.payload["find_highlights"]["highlights"])

        clip_payload = job.payload["clip"]
        self.assertTrue(clip_payload.get("available"), "clip stage did not cut a real clip")
        clip_file = clip_payload["clips"][0]
        self.assertTrue(os.path.exists(clip_file))
        self.assertGreater(os.path.getsize(clip_file), 0)

        # A clip is available to review (captioned where speech was found).
        clips = ctrl.clips_for(job)
        self.assertTrue(clips and os.path.exists(clips[0]))

        # Approve → it reaches publish (metadata ready; no creds → no live upload).
        q.approve(job.id)
        eng.drain()
        job = q.get(job.id)
        self.assertEqual(job.status, JobStatus.DONE)
        self.assertIn("metadata", job.payload["publish"])

    def test_section_b_full_pipeline_from_a_topic(self):
        # The funnel path: a TOPIC (no source video) → generate → transcribe →
        # captions → publish-ready, through the whole engine with real ffmpeg+whisper.
        q = JobQueue(dbmod.connect(cfg.db_path()), cfg.Settings())  # gate ON
        ctrl = AppController(q)
        eng = Engine(q)
        job = q.enqueue("three quick facts about the moon", section=Section.FACELESS_FUNNEL,
                        rights_tag=RightsTag.OWNED, channel="yt_funnel")
        eng.drain()
        job = q.get(job.id)

        self.assertEqual(job.status, JobStatus.BLOCKED_APPROVAL)
        ingest = job.payload["ingest"]
        self.assertTrue(ingest["generated"], "Section B should generate a short from the topic")
        self.assertTrue(os.path.exists(ingest["media_path"]))   # a real generated mp4
        self.assertTrue(job.payload["transcribe"]["available"])  # narration transcribed
        self.assertTrue(job.payload["clip"].get("available"))    # whole short → one clip

        clips = ctrl.clips_for(job)
        self.assertTrue(clips and os.path.exists(clips[0]))

        q.approve(job.id)
        eng.drain()
        self.assertEqual(q.get(job.id).status, JobStatus.DONE)


if __name__ == "__main__":
    unittest.main(verbosity=2)
