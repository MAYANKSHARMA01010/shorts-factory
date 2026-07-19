"""Qt-free controller — the GUI's data facade over the SQLite JobQueue.

All widget code talks to the engine only through this, so the app logic is
unit-testable headless (no display, no Qt). Uses its own JobQueue connection
(separate from the background worker's) — WAL handles the concurrency.
"""
from __future__ import annotations

from typing import Any, Optional

from ..models import Job, JobStatus, RightsTag, Section
from ..queue import JobQueue

SECTION_LABELS: dict[Section, str] = {
    Section.PAID_CLIPPING: "A · Paid Clipping / DFY",
    Section.FACELESS_FUNNEL: "B · Faceless Funnel",
    Section.AD_SHARE: "C · Ad-Share",
}
SECTION_BLURB: dict[Section, str] = {
    Section.PAID_CLIPPING: "Clip client/owned long-form into vertical shorts for paid-clipping campaigns & done-for-you delivery.",
    Section.FACELESS_FUNNEL: "Original faceless channel → affiliate / brand deals (synthetic avatar, varied substance, AI-disclosed).",
    Section.AD_SHARE: "Theme → short for platform ad-share. Lowest ROI — built with eyes open; same approval gate + disclosure.",
}


class AppController:
    def __init__(self, queue: JobQueue):
        self.queue = queue

    # reads
    def counts(self) -> dict[str, int]:
        return self.queue.counts()

    def list_jobs(self, status: Optional[JobStatus] = None, limit: int = 300) -> list[Job]:
        return self.queue.list(status, limit)

    def jobs_for_section(self, section: Section) -> list[Job]:
        return [j for j in self.queue.list(None, 500) if j.section == section]

    def pending_approvals(self) -> list[Job]:
        return self.queue.list(JobStatus.BLOCKED_APPROVAL)

    def needs_attention(self) -> list[Job]:
        return self.queue.list(JobStatus.NEEDS_ATTENTION)

    def get(self, job_id: int) -> Optional[Job]:
        return self.queue.get(job_id)

    # writes
    def enqueue(self, source: str, section: Section,
                rights: RightsTag = RightsTag.THIRD_PARTY, channel: Optional[str] = None) -> Job:
        return self.queue.enqueue(source, section, rights, channel)

    def approve(self, job_id: int) -> Job:
        return self.queue.approve(job_id)

    def reject(self, job_id: int, reason: str = "rejected in review") -> Job:
        return self.queue.reject(job_id, reason)

    def requeue(self, job_id: int) -> Job:
        return self.queue.requeue(job_id)

    # settings (shared with the MCP set_settings tool via config.merge_settings)
    def get_settings(self) -> dict[str, Any]:
        from .. import config as cfg
        return cfg.Settings.load(cfg.settings_path()).to_dict()

    def save_settings(self, updates: dict[str, Any]) -> dict[str, Any]:
        """Persist a partial settings update and apply it to this queue live."""
        from .. import config as cfg
        merged = cfg.merge_settings(self.get_settings(), updates)
        s = cfg.Settings.from_dict(merged)
        s.save(cfg.settings_path())
        self.queue.settings = s
        return s.to_dict()

    # DFY templates (profiles)
    def list_profiles(self) -> list[Any]:
        from ..profiles import load_profiles
        return list(load_profiles().values())

    def save_profile(self, **kw: Any) -> Any:
        from ..profiles import Profile, save_profile
        return save_profile(Profile(**kw))

    def delete_profile(self, name: str) -> bool:
        from ..profiles import delete_profile
        return delete_profile(name)

    # unattended-service control (the 24/7 Windows Task Scheduler integration)
    def automation_status(self) -> dict[str, Any]:
        from ..service import task_installed
        return {"auto_approve": bool(self.get_settings().get("auto_approve")),
                "task_installed": task_installed()}

    def install_service_task(self, every_minutes: int = 5) -> dict[str, Any]:
        from ..service import install_task
        r = install_task(every_minutes=every_minutes)
        return {"ok": r.returncode == 0, "output": (r.stdout or "") + (r.stderr or "")}

    def remove_service_task(self) -> dict[str, Any]:
        from ..service import uninstall_task
        r = uninstall_task()
        return {"ok": r.returncode == 0, "output": (r.stdout or "") + (r.stderr or "")}

    # payload helpers for the review screen
    def clips_for(self, job: Job) -> list[str]:
        # Prefer the finalized compose output, then captioned clips, then bare cuts.
        return ((job.payload.get("compose") or {}).get("clips")
                or (job.payload.get("caption") or {}).get("clips")
                or (job.payload.get("clip") or {}).get("clips") or [])

    def thumbnail_for(self, job: Job, generate: bool = True) -> Optional[str]:
        """Mid-clip preview frame for the review screen, or None. With
        `generate=False` returns only an already-cached frame (no ffmpeg) — used by
        the GUI's fast path so the (blocking) extraction can run off the UI thread."""
        from pathlib import Path

        from ..media.ffmpeg import ffmpeg_available
        from ..media.signals import extract_keyframe, probe
        clips = self.clips_for(job)
        if not clips or not Path(clips[0]).exists():
            return None
        clip = clips[0]
        out = str(Path(clip).with_name(Path(clip).stem + "_thumb.jpg"))
        if Path(out).exists():
            return out
        if not generate or not ffmpeg_available():
            return None
        dur = probe(clip).duration_s or 2.0
        return extract_keyframe(clip, max(0.1, dur / 2.0), out, width=360)

    def metadata_for(self, job: Job) -> dict[str, Any]:
        return (job.payload.get("publish") or {}).get("metadata") or {}

    def understanding_for(self, job: Job) -> dict[str, Any]:
        return (job.payload.get("understand") or {}).get("understanding") or {}

    def highlights_for(self, job: Job) -> list[dict[str, Any]]:
        u = self.understanding_for(job)
        return u.get("highlight_candidates") or []
