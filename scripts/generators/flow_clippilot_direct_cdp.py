# -*- coding: utf-8 -*-
"""
flow_clippilot_direct_cdp.py
============================
Production-grade Chrome DevTools Protocol (CDP) automation engine for Google Flow.
Connects directly to active Chrome instance on port 9222 (or configured CDP port).
All settings are dynamically configurable via environment variables (.env).

Features:
- Dynamically attaches to the active Google Flow tab in Chrome
- Sequential prompt submission with enforced 30-45s cooldown to prevent overlapping/cancellation
- URL set-difference detection for 100% accurate image matching
- Direct binary image extraction using browser authenticated session
- Dual-directory persistence (both broll/ and images/)
- Real-time progress callback support for Web UI status streaming
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import json
import os
import shutil
import sys
import time
from pathlib import Path
from typing import Callable, Optional

# Load .env file automatically
try:
    from dotenv import load_dotenv
    _root = Path(__file__).resolve().parents[2]
    load_dotenv(_root / ".env")
except ImportError:
    pass

# ─────────────────────────────────────────────────────────────────────────────
# Configuration (Loaded from ENV with sensible production defaults)
# ─────────────────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parents[2]
CLIPPILOT_OUT = PROJECT_ROOT / "packages" / "ClipPilot" / "output"

DEFAULT_FLOW_URL = os.getenv(
    "GOOGLE_FLOW_PROJECT_URL",
    "https://labs.google/fx/tools/flow/project/c4ab03f3-339e-450c-b7e8-d8fe4e7c5a22"
)
CDP_URL = os.getenv("GOOGLE_FLOW_CDP_URL", "http://localhost:9222")
GEN_WAIT_SECONDS = int(os.getenv("GOOGLE_FLOW_WAIT_SECONDS", "35"))
COOLDOWN_SECONDS = int(os.getenv("GOOGLE_FLOW_COOLDOWN_SECONDS", "5"))
GEN_TIMEOUT_SECONDS = int(os.getenv("GOOGLE_FLOW_TIMEOUT_SECONDS", "180"))
MAX_RETRIES = int(os.getenv("GOOGLE_FLOW_MAX_RETRIES", "3"))

def log(msg: str):
    print(f"[flow-cdp {time.strftime('%H:%M:%S')}] {msg}", flush=True)

# ─────────────────────────────────────────────────────────────────────────────
# Prompt Loading
# ─────────────────────────────────────────────────────────────────────────────
def load_prompts(project_id: str) -> list[dict]:
    meta_path = CLIPPILOT_OUT / project_id / "studio_meta.json"
    if not meta_path.exists():
        raise FileNotFoundError(f"studio_meta.json not found at {meta_path}")

    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    scenes = meta.get("scenes", [])
    broll_dir = CLIPPILOT_OUT / project_id / "broll"
    images_dir = CLIPPILOT_OUT / project_id / "images"
    broll_dir.mkdir(parents=True, exist_ok=True)
    images_dir.mkdir(parents=True, exist_ok=True)

    items = []
    for s_idx, scene in enumerate(scenes, 1):
        for img in scene.get("images", []):
            raw_prompt: str = img.get("prompt", "")
            clean = raw_prompt.split("Save this image as:")[0].strip().rstrip(".")
            filename: str = img.get("filename", f"short_s{s_idx:03d}_img{img.get('image_index', 0):03d}.png")
            items.append({
                "filename": filename,
                "clean_prompt": clean,
                "broll_path": broll_dir / filename,
                "images_path": images_dir / filename,
                "scene_idx": s_idx,
                "img_idx": img.get("image_index", 0),
                "description": img.get("scene_description", "")
            })
    return items

# ─────────────────────────────────────────────────────────────────────────────
# DOM Inspection & Image Fetching
# ─────────────────────────────────────────────────────────────────────────────
async def get_all_image_srcs(page) -> list[str]:
    """Return all generated image URLs currently on the Flow board."""
    return await page.evaluate("""() => {
        const list = [];
        document.querySelectorAll("img").forEach(img => {
            if (img.src && (img.src.includes("getMediaUrlRedirect") || img.alt === "Generated image")) {
                list.push(img.src);
            }
        });
        return list;
    }""")

async def find_flow_page(context, target_url: str):
    """Find active Google Flow tab or open target_url."""
    for page in context.pages:
        if "labs.google/fx/tools/flow/project/" in page.url:
            return page
    for page in context.pages:
        if "labs.google/fx/tools/flow" in page.url:
            return page
    # Open new page if not open
    log(f"Flow page not found in active tabs. Navigating to {target_url}...")
    page = await context.new_page()
    await page.goto(target_url, wait_until="domcontentloaded")
    await page.wait_for_timeout(3000)
    return page

async def generate_single_image(
    page,
    prompt: str,
    filename: str,
    min_wait_s: int = GEN_WAIT_SECONDS,
    timeout_s: int = GEN_TIMEOUT_SECONDS
) -> bytes:
    """
    Submits a single prompt to Google Flow and waits the required duration
    to ensure full rendering before downloading.
    """
    # 1. Snapshot all existing image URLs before submitting
    pre_srcs = set(await get_all_image_srcs(page))
    log(f"    1. Current images on board: {len(pre_srcs)}")

    # 2. Focus and clear prompt box
    box = page.locator('div[role="textbox"][contenteditable="true"]').first
    await box.wait_for(state="visible", timeout=15000)
    await box.click()
    await page.wait_for_timeout(150)

    # Select all and clear
    await page.keyboard.press("Meta+a")
    await page.keyboard.press("Backspace")
    await page.keyboard.press("Control+a")
    await page.keyboard.press("Backspace")
    await page.wait_for_timeout(150)

    # 3. Insert prompt via simulated human paste (insert_text)
    log(f"    2. Inserting prompt ({len(prompt)} chars)...")
    await page.keyboard.insert_text(prompt)
    await page.wait_for_timeout(400)

    # 4. Click Create / arrow_forward button
    btn = page.locator("button:has-text('arrow_forward'), button:has(i:has-text('arrow_forward'))").first
    if await btn.is_visible():
        await btn.click()
    else:
        # Fallback to pressing Enter
        await page.keyboard.press("Enter")
    
    start_time = time.time()
    log(f"    3. Submitted prompt! Enforcing minimum {min_wait_s}s wait for full rendering...")

    # 5. Poll for NEW image URL that was not in pre_srcs
    deadline = start_time + timeout_s
    new_img_src = None

    while time.time() < deadline:
        # Check for Google Flow account block / unusual activity message
        page_html = (await page.content()).lower()
        if "unusual activity" in page_html and "failed" in page_html:
            raise RuntimeError("Google Flow account is temporarily in cooldown ('We noticed some unusual activity'). Google Flow paused requests for this session.")

        curr_srcs = await get_all_image_srcs(page)
        diff = [s for s in curr_srcs if s not in pre_srcs]
        if diff:
            new_img_src = diff[0]
            log(f"    ✓ New image detected on board: {new_img_src[:65]}...")
            break
        await page.wait_for_timeout(1000)

    if not new_img_src:
        raise TimeoutError(f"Generation timed out for {filename} after {timeout_s}s")

    # Enforce the remaining wait time so Google Flow finishes 100% of internal rendering
    elapsed = time.time() - start_time
    if elapsed < min_wait_s:
        remaining = min_wait_s - elapsed
        log(f"    ⏳ Waiting remaining {remaining:.1f}s for generation cycle to settle...")
        await page.wait_for_timeout(int(remaining * 1000))

    # 6. Fetch the binary bytes using browser session (avoids CORS / cookie issues)
    log(f"    4. Downloading image data...")
    img_data_base64 = await page.evaluate("""async (url) => {
        const res = await fetch(url);
        const blob = await res.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(blob);
        });
    }""", new_img_src)

    img_bytes = base64.b64decode(img_data_base64)
    log(f"    ✓ Downloaded {len(img_bytes):,} bytes.")
    return img_bytes

# ─────────────────────────────────────────────────────────────────────────────
# Main Async Workflow Functions
# ─────────────────────────────────────────────────────────────────────────────
async def generate_flow_images_for_project(
    project_id: str,
    flow_url: Optional[str] = None,
    start_idx: int = 0,
    count: Optional[int] = None,
    progress_callback: Optional[Callable[[dict], None]] = None,
    dry_run: bool = False,
    force: bool = True
) -> dict:
    from playwright.async_api import async_playwright

    target_flow_url = flow_url or DEFAULT_FLOW_URL
    items = load_prompts(project_id)
    to_do = items[start_idx:]
    if count is not None:
        to_do = to_do[:count]

    log(f"Project: {project_id}")
    log(f"Target Flow URL: {target_flow_url}")
    log(f"Config: wait={GEN_WAIT_SECONDS}s, cooldown={COOLDOWN_SECONDS}s, cdp={CDP_URL}, force={force}")
    log(f"Total images: {len(items)}, Queue: {len(to_do)} (start_idx={start_idx})")

    if dry_run:
        for i, it in enumerate(to_do, start_idx):
            log(f"[{i+1}/{len(items)}] {it['filename']} — {it['description']}")
            log(f"     Prompt: {it['clean_prompt'][:90]}...")
        return {"success": True, "dry_run": True, "total": len(to_do)}

    async with async_playwright() as pw:
        log(f"Connecting to Chrome on {CDP_URL}...")
        browser = await pw.chromium.connect_over_cdp(CDP_URL)
        context = browser.contexts[0]

        flow_page = await find_flow_page(context, target_flow_url)
        log(f"Using Google Flow tab: {flow_page.url}")

        await flow_page.bring_to_front()
        await flow_page.wait_for_timeout(1000)

        success_count = 0
        error_count = 0
        completed_filenames = []

        for i, item in enumerate(to_do, start_idx):
            filename = item["filename"]
            prompt = item["clean_prompt"]
            broll_p = item["broll_path"]
            images_p = item["images_path"]

            status_payload = {
                "status": "generating",
                "current_index": i + 1,
                "total_images": len(items),
                "current_filename": filename,
                "current_description": item["description"],
                "percent": int(((i) / len(items)) * 100),
                "message": f"Generating image {i+1}/{len(items)}: {filename}"
            }
            if progress_callback:
                progress_callback(status_payload)

            log(f"\n{'━'*60}")
            log(f"[{i+1}/{len(items)}] Scene {item['scene_idx']} Image {item['img_idx']} → {filename}")
            log(f"📝 {item['description']}")

            # Skip ONLY if not forcing and file exists in BOTH directories
            if not force and broll_p.exists() and images_p.exists() and broll_p.stat().st_size > 10000 and images_p.stat().st_size > 10000:
                log(f"✓ Already exists ({broll_p.stat().st_size:,} bytes) — skipping.")
                success_count += 1
                completed_filenames.append(filename)
                continue

            generated = False
            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    log(f"  Attempt {attempt}/{MAX_RETRIES} generating {filename}...")
                    img_bytes = await generate_single_image(
                        flow_page,
                        prompt,
                        filename,
                        min_wait_s=GEN_WAIT_SECONDS,
                        timeout_s=GEN_TIMEOUT_SECONDS
                    )
                    broll_p.write_bytes(img_bytes)
                    images_p.write_bytes(img_bytes)
                    log(f"  ✅ Saved: {broll_p.name} ({len(img_bytes):,} bytes)")
                    generated = True
                    break
                except Exception as e:
                    log(f"  ⚠ Attempt {attempt} failed: {e}")
                    try:
                        await flow_page.keyboard.press("Escape")
                        await flow_page.wait_for_timeout(1000)
                    except Exception:
                        pass
                    if attempt < MAX_RETRIES:
                        await flow_page.wait_for_timeout(3000)

            if generated:
                success_count += 1
                completed_filenames.append(filename)
            else:
                log(f"  ❌ Failed to generate {filename} after {MAX_RETRIES} attempts.")
                error_count += 1

            # Enforce Cooldown between images to prevent Google Flow race conditions
            log(f"  💤 Cooldown {COOLDOWN_SECONDS}s before next prompt...")
            await flow_page.wait_for_timeout(COOLDOWN_SECONDS * 1000)

        # Update studio_meta.json status
        meta_path = CLIPPILOT_OUT / project_id / "studio_meta.json"
        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
                meta["image_provider"] = "google_flow"
                all_imgs = list(images_p.parent.glob("*.png"))
                meta["images_uploaded"] = len(all_imgs)
                if len(all_imgs) >= len(items):
                    meta["status"] = "ready_to_render"
                meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
            except Exception as ex:
                log(f"Could not update meta status: {ex}")

        log(f"\n{'='*60}")
        log(f"🎉 Complete! Successfully processed: {success_count}/{len(to_do)}, Errors: {error_count}")

        final_payload = {
            "success": error_count == 0,
            "status": "completed" if error_count == 0 else "completed_with_errors",
            "total_images": len(items),
            "generated_count": success_count,
            "error_count": error_count,
            "completed_filenames": completed_filenames
        }
        if progress_callback:
            progress_callback(final_payload)

        return final_payload


async def generate_single_flow_image_async(
    project_id: str,
    filename: str,
    prompt: str
) -> bool:
    from playwright.async_api import async_playwright

    target_flow_url = DEFAULT_FLOW_URL
    broll_dir = CLIPPILOT_OUT / project_id / "broll"
    images_dir = CLIPPILOT_OUT / project_id / "images"
    broll_dir.mkdir(parents=True, exist_ok=True)
    images_dir.mkdir(parents=True, exist_ok=True)

    broll_p = broll_dir / filename
    images_p = images_dir / filename

    clean_prompt = prompt.split("Save this image as:")[0].strip().rstrip(".")

    async with async_playwright() as pw:
        browser = await pw.chromium.connect_over_cdp(CDP_URL)
        context = browser.contexts[0]
        flow_page = await find_flow_page(context, target_flow_url)
        await flow_page.bring_to_front()
        await flow_page.wait_for_timeout(500)

        img_bytes = await generate_single_image(
            flow_page,
            clean_prompt,
            filename,
            min_wait_s=GEN_WAIT_SECONDS,
            timeout_s=GEN_TIMEOUT_SECONDS
        )
        broll_p.write_bytes(img_bytes)
        images_p.write_bytes(img_bytes)
        return True

# ─────────────────────────────────────────────────────────────────────────────
# Synchronous Entry Points
# ─────────────────────────────────────────────────────────────────────────────
def run_flow_pipeline_sync(
    project_id: str,
    flow_url: Optional[str] = None,
    start_idx: int = 0,
    count: Optional[int] = None,
    progress_callback: Optional[Callable[[dict], None]] = None,
    dry_run: bool = False,
    force: bool = True
) -> dict:
    return asyncio.run(generate_flow_images_for_project(
        project_id=project_id,
        flow_url=flow_url,
        start_idx=start_idx,
        count=count,
        progress_callback=progress_callback,
        dry_run=dry_run,
        force=force
    ))

def generate_single_flow_image_sync(project_id: str, filename: str, prompt: str) -> bool:
    return asyncio.run(generate_single_flow_image_async(project_id, filename, prompt))

def main():
    ap = argparse.ArgumentParser(description="Google Flow Image Generation Pipeline")
    ap.add_argument("--project", default="2026-08-13/breaking_news_trees_just_put_humans_on_an_oxygen_s",
                    help="ClipPilot project ID")
    ap.add_argument("--flow-url", default=None, help="Google Flow Project URL")
    ap.add_argument("--start", type=int, default=0, help="Start prompt index")
    ap.add_argument("--count", type=int, default=None, help="Number of prompts to process")
    ap.add_argument("--dry-run", action="store_true", help="Print queue without executing")
    ap.add_argument("--force", action="store_true", default=True, help="Force regenerate even if exists")
    args = ap.parse_args()

    run_flow_pipeline_sync(
        project_id=args.project,
        flow_url=args.flow_url,
        start_idx=args.start,
        count=args.count,
        dry_run=args.dry_run,
        force=args.force
    )

if __name__ == "__main__":
    main()
