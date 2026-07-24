"""The `Understanding` object — the holistic, human-like read of a video.

Schema mirrors docs/07-video-understanding.md (itself modeled on OpenMontage's
`VideoAnalysisBrief`, clean-room re-authored — see docs/02b §2). It is produced by
the `understand` stage: cheap/deterministic fields are filled by CPU extractors
(ffmpeg signals, faster-whisper, PySceneDetect, MediaPipe, EasyOCR), while
`visual_desc`, `summary`, mood labels, on-screen-text reads, and highlight
`reasons` are completed by Claude's own vision over the sampled keyframes in the
same MCP tool turn.

Stdlib-only (dataclasses) so it stays importable on Python 3.14 in Phase 0; the
real extractors arrive in the pinned 3.12 venv (Phase 1).
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Optional


@dataclass
class Scene:
    idx: int
    start: float
    end: float
    keyframe_path: Optional[str] = None
    shot_change_score: float = 0.0
    transcript_excerpt: str = ""
    on_screen_text: list[str] = field(default_factory=list)
    visual_desc: str = ""            # filled by Claude from the keyframe
    energy: float = 0.0              # 0..1 from ebur128 loudness
    speech_ratio: float = 0.0


@dataclass
class HighlightCandidate:
    start: float
    end: float
    score: float = 0.0
    reasons: list[str] = field(default_factory=list)   # never a bare timestamp


@dataclass
class Faces:
    present: bool = False
    max_count: int = 0
    identifiable_person_likely: bool = False   # → likeness guardrail (docs/07 §5)


@dataclass
class SourceMeta:
    duration_s: float = 0.0
    fps: float = 0.0
    resolution: str = ""
    codec: str = ""
    has_audio: bool = False


@dataclass
class Understanding:
    source: SourceMeta = field(default_factory=SourceMeta)
    summary: str = ""                       # 1-paragraph holistic gist (Claude)
    topics: list[str] = field(default_factory=list)
    entities: list[str] = field(default_factory=list)
    scenes: list[Scene] = field(default_factory=list)
    on_screen_text: list[dict[str, Any]] = field(default_factory=list)   # OCR: {t, text, bbox}
    mood_energy_timeline: list[dict[str, Any]] = field(default_factory=list)
    faces: Faces = field(default_factory=Faces)
    highlight_candidates: list[HighlightCandidate] = field(default_factory=list)
    flags: dict[str, list[str]] = field(default_factory=dict)   # sensitivity / likeness / third_party_source
    keyframe_paths: list[str] = field(default_factory=list)     # returned to Claude as image blocks

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def needs_likeness_review(self) -> bool:
        """True when a real, identifiable person is present → route to the
        consent/likeness guardrail before publish (docs/04, docs/07 §5)."""
        return bool(self.faces.identifiable_person_likely) or "identifiable_person" in self.flags.get("likeness", [])
