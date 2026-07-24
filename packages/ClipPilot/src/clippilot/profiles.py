"""DFY templates — named presets an operator applies per client/brand.

A profile bundles the per-job choices that should stay consistent across a
client's batch: section, rights, publish channel, and (for generated Section B/C)
voice, music bed, and target length. Stored as JSON in the data dir; applied at
enqueue time so every job for that client inherits the same settings.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from typing import Any, Optional

from . import config as cfg


@dataclass
class Profile:
    name: str
    section: str = "A"                 # A=clip / B=funnel / C=ad-share
    rights: str = "owned"
    channel: Optional[str] = None
    voice: Optional[str] = None        # edge-tts narration voice (Chatterbox uses its own/synthetic voice)
    bgm_path: Optional[str] = None     # cleared music bed
    target_seconds: int = 35
    mode: str = "standard"             # "standard" | "facts" (ShortGPT facts engine)
    facts_count: int = 5               # number of facts when mode="facts"
    caption_skin: Optional[str] = None  # caption look (edit.CAPTION_SKINS); None → use Settings

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Profile":
        return cls(
            name=str(d.get("name", "")),
            section=str(d.get("section", "A")),
            rights=str(d.get("rights", "owned")),
            channel=d.get("channel") or None,
            voice=d.get("voice") or None,
            bgm_path=d.get("bgm_path") or None,
            target_seconds=int(d.get("target_seconds", 35)),
            mode=str(d.get("mode", "standard")),
            facts_count=int(d.get("facts_count", 5)),
            caption_skin=d.get("caption_skin") or None,
        )


def profiles_path():
    return cfg.data_dir() / "profiles.json"


def load_profiles() -> dict[str, Profile]:
    p = profiles_path()
    if not p.exists():
        return {}
    try:
        raw = json.loads(p.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, ValueError, OSError):
        return {}
    return {name: Profile.from_dict({**d, "name": name}) for name, d in (raw or {}).items()}


def _write(profiles: dict[str, Profile]) -> None:
    p = profiles_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps({n: pr.to_dict() for n, pr in profiles.items()}, indent=2),
                 encoding="utf-8")


def save_profile(profile: Profile) -> Profile:
    if not profile.name.strip():
        raise ValueError("profile name is required")
    profiles = load_profiles()
    profiles[profile.name] = profile
    _write(profiles)
    return profile


def get_profile(name: str) -> Optional[Profile]:
    return load_profiles().get(name)


def delete_profile(name: str) -> bool:
    profiles = load_profiles()
    if name in profiles:
        del profiles[name]
        _write(profiles)
        return True
    return False


def enqueue_with_profile(queue: Any, source_ref: str, profile: Profile,
                         idempotency_key: Optional[str] = None) -> Any:
    """Enqueue a job using a profile's section/rights/channel + generation overrides
    (carried in the job payload so _ingest applies them for Section B/C)."""
    payload = {"profile": {
        "name": profile.name,
        "voice": profile.voice,
        "bgm_path": profile.bgm_path,
        "target_seconds": profile.target_seconds,
        "mode": profile.mode,
        "facts_count": profile.facts_count,
        "caption_skin": profile.caption_skin,
    }}
    return queue.enqueue(source_ref, section=profile.section, rights_tag=profile.rights,
                         channel=profile.channel, idempotency_key=idempotency_key, payload=payload)
