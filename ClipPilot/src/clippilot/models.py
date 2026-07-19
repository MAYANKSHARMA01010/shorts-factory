"""Domain models: the pipeline stages, job status, rights tags, sections, and Job.

The pipeline is a linear state machine:

    ingest -> transcribe -> find_highlights -> clip -> caption
           -> compose -> approval -> publish -> (done)

`approval` is the human gate; `publish` is the only stage with irreversible
external side effects.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional


def utcnow() -> str:
    """ISO-8601 UTC timestamp (seconds precision)."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Section(str, Enum):
    """The three monetization sections (docs/06). All share one engine."""
    PAID_CLIPPING = "A"      # paid-clipping campaigns + done-for-you service
    FACELESS_FUNNEL = "B"    # original faceless channel -> affiliate/brand deals
    AD_SHARE = "C"           # faceless ad-share automation (lowest ROI; eyes open)


class RightsTag(str, Enum):
    """Provenance of an ingested source. THIRD_PARTY is allowed (owner choice)
    but always logged and surfaced in the review UI."""
    OWNED = "owned"
    LICENSED = "licensed"
    CC = "cc"                # creative-commons / public-domain
    THIRD_PARTY = "third_party"


class Stage(str, Enum):
    INGEST = "ingest"
    EXTRACT_SIGNALS = "extract_signals"   # ffmpeg/ffprobe cheap signals (scenes, energy, silence)
    TRANSCRIBE = "transcribe"
    UNDERSTAND = "understand"             # holistic Video Understanding Engine (docs/07)
    FIND_HIGHLIGHTS = "find_highlights"
    CLIP = "clip"
    CAPTION = "caption"
    COMPOSE = "compose"
    APPROVAL = "approval"
    PUBLISH = "publish"
    DONE = "done"


# Linear order of executable stages (DONE is terminal, not executed).
# Refined per docs/02b: ingest → extract_signals → transcribe → understand →
# find_highlights → clip → caption → compose → [approval] → publish.
STAGE_ORDER: list[Stage] = [
    Stage.INGEST,
    Stage.EXTRACT_SIGNALS,
    Stage.TRANSCRIBE,
    Stage.UNDERSTAND,
    Stage.FIND_HIGHLIGHTS,
    Stage.CLIP,
    Stage.CAPTION,
    Stage.COMPOSE,
    Stage.APPROVAL,
    Stage.PUBLISH,
]


def next_stage(stage: Stage) -> Stage:
    """The stage that follows `stage`; DONE after the last."""
    if stage == Stage.DONE:
        return Stage.DONE
    idx = STAGE_ORDER.index(stage)
    return STAGE_ORDER[idx + 1] if idx + 1 < len(STAGE_ORDER) else Stage.DONE


class JobStatus(str, Enum):
    PENDING = "pending"                  # ready for a worker to claim
    RUNNING = "running"                  # a worker is executing the current stage
    BLOCKED_APPROVAL = "blocked_approval"  # waiting at the human gate
    NEEDS_ATTENTION = "needs_attention"  # retries exhausted / guardrail block
    PAUSED = "paused"                    # manually held
    REJECTED = "rejected"                # human rejected at the gate
    DONE = "done"                        # published / completed


# Statuses a worker may claim and run.
RUNNABLE = {JobStatus.PENDING}
# Terminal statuses (no further automatic movement).
TERMINAL = {JobStatus.DONE, JobStatus.REJECTED}


@dataclass
class Job:
    id: Optional[int] = None
    section: Section = Section.PAID_CLIPPING
    source_ref: str = ""                 # path/URL/identifier of the long-form source
    rights_tag: RightsTag = RightsTag.OWNED
    channel: Optional[str] = None        # publish target channel id (nullable)
    stage: Stage = Stage.INGEST
    status: JobStatus = JobStatus.PENDING
    attempts: int = 0                    # attempts on the *current* stage
    max_attempts: int = 3
    idempotency_key: Optional[str] = None
    content_hash: Optional[str] = None
    payload: dict[str, Any] = field(default_factory=dict)  # accumulated stage outputs
    error: Optional[str] = None
    created_at: str = field(default_factory=utcnow)
    updated_at: str = field(default_factory=utcnow)

    # ── (de)serialization for SQLite ──
    def to_row(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "section": self.section.value,
            "source_ref": self.source_ref,
            "rights_tag": self.rights_tag.value,
            "channel": self.channel,
            "stage": self.stage.value,
            "status": self.status.value,
            "attempts": self.attempts,
            "max_attempts": self.max_attempts,
            "idempotency_key": self.idempotency_key,
            "content_hash": self.content_hash,
            "payload": json.dumps(self.payload),
            "error": self.error,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_row(cls, row: Any) -> "Job":
        d = dict(row)
        return cls(
            id=d["id"],
            section=Section(d["section"]),
            source_ref=d["source_ref"],
            rights_tag=RightsTag(d["rights_tag"]),
            channel=d["channel"],
            stage=Stage(d["stage"]),
            status=JobStatus(d["status"]),
            attempts=d["attempts"],
            max_attempts=d["max_attempts"],
            idempotency_key=d["idempotency_key"],
            content_hash=d["content_hash"],
            payload=json.loads(d["payload"]) if d["payload"] else {},
            error=d["error"],
            created_at=d["created_at"],
            updated_at=d["updated_at"],
        )


@dataclass
class Channel:
    channel: str
    platform: str = "youtube"            # youtube | instagram | facebook
    strikes: int = 0
    paused: bool = False
    updated_at: str = field(default_factory=utcnow)
