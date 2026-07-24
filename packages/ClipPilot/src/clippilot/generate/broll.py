"""B-roll sourcing — turn a script into RELEVANT visuals so Section B isn't a flat
gradient. Two providers, best→fallback:

  • Pexels stock VIDEO (portrait 9:16) — if PEXELS_API_KEY is set (free key). Best.
  • Bing image search — FREE, no key (the ShortGPT technique). Good default.

Keyword extraction prefers the Claude brain (a generate_fn) and falls back to a
stopword heuristic, so it works with no key at all. Everything is best-effort and
returns [] on any failure, so generation degrades to the gradient background.

Re-authored from MoneyPrinterTurbo `material.py` (MIT) + ShortGPT `image_api.py` /
`pexels_api.py` (MIT) — on httpx, no extra deps.
"""
from __future__ import annotations

import html
import json
import os
import re
from pathlib import Path
from typing import Any, Callable, Optional
from urllib.parse import quote

_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
_HEADERS = {"User-Agent": _UA}

_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
    "is", "are", "was", "were", "be", "been", "it", "its", "this", "that", "these",
    "those", "you", "your", "we", "our", "they", "them", "i", "me", "my", "he",
    "she", "his", "her", "as", "at", "by", "from", "so", "if", "then", "than",
    "about", "into", "out", "up", "down", "more", "most", "some", "any", "all",
    "here", "there", "what", "when", "how", "why", "who", "will", "can", "just",
    "get", "got", "see", "know", "think", "really", "actually", "thing", "things",
    "people", "stick", "around", "follow", "subscribe", "watch", "look",
    # generic filler that yields off-topic stock results — fall back to the subject
    "probably", "didn", "didnt", "doesn", "doesnt", "realise", "realize", "number",
    "first", "second", "third", "fourth", "fifth", "next", "last", "much", "many",
    "very", "also", "never", "always", "every", "everyone", "everything", "something",
    "anyone", "today", "because", "before", "after", "while", "still", "even", "ever",
    "make", "made", "want", "need", "going", "gonna", "let", "lets", "didn't",
}

_KEYWORD_PROMPT = (
    "You generate stock-footage search terms for a short vertical video.\n"
    "TITLE: {title}\nSCRIPT: {script}\n\n"
    "Return ONLY a minified JSON array of {amount} search terms (each 1-3 words, "
    "concrete, visual and cinematic — things a camera can film, in English), "
    "e.g. [\"ocean waves\",\"city skyline night\"]."
)


# ── keyword extraction ───────────────────────────────────────────────────────
def _strip_fence(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z]*\n?", "", t)
        t = re.sub(r"\n?```$", "", t).strip()
    return t


def _heuristic_keywords(title: str, script: str, amount: int) -> list[str]:
    words = re.findall(r"[A-Za-z][A-Za-z'-]{2,}", f"{title} {script}".lower())
    counts: dict[str, int] = {}
    for w in words:
        if w in _STOPWORDS:
            continue
        counts[w] = counts.get(w, 0) + 1
    ranked = sorted(counts, key=lambda w: (-counts[w], w))
    terms: list[str] = []
    t = (title or "").strip()
    if t:
        terms.append(t[:40])               # the title is the most on-topic phrase
    for w in ranked:
        if w not in " ".join(terms).lower():
            terms.append(w)
        if len(terms) >= amount:
            break
    return terms[:amount] or ["abstract background"]


def keywords_from_script(title: str, script: str,
                         generate_fn: Optional[Callable[[str], str]] = None,
                         amount: int = 4) -> list[str]:
    """3-4 concrete visual search terms for the script (Claude if available, else
    a stopword heuristic)."""
    if generate_fn is not None:
        try:
            raw = generate_fn(_KEYWORD_PROMPT.format(title=title, script=script[:1500], amount=amount))
            arr = json.loads(_strip_fence(raw))
            terms = [str(x).strip() for x in arr if str(x).strip()][:amount]
            if terms:
                return terms
        except Exception:  # noqa: BLE001 — fall back to the heuristic
            pass
    return _heuristic_keywords(title, script, amount)


# ── sourcing ─────────────────────────────────────────────────────────────────
def _parse_murl(page_text: str, limit: int) -> list[str]:
    """Extract image URLs from Bing image-search HTML (the `murl` JSON field).
    Pure — split out so it's testable without the network."""
    text = html.unescape(page_text or "")
    out: list[str] = []
    for m in re.findall(r'"murl":"(.*?)"', text):
        u = m.replace("\\/", "/")
        if u.startswith("http") and u not in out:
            out.append(u)
        if len(out) >= limit:
            break
    return out


def bing_image_urls(query: str, limit: int = 4) -> list[str]:
    """Free image URLs from Bing image search (no API key)."""
    try:
        import httpx
        r = httpx.get(f"https://www.bing.com/images/search?q={quote(query)}&first=1",
                      headers=_HEADERS, timeout=20, follow_redirects=True)
    except Exception:  # noqa: BLE001
        return []
    return _parse_murl(r.text or "", limit)


def _parse_openverse(data: dict[str, Any], limit: int) -> list[str]:
    """Image URLs from an Openverse /v1/images response. Pure."""
    out: list[str] = []
    for x in (data or {}).get("results", []):
        u = x.get("url")
        if u and u not in out:
            out.append(u)
        if len(out) >= limit:
            break
    return out


def openverse_image_urls(query: str, limit: int = 4) -> list[str]:
    """Relevant, CC-licensed image URLs from the Openverse API — FREE, no key, and
    far more RELIABLE + on-topic than scraping Bing (which bot-detects and serves
    rotating/garbage results). CC licensing also fits the rights guardrail."""
    try:
        import httpx
        r = httpx.get(f"https://api.openverse.org/v1/images/?q={quote(query)}"
                      f"&page_size={max(limit, 12)}", headers=_HEADERS, timeout=20,
                      follow_redirects=True)
        return _parse_openverse(r.json(), limit)
    except Exception:  # noqa: BLE001
        return []


def _parse_pexels_photos(data: dict[str, Any], limit: int) -> list[str]:
    """High-res portrait-ish photo URLs from a Pexels /v1/search response. Pure."""
    out: list[str] = []
    for p in (data or {}).get("photos", []):
        src = p.get("src") or {}
        url = src.get("portrait") or src.get("large2x") or src.get("large") or src.get("original")
        if url and url not in out:
            out.append(url)
        if len(out) >= limit:
            break
    return out


def pexels_photo_urls(query: str, api_key: str, limit: int = 4) -> list[str]:
    """Curated, high-resolution photo URLs from the Pexels Photo API (needs a key)."""
    try:
        import httpx
        r = httpx.get(f"https://api.pexels.com/v1/search?query={quote(query)}&per_page=15&orientation=portrait",
                      headers={"Authorization": api_key, **_HEADERS}, timeout=20)
        return _parse_pexels_photos(r.json(), limit)
    except Exception:  # noqa: BLE001
        return []


def image_urls(query: str, limit: int = 4) -> list[str]:
    """Best available image source, in reliability order: curated Pexels photos
    (PEXELS_API_KEY) → Openverse CC images (free, reliable, on-topic) → Bing scrape
    (last resort — unreliable, so only when the others return nothing)."""
    key = os.environ.get("PEXELS_API_KEY")
    if key:
        urls = pexels_photo_urls(query, key, limit)
        if urls:
            return urls
    urls = openverse_image_urls(query, limit)
    if urls:
        return urls
    return bing_image_urls(query, limit)


def _parse_pexels_videos(data: dict[str, Any], limit: int, min_duration: int = 3) -> list[str]:
    """Portrait-preferred stock-video URLs from a Pexels /videos/search response. Pure."""
    out: list[str] = []
    for v in (data or {}).get("videos", []):
        if v.get("duration", 0) < min_duration:
            continue
        link = None
        for f in sorted(v.get("video_files", []), key=lambda f: -(f.get("height") or 0)):
            h, w = f.get("height") or 0, f.get("width") or 0
            if f.get("link"):
                if h >= w:                      # portrait/tall — best for 9:16
                    link = f["link"]
                    break
                link = link or f["link"]        # landscape fallback (we reframe anyway)
        if link and link not in out:
            out.append(link)
        if len(out) >= limit:
            break
    return out


def pexels_video_urls(query: str, api_key: str, limit: int = 4, min_duration: int = 3) -> list[str]:
    """Portrait stock-video URLs from the Pexels Video API (needs a key)."""
    try:
        import httpx
        r = httpx.get(f"https://api.pexels.com/videos/search?query={quote(query)}&per_page=15&orientation=portrait",
                      headers={"Authorization": api_key, **_HEADERS}, timeout=20)
        return _parse_pexels_videos(r.json(), limit, min_duration)
    except Exception:  # noqa: BLE001
        return []


def pexels_portrait_video(query: str, api_key: str, min_duration: int = 3) -> Optional[str]:
    """A single direct portrait stock-video URL from Pexels, or None."""
    urls = pexels_video_urls(query, api_key, limit=1, min_duration=min_duration)
    return urls[0] if urls else None


def _parse_pixabay_videos(data: dict[str, Any], limit: int) -> list[str]:
    """Downloadable stock-video URLs from a Pixabay /api/videos response. Pure."""
    out: list[str] = []
    for hit in (data or {}).get("hits", []):
        vids = hit.get("videos") or {}
        for size in ("large", "medium", "small", "tiny"):
            f = vids.get(size) or {}
            if f.get("url"):
                out.append(f["url"])
                break
        if len(out) >= limit:
            break
    return out


def pixabay_video_urls(query: str, api_key: str, limit: int = 4) -> list[str]:
    """FREE stock-video URLs from the Pixabay Video API (needs a free key)."""
    try:
        import httpx
        r = httpx.get(f"https://pixabay.com/api/videos/?key={api_key}&q={quote(query)}&per_page=12",
                      headers=_HEADERS, timeout=20)
        return _parse_pixabay_videos(r.json(), limit)
    except Exception:  # noqa: BLE001
        return []


def motion_clip_urls(query: str, limit: int = 1) -> list[str]:
    """Real MOTION-clip URLs from free archives: Pexels video (PEXELS_API_KEY) →
    Pixabay video (PIXABAY_API_KEY) → []. Motion needs a (free) key; stills work
    keyless via Bing. Used to build a real-footage montage instead of Ken-Burns stills."""
    key = os.environ.get("PEXELS_API_KEY")
    if key:
        urls = pexels_video_urls(query, key, limit)
        if urls:
            return urls
    pk = os.environ.get("PIXABAY_API_KEY")
    if pk:
        urls = pixabay_video_urls(query, pk, limit)
        if urls:
            return urls
    return []


def fetch_gen_broll(keywords: list[str], out_dir: str, mood: Optional[str] = None,
                    max_items: int = 6) -> dict[str, Any]:
    """Hosted-API generated stills (backlog #7): one cinematic image per keyword via
    the cinematic prompt-builder. Active only when GEN_IMAGE_API_KEY is set, else
    {kind: 'none'}. Returns {kind: 'gen_images', paths}."""
    from .cinematic import build_visual_prompt
    from .gen_image import gen_available, generate_images
    if not gen_available():
        return {"kind": "none", "paths": []}
    prompts = [build_visual_prompt(kw, mood) for kw in keywords if kw]
    paths = generate_images(prompts, out_dir, max_items=max_items)
    return {"kind": "gen_images", "paths": paths} if paths else {"kind": "none", "paths": []}


def fetch_motion_broll(keywords: list[str], out_dir: str, max_items: int = 5) -> dict[str, Any]:
    """Download one real motion clip per keyword from free archives → local mp4 paths.
    Returns {kind: 'motion_clips', paths} or {kind: 'none', paths: []}."""
    Path(out_dir).mkdir(parents=True, exist_ok=True)
    paths: list[str] = []
    for i, kw in enumerate(keywords):
        if len(paths) >= max_items:
            break
        for u in motion_clip_urls(kw, 1):
            p = str(Path(out_dir) / f"motion_{i:02d}.mp4")
            if download(u, p, min_bytes=20000):
                paths.append(p)
                break
    return {"kind": "motion_clips", "paths": paths} if paths else {"kind": "none", "paths": []}


def download(url: str, path: str, min_bytes: int = 2048) -> bool:
    try:
        import httpx
        r = httpx.get(url, headers=_HEADERS, timeout=40, follow_redirects=True)
        if r.status_code == 200 and r.content and len(r.content) >= min_bytes:
            Path(path).parent.mkdir(parents=True, exist_ok=True)
            Path(path).write_bytes(r.content)
            return True
    except Exception:  # noqa: BLE001
        pass
    return False


def fetch_broll_images(keywords: list[str], out_dir: str, per_keyword: int = 2,
                       max_images: int = 6) -> list[str]:
    """Download relevant images for the keywords → local file paths (best-effort)."""
    Path(out_dir).mkdir(parents=True, exist_ok=True)
    paths: list[str] = []
    for kw in keywords:
        for u in image_urls(kw, limit=per_keyword):
            p = str(Path(out_dir) / f"broll_{len(paths):02d}.jpg")
            if download(u, p):
                paths.append(p)
            if len(paths) >= max_images:
                return paths
    return paths


def salient_word(text: str) -> str:
    """The most 'visual' word in a phrase — longest non-stopword (crude but works)."""
    words = re.findall(r"[A-Za-z][A-Za-z'-]{2,}", (text or "").lower())
    for w in sorted(words, key=lambda w: -len(w)):
        if w not in _STOPWORDS:
            return w
    return ""


def phrase_windows(script: str, duration: float) -> list[tuple[float, float, str]]:
    """[(start_s, dur_s, phrase_text)] for the narration, using SAPI proportional
    word timing grouped into TikTok-style pages — no whisper needed at gen time."""
    import math

    from ..media import tts
    from ..media.captions import create_tiktok_style_captions
    toks = tts.word_timings(script, duration)
    if not toks:
        return []
    pages = create_tiktok_style_captions(toks, combine_within_ms=1100)["pages"]
    wins: list[tuple[float, float, str]] = []
    for p in pages:
        start = p["start_ms"] / 1000.0
        dur = p["duration_ms"] / 1000.0
        if not math.isfinite(dur) or dur <= 0:
            dur = max(1.5, duration - start)
        wins.append((round(start, 3), round(dur, 3), p.get("text", "")))
    return wins


def _image_urls_cinematic(query: str, limit: int, cinematic: bool) -> list[str]:
    """Image URLs for a query. Cinematic boosting makes queries MULTI-WORD, which the
    free Bing image search returns poor/garbage results for — so we only enrich when a
    PEXELS_API_KEY is set (Pexels handles descriptive queries well). Bing path stays
    bare. Falls back to the bare query so we never return FEWER results."""
    if cinematic and os.environ.get("PEXELS_API_KEY"):
        from .cinematic import enrich_term
        urls = image_urls(enrich_term(query), limit=limit)
        if urls:
            return urls
    return image_urls(query, limit=limit)


def fetch_timed_broll(script: str, title: str, duration: float, out_dir: str,
                      generate_fn: Optional[Callable[[str], str]] = None,
                      max_fetch: int = 12, cinematic: bool = True) -> dict[str, Any]:
    """Per-phrase b-roll: a topic-relevant image for each spoken caption window, so
    the visual changes with the narration (ShortGPT-style). `cinematic` lightly
    boosts each stock-search query for more polished results. Returns
    {kind: 'timed_images', segments: [(image, seconds)]} or {kind: 'none'}."""
    wins = phrase_windows(script, duration)
    if not wins:
        return {"kind": "none", "segments": []}
    Path(out_dir).mkdir(parents=True, exist_ok=True)
    topic = (title or "").strip() or (keywords_from_script(title, script, generate_fn, 1) or ["background"])[0]

    # Pre-fetch a POOL of on-SUBJECT images. Caption pages are short fragments ("didn't
    # know about"), so most pages have no strong visual word — those rotate through this
    # pool so the short stays ON-TOPIC and VARIED instead of showing off-topic stock for
    # a generic word (the "octopuses → random cartoon" slop). Pages WITH a strong noun
    # still fetch a specific image.
    pool: list[str] = []
    for u in _image_urls_cinematic(topic, 8, cinematic):
        p = str(Path(out_dir) / f"pool_{len(pool):02d}.jpg")
        if download(u, p):
            pool.append(p)
    pool_i = 0

    # Per-page specific images need a "{subject} {word}" (multi-word) query, which the
    # free Bing search returns garbage for — so only trust page-specifics when Pexels
    # (which handles descriptive queries) is configured; otherwise rotate the pool.
    has_pexels = bool(os.environ.get("PEXELS_API_KEY"))
    cache: dict[str, Optional[str]] = {}
    segments: list[tuple[str, float]] = []
    fetched = len(pool)
    for (_start, dur, text) in wins:
        kw = salient_word(text)
        strong = has_pexels and bool(kw) and kw not in topic.lower() and len(kw) >= 4
        img: Optional[str] = None
        if strong:
            query = f"{topic} {kw}".strip()
            if query in cache:
                img = cache[query]
            elif fetched < max_fetch:
                for u in _image_urls_cinematic(query, 1, cinematic):
                    p = str(Path(out_dir) / f"timg_{len(cache):02d}.jpg")
                    if download(u, p):
                        img = p
                        break
                cache[query] = img
                fetched += 1
        if img is None and pool:               # generic page or specific fetch failed
            img = pool[pool_i % len(pool)]
            pool_i += 1
        if img:
            segments.append((img, max(1.2, dur)))
    if len(segments) >= max(2, len(wins) // 2):
        return {"kind": "timed_images", "segments": segments}
    return {"kind": "none", "segments": []}


def fetch_broll(keywords: list[str], out_dir: str, max_items: int = 6) -> dict[str, Any]:
    """Source b-roll for the keywords. Prefers a Pexels portrait video (if a key is
    set), else free Bing images. Returns {kind: 'video'|'images'|'none', paths}."""
    key = os.environ.get("PEXELS_API_KEY")
    Path(out_dir).mkdir(parents=True, exist_ok=True)
    if key:
        for kw in keywords:
            url = pexels_portrait_video(kw, key)
            if url:
                vp = str(Path(out_dir) / "broll_video.mp4")
                if download(url, vp, min_bytes=10000):
                    return {"kind": "video", "paths": [vp], "keywords": keywords}
    imgs = fetch_broll_images(keywords, out_dir, max_images=max_items)
    if imgs:
        return {"kind": "images", "paths": imgs, "keywords": keywords}
    return {"kind": "none", "paths": [], "keywords": keywords}
