"""Phase 0 tests: the state machine, approval gate, retries, and the strike
guardrail. Stdlib `unittest` only (Python 3.14 friendly).

Run from the src/ directory:
    python -m unittest discover -s tests
"""
from __future__ import annotations

import unittest

from clippilot import config as cfg
from clippilot import db as dbmod
from clippilot.engine import Engine
from clippilot.models import JobStatus, RightsTag, Section, Stage
from clippilot.queue import JobQueue
from clippilot.runners import default_registry


def make(settings: cfg.Settings | None = None) -> JobQueue:
    conn = dbmod.connect(":memory:")
    return JobQueue(conn, settings or cfg.Settings())


class TestHappyPath(unittest.TestCase):
    def test_parks_at_gate_then_publishes(self):
        q = make()  # approval gate ON by default
        eng = Engine(q)
        job = q.enqueue("podcast.mp4", section=Section.PAID_CLIPPING,
                        rights_tag=RightsTag.OWNED, channel="yt1")
        eng.drain()
        job = q.get(job.id)
        self.assertEqual(job.status, JobStatus.BLOCKED_APPROVAL)
        self.assertEqual(job.stage, Stage.APPROVAL)
        # find_highlights refined the brain's 1 demo candidate into a clip plan
        self.assertIn("find_highlights", job.payload)
        hls = job.payload["find_highlights"]["highlights"]
        self.assertEqual(len(hls), 1)
        self.assertIn("duration", hls[0])      # refined spans carry a duration
        self.assertTrue(hls[0]["reasons"])     # never a bare timestamp

        q.approve(job.id)
        eng.drain()
        job = q.get(job.id)
        self.assertEqual(job.status, JobStatus.DONE)
        self.assertEqual(job.stage, Stage.DONE)
        # AI-disclosure guardrail flowed into the publish result
        self.assertTrue(job.payload["publish"]["ai_disclosure_applied"])

    def test_reject_at_gate(self):
        q = make()
        eng = Engine(q)
        job = q.enqueue("x.mp4")
        eng.drain()
        q.reject(job.id, "off-brand")
        eng.drain()
        job = q.get(job.id)
        self.assertEqual(job.status, JobStatus.REJECTED)
        self.assertEqual(job.error, "off-brand")


class TestClaimAndIdempotency(unittest.TestCase):
    def test_claim_next_claims_a_job_only_once(self):
        q = make()
        q.enqueue("x.mp4")
        first = q.claim_next()
        self.assertIsNotNone(first)
        self.assertEqual(first.status, JobStatus.RUNNING)
        self.assertIsNone(q.claim_next())  # atomic claim: no double-claim of the same row

    def test_complete_stage_failure_does_not_rerun_publish(self):
        # Runner succeeds (publish uploaded) but advancing the state machine fails
        # → the job must park at NEEDS_ATTENTION, NOT re-run publish (double upload).
        q = make(cfg.Settings(auto_approve=True))
        reg = default_registry()
        calls = {"publish": 0}

        def counting_publish(job, queue):
            calls["publish"] += 1
            return {"ok": True}

        reg[Stage.PUBLISH] = counting_publish
        eng = Engine(q, registry=reg)
        job = q.enqueue("x.mp4", channel="yt1")

        orig_complete = q.complete_stage
        state = {"boom": True}

        def flaky_complete(j, result=None):
            if j.stage == Stage.PUBLISH and state["boom"]:
                state["boom"] = False
                raise RuntimeError("db hiccup advancing publish")
            return orig_complete(j, result)

        q.complete_stage = flaky_complete  # type: ignore[assignment]
        eng.drain()
        job = q.get(job.id)
        self.assertEqual(calls["publish"], 1)                  # uploaded exactly once
        self.assertEqual(job.status, JobStatus.NEEDS_ATTENTION)  # parked, not retried


class TestAutoApprove(unittest.TestCase):
    def test_auto_approve_skips_gate(self):
        s = cfg.Settings(auto_approve=True)
        q = make(s)
        eng = Engine(q)
        job = q.enqueue("x.mp4", channel="yt1")
        eng.drain()
        job = q.get(job.id)
        self.assertEqual(job.status, JobStatus.DONE)


class TestRetries(unittest.TestCase):
    def test_exhausted_retries_go_to_needs_attention(self):
        q = make(cfg.Settings(max_attempts=3))
        reg = default_registry()

        def boom(job, queue):
            raise RuntimeError("clip failed")

        reg[Stage.CLIP] = boom
        eng = Engine(q, registry=reg)
        job = q.enqueue("x.mp4")
        eng.drain()
        job = q.get(job.id)
        self.assertEqual(job.status, JobStatus.NEEDS_ATTENTION)
        self.assertEqual(job.stage, Stage.CLIP)
        self.assertEqual(job.attempts, 3)
        self.assertIn("clip failed", job.error or "")

    def test_requeue_after_attention(self):
        q = make(cfg.Settings(max_attempts=1))
        reg = default_registry()
        calls = {"n": 0}

        def flaky(job, queue):
            calls["n"] += 1
            if calls["n"] == 1:
                raise RuntimeError("transient")
            return {"ok": True}

        reg[Stage.CAPTION] = flaky
        eng = Engine(q, registry=reg)
        job = q.enqueue("x.mp4")
        eng.drain()
        self.assertEqual(q.get(job.id).status, JobStatus.NEEDS_ATTENTION)
        q.requeue(job.id)
        eng.drain()  # second attempt succeeds → proceeds to gate
        self.assertEqual(q.get(job.id).status, JobStatus.BLOCKED_APPROVAL)


class TestStrikeGuardrail(unittest.TestCase):
    def test_two_strikes_pause_channel_and_block_publish(self):
        q = make()  # threshold default = 2
        eng = Engine(q)
        job = q.enqueue("x.mp4", channel="yt1")
        eng.drain()
        q.approve(job.id)               # now PENDING at publish
        q.record_strike("yt1")
        ch = q.record_strike("yt1")     # 2nd strike → paused
        self.assertTrue(ch.paused)
        eng.drain()                     # claim should route publish → NEEDS_ATTENTION
        job = q.get(job.id)
        self.assertEqual(job.status, JobStatus.NEEDS_ATTENTION)
        self.assertEqual(job.stage, Stage.PUBLISH)

    def test_resume_channel_allows_publish(self):
        q = make()
        eng = Engine(q)
        job = q.enqueue("x.mp4", channel="yt1")
        eng.drain(); q.approve(job.id)
        q.record_strike("yt1"); q.record_strike("yt1")
        eng.drain()
        self.assertEqual(q.get(job.id).status, JobStatus.NEEDS_ATTENTION)
        q.resume_channel("yt1")
        q.requeue(job.id)
        eng.drain()
        self.assertEqual(q.get(job.id).status, JobStatus.DONE)


class TestRightsAndIdempotency(unittest.TestCase):
    def test_third_party_is_logged(self):
        q = make()
        job = q.enqueue("someone_elses_stream.mp4", rights_tag=RightsTag.THIRD_PARTY)
        kinds = [e["kind"] for e in q.events(job.id)]
        self.assertIn("rights_warning", kinds)

    def test_idempotency_key_dedups(self):
        q = make()
        a = q.enqueue("x.mp4", idempotency_key="k1")
        b = q.enqueue("x.mp4", idempotency_key="k1")
        self.assertEqual(a.id, b.id)
        self.assertEqual(len(q.list()), 1)


class TestUnderstanding(unittest.TestCase):
    def test_understand_stage_runs_and_flags_likeness(self):
        q = make()
        eng = Engine(q)
        job = q.enqueue("podcast.mp4")
        eng.drain()  # parks at approval after the full ingest..understand..compose chain
        job = q.get(job.id)
        # new stages executed and recorded
        self.assertIn("extract_signals", job.payload)
        self.assertIn("understand", job.payload)
        u = job.payload["understand"]["understanding"]
        self.assertEqual(u["flags"]["likeness"], ["identifiable_person"])
        self.assertTrue(u["faces"]["identifiable_person_likely"])
        self.assertEqual(len(u["highlight_candidates"]), 1)
        self.assertTrue(u["highlight_candidates"][0]["reasons"])  # never a bare timestamp

    def test_understanding_model_likeness_helper(self):
        from clippilot.understanding import Faces, Understanding
        u = Understanding(faces=Faces(present=True, identifiable_person_likely=True))
        self.assertTrue(u.needs_likeness_review())
        u2 = Understanding()
        self.assertFalse(u2.needs_likeness_review())

    def test_pipeline_has_understand_between_transcribe_and_highlights(self):
        from clippilot.models import STAGE_ORDER, Stage
        order = [s.value for s in STAGE_ORDER]
        self.assertLess(order.index("transcribe"), order.index("understand"))
        self.assertLess(order.index("understand"), order.index("find_highlights"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
