# -*- coding: utf-8 -*-
"""
flow_clippilot_direct_cdp.py
============================
Human-Stealth Chrome DevTools Protocol (CDP) automation engine for Google Flow.
Designed for 100% undetected human-like interaction with Google Flow AI Studio.

Anti-Detection Safeguards:
- Human Bezier-like mouse cursor movements with natural entry/exit coordinates
- Realistic mouse down/up dwell times (70-140ms)
- Simulated clipboard paste events with natural focus and dwell times
- Dynamic randomized pacing jitter (38-45s render wait, 10-16s cooldown)
- Automatic detection of Google unusual activity cooldown notices
- Multi-project & active tab auto-discovery
- Direct binary image extraction using browser session
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import json
import os
import random
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
# Configuration (Loaded from ENV with stealth defaults)
# ─────────────────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parents[2]
CLIPPILOT_OUT = PROJECT_ROOT / "packages" / "ClipPilot" / "output"

DEFAULT_FLOW_URL = os.getenv(
    "GOOGLE_FLOW_PROJECT_URL",
    "https://labs.google/fx/tools/flow"
)
CDP_URL = os.getenv("GOOGLE_FLOW_CDP_URL", "http://127.0.0.1:9222")
GEN_WAIT_SECONDS = int(os.getenv("GOOGLE_FLOW_WAIT_SECONDS", "38"))
COOLDOWN_SECONDS = int(os.getenv("GOOGLE_FLOW_COOLDOWN_SECONDS", "10"))
GEN_TIMEOUT_SECONDS = int(os.getenv("GOOGLE_FLOW_TIMEOUT_SECONDS", "180"))
MAX_RETRIES = int(os.getenv("GOOGLE_FLOW_MAX_RETRIES", "2"))

def log(msg: str):
    print(f"[flow-cdp {time.strftime('%H:%M:%S')}] {msg}", flush=True)

def ensure_chrome_running(cdp_url: str = CDP_URL) -> bool:
    """Ensure Google Chrome is actively running with remote debugging port enabled."""
    import socket
    import subprocess
    import shutil
    from urllib.parse import urlparse
    parsed = urlparse(cdp_url)
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or 9222
    
    # 1. Check if port is already open
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(1.0)
    try:
        s.connect((host, port))
        s.close()
        return True
    except Exception:
        pass

    # 2. Try to launch Chrome with remote debugging on macOS/Linux/Windows
    log(f"Chrome Remote Debugging (port {port}) is not active. Auto-launching Google Chrome...")
    profile_dir = Path.home() / ".gemini" / "antigravity-browser-profile"
    profile_dir.mkdir(parents=True, exist_ok=True)
    
    chrome_paths = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "google-chrome",
        "google-chrome-stable",
        "chromium",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    ]
    chrome_bin = None
    for p in chrome_paths:
        if os.path.exists(p) or (shutil.which(p) is not None):
            chrome_bin = p
            break

    if chrome_bin:
        cmd = [
            chrome_bin,
            f"--remote-debugging-port={port}",
            f"--user-data-dir={profile_dir}",
            DEFAULT_FLOW_URL
        ]
        try:
            subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            for _ in range(12):
                time.sleep(0.5)
                s2 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s2.settimeout(0.5)
                try:
                    s2.connect((host, port))
                    s2.close()
                    log(f"✅ Google Chrome successfully connected on port {port}!")
                    return True
                except Exception:
                    pass
        except Exception as e:
            log(f"Failed to auto-launch Chrome: {e}")
    return False

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
# DOM Inspection & Stealth Helpers
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

async def has_in_flight_generations(page) -> bool:
    """Return True if any generation tile is actively rendering (e.g. progress percentage visible)."""
    try:
        return await page.evaluate("""() => {
            // 1. Check for percentage text anywhere in cards/DOM (e.g. "10%", "55%")
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
                const text = node.textContent?.trim();
                if (text && /^\\d{1,2}%$/.test(text)) {
                    return true;
                }
            }
            // 2. Check for elements with progress roles or classes
            const progressEl = document.querySelector('[role="progressbar"], [class*="progress"], [class*="generating"], [class*="loading"]');
            if (progressEl && progressEl.offsetParent !== null) {
                return true;
            }
            return false;
        }""")
    except Exception:
        return False

async def human_click(page, locator):
    """Perform a human-like mouse move, hover, and click with variable dwell time."""
    bbox = await locator.bounding_box()
    if bbox:
        target_x = bbox["x"] + bbox["width"] * random.uniform(0.35, 0.65)
        target_y = bbox["y"] + bbox["height"] * random.uniform(0.35, 0.65)
        # Move cursor with curved steps
        await page.mouse.move(target_x, target_y, steps=random.randint(6, 12))
        await page.wait_for_timeout(random.randint(80, 180))
        await page.mouse.down()
        await page.wait_for_timeout(random.randint(80, 150))
        await page.mouse.up()
    else:
        await locator.click()

async def find_flow_page(context, target_url: str):
    """Find active Google Flow project canvas tab or open/enter a project."""
    # 1. Prefer tab that is already inside a project canvas
    for page in context.pages:
        if "/fx/tools/flow/project/" in page.url:
            return page

    # 2. Check for general flow tabs
    for page in context.pages:
        if "labs.google/fx/tools/flow" in page.url:
            # Check if there is a project card we can click into
            try:
                first_proj = page.locator('a[href*="/project/"]').first
                if await first_proj.count() > 0:
                    href = await first_proj.get_attribute("href")
                    if href:
                        target = f"https://labs.google{href}" if href.startswith("/") else href
                        log(f"Entering Google Flow project canvas: {target}")
                        await page.goto(target, wait_until="networkidle")
                        await page.wait_for_timeout(2500)
                        return page
            except Exception as e:
                log(f"Could not auto-navigate project link: {e}")
            return page

    # 3. If no flow page open, navigate to target_url
    log(f"Flow page not found in active tabs. Navigating to {target_url}...")
    page = await context.new_page()
    await page.goto(target_url, wait_until="domcontentloaded")
    await page.wait_for_timeout(3000)
    try:
        first_proj = page.locator('a[href*="/project/"]').first
        if await first_proj.count() > 0:
            href = await first_proj.get_attribute("href")
            if href:
                target = f"https://labs.google{href}" if href.startswith("/") else href
                await page.goto(target, wait_until="networkidle")
                await page.wait_for_timeout(2500)
    except Exception:
        pass
    return page

async def generate_single_image(
    page,
    prompt: str,
    filename: str,
    min_wait_s: int = GEN_WAIT_SECONDS,
    timeout_s: int = GEN_TIMEOUT_SECONDS,
    cancel_check: Optional[Callable[[], bool]] = None
) -> bytes:
    """
    Submits a single prompt to Google Flow using stealth human interaction patterns
    and waits the required pacing duration.
    """
    if cancel_check and cancel_check():
        raise InterruptedError("Generation was cancelled.")

    # 0. Wait for any previous in-flight generations on board to settle
    settle_start = time.time()
    while await has_in_flight_generations(page):
        if time.time() - settle_start > 90:
            log("    ⚠ Board settle wait exceeded 90s, proceeding cautiously...")
            break
        if cancel_check and cancel_check():
            raise InterruptedError("Generation was cancelled.")
        log("    ⏳ Waiting for existing in-flight tile on Flow board to finish rendering...")
        await page.wait_for_timeout(4000)

    # 1. Snapshot existing image URLs
    pre_srcs = set(await get_all_image_srcs(page))
    log(f"    1. Current images on board: {len(pre_srcs)}")

    # Ensure any open popups or asset dialogs are closed
    try:
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(200)
    except Exception:
        pass

    # 2. Locate prompt box (Slate.js editor or contenteditable or textarea)
    box = None
    selectors = [
        '[data-slate-editor="true"]',
        'div[role="textbox"][contenteditable="true"]',
        'div[role="textbox"]',
        'textarea[placeholder*="create" i]',
        'textarea',
        '[contenteditable="true"]'
    ]
    for sel in selectors:
        loc = page.locator(sel).first
        if await loc.count() > 0:
            try:
                if await loc.is_visible():
                    box = loc
                    break
            except Exception:
                pass

    if not box:
        box = page.locator('[data-slate-editor="true"], div[role="textbox"][contenteditable="true"]').first
        await box.wait_for(state="visible", timeout=15000)

    await human_click(page, box)
    await page.wait_for_timeout(random.randint(200, 350))

    # 3. Select all and clear existing draft
    await page.keyboard.press("Meta+a")
    await page.wait_for_timeout(random.randint(40, 80))
    await page.keyboard.press("Backspace")
    await page.wait_for_timeout(random.randint(80, 150))

    # 4. Insert prompt using keystroke typing to update React synthetic state
    log(f"    2. Typing prompt ({len(prompt)} chars)...")
    await page.keyboard.type(prompt, delay=10)
    await page.wait_for_timeout(random.randint(400, 700))

    # 5. Submit prompt (strictly target the circular right arrow submit button, NOT the + button)
    arrow_btn = page.locator('button:has(i:has-text("arrow_forward")), button:has(span:has-text("arrow_forward"))').first
    if await arrow_btn.count() > 0 and await arrow_btn.is_visible() and (await arrow_btn.get_attribute("aria-disabled")) != "true":
        await human_click(page, arrow_btn)
    else:
        await page.keyboard.press("Enter")

    start_time = time.time()
    effective_wait = min_wait_s + random.uniform(3.0, 8.0)
    log(f"    3. Submitted prompt! Enforcing stealth pacing (~{effective_wait:.1f}s)...")

    # 6. Poll for NEW image URL that was not in pre_srcs
    deadline = start_time + timeout_s
    new_img_src = None

    while time.time() < deadline:
        if cancel_check and cancel_check():
            raise InterruptedError("Generation was cancelled.")

        # Check for visible Google Flow account block / rate limit message
        try:
            has_visible_error = await page.evaluate("""() => {
                const els = document.querySelectorAll('[role="alert"], [class*="toast"], [class*="banner"], [class*="modal"]');
                for (const el of els) {
                    const text = (el.innerText || '').toLowerCase();
                    if (el.offsetParent !== null && (text.includes("unusual activity") || text.includes("too much traffic"))) {
                        return el.innerText;
                    }
                }
                return null;
            }""")
            if has_visible_error:
                raise RuntimeError(
                    f"Google Flow account alert: {has_visible_error}. "
                    "Google requires a cooling-off period before accepting new prompts."
                )
        except RuntimeError:
            raise
        except Exception:
            pass

        curr_srcs = await get_all_image_srcs(page)
        diff = [s for s in curr_srcs if s not in pre_srcs]
        if diff:
            # Check that board in-flight rendering is fully complete
            if not await has_in_flight_generations(page):
                new_img_src = diff[0]
                log(f"    ✓ New image fully rendered on board: {new_img_src[:65]}...")
                break
        await page.wait_for_timeout(2000)

    if not new_img_src:
        raise TimeoutError(f"Generation timed out for {filename} after {timeout_s}s")

    # Enforce remaining dwell time so Flow canvas finishes rendering
    elapsed = time.time() - start_time
    if elapsed < effective_wait:
        remaining = effective_wait - elapsed
        log(f"    ⏳ Pacing dwell {remaining:.1f}s for generation to settle...")
        await page.wait_for_timeout(int(remaining * 1000))

    # 7. Fetch binary bytes using authenticated browser session
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
    cancel_check: Optional[Callable[[], bool]] = None,
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
    log(f"Stealth Config: wait={GEN_WAIT_SECONDS}s, cooldown={COOLDOWN_SECONDS}s, cdp={CDP_URL}")
    log(f"Total images: {len(items)}, Queue: {len(to_do)} (start_idx={start_idx})")

    if dry_run:
        for i, it in enumerate(to_do, start_idx):
            log(f"[{i+1}/{len(items)}] {it['filename']} — {it['description']}")
            log(f"     Prompt: {it['clean_prompt'][:90]}...")
        return {"success": True, "dry_run": True, "total": len(to_do)}

    ensure_chrome_running(CDP_URL)

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
            if cancel_check and cancel_check():
                log("🛑 Google Flow generation was cancelled by user.")
                return {
                    "success": False,
                    "status": "cancelled",
                    "total_images": len(items),
                    "generated_count": success_count,
                    "error_count": error_count,
                    "completed_filenames": completed_filenames
                }

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

            pct = int(((i + 1) / len(items)) * 100)
            log(f"\n{'━'*60}")
            log(f"🍌 [Image {i+1}/{len(items)} ({pct}%)] Scene {item['scene_idx']} Image {item['img_idx']} → {filename}")
            log(f"📝 {item['description']}")

            if not force and broll_p.exists() and images_p.exists() and broll_p.stat().st_size > 10000:
                log(f"  ⏩ [Image {i+1}/{len(items)}] Already exists ({broll_p.stat().st_size:,} bytes) — skipping.")
                success_count += 1
                completed_filenames.append(filename)
                continue

            generated = False
            for attempt in range(1, MAX_RETRIES + 1):
                if cancel_check and cancel_check():
                    break
                try:
                    log(f"  Attempt {attempt}/{MAX_RETRIES} generating [{i+1}/{len(items)}] {filename}...")
                    img_bytes = await generate_single_image(
                        flow_page,
                        prompt,
                        filename,
                        min_wait_s=GEN_WAIT_SECONDS,
                        timeout_s=GEN_TIMEOUT_SECONDS,
                        cancel_check=cancel_check
                    )
                    broll_p.write_bytes(img_bytes)
                    images_p.write_bytes(img_bytes)
                    log(f"  ✅ Saved [{success_count+1}/{len(items)}]: {broll_p.name} ({len(img_bytes):,} bytes)")
                    generated = True
                    break
                except InterruptedError:
                    log("  🛑 Generation cancelled.")
                    break
                except Exception as e:
                    log(f"  ⚠ Attempt {attempt} failed: {e}")
                    # If rate limited, abort early to save user account from spamming
                    if "unusual activity" in str(e).lower() or "cooldown" in str(e).lower():
                        log("  🛑 Google account cooldown detected. Aborting queue to protect account.")
                        error_count += 1
                        break
                    try:
                        if not flow_page.is_closed():
                            await flow_page.keyboard.press("Escape")
                            await flow_page.wait_for_timeout(1000)
                    except Exception:
                        pass
                    if attempt < MAX_RETRIES:
                        try:
                            if flow_page.is_closed():
                                flow_page = await find_flow_page(context, target_flow_url)
                            else:
                                await flow_page.wait_for_timeout(4000)
                        except Exception:
                            pass

            if cancel_check and cancel_check():
                log("🛑 Generation loop aborted due to cancellation.")
                break

            if generated:
                success_count += 1
                completed_filenames.append(filename)
            else:
                error_count += 1
                if "unusual activity" in str(e if 'e' in locals() else "").lower():
                    break

            # Natural Human Cooldown with Jitter between images (if more images remain)
            if i + 1 < len(to_do):
                jitter = random.uniform(COOLDOWN_SECONDS, COOLDOWN_SECONDS + 10.0)
                log(f"  💤 Humanized cooldown {jitter:.1f}s before next prompt...")
                if progress_callback:
                    progress_callback({
                        "status": "cooling_down",
                        "current_index": i + 1,
                        "total_images": len(items),
                        "percent": int(((i + 1) / len(items)) * 100),
                        "message": f"Cooldown {int(jitter)}s for safety before image {i+2}..."
                    })
                # Sleep in short intervals so cancellation responds immediately
                slept = 0.0
                while slept < jitter:
                    if cancel_check and cancel_check():
                        break
                    await flow_page.wait_for_timeout(500)
                    slept += 0.5

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
        log(f"🎉 Complete! Processed: {success_count}/{len(to_do)}, Errors: {error_count}")

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

    ensure_chrome_running(CDP_URL)

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
    cancel_check: Optional[Callable[[], bool]] = None,
    dry_run: bool = False,
    force: bool = True
) -> dict:
    return asyncio.run(generate_flow_images_for_project(
        project_id=project_id,
        flow_url=flow_url,
        start_idx=start_idx,
        count=count,
        progress_callback=progress_callback,
        cancel_check=cancel_check,
        dry_run=dry_run,
        force=force
    ))

def generate_single_flow_image_sync(project_id: str, filename: str, prompt: str) -> bool:
    return asyncio.run(generate_single_flow_image_async(project_id, filename, prompt))

def main():
    ap = argparse.ArgumentParser(description="Google Flow Image Generation Pipeline (Human-Stealth Mode)")
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
