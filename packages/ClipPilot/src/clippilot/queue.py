"""JobQueue — persistence + the pipeline state machine.

Transitions (the only legal moves):

    PENDING  --claim-->  RUNNING
    RUNNING  --complete-stage-->  PENDING (next stage)        # normal advance
    RUNNING  --complete COMPOSE-->  BLOCKED_APPROVAL          # if approval gate on
    RUNNING  --complete PUBLISH-->  DONE
    RUNNING  --fail-->  PENDING (retry) | NEEDS_ATTENTION     # when attempts exhausted
    BLOCKED_APPROVAL --approve-->  PENDING (publish)
    BLOCKED_APPROVAL --reject-->   REJECTED

Guardrails (approval gate, auto_approve, strike pause) are injected via Settings.
"""
from __future__ import annotations

import json
import sqlite3
from typing import Any, Optional

from . import db as dbmod
from .config import Settings
from .models import (
    RUNNABLE,
    Channel,
    Job,
    JobStatus,
    RightsTag,
    Section,
    Stage,
    next_stage,
    utcnow,
)


class JobQueue:
    def __init__(self, conn: sqlite3.Connection, settings: Optional[Settings] = None):
        self.conn = conn
        self.settings = settings or Settings()
        dbmod.init_schema(conn)

    # ── events / audit ───────────────────────────────────────────────────────
    def _event(self, job_id: Optional[int], kind: str, detail: str = "") -> None:
        self.conn.execute(
            "INSERT INTO events (job_id, ts, kind, detail) VALUES (?,?,?,?)",
            (job_id, utcnow(), kind, detail),
        )

    def events(self, job_id: int) -> list[sqlite3.Row]:
        return list(
            self.conn.execute(
                "SELECT * FROM events WHERE job_id=? ORDER BY id", (job_id,)
            )
        )

    # ── create / read ────────────────────────────────────────────────────────
    def enqueue(
        self,
        source_ref: str,
        section: Section | str = Section.PAID_CLIPPING,
        rights_tag: RightsTag | str = RightsTag.OWNED,
        channel: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        payload: Optional[dict[str, Any]] = None,
    ) -> Job:
        section = Section(section)
        rights_tag = RightsTag(rights_tag)

        # Idempotency: if a job with this key exists, return it unchanged.
        if idempotency_key:
            existing = self.conn.execute(
                "SELECT * FROM jobs WHERE idempotency_key=?", (idempotency_key,)
            ).fetchone()
            if existing:
                return Job.from_row(existing)

        job = Job(
            section=section,
            source_ref=source_ref,
            rights_tag=rights_tag,
            channel=channel,
            stage=Stage.INGEST,
            status=JobStatus.PENDING,
            max_attempts=self.settings.max_attempts,
            idempotency_key=idempotency_key,
            payload=payload or {},
        )
        row = job.to_row()
        del row["id"]
        cols = ", ".join(row.keys())
        ph = ", ".join("?" for _ in row)
        cur = self.conn.execute(
            f"INSERT INTO jobs ({cols}) VALUES ({ph})", tuple(row.values())
        )
        job.id = cur.lastrowid
        # Surface the legal-provenance signal in the log (docs/06 guardrail).
        self._event(job.id, "enqueued", f"section={section.value} rights={rights_tag.value}")
        if rights_tag == RightsTag.THIRD_PARTY:
            self._event(job.id, "rights_warning", "third-party source: elevated copyright/strike risk")
        return job

    def get(self, job_id: int) -> Optional[Job]:
        row = self.conn.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
        return Job.from_row(row) if row else None

    def list(self, status: Optional[JobStatus | str] = None, limit: int = 100) -> list[Job]:
        if status:
            status = JobStatus(status)
            rows = self.conn.execute(
                "SELECT * FROM jobs WHERE status=? ORDER BY id DESC LIMIT ?",
                (status.value, limit),
            )
        else:
            rows = self.conn.execute(
                "SELECT * FROM jobs ORDER BY id DESC LIMIT ?", (limit,)
            )
        return [Job.from_row(r) for r in rows]

    def _save(self, job: Job) -> None:
        job.updated_at = utcnow()
        row = job.to_row()
        sets = ", ".join(f"{k}=?" for k in row if k != "id")
        vals = [v for k, v in row.items() if k != "id"]
        vals.append(job.id)
        self.conn.execute(f"UPDATE jobs SET {sets} WHERE id=?", tuple(vals))

    # ── claim / run ──────────────────────────────────────────────────────────
    def claim_next(self) -> Optional[Job]:
        """Atomically pick the oldest PENDING job and mark it RUNNING.

        Publish-stage jobs whose channel is paused (strike guardrail) are routed
        to NEEDS_ATTENTION instead of being run.
        """
        while True:
            row = self.conn.execute(
                "SELECT * FROM jobs WHERE status=? ORDER BY id LIMIT 1",
                (JobStatus.PENDING.value,),
            ).fetchone()
            if not row:
                return None
            job = Job.from_row(row)

            if job.stage == Stage.PUBLISH and self.channel_paused(job.channel):
                err = f"channel '{job.channel}' paused by strike guardrail"
                cur = self.conn.execute(
                    "UPDATE jobs SET status=?, error=?, updated_at=? WHERE id=? AND status=?",
                    (JobStatus.NEEDS_ATTENTION.value, err, utcnow(), job.id, JobStatus.PENDING.value),
                )
                if cur.rowcount:
                    self._event(job.id, "publish_blocked", err)
                continue  # look for the next runnable job

            # Atomic claim: only one worker can flip this row PENDING -> RUNNING.
            # (Plain SELECT+UPDATE would let two drainers — the GUI worker and the
            # service — claim and run the same job, double-publishing.)
            cur = self.conn.execute(
                "UPDATE jobs SET status=?, updated_at=? WHERE id=? AND status=?",
                (JobStatus.RUNNING.value, utcnow(), job.id, JobStatus.PENDING.value),
            )
            if cur.rowcount != 1:
                continue  # another worker won the row first; try the next one
            job.status = JobStatus.RUNNING
            self._event(job.id, "claimed", f"stage={job.stage.value}")
            return job

    def complete_stage(self, job: Job, result: Optional[dict[str, Any]] = None) -> Job:
        """Mark the current stage done and advance the state machine."""
        if job.status != JobStatus.RUNNING:
            raise ValueError(f"job {job.id} not RUNNING (is {job.status.value})")

        if result:
            job.payload[job.stage.value] = result
        self._event(job.id, "stage_done", job.stage.value)

        completed = job.stage
        nxt = next_stage(completed)

        if completed == Stage.PUBLISH:
            job.stage = Stage.DONE
            job.status = JobStatus.DONE
            job.attempts = 0
            self._save(job)
            self._event(job.id, "published", job.channel or "")
            return job

        # Entering APPROVAL: apply the human-gate guardrail.
        if nxt == Stage.APPROVAL:
            job.stage = Stage.APPROVAL
            job.attempts = 0
            gate_on = self.settings.guardrails.approval_gate and not self.settings.auto_approve
            if gate_on:
                job.status = JobStatus.BLOCKED_APPROVAL
                self._save(job)
                self._event(job.id, "awaiting_approval", "")
                return job
            # auto-approved: fall through to publish
            job.status = JobStatus.PENDING
            job.stage = Stage.PUBLISH
            self._save(job)
            self._event(job.id, "auto_approved", "approval gate off / auto_approve on")
            return job

        # Normal advance.
        job.stage = nxt
        job.status = JobStatus.PENDING
        job.attempts = 0
        self._save(job)
        return job

    def fail_stage(self, job: Job, error: str) -> Job:
        """Record a stage failure; retry until the per-stage budget is spent."""
        if job.status != JobStatus.RUNNING:
            raise ValueError(f"job {job.id} not RUNNING (is {job.status.value})")
        job.attempts += 1
        job.error = error
        self._event(job.id, "stage_failed", f"{job.stage.value}: {error} (attempt {job.attempts})")
        if job.attempts < job.max_attempts:
            job.status = JobStatus.PENDING  # retry same stage
        else:
            job.status = JobStatus.NEEDS_ATTENTION
            self._event(job.id, "needs_attention", f"retries exhausted at {job.stage.value}")
        self._save(job)
        return job

    # ── approval gate ────────────────────────────────────────────────────────
    def approve(self, job_id: int) -> Job:
        job = self.get(job_id)
        if not job:
            raise ValueError(f"no job {job_id}")
        if job.status != JobStatus.BLOCKED_APPROVAL:
            raise ValueError(f"job {job_id} not awaiting approval (is {job.status.value})")
        job.stage = Stage.PUBLISH
        job.status = JobStatus.PENDING
        job.attempts = 0
        self._save(job)
        self._event(job.id, "approved", "")
        return job

    def reject(self, job_id: int, reason: str = "") -> Job:
        job = self.get(job_id)
        if not job:
            raise ValueError(f"no job {job_id}")
        job.status = JobStatus.REJECTED
        job.error = reason or "rejected at approval gate"
        self._save(job)
        self._event(job.id, "rejected", reason)
        return job

    def mark_needs_attention(self, job_id: int, error: str) -> None:
        """Park a job (no attempt increment, no re-queue) — used when a stage's
        runner already succeeded but advancing the state machine failed, so the
        stage (e.g. an irreversible publish) must NOT be retried."""
        self.conn.execute(
            "UPDATE jobs SET status=?, error=?, updated_at=? WHERE id=?",
            (JobStatus.NEEDS_ATTENTION.value, error, utcnow(), job_id),
        )
        self._event(job_id, "needs_attention", error)

    def requeue(self, job_id: int) -> Job:
        """Reset a NEEDS_ATTENTION/PAUSED job to retry its current stage."""
        job = self.get(job_id)
        if not job:
            raise ValueError(f"no job {job_id}")
        job.status = JobStatus.PENDING
        job.attempts = 0
        job.error = None
        self._save(job)
        self._event(job.id, "requeued", f"stage={job.stage.value}")
        return job

    # ── channels / strike guardrail (docs/06 §6.3) ───────────────────────────
    def get_channel(self, channel: Optional[str]) -> Optional[Channel]:
        if not channel:
            return None
        row = self.conn.execute("SELECT * FROM channels WHERE channel=?", (channel,)).fetchone()
        if not row:
            return None
        d = dict(row)
        return Channel(
            channel=d["channel"], platform=d["platform"],
            strikes=d["strikes"], paused=bool(d["paused"]), updated_at=d["updated_at"],
        )

    def ensure_channel(self, channel: str, platform: str = "youtube") -> Channel:
        # INSERT OR IGNORE is idempotent — no SELECT-then-INSERT race (channel is PK).
        self.conn.execute(
            "INSERT OR IGNORE INTO channels (channel, platform, strikes, paused, updated_at) "
            "VALUES (?,?,0,0,?)",
            (channel, platform, utcnow()),
        )
        return self.get_channel(channel) or Channel(channel=channel, platform=platform)

    def channel_paused(self, channel: Optional[str]) -> bool:
        ch = self.get_channel(channel)
        return bool(ch and ch.paused)

    def record_strike(self, channel: str, platform: str = "youtube") -> Channel:
        """Add a copyright strike; auto-pause at the configured threshold."""
        self.ensure_channel(channel, platform)
        # Atomic increment in SQL — a Python read-modify-write would lose strikes
        # under concurrency and could keep a channel below the pause threshold.
        self.conn.execute(
            "UPDATE channels SET strikes = strikes + 1, updated_at=? WHERE channel=?",
            (utcnow(), channel),
        )
        ch = self.get_channel(channel)
        assert ch is not None
        if (self.settings.guardrails.strike_tracking
                and ch.strikes >= self.settings.guardrails.strike_pause_threshold
                and not ch.paused):
            self.conn.execute(
                "UPDATE channels SET paused=1, updated_at=? WHERE channel=?", (utcnow(), channel)
            )
            ch.paused = True
        self._event(None, "strike", f"{channel}: strikes={ch.strikes} paused={ch.paused}")
        return ch

    def resume_channel(self, channel: str) -> None:
        self.conn.execute(
            "UPDATE channels SET paused=0, updated_at=? WHERE channel=?", (utcnow(), channel)
        )
        self._event(None, "channel_resumed", channel)

    # ── reporting ────────────────────────────────────────────────────────────
    def counts(self) -> dict[str, int]:
        rows = self.conn.execute("SELECT status, COUNT(*) c FROM jobs GROUP BY status")
        return {r["status"]: r["c"] for r in rows}
