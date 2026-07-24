"""Publishing stage: social-metadata generation + cross-platform upload.

Ported (not vendored) from MIT-licensed repos in the harvest (docs/08):
- metadata.py  ← MoneyPrinterTurbo `app/services/llm.py` (generate_social_metadata,
  SOCIAL_PLATFORMS spec, hashtag normalization, JSON recovery) + ShortGPT
  `gpt_yt.py` patterns. MIT — re-authored, with the LLM call routed through
  ClipPilot's own Claude brain instead of MoneyPrinter's 40-provider zoo.
- upload_post.py ← MoneyPrinterTurbo `app/services/upload_post.py` (UploadPostService).
  MIT — the requests-only multi-platform publisher, re-authored on httpx, with
  AI-synthetic-media disclosure forced on.
"""
from .metadata import (
    SOCIAL_PLATFORMS,
    fallback_metadata,
    from_understanding,
    generate_social_metadata,
    normalize_hashtags,
    parse_metadata,
)
from .instagram import InstagramPublisher
from .instagram import publisher_from_env as instagram_from_env
from .upload_post import UploadPostPublisher, publisher_from_env
from .youtube import YouTubePublisher
from .youtube import publisher_from_env as youtube_from_env

__all__ = [
    "SOCIAL_PLATFORMS", "generate_social_metadata", "from_understanding",
    "normalize_hashtags", "parse_metadata", "fallback_metadata",
    "UploadPostPublisher", "publisher_from_env",
    "YouTubePublisher", "youtube_from_env",
    "InstagramPublisher", "instagram_from_env",
]
