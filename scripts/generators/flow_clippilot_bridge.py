# -*- coding: utf-8 -*-
"""
flow_clippilot_bridge.py — Two-Tab Playwright Automation
=========================================================
Reads image prompts from ClipPilot's studio_meta.json, then opens
the specific Google Flow project and generates + downloads each image
one by one, saving them to the project's broll/ folder.

Usage:
    # Activate the venv first
    source .venv-flow/bin/activate

    # Run (auto-detects current project)
    python scripts/generators/flow_clippilot_bridge.py \
        --project "2026-08-13/breaking_news_trees_just_put_humans_on_an_oxygen_s" \
        --flow-url "https://labs.google/fx/tools/flow/project/199c8a50-3cf7-4f4b-b6c0-360d7ec2caf0"

    # Resume from image 5
    python scripts/generators/flow_clippilot_bridge.py \
        --project "2026-08-13/breaking_news_trees_just_put_humans_on_an_oxygen_s" \
        --flow-url "https://labs.google/fx/tools/flow/project/199c8a50-3cf7-4f4b-b6c0-360d7ec2caf0" \
        --start 5

    # Dry run (no browser)
    python scripts/generators/flow_clippilot_bridge.py \
        --project "2026-08-13/breaking_news_trees_just_put_humans_on_an_oxygen_s" \
        --flow-url "https://labs.google/fx/tools/flow/project/199c8a50-3cf7-4f4b-b6c0-360d7ec2caf0" \
        --dry-run
"""
from __future__ import annotations
import argparse, asyncio, json, shutil, sys, time
from pathlib import Path

# ─────────────────────────────────────────────────────────────────────────────
# Paths
# ─────────────────────────────────────────────────────────────────────────────
PROJECT_ROOT  = Path(__file__).resolve().parents[2]
CLIPPILOT_OUT = PROJECT_ROOT / "packages" / "ClipPilot" / "output"
PROFILE_DIR   = Path.home() / ".config" / "shorts-flow-profile"

# Timeouts
GEN_TIMEOUT   = 180   # seconds to wait for image generation
DL_TIMEOUT    = 60    # seconds to wait for download
POLL_MS       = 800   # poll interval (ms) while waiting for thumbnail
MAX_RETRY     = 3     # retries per image

# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────
def log(msg: str):
    print(f"[bridge {time.strftime('%H:%M:%S')}] {msg}", flush=True)

# ─────────────────────────────────────────────────────────────────────────────
# Load prompts from studio_meta.json
# ─────────────────────────────────────────────────────────────────────────────
def load_images(project_id: str) -> list[dict]:
    """
    Returns list of dicts:
      {filename, clean_prompt, save_path, scene_idx, img_idx}
    """
    meta_path = CLIPPILOT_OUT / project_id / "studio_meta.json"
    if not meta_path.exists():
        sys.exit(f"[bridge] studio_meta.json not found: {meta_path}")

    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    scenes = meta.get("scenes", [])
    broll_dir = CLIPPILOT_OUT / project_id / "broll"
    broll_dir.mkdir(parents=True, exist_ok=True)

    items = []
    for s_idx, scene in enumerate(scenes, 1):
        for img in scene.get("images", []):
            raw_prompt: str = img.get("prompt", "")
            # Strip "Save this image as: ..." and "Negative: ..." instructions
            clean = raw_prompt.split("Save this image as:")[0].strip().rstrip(".")
            filename: str = img.get("filename", f"short_s{s_idx:03d}_img{img.get('image_index',0):03d}.png")
            items.append({
                "filename"     : filename,
                "clean_prompt" : clean,
                "save_path"    : broll_dir / filename,
                "scene_idx"    : s_idx,
                "img_idx"      : img.get("image_index", 0),
                "description"  : img.get("scene_description", ""),
            })
    return items


# ─────────────────────────────────────────────────────────────────────────────
# Main async runner
# ─────────────────────────────────────────────────────────────────────────────
async def run(
    items: list[dict],
    flow_url: str,
    *,
    start: int = 0,
    count: int | None = None,
    dry_run: bool = False,
):
    # Filter
    to_do = [it for i, it in enumerate(items) if i >= start]
    if count is not None:
        to_do = to_do[:count]

    if dry_run:
        log(f"DRY RUN — {len(to_do)} images:")
        for i, it in enumerate(to_do):
            exists = "✓" if it["save_path"].exists() else "✗"
            log(f"  [{exists}] {it['filename']:30s} — {it['description']}")
            log(f"       prompt ({len(it['clean_prompt'])} chars): {it['clean_prompt'][:80]}...")
        return

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        sys.exit("Install playwright: pip install playwright && playwright install chromium")

    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    log(f"Browser profile: {PROFILE_DIR}")
    log(f"Flow project   : {flow_url}")
    log(f"Images to do   : {len(to_do)}")

    async with async_playwright() as pw:
        ctx = await pw.chromium.launch_persistent_context(
            str(PROFILE_DIR),
            headless=False,
            accept_downloads=True,
            viewport={"width": 1440, "height": 900},
            args=["--disable-blink-features=AutomationControlled"],
        )

        # ── Open / reuse a Flow tab ──────────────────────────────────────────
        page = ctx.pages[0] if ctx.pages else await ctx.new_page()
        log(f"Navigating to Flow project...")
        await page.goto(flow_url, wait_until="domcontentloaded", timeout=30_000)
        await page.wait_for_timeout(2500)

        # Login check
        if "accounts.google.com" in page.url or "signin" in page.url.lower():
            log("\n⚠️  Please sign in to Google in the browser, then press ENTER here.")
            input(">> Press ENTER when logged in: ")
            await page.goto(flow_url, wait_until="domcontentloaded", timeout=30_000)
            await page.wait_for_timeout(2500)

        # ── Ensure 9:16 + Image + Nano Banana Pro ───────────────────────────
        await configure_flow_settings(page)

        ok = 0
        fail = 0

        for global_i, item in enumerate(to_do):
            filename   = item["filename"]
            prompt     = item["clean_prompt"]
            save_path  = item["save_path"]
            desc       = item["description"]
            scene_idx  = item["scene_idx"]
            img_idx    = item["img_idx"]

            log(f"\n{'━'*60}")
            log(f"Scene {scene_idx} | Image {img_idx:02d} | {filename}")
            log(f"📝 {desc}")

            # Skip if already done
            if save_path.exists() and save_path.stat().st_size > 2000:
                log(f"✓ Already exists — skipping.")
                ok += 1
                continue

            success = False
            for attempt in range(1, MAX_RETRY + 1):
                try:
                    log(f"  Attempt {attempt}/{MAX_RETRY}...")
                    dl_file = await generate_image(page, prompt, flow_url)
                    shutil.move(str(dl_file), str(save_path))
                    log(f"  ✅ Saved → {save_path.name}  ({save_path.stat().st_size:,} bytes)")
                    success = True
                    break
                except Exception as e:
                    log(f"  ⚠ Attempt {attempt} error: {e}")
                    # Try to escape / click Done to recover from stuck state
                    try:
                        await page.keyboard.press("Escape")
                        await page.wait_for_timeout(500)
                        done = page.locator("text=Done").first
                        if await done.is_visible(timeout=2000):
                            await done.click()
                            await page.wait_for_timeout(1000)
                    except Exception:
                        pass
                    if attempt < MAX_RETRY:
                        log(f"  Retrying in 4s...")
                        await page.wait_for_timeout(4000)

            if success:
                ok += 1
            else:
                log(f"  ❌ Failed after {MAX_RETRY} attempts. Moving on.")
                fail += 1

            # Brief cooldown between images
            await page.wait_for_timeout(1500)

        await ctx.close()
        log(f"\n{'='*60}")
        log(f"✅ Done!  Success: {ok}  Failed: {fail}  Skipped: {len(to_do)-ok-fail}")


# ─────────────────────────────────────────────────────────────────────────────
# Configure Flow settings (Image / 9:16 / Nano Banana Pro / x1)
# ─────────────────────────────────────────────────────────────────────────────
async def configure_flow_settings(page):
    log("Configuring Flow settings (Image, 9:16, Nano Banana Pro, x1)...")
    try:
        # Click the settings chip at bottom-right (shows model + ratio + count)
        chip = page.locator("button:has-text('Nano Banana Pro'), [class*='model-chip'], [class*='ModelChip']").last
        visible = await chip.is_visible(timeout=4000)
        if visible:
            await chip.click()
            await page.wait_for_timeout(700)
        else:
            # Try clicking the bottom-right area that shows the settings
            await page.mouse.click(910, 766)
            await page.wait_for_timeout(700)
    except Exception:
        log("  Could not open settings popup — assuming defaults are already correct.")
        return

    # Image tab
    for sel in ["text=Image", "[role='tab']:has-text('Image')", "button:has-text('Image')"]:
        try:
            el = page.locator(sel).first
            if await el.is_visible(timeout=1500):
                await el.click()
                await page.wait_for_timeout(300)
                break
        except Exception:
            continue

    # 9:16 ratio
    for sel in ["text=9:16", "button:has-text('9:16')", "[aria-label='9:16']"]:
        try:
            el = page.locator(sel).first
            if await el.is_visible(timeout=1500):
                await el.click()
                log("  ✓ 9:16 ratio selected")
                await page.wait_for_timeout(300)
                break
        except Exception:
            continue

    # x1 count
    for sel in ["text=x1", "button:has-text('x1')"]:
        try:
            el = page.locator(sel).first
            if await el.is_visible(timeout=1000):
                await el.click()
                await page.wait_for_timeout(300)
                break
        except Exception:
            continue

    await page.keyboard.press("Escape")
    await page.wait_for_timeout(500)
    log("  ✓ Settings confirmed.")


# ─────────────────────────────────────────────────────────────────────────────
# Generate one image
# ─────────────────────────────────────────────────────────────────────────────
async def find_prompt_box(page):
    """
    Find the prompt input box using multiple strategies.
    Google Flow uses a contenteditable DIV[role="textbox"], NOT a textarea/input.
    """
    selectors = [
        '[role="textbox"]',                              # ← actual selector (DIV contenteditable)
        '[contenteditable="true"]',
        'div[role="textbox"]',
        '[placeholder="What do you want to create?"]',   # fallback if they change it to input
        '[placeholder="What do you want to change?"]',
        'textarea',
    ]
    for sel in selectors:
        try:
            loc = page.locator(sel).first
            if await loc.is_visible(timeout=3000):
                return loc
        except Exception:
            continue
    return None


async def generate_image(page, prompt: str, flow_url: str) -> Path:
    """Type the prompt, submit, wait for thumbnail, click download. Returns downloaded file path."""

    # ── 1. Find prompt box — navigate back to project if needed ──────────────
    box = await find_prompt_box(page)
    if box is None:
        log("    Prompt box not found — navigating back to Flow project...")
        await page.goto(flow_url, wait_until="domcontentloaded", timeout=20_000)
        await page.wait_for_timeout(2000)
        box = await find_prompt_box(page)
        if box is None:
            raise RuntimeError("Prompt box still not found after re-navigating to Flow project.")

    # ── 2. Clear and type prompt into contenteditable div ────────────────────
    await box.click()
    await page.wait_for_timeout(200)
    # Select all existing text and delete it
    await page.keyboard.press("Control+a")
    await page.keyboard.press("Delete")
    await page.wait_for_timeout(150)
    # Type prompt using keyboard (works reliably with contenteditable divs)
    await page.keyboard.type(prompt, delay=8)
    await page.wait_for_timeout(300)

    # ── 3. Count thumbnails before generating ────────────────────────────────
    pre_count = await count_thumbnails(page)
    log(f"    Thumbnails before: {pre_count}")

    # ── 4. Submit ────────────────────────────────────────────────────────────
    sent = False
    # Try the arrow send button (various aria-labels used by Flow)
    for sel in [
        "button[aria-label='Send']",
        "button[aria-label='Generate']",
        "button[aria-label='Submit']",
        "button[aria-label='submit']",
        "button[type='submit']",
    ]:
        try:
            btn = page.locator(sel).first
            if await btn.is_visible(timeout=1000):
                await btn.click()
                sent = True
                log(f"    Sent via button: {sel}")
                break
        except Exception:
            continue

    if not sent:
        # Enter key inside the textbox
        await page.keyboard.press("Enter")
        log("    Sent via Enter key.")

    # ── 5. Wait for new thumbnail ─────────────────────────────────────────────
    log(f"    Waiting for generation (up to {GEN_TIMEOUT}s)...")
    new_thumb = await wait_for_thumbnail(page, pre_count)
    if new_thumb is None:
        raise TimeoutError(f"No new thumbnail after {GEN_TIMEOUT}s — generation timed out.")
    log("    ✓ Image generated!")

    # ── 6. Click thumbnail → detail view ─────────────────────────────────────
    await new_thumb.click()
    await page.wait_for_timeout(1800)

    # ── 7. Download ───────────────────────────────────────────────────────────
    dl_path = await download_image(page)

    # ── 8. Return to workspace ────────────────────────────────────────────────
    for sel in ["text=Done", "button:has-text('Done')", "[aria-label='Done']"]:
        try:
            btn = page.locator(sel).first
            if await btn.is_visible(timeout=2500):
                await btn.click()
                await page.wait_for_timeout(900)
                break
        except Exception:
            continue
    else:
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(700)

    return dl_path


# ─────────────────────────────────────────────────────────────────────────────
# Count thumbnails in workspace
# ─────────────────────────────────────────────────────────────────────────────
async def count_thumbnails(page) -> int:
    selectors = [
        "main img",
        "[role='main'] img",
        "[class*='MediaCard'] img",
        "[class*='thumbnail'] img",
        "[class*='Thumbnail'] img",
        "article img",
        "[class*='grid'] img",
    ]
    for sel in selectors:
        try:
            n = await page.locator(sel).count()
            if n > 0:
                return n
        except Exception:
            continue
    return 0


# ─────────────────────────────────────────────────────────────────────────────
# Wait until a new thumbnail appears
# ─────────────────────────────────────────────────────────────────────────────
async def wait_for_thumbnail(page, pre_count: int):
    deadline = time.time() + GEN_TIMEOUT
    while time.time() < deadline:
        current = await count_thumbnails(page)
        if current > pre_count:
            # Return the newest (last) thumbnail
            for sel in ["main img", "[role='main'] img", "article img",
                        "[class*='MediaCard'] img", "[class*='grid'] img"]:
                try:
                    locs = page.locator(sel)
                    n = await locs.count()
                    if n > pre_count:
                        return locs.last
                except Exception:
                    continue
        await page.wait_for_timeout(POLL_MS)

    # Last resort: look for any visible newly-appeared image
    for sel in ["main img:last-child", "article:last-child img", "[class*='card']:last-child img"]:
        try:
            el = page.locator(sel).last
            if await el.is_visible(timeout=2000):
                return el
        except Exception:
            continue
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Download image
# ─────────────────────────────────────────────────────────────────────────────
async def download_image(page) -> Path:
    tmp_dir = PROFILE_DIR / "_downloads"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    dl_selectors = [
        "button[aria-label='Download']",
        "button[aria-label='Save']",
        "[aria-label='Download image']",
        "[title='Download']",
        "a[download]",
        "button[aria-label='download']",
    ]

    async with page.expect_download(timeout=DL_TIMEOUT * 1000) as dl_info:
        clicked = False
        for sel in dl_selectors:
            try:
                btn = page.locator(sel).first
                if await btn.is_visible(timeout=1800):
                    await btn.click()
                    clicked = True
                    log(f"    Download clicked: {sel}")
                    break
            except Exception:
                continue

        if not clicked:
            # Position-based click: download icon is ~2nd icon in top-right bar
            # Approximate coords based on 1440×900 viewport
            log("    Trying position-based download click...")
            await page.mouse.click(1243, 27)

    dl = await dl_info.value
    name = dl.suggested_filename or f"flow_dl_{int(time.time())}.jpg"
    out  = tmp_dir / name
    await dl.save_as(str(out))
    log(f"    Downloaded: {out.name}  ({out.stat().st_size:,} bytes)")
    return out


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(
        description="Auto-generate images via Google Flow from ClipPilot prompts"
    )
    ap.add_argument(
        "--project", required=True,
        help='ClipPilot project ID, e.g. "2026-08-13/breaking_news_trees_just_put_humans_on_an_oxygen_s"'
    )
    ap.add_argument(
        "--flow-url", required=True,
        help="Google Flow project URL, e.g. https://labs.google/fx/tools/flow/project/..."
    )
    ap.add_argument("--start", type=int, default=0,
                    help="Start from this image index (0-based, for resuming)")
    ap.add_argument("--count", type=int, default=None,
                    help="Only process N images (for testing)")
    ap.add_argument("--dry-run", action="store_true",
                    help="Show what would be generated without opening browser")
    args = ap.parse_args()

    items = load_images(args.project)
    log(f"Project : {args.project}")
    log(f"Images  : {len(items)} total across all scenes")

    asyncio.run(run(
        items,
        args.flow_url,
        start=args.start,
        count=args.count,
        dry_run=args.dry_run,
    ))


if __name__ == "__main__":
    main()
