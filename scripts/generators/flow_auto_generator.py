# -*- coding: utf-8 -*-
"""
flow_auto_generator.py — Google Flow (labs.google/flow) Playwright Automation
=============================================================================
Reads a manifest_explainer_<id>.json, iterates through every entry in
image_timeline, and auto-generates + downloads each image using Google Flow
(Nano Banana Pro model, 9:16 ratio, 0 credits).

Usage
-----
# Dry-run: print prompts, don't open browser
python scripts/generators/flow_auto_generator.py --slug dogsniff --dry-run

# Run for all images (skips already-existing files)
python scripts/generators/flow_auto_generator.py --slug dogsniff

# Specify full manifest path
python scripts/generators/flow_auto_generator.py \
    --manifest packages/ClipPilot/data/manifest_explainer_dogsniff.json

# Resume from image index 5
python scripts/generators/flow_auto_generator.py --slug dogsniff --start 5

# Generate only N images (useful for testing)
python scripts/generators/flow_auto_generator.py --slug dogsniff --count 2

# Use custom browser profile dir (for persistent Google login)
python scripts/generators/flow_auto_generator.py --slug dogsniff \
    --profile ~/.config/shorts-flow-profile

Requirements
------------
pip install playwright
playwright install chromium
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import shutil
import sys
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# Project paths
# ---------------------------------------------------------------------------
HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parents[1]
CLIPPILOT_DATA = PROJECT_ROOT / "packages" / "ClipPilot" / "data"
LOGS_DIR = PROJECT_ROOT / "packages" / "ClipPilot" / "data" / "logs"

FLOW_URL = "https://labs.google/flow"
DEFAULT_PROFILE = Path.home() / ".config" / "shorts-flow-profile"

# Timeouts (seconds)
GENERATION_TIMEOUT = 150
DOWNLOAD_TIMEOUT   = 60
POLL_INTERVAL      = 0.75
MAX_RETRIES        = 3


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def resolve_manifest(slug: str | None, manifest_path: str | None) -> Path:
    if manifest_path:
        p = Path(manifest_path)
        if not p.exists():
            sys.exit(f"[flow] manifest not found: {p}")
        return p
    if slug:
        p = CLIPPILOT_DATA / f"manifest_explainer_{slug}.json"
        if not p.exists():
            sys.exit(f"[flow] manifest not found for slug '{slug}': {p}")
        return p
    sys.exit("[flow] provide --slug or --manifest")


def load_timeline(manifest: Path) -> list[dict]:
    data = json.loads(manifest.read_text(encoding="utf-8"))
    timeline = data.get("assets", {}).get("image_timeline", [])
    if not timeline:
        sys.exit(f"[flow] no image_timeline found in {manifest}")
    return timeline


def _log(msg: str) -> None:
    ts = time.strftime("%H:%M:%S")
    print(f"[flow {ts}] {msg}", flush=True)


# ---------------------------------------------------------------------------
# Core async generator
# ---------------------------------------------------------------------------

async def run_generation(
    timeline: list[dict],
    *,
    start_index: int = 0,
    count: int | None = None,
    profile_dir: Path = DEFAULT_PROFILE,
    headless: bool = False,
    dry_run: bool = False,
    slug: str = "video",
) -> None:
    """Open a persistent Chrome context, iterate timeline items, generate images."""

    items = [item for item in timeline if item["clip_index"] >= start_index]
    if count is not None:
        items = items[:count]

    if dry_run:
        _log(f"DRY RUN — would generate {len(items)} image(s):")
        for item in items:
            path = item.get("image_path", "<no path>")
            prompt_preview = item.get("prompt", "")[:100]
            status = "EXISTS" if Path(path).exists() else "MISSING"
            _log(f"  [{item['clip_index']:02d}] [{status}] {path}")
            _log(f"         prompt: {prompt_preview}...")
        return

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        sys.exit(
            "[flow] playwright is not installed.\n"
            "Run: pip install playwright && playwright install chromium"
        )

    log_dir = LOGS_DIR / slug
    log_dir.mkdir(parents=True, exist_ok=True)
    profile_dir.mkdir(parents=True, exist_ok=True)
    _log(f"Using browser profile: {profile_dir}")

    async with async_playwright() as pw:
        context = await pw.chromium.launch_persistent_context(
            str(profile_dir),
            headless=headless,
            accept_downloads=True,
            viewport={"width": 1440, "height": 900},
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
            ],
        )

        page = context.pages[0] if context.pages else await context.new_page()

        _log(f"Navigating to {FLOW_URL} ...")
        await page.goto(FLOW_URL, wait_until="domcontentloaded", timeout=30_000)
        await page.wait_for_timeout(2000)

        if "accounts.google.com" in page.url or "signin" in page.url.lower():
            _log(
                "\n⚠️  Google login required!\n"
                "   Please sign in manually in the browser window, then press ENTER here."
            )
            input("   >> Press ENTER after you are logged in to Google Flow: ")
            await page.wait_for_timeout(2000)

        if "labs.google/flow" not in page.url:
            await page.goto(FLOW_URL, wait_until="domcontentloaded", timeout=30_000)
            await page.wait_for_timeout(2000)

        # Configure settings once
        await _ensure_settings(page)

        processed = 0
        errors = 0

        for item in items:
            clip_idx = item["clip_index"]
            prompt: str = item.get("prompt", "")
            target_path = Path(item.get("image_path", ""))

            _log(f"\n━━━ [{clip_idx:02d}/{len(timeline)-1}] {target_path.name}")

            if target_path.exists() and target_path.stat().st_size > 1000:
                _log(f"  ✓ Already exists — skipping.")
                processed += 1
                continue

            if not prompt.strip():
                _log(f"  ⚠ Empty prompt — skipping clip {clip_idx}.")
                continue

            target_path.parent.mkdir(parents=True, exist_ok=True)

            success = False
            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    _log(f"  Attempt {attempt}/{MAX_RETRIES}: generating...")
                    downloaded_file = await _generate_one_image(page, prompt, log_dir, clip_idx)
                    if downloaded_file:
                        shutil.move(str(downloaded_file), str(target_path))
                        _log(f"  ✅ Saved → {target_path}")
                        success = True
                        break
                except Exception as exc:
                    _log(f"  ⚠ Attempt {attempt} failed: {exc}")
                    screenshot_path = log_dir / f"error_{clip_idx:02d}_attempt{attempt}.png"
                    try:
                        await page.screenshot(path=str(screenshot_path))
                        _log(f"  📸 Error screenshot → {screenshot_path}")
                    except Exception:
                        pass
                    if attempt < MAX_RETRIES:
                        _log(f"  Retrying in 5s...")
                        await page.wait_for_timeout(5000)
                    try:
                        done_btn = page.locator("text=Done").first
                        if await done_btn.is_visible(timeout=2000):
                            await done_btn.click()
                            await page.wait_for_timeout(1500)
                    except Exception:
                        pass

            if success:
                processed += 1
            else:
                _log(f"  ❌ Failed after {MAX_RETRIES} attempts — skipping clip {clip_idx}.")
                errors += 1

            await page.wait_for_timeout(1500)

        await context.close()

        _log(f"\n{'='*60}")
        _log(f"Done. Processed: {processed}  Errors: {errors}  Skipped: {len(items) - processed - errors}")


async def _ensure_settings(page) -> None:
    """Click the settings chip and set Image + 9:16 + Nano Banana Pro + x1."""
    _log("  Configuring generation settings...")
    try:
        # The bottom-bar settings chip showing model/ratio/count
        chip = page.locator("button:has-text('Nano Banana Pro'), div:has-text('Nano Banana Pro')").last
        if await chip.is_visible(timeout=5000):
            await chip.click()
            await page.wait_for_timeout(800)
    except Exception:
        _log("  ⚠ Could not open settings popup.")
        return

    # Image tab
    try:
        img_tab = page.locator("text=Image").first
        if await img_tab.is_visible(timeout=3000):
            await img_tab.click()
            await page.wait_for_timeout(400)
    except Exception:
        pass

    # 9:16 ratio
    try:
        ratio_btn = page.locator("text=9:16").first
        if await ratio_btn.is_visible(timeout=3000):
            await ratio_btn.click()
            await page.wait_for_timeout(400)
            _log("  ✓ Ratio → 9:16")
    except Exception:
        _log("  ⚠ 9:16 button not found.")

    # x1 count
    try:
        x1_btn = page.locator("text=x1").first
        if await x1_btn.is_visible(timeout=2000):
            await x1_btn.click()
            await page.wait_for_timeout(400)
    except Exception:
        pass

    await page.keyboard.press("Escape")
    await page.wait_for_timeout(600)
    _log("  ✓ Settings confirmed.")


async def _count_workspace_thumbnails(page) -> int:
    """Count image thumbnails in the workspace grid."""
    try:
        imgs = page.locator("main img, [role='main'] img")
        return await imgs.count()
    except Exception:
        return 0


async def _wait_for_new_thumbnail(page, pre_count: int):
    """Poll until a new thumbnail appears; return the last (newest) one."""
    deadline = time.time() + GENERATION_TIMEOUT
    while time.time() < deadline:
        try:
            count = await _count_workspace_thumbnails(page)
            if count > pre_count:
                imgs = page.locator("main img, [role='main'] img")
                return imgs.last
        except Exception:
            pass
        await page.wait_for_timeout(int(POLL_INTERVAL * 1000))

    # Broader fallback selectors
    for sel in ["article img", "section img", "[class*='card'] img", "[class*='media'] img"]:
        try:
            el = page.locator(sel).last
            if await el.is_visible(timeout=2000):
                return el
        except Exception:
            continue

    return None


async def _generate_one_image(page, prompt: str, log_dir: Path, clip_idx: int) -> Path | None:
    """Type prompt, submit, wait for generation, click download, return file path."""

    # 1. Fill prompt
    prompt_box = page.locator('[placeholder="What do you want to create?"]').first
    await prompt_box.wait_for(state="visible", timeout=15_000)
    await prompt_box.click()
    await prompt_box.fill("")
    await prompt_box.type(prompt, delay=8)
    await page.wait_for_timeout(300)

    # 2. Count existing thumbnails
    pre_count = await _count_workspace_thumbnails(page)
    _log(f"    Pre-count: {pre_count} thumbnails")

    # 3. Submit
    sent = False
    for send_sel in [
        "button[aria-label='Send']",
        "button[aria-label='Generate']",
        "button[aria-label='Submit']",
    ]:
        try:
            btn = page.locator(send_sel).first
            if await btn.is_visible(timeout=1500):
                await btn.click()
                sent = True
                break
        except Exception:
            continue

    if not sent:
        await prompt_box.press("Enter")

    _log(f"    Waiting for generation (up to {GENERATION_TIMEOUT}s)...")

    # 4. Wait for new thumbnail
    new_thumb = await _wait_for_new_thumbnail(page, pre_count)
    if new_thumb is None:
        raise RuntimeError("Generation timed out — no new thumbnail appeared.")
    _log("    ✓ New image in workspace.")

    # 5. Click thumbnail → edit view
    await new_thumb.click()
    await page.wait_for_timeout(1500)

    # 6. Download
    downloaded_path = await _click_download(page, clip_idx, log_dir)

    # 7. Return to workspace
    try:
        done_btn = page.locator("text=Done").first
        if await done_btn.is_visible(timeout=3000):
            await done_btn.click()
            await page.wait_for_timeout(1000)
    except Exception:
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(800)

    return downloaded_path


async def _click_download(page, clip_idx: int, log_dir: Path) -> Path | None:
    """Find and click the download button; return path to downloaded file."""
    debug_shot = log_dir / f"pre_download_{clip_idx:02d}.png"
    try:
        await page.screenshot(path=str(debug_shot))
    except Exception:
        pass

    download_selectors = [
        "button[aria-label='Download']",
        "button[aria-label='Save']",
        "a[download]",
        "[aria-label='Download image']",
        "[aria-label='download']",
        "[title='Download']",
    ]

    async with page.expect_download(timeout=DOWNLOAD_TIMEOUT * 1000) as dl_info:
        clicked = False
        for sel in download_selectors:
            try:
                btn = page.locator(sel).first
                if await btn.is_visible(timeout=2000):
                    await btn.click()
                    clicked = True
                    _log(f"    Clicked download: {sel}")
                    break
            except Exception:
                continue

        if not clicked:
            # Fallback: click by approximate position (download icon is at ~x=1244, y=27)
            _log("    Falling back to position-click for download button...")
            await page.mouse.click(1244, 27)
            clicked = True

    download = await dl_info.value
    tmp_dir = log_dir / "_tmp_downloads"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    suggested = download.suggested_filename or f"flow_img_{clip_idx:02d}.jpg"
    tmp_path = tmp_dir / suggested
    await download.save_as(str(tmp_path))
    _log(f"    Downloaded: {tmp_path} ({tmp_path.stat().st_size:,} bytes)")
    return tmp_path


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(
        description="Auto-generate images via Google Flow (labs.google/flow)"
    )
    group = ap.add_mutually_exclusive_group(required=True)
    group.add_argument("--slug", help="Explainer slug, e.g. 'dogsniff'")
    group.add_argument("--manifest", help="Full path to manifest JSON file")

    ap.add_argument("--start", type=int, default=0,
                    help="Resume from this clip_index (default: 0)")
    ap.add_argument("--count", type=int, default=None,
                    help="Only generate this many images (for testing)")
    ap.add_argument("--profile", type=Path, default=DEFAULT_PROFILE,
                    help=f"Browser profile directory (default: {DEFAULT_PROFILE})")
    ap.add_argument("--headless", action="store_true",
                    help="Run browser headless (default: headed)")
    ap.add_argument("--dry-run", action="store_true",
                    help="Print prompts without opening browser")

    args = ap.parse_args()
    manifest_path = resolve_manifest(args.slug, args.manifest)
    slug = args.slug or manifest_path.stem.replace("manifest_explainer_", "")
    timeline = load_timeline(manifest_path)

    _log(f"Manifest : {manifest_path}")
    _log(f"Slug     : {slug}")
    _log(f"Images   : {len(timeline)} total (start={args.start})")
    if args.count:
        _log(f"Count    : {args.count} (limited)")

    asyncio.run(run_generation(
        timeline,
        start_index=args.start,
        count=args.count,
        profile_dir=args.profile,
        headless=args.headless,
        dry_run=args.dry_run,
        slug=slug,
    ))


if __name__ == "__main__":
    main()
