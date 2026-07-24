"""Section B/C content generation — make an original short from just a topic.

The honest "press start" path (VISION §3 B): topic → Claude writes an ORIGINAL
script (transformative-nudge guardrail) → SAPI TTS narration (media/tts.py) →
ffmpeg-assembled vertical video → the existing transcribe/caption/publish
pipeline takes it from there. No source video to clip; monetized via the funnel
(affiliate/brand), never raw ad-share.

CPU-only, permissive deps. Porting Pixelle's StandardPipeline *recipe* (Apache,
docs/08) — orchestration, not GPU generation.
"""
from .assemble import assemble_short
from .pipeline import generate_short
from .script import build_script_prompt, generate_script

__all__ = ["generate_script", "build_script_prompt", "assemble_short", "generate_short"]
