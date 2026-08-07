import os
import sys
import json
import shutil
import re
import subprocess
import requests
import threading
import uuid
import datetime
import math
from pathlib import Path
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

# --- Setup Paths ---
HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "packages" / "ClipPilot" / "src"))

try:
    from clippilot.publish.youtube import YouTubePublisher
except ImportError:
    YouTubePublisher = None

try:
    from clippilot.publish.gdrive import GoogleDrivePublisher, publisher_from_env as gdrive_from_env
except ImportError:
    GoogleDrivePublisher = None
    gdrive_from_env = None

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# --- Load Environment Variables ---
def load_env():
    """Load environment variables from both root .env and local backend .env."""
    env_files = [PROJECT_ROOT / ".env", HERE / ".env"]
    for env_file in env_files:
        if env_file.exists():
            with open(env_file, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        val = v.strip()
                        # Allow backend local .env to override empty root variables if specified
                        if val or k.strip() not in os.environ:
                            os.environ[k.strip()] = val
load_env()

DATA_DIR = PROJECT_ROOT / "packages" / "ClipPilot" / "data"

# =============================================================================
# HEALTH & STATUS ENDPOINTS
# =============================================================================

@app.route("/", methods=["GET"])
@app.route("/health", methods=["GET"])
@app.route("/api/health", methods=["GET"])
def health():
    """Health check returning backend environment state."""
    gemini_set = bool(os.environ.get("GEMINI_API_KEY"))
    yt_client_set = bool(os.environ.get("YOUTUBE_CLIENT_ID"))
    yt_refresh_set = bool(os.environ.get("YOUTUBE_REFRESH_TOKEN"))
    
    return jsonify({
        "status": "healthy",
        "service": "Shorts Factory API Backend",
        "version": "2.0.0",
        "project_root": str(PROJECT_ROOT),
        "env": {
            "gemini_configured": gemini_set,
            "youtube_client_configured": yt_client_set,
            "youtube_refresh_configured": yt_refresh_set,
        }
    })

# =============================================================================
# VIDEO MANAGEMENT & SERVING ENDPOINTS
# =============================================================================

def find_final_video(item_dir: Path) -> Path | None:
    """Find the true final output video file in a project folder, excluding slide chunks and silent drafts."""
    all_mp4s = list(item_dir.glob("*.mp4"))
    if not all_mp4s:
        return None
    
    # 1. Prefer explicit Final_*.mp4 files
    final_prefixed = [f for f in all_mp4s if f.name.startswith("Final_") or f.name.startswith("final_")]
    if final_prefixed:
        return max(final_prefixed, key=lambda f: f.stat().st_size)
        
    # 2. Exclude intermediate slide clips, base video, and silent drafts
    excluded_keywords = ["slide_", "slides_silent", "base.mp4", "temp_", "chunk_"]
    valid_finals = [
        f for f in all_mp4s 
        if not any(k in f.name.lower() for k in excluded_keywords)
    ]
    
    if valid_finals:
        return max(valid_finals, key=lambda f: f.stat().st_size)
        
    # 3. Fallback to largest mp4 file in the folder
    return max(all_mp4s, key=lambda f: f.stat().st_size)

@app.route("/api/videos", methods=["GET"])
def get_videos():
    """Scan ClipPilot/data/ for generated .mp4 video projects, sorted newest first."""
    import json as _json
    videos = []
    if DATA_DIR.exists():
        for item in DATA_DIR.iterdir():
            if item.is_dir() and (item.name.startswith("explainer_") or item.name.startswith("short_")):
                final_video = find_final_video(item)
                if final_video:
                    # Read created_at from manifest.json; fall back to file mtime
                    created_at = None
                    manifest_path = item / "manifest.json"
                    if manifest_path.exists():
                        try:
                            with open(manifest_path, "r", encoding="utf-8") as mf:
                                mdata = _json.load(mf)
                            created_at = mdata.get("project_info", {}).get("created_at")
                        except Exception:
                            pass
                    if not created_at:
                        # Fallback: use video file modification time as ISO string
                        import datetime
                        mtime = final_video.stat().st_mtime
                        created_at = datetime.datetime.utcfromtimestamp(mtime).strftime("%Y-%m-%dT%H:%M:%SZ")
                    videos.append({
                        "id": item.name,
                        "name": item.name.replace("explainer_", "").replace("short_", "").replace("_", " ").title(),
                        "path": str(final_video.relative_to(DATA_DIR)),
                        "filename": final_video.name,
                        "size_mb": round(final_video.stat().st_size / (1024 * 1024), 2),
                        "created_at": created_at,
                    })
    # Sort newest first
    videos.sort(key=lambda v: v.get("created_at", ""), reverse=True)
    return jsonify(videos)

@app.route("/video/<path:filepath>", methods=["GET"])
def serve_video(filepath):
    """Serve .mp4 video files to the frontend video player."""
    full_path = DATA_DIR / filepath
    if full_path.exists():
        return send_file(full_path, mimetype="video/mp4")
    return jsonify({"error": "Video not found"}), 404

# =============================================================================
# GEMINI AI METADATA GENERATION
# =============================================================================

import time

_KEY_LAST_CALL: dict[str, float] = {}

def call_gemini(prompt: str, timeout: int = 300, json_mode: bool = False) -> str:
    """Helper to execute Gemini REST API requests with rich terminal logging, 6.0s pacing governor, and 8s failover backoff."""
    raw_keys = os.environ.get("GEMINI_API_KEYS") or os.environ.get("GEMINI_API_KEY") or ""
    keys = [k.strip() for k in raw_keys.replace("\n", ",").split(",") if k.strip()]
    if not keys:
        raise Exception("GEMINI_API_KEY is missing in .env")
    
    primary_model  = os.environ.get("GEMINI_PRIMARY_MODEL") or os.environ.get("GEMINI_MODEL") or "gemini-flash-latest"
    fallback_model = os.environ.get("GEMINI_CANDIDATE_MODEL") or os.environ.get("GEMINI_FALLBACK_MODEL") or "gemini-flash-lite-latest"
    
    candidate_models = [primary_model, "gemini-2.0-flash", fallback_model, "gemini-2.0-flash-lite"]
    models = list(dict.fromkeys([m for m in candidate_models if m]))
    
    total_keys = len(keys)
    print(f"\n[Gemini API] Dispatching request across {total_keys} API key(s) and {len(models)} model(s)...")
    
    last_err = None
    for model in models:
        for key_idx, key in enumerate(keys):
            key_label = f"Key #{key_idx+1}/{total_keys} ({key[:14]}...)"
            
            # Enforce 6.0s pacing per key (strictly 10 RPM limit to eliminate 429 spikes)
            now = time.time()
            last_used = _KEY_LAST_CALL.get(key, 0)
            if now - last_used < 6.0:
                wait_time = round(6.0 - (now - last_used), 1)
                print(f"[Gemini API] Rate Governor: Pacing {wait_time}s for {key_label}...")
                time.sleep(wait_time)
            _KEY_LAST_CALL[key] = time.time()

            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "maxOutputTokens": 8192
                }
            }
            if json_mode:
                payload["generationConfig"]["responseMimeType"] = "application/json"
            
            for attempt in range(2):
                print(f"[Gemini API] Attempt {attempt+1} on {model} using {key_label}...")
                try:
                    resp = requests.post(url, json=payload, timeout=timeout)
                    if resp.status_code == 200:
                        data = resp.json()
                        try:
                            res_text = data["candidates"][0]["content"]["parts"][0]["text"]
                            print(f"[Gemini API] SUCCESS on {model} using {key_label}!")
                            return res_text
                        except (KeyError, IndexError):
                            raise Exception("Invalid response structure from Gemini API")
                    elif resp.status_code == 429:
                        last_err = f"Rate Limit (429) on {key_label} for {model}"
                        print(f"[Gemini API WARNING] {last_err}")
                        if total_keys > 1 and key_idx < total_keys - 1:
                            print(f"[Gemini API] Rotating to Key #{key_idx+2} (pausing 8s for quota clearance)...")
                            time.sleep(8)
                            break
                        print(f"[Gemini API] Pausing 8s backoff before retry...")
                        time.sleep(8)
                        continue
                    else:
                        last_err = f"API Error ({resp.status_code}) on {key_label} for {model}: {resp.text[:150]}"
                        print(f"[Gemini API ERROR] {last_err}")
                        break
                except Exception as e:
                    last_err = str(e)
                    print(f"[Gemini API EXCEPTION] {last_err}")
            
    raise Exception(f"Gemini API Rate Limited / Unavailable: {last_err}")

@app.route("/api/generate_metadata", methods=["POST"])
def generate_metadata():
    """Generate viral Title, Description, Hashtags, YouTube Tags, and English Language using Gemini with smart rate-limit fallback."""
    topic = request.json.get("topic", "") if request.json else ""
    if not topic:
        return jsonify({"error": "No topic provided"}), 400
    
    prompt = f"""
    You are an expert YouTube Shorts creator. 
    I have a short vertical video about: "{topic}".
    Generate a JSON object with:
    1. A viral Title.
    2. An engaging Description.
    3. A space-separated list of 5 Hashtags starting with #.
    4. A list of 10-15 relevant search keywords/phrases for YouTube Studio Tags box (e.g. ["{topic.lower()} facts", "why is {topic.lower()}", "science explainer", "{topic.lower()}"]).
    5. Language code ("en").

    Format your response EXACTLY as raw JSON with no markdown formatting.
    {{
        "title": "...",
        "description": "...",
        "hashtags": "#shorts #tag1 #tag2 #tag3 #tag4",
        "video_tags": ["keyword 1", "keyword 2", "keyword 3", "keyword 4"],
        "language": "en"
    }}
    """
    try:
        response_text = call_gemini(prompt)
        response_text = response_text.replace("```json", "").replace("```", "").strip()
        metadata = json.loads(response_text)
        return jsonify(metadata)
    except Exception as e:
        print(f"Gemini API Notice ({e}) -> Using smart topic fallback metadata for: {topic}")
        clean_topic = topic.strip().title()
        tag_slug = "".join([c for c in topic if c.isalnum() or c == ' ']).replace(" ", "").lower()
        
        fallback_metadata = {
            "title": f"The Mind-Blowing Secret Behind {clean_topic}! 🤯",
            "description": f"Did you know this insane fact about {clean_topic}? Watch until the end to discover how it works! Subscribe for daily explainer shorts.\n\n#shorts #{tag_slug} #facts #science #viral",
            "hashtags": f"#shorts #{tag_slug} #facts #curiosity #viral",
            "video_tags": [topic.lower(), f"{topic.lower()} facts", f"why {topic.lower()}", "science explainer", "curiosity", "educational", "shorts", "viral facts"],
            "language": "en"
        }
        return jsonify(fallback_metadata)

@app.route("/api/rewrite_metadata", methods=["POST"])
def rewrite_metadata():
    """Rewrite title, description, hashtags, or tags using Gemini with smart fallback."""
    req = request.json or {}
    field = req.get("field")
    current_text = req.get("current_text")
    user_prompt = req.get("prompt")
    
    if not field or not current_text or not user_prompt:
        return jsonify({"error": "Missing required fields (field, current_text, prompt)"}), 400
    
    prompt = f"""
    I have the following {field} for a YouTube Short:
    "{current_text}"
    
    The user asked to rewrite it based on this instruction:
    "{user_prompt}"
    
    Provide ONLY the rewritten {field} text. Do not include quotes or conversational filler.
    """
    try:
        new_text = call_gemini(prompt).strip()
        return jsonify({"result": new_text})
    except Exception as e:
        print(f"Gemini Rewrite Notice ({e}) -> Applying prompt transformation to {field}")
        instruction_lower = user_prompt.lower()
        if "catch" in instruction_lower or "hook" in instruction_lower:
            rewritten = f"🔥 MUST WATCH: {current_text.strip('!.')}!"
        elif "curiosity" in instruction_lower or "question" in instruction_lower:
            rewritten = f"Why Nobody Talks About {current_text.strip('!.')}?"
        elif "cta" in instruction_lower or "subscribe" in instruction_lower:
            rewritten = f"{current_text}\n\n👉 Subscribe @ShortsFactory for daily viral facts!"
        elif "seo" in instruction_lower:
            rewritten = f"Complete guide to {current_text}.\n\n{current_text}"
        elif "niche" in instruction_lower or "tag" in instruction_lower:
            rewritten = f"shorts, finance, technology, trending, viral, facts, science, learning"
        else:
            rewritten = f"{current_text} - {user_prompt.capitalize()}"
        return jsonify({"result": rewritten})

@app.route("/api/generate_cover", methods=["POST"])
def generate_cover():
    """Extract a high-quality thumbnail cover image from video at specified timestamp."""
    req = request.json or {}
    video_rel_path = req.get("video_path")
    timestamp = req.get("timestamp", "2.0")
    
    if not video_rel_path:
        return jsonify({"error": "Missing video_path"}), 400
        
    video_path = DATA_DIR / video_rel_path
    if not video_path.exists():
        return jsonify({"error": f"Video file not found: {video_path}"}), 404
        
    cover_dir = DATA_DIR / "covers"
    cover_dir.mkdir(parents=True, exist_ok=True)
    
    clean_name = video_path.stem.replace(" ", "_")
    cover_filename = f"cover_{clean_name}_{str(timestamp).replace('.', '_')}.jpg"
    cover_path = cover_dir / cover_filename
    
    cmd = [
        "ffmpeg", "-y", "-ss", str(timestamp), "-i", str(video_path),
        "-vframes", "1", "-q:v", "2", str(cover_path)
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True)
        rel_cover = f"covers/{cover_filename}"
        return jsonify({
            "success": True,
            "cover_path": rel_cover,
            "url": f"/cover/{rel_cover}",
            "timestamp": str(timestamp)
        })
    except Exception as e:
        return jsonify({"error": f"Cover extraction failed: {str(e)}"}), 500

@app.route("/cover/<path:filepath>", methods=["GET"])
def serve_cover(filepath):
    """Serve thumbnail cover images."""
    full_path = DATA_DIR / filepath
    if full_path.exists():
        return send_file(full_path, mimetype="image/jpeg")
    return jsonify({"error": "Cover image not found"}), 404

# =============================================================================
# YOUTUBE PUBLISHING ENDPOINT
# =============================================================================

@app.route("/api/publish", methods=["POST"])
def publish():
    """Upload video directly to YouTube with Studio Tags and English Language default."""
    if not YouTubePublisher:
        return jsonify({"error": "YouTubePublisher module unavailable"}), 500
        
    req = request.json or {}
    video_rel_path = req.get("video_path")
    title = req.get("title")
    description = req.get("description")
    
    # Process explicit YouTube Studio tags & hashtags
    raw_video_tags = req.get("video_tags") or []
    if isinstance(raw_video_tags, str):
        explicit_tags = [t.strip() for t in raw_video_tags.split(",") if t.strip()]
    else:
        explicit_tags = [str(t).strip() for t in raw_video_tags if str(t).strip()]
        
    hashtags_raw = req.get("hashtags", "").replace("#", "").split()
    combined_tags = list(dict.fromkeys(explicit_tags + hashtags_raw + ["shorts", "educational", "facts"]))
    
    visibility = req.get("visibility", "private")
    language = req.get("language", "en")
    is_scheduled = req.get("is_scheduled", False)
    publish_at = req.get("publish_at") if is_scheduled else None
    
    if not video_rel_path or not title:
        return jsonify({"error": "Missing video_path or title"}), 400

    video_path = DATA_DIR / video_rel_path
    if not video_path.exists():
        return jsonify({"error": f"Video file not found: {video_path}"}), 404
        
    cid = os.environ.get("YOUTUBE_CLIENT_ID")
    csec = os.environ.get("YOUTUBE_CLIENT_SECRET")
    rt = os.environ.get("YOUTUBE_REFRESH_TOKEN")

    if not cid or not rt:
        return jsonify({"error": "YouTube credentials missing in .env"}), 400
        
    pub = YouTubePublisher(client_id=cid, client_secret=csec, refresh_token=rt)
    result = pub.upload_video(
        video_path=str(video_path),
        title=title,
        description=description,
        tags=combined_tags,
        privacy=visibility,
        language=language,
        publish_at=publish_at
    )
    
    if result.get("success"):
        return jsonify({"success": True, "url": result.get("url")})
    else:
        return jsonify({"error": result.get("error", "Upload failed"), "details": result.get("response")}), 500

# =============================================================================
# GOOGLE DRIVE PUBLISH ENDPOINT
# =============================================================================

@app.route("/api/publish/gdrive", methods=["POST"])
def publish_to_gdrive():
    """Upload the final video of a project to Google Drive.

    Body (JSON):
      video_id   — folder name under ClipPilot/data/ (e.g. "explainer_stomachacid")
                   OR an absolute path to the project folder.

    Returns JSON with:
      success, drive_link, upload_name, date_folder  — on success.
      error                                           — on failure.

    The upload filename is derived from master_metadata.title in manifest.json.
    If a file with the same title already exists in the date folder, the file
    is uploaded as "Title (1).mp4", "Title (2).mp4", etc.
    manifest.json is never uploaded to Drive.
    """
    if not GoogleDrivePublisher:
        return jsonify({"error": "GoogleDrivePublisher module unavailable — check installation."}), 500

    req = request.json or {}
    video_id = req.get("video_id", "").strip()

    if not video_id:
        return jsonify({"error": "Missing required field: video_id"}), 400

    # Resolve project directory
    project_dir = Path(video_id) if Path(video_id).is_absolute() else DATA_DIR / video_id
    if not project_dir.exists() or not project_dir.is_dir():
        return jsonify({"error": f"Project folder not found: {project_dir}"}), 404

    # Read Drive credentials from environment
    root_folder_id = os.environ.get("GDRIVE_ROOT_FOLDER_ID", "").strip()
    service_account_file = os.environ.get("GDRIVE_SERVICE_ACCOUNT_FILE", "").strip() or None

    if not root_folder_id:
        return jsonify({
            "error": "GDRIVE_ROOT_FOLDER_ID is not set in .env. "
                     "Set it to the ID in your Google Drive folder URL."
        }), 400

    try:
        pub = GoogleDrivePublisher(
            root_folder_id=root_folder_id,
            service_account_file=service_account_file,
        )
        result = pub.publish_project(project_dir)
    except Exception as exc:
        return jsonify({"error": f"Google Drive upload failed: {str(exc)}"}), 500

    if result.get("success"):
        return jsonify({
            "success": True,
            "drive_link": result.get("drive_link"),
            "upload_name": result.get("upload_name"),
            "date_folder": result.get("date_folder"),
            "drive_file_id": result.get("drive_file_id"),
        })
    else:
        return jsonify({"error": result.get("error", "Upload failed")}), 500


# =============================================================================
# ANALYTICS & INTELLIGENCE DATA ENDPOINTS
# =============================================================================

@app.route("/api/analytics", methods=["GET"])
def get_analytics():
    """Return latest YouTube analytics data."""
    analytics_file = PROJECT_ROOT / "data" / "analytics" / "performance_latest.json"
    if analytics_file.exists():
        try:
            with open(analytics_file, encoding="utf-8") as f:
                data = json.load(f)
            return jsonify(data)
        except Exception as e:
            return jsonify({"error": f"Error reading analytics JSON: {str(e)}"}), 500
    
    return jsonify({
        "channel": {"title": "Shorts Factory Channel", "subscribers": 26, "views": 7457, "videos": 25},
        "status": "No live snapshot generated yet. Run scripts/analytics/yt_analytics.py to populate data."
    })

@app.route("/api/ledgers", methods=["GET"])
def get_ledgers():
    """Return topics, post history, and variation rules."""
    def read_file_safe(path: Path) -> str:
        if path.exists():
            return path.read_text(encoding="utf-8")
        return ""

    topics_raw = read_file_safe(PROJECT_ROOT / "pipeline" / "ledgers" / "daily_topics.md")
    posts_raw = read_file_safe(PROJECT_ROOT / "pipeline" / "ledgers" / "daily_posts_ledger.md")
    studied_raw = read_file_safe(PROJECT_ROOT / "pipeline" / "ledgers" / "studied_videos.md")
    variation_raw = read_file_safe(PROJECT_ROOT / "pipeline" / "ledgers" / "variation_ledger.md")
    
    return jsonify({
        "daily_topics": topics_raw,
        "daily_posts": posts_raw,
        "studied_videos": studied_raw,
        "variation_ledger": variation_raw
    })

@app.route("/api/decisions", methods=["GET"])
def get_decisions():
    """Return owner decision items."""
    decisions_path = PROJECT_ROOT / "docs" / "DECISIONS_FOR_OWNER.md"
    if decisions_path.exists():
        return jsonify({"content": decisions_path.read_text(encoding="utf-8")})
    return jsonify({"content": "No decision items currently pending."})

# =============================================================================
# PIPELINE TRIGGER ENDPOINTS
# =============================================================================

@app.route("/api/trigger/<action>", methods=["POST"])
def trigger_runner(action):
    """Trigger background pipeline scripts."""
    valid_actions = {
        "daily_shorts": "scripts/runners/bash/daily_shorts.sh",
        "creator_study": "scripts/runners/bash/study_creators.sh",
        "learn_shorts": "scripts/runners/bash/learn_shorts.sh",
        "digest": "scripts/runners/bash/digest.sh"
    }
    
    if action not in valid_actions:
        return jsonify({"error": f"Invalid action: {action}. Valid options: {list(valid_actions.keys())}"}), 400
        
    script_path = PROJECT_ROOT / valid_actions[action]
    if not script_path.exists():
        return jsonify({"error": f"Runner script not found: {script_path}"}), 404

    try:
        subprocess.Popen(["bash", str(script_path)], cwd=str(PROJECT_ROOT))
        return jsonify({"success": True, "message": f"Action '{action}' triggered in background."})
    except Exception as e:
        return jsonify({"error": f"Failed to trigger {action}: {str(e)}"}), 500

# =============================================================================
# SLIDE EDITOR ENDPOINTS  (Visual Timeline Editor)
# =============================================================================

try:
    from clippilot.media.recompose import (
        get_slide_metadata,
        replace_slide_image,
        revert_slide,
        recompose_project,
    )
    _RECOMPOSE_AVAILABLE = True
except ImportError:
    _RECOMPOSE_AVAILABLE = False


@app.route("/api/project/<project_id>/manifest", methods=["GET"])
def get_project_manifest(project_id):
    """Return per-slide metadata for the Slide Timeline Editor UI.

    Each slide entry has: index, slide_file, broll_image, duration_s,
    width, height, has_replacement.
    """
    project_dir = DATA_DIR / project_id
    if not project_dir.exists() or not project_dir.is_dir():
        return jsonify({"error": f"Project not found: {project_id}"}), 404

    if not _RECOMPOSE_AVAILABLE:
        return jsonify({"error": "recompose module unavailable — check ClipPilot installation"}), 500

    try:
        data = get_slide_metadata(project_dir)
        return jsonify(data)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/project/<project_id>/slide_asset/<path:filename>", methods=["GET"])
def serve_slide_asset(project_id, filename):
    """Serve slide broll images for the Web UI timeline thumbnails."""
    project_dir = DATA_DIR / project_id
    asset_path = project_dir / filename
    if not asset_path.exists():
        return jsonify({"error": "Asset not found"}), 404

    ext = asset_path.suffix.lower()
    mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".png": "image/png", ".webp": "image/webp"}.get(ext, "application/octet-stream")
    return send_file(asset_path, mimetype=mime)


@app.route("/api/project/<project_id>/replace_slide", methods=["POST"])
def replace_slide_endpoint(project_id):
    """Replace a slide's background image and re-render slide_XX.mp4.

    Multipart form fields:
      slide_index  — integer index of the slide to replace (0-based)
      image        — the new background image file (JPEG, PNG, WEBP, etc.)
    """
    project_dir = DATA_DIR / project_id
    if not project_dir.exists() or not project_dir.is_dir():
        return jsonify({"error": f"Project not found: {project_id}"}), 404

    if not _RECOMPOSE_AVAILABLE:
        return jsonify({"error": "recompose module unavailable"}), 500

    slide_index = request.form.get("slide_index")
    image_file  = request.files.get("image")

    if slide_index is None:
        return jsonify({"error": "Missing form field: slide_index"}), 400
    if image_file is None:
        return jsonify({"error": "Missing file field: image"}), 400

    try:
        slide_index = int(slide_index)
    except ValueError:
        return jsonify({"error": "slide_index must be an integer"}), 400

    import tempfile
    suffix = Path(image_file.filename or "upload.jpg").suffix or ".jpg"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        image_file.save(tmp)
        tmp_path = tmp.name

    try:
        result = replace_slide_image(
            project_dir=project_dir,
            slide_index=slide_index,
            new_image_path=tmp_path,
        )
    finally:
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except Exception:
            pass

    if result.get("success"):
        return jsonify({"success": True, "slide_index": slide_index})
    return jsonify({"error": result.get("error", "Replace failed")}), 500


@app.route("/api/project/<project_id>/revert_slide", methods=["POST"])
def revert_slide_endpoint(project_id):
    """Revert a slide to its original broll image (undo replace_slide).

    JSON body: { "slide_index": 0 }
    """
    project_dir = DATA_DIR / project_id
    if not project_dir.exists() or not project_dir.is_dir():
        return jsonify({"error": f"Project not found: {project_id}"}), 404

    if not _RECOMPOSE_AVAILABLE:
        return jsonify({"error": "recompose module unavailable"}), 500

    req = request.json or {}
    slide_index = req.get("slide_index")
    if slide_index is None:
        return jsonify({"error": "Missing field: slide_index"}), 400

    try:
        slide_index = int(slide_index)
    except (TypeError, ValueError):
        return jsonify({"error": "slide_index must be an integer"}), 400

    result = revert_slide(project_dir=project_dir, slide_index=slide_index)
    if result.get("success"):
        return jsonify({"success": True, "slide_index": slide_index})
    return jsonify({"error": result.get("error", "Revert failed")}), 500


@app.route("/api/project/<project_id>/recompose", methods=["POST"])
def recompose_endpoint(project_id):
    """Re-stitch all slide clips, mux with narration, re-burn captions,
    update manifest.json, then delete the old Google Drive file and
    upload the new final video in its place.

    Returns: { success, video_path, video_url, manifest_updated,
               drive_deleted, drive_reuploaded, drive_link, drive_error }
    """
    project_dir = DATA_DIR / project_id
    if not project_dir.exists() or not project_dir.is_dir():
        return jsonify({"error": f"Project not found: {project_id}"}), 404

    if not _RECOMPOSE_AVAILABLE:
        return jsonify({"error": "recompose module unavailable"}), 500

    # ── Step 1: Recompose video + update manifest ─────────────────────────────
    try:
        result = recompose_project(project_dir=project_dir)
    except Exception as exc:
        return jsonify({"error": f"Recompose failed: {str(exc)}"}), 500

    if not result.get("success"):
        return jsonify({"error": result.get("error", "Recompose failed")}), 500

    video_path = Path(result["video_path"])
    rel = video_path.relative_to(DATA_DIR)

    response = {
        "success": True,
        "video_path": str(rel),
        "video_url": f"/video/{rel}",
        "manifest_updated": True,   # recompose_project already called update_manifest_after_recompose
        "drive_deleted": False,
        "drive_reuploaded": False,
        "drive_link": None,
        "drive_error": None,
    }

    # ── Step 2: Google Drive – delete old file + re-upload ────────────────────
    root_folder_id = os.environ.get("GDRIVE_ROOT_FOLDER_ID", "").strip()
    service_account_file = os.environ.get("GDRIVE_SERVICE_ACCOUNT_FILE", "").strip() or None

    if not root_folder_id or not GoogleDrivePublisher:
        response["drive_error"] = "Drive not configured (GDRIVE_ROOT_FOLDER_ID missing)"
        return jsonify(response)

    try:
        pub = GoogleDrivePublisher(
            root_folder_id=root_folder_id,
            service_account_file=service_account_file,
        )

        # Read manifest to get the old drive_file_id (if any) and title
        manifest_path = project_dir / "manifest.json"
        old_drive_file_id = None
        date_str = None
        if manifest_path.exists():
            try:
                mdata = json.load(open(manifest_path, encoding="utf-8"))
                old_drive_file_id = mdata.get("gdrive", {}).get("drive_file_id")
                date_str = mdata.get("project_info", {}).get("created_at", "")[:10] or None
            except Exception:
                pass

        # Delete the old Drive file if we know its ID
        if old_drive_file_id:
            deleted = pub.delete_file(old_drive_file_id)
            response["drive_deleted"] = deleted
        else:
            # Fallback: try to delete by title name in the date folder
            try:
                if manifest_path.exists():
                    mdata = json.load(open(manifest_path, encoding="utf-8"))
                    title = (mdata.get("master_metadata", {}).get("title")
                             or mdata.get("project_info", {}).get("generation_params", {}).get("title", ""))
                    if title and date_str:
                        folder_id = pub.get_or_create_date_folder(date_str)
                        from clippilot.publish.gdrive import _slugify_for_filename
                        desired_name = f"{_slugify_for_filename(title)}.mp4"
                        response["drive_deleted"] = pub.delete_file_by_name(folder_id, desired_name)
            except Exception:
                pass

        # Re-upload with force_reupload=True (skips duplicate check, uploads fresh)
        upload_result = pub.publish_project(project_dir, force_reupload=True)
        if upload_result.get("success"):
            response["drive_reuploaded"] = True
            response["drive_link"] = upload_result.get("drive_link")

            # Persist new Drive file ID back to manifest.json
            try:
                if manifest_path.exists():
                    mdata = json.load(open(manifest_path, encoding="utf-8"))
                    mdata.setdefault("gdrive", {})
                    mdata["gdrive"]["drive_file_id"] = upload_result.get("drive_file_id")
                    mdata["gdrive"]["drive_link"] = upload_result.get("drive_link")
                    mdata["gdrive"]["upload_name"] = upload_result.get("upload_name")
                    mdata["gdrive"]["last_uploaded_at"] = (
                        datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
                    )
                    manifest_path.write_text(
                        json.dumps(mdata, indent=2, ensure_ascii=False), encoding="utf-8"
                    )
            except Exception:
                pass
        else:
            response["drive_error"] = upload_result.get("error", "Drive re-upload failed")

    except Exception as exc:
        response["drive_error"] = f"Drive operation failed: {str(exc)}"

    return jsonify(response)




# =============================================================================
# STUDIO — VIDEO CREATOR PIPELINE
# =============================================================================

OUTPUT_ROOT = PROJECT_ROOT / "packages" / "ClipPilot" / "output"
_RENDER_JOBS: dict = {}   # job_id → status dict (in-memory)


def _slugify(text: str) -> str:
    """Convert title to a safe directory name."""
    import re
    text = re.sub(r"[^\w\s-]", "", text.strip())
    text = re.sub(r"[\s_]+", "_", text)
    return text[:60]


@app.route("/api/studio/generate_prompts", methods=["POST"])
def studio_generate_prompts():
    """Break script into 10-15s scenes, each scene gets 8-15 image prompts.

    Filename format:  short_s001_img001.png  /  long_s001_img001.png
    Duration: estimated from word count (140 wpm), never a user slider.
    Shorts capped at 180s / 18 scenes. Long videos: no cap.
    """
    req        = request.json or {}
    topic      = req.get("topic", "")
    title      = req.get("title", "") or topic
    script     = req.get("script", "") or topic
    keywords   = req.get("keywords", "")
    video_type = req.get("video_type", "short")   # "short" | "long"

    word_count   = len(script.split())
    est_dur_secs = round((word_count / 140) * 60)  # 140 wpm TTS

    aspect = "9:16" if video_type == "short" else "16:9"
    prefix = "short" if video_type == "short" else "long"

    # ── Style constants from VIDEO_GENERATION_GUIDE.md ──────────────────────
    if video_type == "short":
        style_defaults = (
            "Vertical portrait 9:16 composition, subject centered in frame, "
            "full subject visible, golden hour light, photorealistic 8k, "
            "crisp focal detail, macro 85mm f/1.4 lens, shallow depth of field"
        )
        max_scenes    = 18
        short_warning = est_dur_secs > 180
    else:
        style_defaults = (
            "Widescreen 16:9 cinematic shot, rule of thirds, expansive view, "
            "warm amber light, 8k wallpaper quality, anamorphic lens flare, "
            "shallow depth of field, cinematic color grade"
        )
        max_scenes    = 9999
        short_warning = False

    negative = (
        "nudity, naked, nsfw, pornographic, explicit content, sexual content, "
        "uncensored, revealing clothing, watermark, text overlay, logo, blurry, "
        "low quality, cropped head, missing limbs, bad anatomy, deformed"
    )

    # ── Build an EXAMPLE block so Gemini sees the exact format ──────────────
    eg_fn1 = f"{prefix}_s001_img001.png"
    eg_fn2 = f"{prefix}_s001_img002.png"
    eg_fn3 = f"{prefix}_s001_img003.png"

    gemini_prompt = f"""You are a cinematic image-prompt engineer and professional video editor.

VIDEO: "{title}"
TYPE: {video_type} ({aspect})
NARRATION SCRIPT:
---
{script}
---

== TASK ==

1. ESTIMATE DURATION
   TTS speed = 140 words/minute.  Word count ≈ {word_count}.  Estimated = {est_dur_secs}s.
   {"SHORT RULE: TOTAL ≤ 180s → max 18 scenes. Compress if needed." if video_type == "short" else "LONG VIDEO: No scene limit."}

2. BREAK INTO SCENES (10–15 seconds each)
   - Each scene = one thematic beat of the narration
   - Scenes must cover the ENTIRE script from start to finish
   - Let the script naturally decide how many scenes are needed

3. FOR EACH SCENE: write 8–15 IMAGE PROMPTS
   - Each prompt = one still photo shown with Ken-Burns zoom during that scene
   - Images within a scene share mood/location, but vary in framing, angle, distance
   - EVERY prompt must be UNIQUE and scene-specific — NO generic or repeated prompts
   - EVERY prompt must start EXACTLY with the style defaults
   - EVERY prompt must end EXACTLY with the negative list
   - The prompt must ALSO state: "Save this image as: <filename>"
   - Image count: use 8 for short/simple scenes, up to 15 for dramatic/complex scenes

== FILENAME FORMAT ==
   {prefix}_s<scene_3digits>_img<image_3digits>.png
   Example: {eg_fn1}, {eg_fn2}, {eg_fn3}
   Scene 2 example: {prefix}_s002_img001.png, {prefix}_s002_img002.png
   ALWAYS 3-digit zero-padded for BOTH scene and image numbers.

== STYLE DEFAULTS (start every prompt with this VERBATIM) ==
"{style_defaults}."

== NEGATIVE PROMPT (end every prompt with this VERBATIM) ==
"Negative: {negative}."

== OUTPUT FORMAT ==
Return ONLY a valid JSON object. No markdown. No code blocks. No explanation.

{{
  "estimated_duration_s": {est_dur_secs},
  "scene_count": <N>,
  "total_images": <total across all scenes>,
  "aspect_ratio": "{aspect}",
  "scenes": [
    {{
      "scene_index": 1,
      "scene_title": "<descriptive title for this scene>",
      "script_excerpt": "<exact 1-3 sentences from the script this scene covers>",
      "scene_duration_s": 12,
      "images": [
        {{
          "image_index": 1,
          "filename": "{eg_fn1}",
          "scene_description": "<one sentence: what this specific image shows>",
          "prompt": "{style_defaults}. <HIGHLY SPECIFIC subject, action, setting, mood, camera angle for this EXACT image>. Save this image as: {eg_fn1}. Negative: {negative}."
        }},
        {{
          "image_index": 2,
          "filename": "{eg_fn2}",
          "scene_description": "<different angle / moment from same scene>",
          "prompt": "{style_defaults}. <DIFFERENT framing from image 1, same scene>. Save this image as: {eg_fn2}. Negative: {negative}."
        }}
      ]
    }}
  ]
}}

CRITICAL RULES:
- Every prompt is UNIQUE — describe a SPECIFIC visual, not a generic one
- Every prompt starts with "{style_defaults}." (verbatim)
- Every prompt ends with "Negative: {negative}." (verbatim)
- Every prompt contains "Save this image as: <filename>."
- Images in a scene: same location/mood, different angles (wide, mid, close, overhead, low)
- NEVER repeat the same prompt twice
- Scenes cover 100% of the script
"""

    def _build_filename(si: int, ii: int) -> str:
        return f"{prefix}_s{si+1:03d}_img{ii+1:03d}.png"

    def _parse_json(raw: str):
        """Robust JSON extraction — strips markdown fences, finds outer braces."""
        raw = raw.replace("```json", "").replace("```", "").strip()
        start = raw.find("{")
        end   = raw.rfind("}") + 1
        if start < 0 or end <= start:
            start = raw.find("[")
            end   = raw.rfind("]") + 1
            if start < 0 or end <= start:
                raise ValueError("No JSON found in Gemini response")
        return json.loads(raw[start:end])

    def _call_gemini_with_key(prompt: str, key: str, model: str = "gemini-flash-latest", timeout: int = 60) -> str:
        """Call Gemini using a specific key (bypasses key rotation — caller manages keys)."""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"maxOutputTokens": 8192, "responseMimeType": "application/json"}
        }
        for attempt in range(3):
            try:
                resp = requests.post(url, json=payload, timeout=timeout)
                if resp.status_code == 200:
                    data = resp.json()
                    return data["candidates"][0]["content"]["parts"][0]["text"]
                elif resp.status_code == 429:
                    print(f"[studio][key {key[:12]}...] 429 on attempt {attempt+1}, waiting 5s...")
                    time.sleep(5)
                    continue
                else:
                    raise Exception(f"HTTP {resp.status_code}: {resp.text[:120]}")
            except Exception as ex:
                if attempt < 2:
                    print(f"[studio][key {key[:12]}...] Exception: {ex} — retry {attempt+2}")
                    time.sleep(3)
                else:
                    raise
        raise Exception(f"All 3 attempts failed for key {key[:12]}...")

    # ── Get pool of keys for per-scene rotation ──────────────────────────────
    raw_keys = os.environ.get("GEMINI_API_KEYS") or os.environ.get("GEMINI_API_KEY") or ""
    key_pool  = [k.strip() for k in raw_keys.replace("\n", ",").split(",") if k.strip()]
    primary_model = os.environ.get("GEMINI_PRIMARY_MODEL") or "gemini-flash-latest"

    try:
        # ── PHASE 1: Plan the scene structure (small, fast call) ─────────────
        scene_plan_prompt = f"""You are a video scene planner.

VIDEO: "{title}" ({video_type}, {aspect})
SCRIPT ({word_count} words, ~{est_dur_secs}s at 140 wpm):
{script}

Plan the scenes. Each scene = 10-15 seconds of narration.
{"Max 18 scenes for shorts (<=180s)." if video_type == "short" else "No scene limit for long videos."}

Return JSON only — no markdown:
{{"scenes": [
  {{"scene_index": 1, "scene_title": "...", "script_excerpt": "exact sentence(s) from script for this scene", "scene_duration_s": 12}},
  ...
]}}"""

        print(f"[studio] PHASE 1: Planning scene structure with {primary_model}...")
        key1 = key_pool[0] if key_pool else ""
        if not key1:
            raise Exception("No API keys available")
        plan_raw  = _call_gemini_with_key(scene_plan_prompt, key1, primary_model, timeout=45)
        plan_data = _parse_json(plan_raw)
        scene_plan = plan_data if isinstance(plan_data, list) else plan_data.get("scenes", [])
        if not scene_plan:
            raise ValueError("Scene planner returned no scenes")
        print(f"[studio] PHASE 1 done — {len(scene_plan)} scenes planned.")

        # ── PHASE 2: Generate image prompts per-scene, rotating keys ─────────
        scenes       = []
        total_images = 0
        n_keys       = len(key_pool)

        for si, sp in enumerate(scene_plan):
            scene_title   = sp.get("scene_title", f"Scene {si+1}")
            excerpt       = sp.get("script_excerpt", "") or sp.get("narration", "")
            duration_s    = sp.get("scene_duration_s", 12)
            n_imgs        = max(8, min(15, round(duration_s * 0.9)))

            # Rotate key: scene 0 → key[1 % n], scene 1 → key[2 % n], etc.
            key_idx  = (si + 1) % n_keys
            scene_key = key_pool[key_idx]
            eg_fns    = [_build_filename(si, ii) for ii in range(3)]

            img_prompt = f"""Generate {n_imgs} cinematic image prompts for one video scene.

VIDEO: "{title}" — Scene {si+1}: "{scene_title}"
NARRATION: {excerpt}
ASPECT: {aspect}
STYLE PREFIX (include verbatim at start of every prompt): {style_defaults}.
NEGATIVE (include verbatim at end): Negative: {negative}.

Rules:
- Every prompt is UNIQUE — specific visual, specific angle
- Same location/mood per scene, vary framing: wide, mid, close, overhead, low
- Include filename exactly: "Save this image as: <filename>."
- Filenames: {eg_fns[0]}, {eg_fns[1]}, {eg_fns[2]}, ... up to {_build_filename(si, n_imgs-1)}

Return JSON only — no markdown:
{{"images": [
  {{"image_index": 1, "filename": "{eg_fns[0]}", "scene_description": "...", "prompt": "{style_defaults}. <specific visual>. Save this image as: {eg_fns[0]}. Negative: {negative}."}},
  ...
]}}"""

            print(f"[studio] PHASE 2 — Scene {si+1}/{len(scene_plan)}: generating {n_imgs} prompts with key[{key_idx}]...")
            try:
                img_raw  = _call_gemini_with_key(img_prompt, scene_key, primary_model, timeout=60)
                img_data = _parse_json(img_raw)
                imgs_raw = img_data if isinstance(img_data, list) else img_data.get("images", [])
                imgs = []
                for ii, img in enumerate(imgs_raw[:n_imgs]):
                    fn = _build_filename(si, ii)
                    img["image_index"]  = ii + 1
                    img["filename"]     = fn
                    img["aspect_ratio"] = aspect
                    if fn not in img.get("prompt", ""):
                        img["prompt"] = img.get("prompt", "").rstrip(".") + f" Save this image as: {fn}."
                    imgs.append(img)
                print(f"[studio]   ✓ Scene {si+1}: {len(imgs)} image prompts generated.")
            except Exception as scene_err:
                print(f"[studio]   ✗ Scene {si+1} Gemini failed: {scene_err} — using fallback prompts")
                imgs = []
                ANGLE_VARIATIONS = ["extreme close-up", "medium shot", "wide shot", "overhead view", "low-angle hero shot", "over-the-shoulder", "tight portrait", "dramatic silhouette", "three-quarter angle", "dutch tilt"]
                for ii in range(n_imgs):
                    fn = _build_filename(si, ii)
                    angle = ANGLE_VARIATIONS[ii % len(ANGLE_VARIATIONS)]
                    imgs.append({
                        "image_index":       ii + 1,
                        "filename":          fn,
                        "scene_description": f"{angle.capitalize()} of: {excerpt[:80]}",
                        "prompt":            f"{style_defaults}. {angle} — {excerpt[:120].rstrip('.')} — dramatic cinematic mood, rich colors, ultra detailed. Save this image as: {fn}. Negative: {negative}.",
                        "aspect_ratio":      aspect,
                    })

            total_images += len(imgs)
            scenes.append({
                "scene_index":      si + 1,
                "scene_title":      scene_title,
                "script_excerpt":   excerpt,
                "scene_duration_s": duration_s,
                "images":           imgs,
            })
            # Small pace between scenes to avoid hitting per-key limits
            if si < len(scene_plan) - 1:
                time.sleep(1.5)

        all_fallback = all(not s["images"] or all("Save this image as" in i.get("prompt","") and "extreme close-up" in i.get("scene_description","").lower() or "medium shot" in i.get("scene_description","").lower() for i in s["images"]) for s in scenes)

        return jsonify({
            "estimated_duration_s": est_dur_secs,
            "scene_count":          len(scenes),
            "total_images":         total_images,
            "aspect_ratio":         aspect,
            "video_type":           video_type,
            "short_warning":        short_warning,
            "word_count":           word_count,
            "scenes":               scenes,
            "fallback":             False,
        })

    except Exception as e:
        print(f"[studio] Full generation failed: {e} — building scene-specific fallback")

        # ── Scene-specific fallback: split script by sentences ───────────────
        import re as _re
        sentences  = [s.strip() for s in _re.split(r'(?<=[.!?])\s+', script.strip()) if s.strip()]
        n_scenes   = min(max_scenes, max(3, est_dur_secs // 12))
        chunk_size = max(1, len(sentences) // n_scenes)

        # Per-scene visual keywords derived from the sentence content
        ANGLE_VARIATIONS = [
            "extreme close-up macro shot",
            "medium shot from slightly below",
            "wide establishing shot",
            "overhead bird's-eye view",
            "low-angle hero shot",
            "over-the-shoulder perspective",
            "tight portrait framing",
            "dramatic side profile silhouette",
            "three-quarter angle cinematic",
            "dutch tilt dramatic angle",
        ]

        scenes       = []
        total_images = 0

        for si in range(n_scenes):
            chunk_sents = sentences[si * chunk_size: (si + 1) * chunk_size]
            excerpt     = " ".join(chunk_sents) if chunk_sents else f"Scene {si+1} of {title}"
            # Extract a core visual noun from the excerpt (first meaningful words)
            core_words  = " ".join(excerpt.split()[:8])

            n_imgs = 10  # default per scene for fallback
            imgs   = []
            for ii in range(n_imgs):
                fn    = _build_filename(si, ii)
                angle = ANGLE_VARIATIONS[ii % len(ANGLE_VARIATIONS)]
                prompt = (
                    f"{style_defaults}. "
                    f"{angle} — {excerpt[:120].rstrip('.')} — "
                    f"dramatic cinematic mood, rich color palette, "
                    f"high contrast lighting, ultra detailed. "
                    f"Save this image as: {fn}. "
                    f"Negative: {negative}."
                )
                imgs.append({
                    "image_index":       ii + 1,
                    "filename":          fn,
                    "scene_description": f"{angle.capitalize()} of: {core_words}",
                    "prompt":            prompt,
                    "aspect_ratio":      aspect,
                })
            total_images += n_imgs
            scenes.append({
                "scene_index":      si + 1,
                "scene_title":      f"Scene {si+1} — {' '.join(excerpt.split()[:5])}…",
                "script_excerpt":   excerpt,
                "scene_duration_s": max(10, est_dur_secs // n_scenes),
                "images":           imgs,
            })

        return jsonify({
            "estimated_duration_s": est_dur_secs,
            "scene_count":          n_scenes,
            "total_images":         total_images,
            "aspect_ratio":         aspect,
            "video_type":           video_type,
            "short_warning":        short_warning,
            "word_count":           word_count,
            "scenes":               scenes,
            "fallback":             True,
            "fallback_reason":      str(e),
        })


@app.route("/api/studio/regenerate_prompt", methods=["POST"])
def studio_regenerate_prompt():
    """Regenerate a single image prompt using AI or visual variation engine."""
    req            = request.json or {}
    title          = req.get("title", "Video")
    video_type     = req.get("video_type", "short")
    script_excerpt = req.get("script_excerpt", "")
    filename       = req.get("filename", "short_s001_img001.png")
    
    aspect = "9:16" if video_type == "short" else "16:9"
    style_defaults = (
        "Vertical portrait 9:16 composition, subject centered in frame, full subject visible, golden hour light, photorealistic 8k, crisp focal detail, macro 85mm f/1.4 lens, shallow depth of field"
        if video_type == "short" else
        "Widescreen 16:9 cinematic shot, rule of thirds, expansive view, warm amber light, 8k wallpaper quality, anamorphic lens flare, shallow depth of field, cinematic color grade"
    )
    negative = "nudity, naked, nsfw, explicit, sexual, uncensored, watermarks, text overlay, logo, blurry, low quality, cropped head, missing limbs, bad anatomy"
    
    prompt_text = None
    scene_desc  = ""
    if os.environ.get("GEMINI_API_KEY"):
        p = f"""Create 1 cinematic image prompt for video '{title}'.
Aspect ratio: {aspect}.
Scene excerpt: "{script_excerpt}".
Save filename: {filename}.
Start prompt with: "{style_defaults}."
End prompt with: "Negative: {negative}."
Return JSON: {{"prompt": "...", "scene_description": "..."}}"""
        try:
            raw = call_gemini(p, timeout=20, json_mode=True)
            d = json.loads(raw)
            prompt_text = d.get("prompt")
            scene_desc  = d.get("scene_description", "")
        except Exception:
            prompt_text = None

    if not prompt_text:
        import random
        angles = [
            "dramatic close-up reaction shot", "wide cinematic establishing shot",
            "low-angle heroic perspective", "overhead aerial view", "shallow depth of field portrait",
            "dynamic action freeze-frame", "atmospheric backlight silhouette", "intense focal macro view"
        ]
        chosen_angle = random.choice(angles)
        prompt_text = (
            f"{style_defaults}. {chosen_angle} — {script_excerpt[:120].rstrip('.')} — "
            f"dramatic cinematic lighting, rich colors, 8k quality. Save this image as: {filename}. "
            f"Negative: {negative}."
        )
        scene_desc = f"{chosen_angle.capitalize()} visualizing beat: '{script_excerpt[:60]}...'"

    return jsonify({"filename": filename, "prompt": prompt_text, "scene_description": scene_desc})


@app.route("/api/studio/regenerate_scene", methods=["POST"])
def studio_regenerate_scene():
    """Regenerate all image prompts for a single scene."""
    req            = request.json or {}
    title          = req.get("title", "Video")
    video_type     = req.get("video_type", "short")
    scene_index    = req.get("scene_index", 0)
    script_excerpt = req.get("script_excerpt", "")
    image_count    = req.get("image_count", 10)
    
    prefix = "short" if video_type == "short" else "long"
    aspect = "9:16" if video_type == "short" else "16:9"
    style_defaults = (
        "Vertical portrait 9:16 composition, subject centered in frame, full subject visible, golden hour light, photorealistic 8k, crisp focal detail, macro 85mm f/1.4 lens, shallow depth of field"
        if video_type == "short" else
        "Widescreen 16:9 cinematic shot, rule of thirds, expansive view, warm amber light, 8k wallpaper quality, anamorphic lens flare, shallow depth of field, cinematic color grade"
    )
    negative = "nudity, naked, nsfw, explicit, sexual, uncensored, watermarks, text overlay, logo, blurry, low quality, cropped head, missing limbs, bad anatomy"

    def _build_fn(s_idx, i_idx):
        return f"{prefix}_s{s_idx+1:03d}_img{i_idx+1:03d}.png"

    images = []
    if os.environ.get("GEMINI_API_KEY"):
        p = f"""Create {image_count} cinematic image prompts for Scene {scene_index+1} of '{title}'.
Excerpt: "{script_excerpt}".
Filenames: {_build_fn(scene_index, 0)} to {_build_fn(scene_index, image_count-1)}.
Start prompts with: "{style_defaults}."
End prompts with: "Negative: {negative}."
Return JSON: {{"images": [{{"filename": "...", "prompt": "...", "scene_description": "..."}}]}}"""
        try:
            raw = call_gemini(p, timeout=40, json_mode=True)
            d = json.loads(raw)
            images = d.get("images") or []
        except Exception:
            images = []

    if not images:
        ANGLE_VARIATIONS = [
            "extreme close-up macro shot", "medium shot from slightly below",
            "wide establishing shot", "overhead bird's-eye view", "low-angle hero shot",
            "over-the-shoulder perspective", "tight portrait framing", "dramatic side profile silhouette",
            "three-quarter angle cinematic", "dutch tilt dramatic angle"
        ]
        images = []
        for ii in range(image_count):
            fn = _build_fn(scene_index, ii)
            angle = ANGLE_VARIATIONS[ii % len(ANGLE_VARIATIONS)]
            prompt = (
                f"{style_defaults}. {angle} — {script_excerpt[:120].rstrip('.')} — "
                f"dramatic cinematic mood, rich color palette, high contrast lighting. "
                f"Save this image as: {fn}. Negative: {negative}."
            )
            images.append({
                "filename": fn,
                "prompt": prompt,
                "scene_description": f"{angle.capitalize()} visualizing '{script_excerpt[:50]}...'"
            })

    return jsonify({"scene_index": scene_index, "images": images})


OUTPUT_ROOT = PROJECT_ROOT / "packages" / "ClipPilot" / "output"
MY_VIDEOS_ROOT = PROJECT_ROOT / "packages" / "ClipPilot" / "my_videos"
_RENDER_JOBS: dict = {}   # job_id → status dict (in-memory)


def _slugify(text: str) -> str:
    text = re.sub(r'[^\w\s-]', '', text).strip().lower()
    return re.sub(r'[-\s]+', '_', text)[:50] or "video"


@app.route("/api/studio/create_project", methods=["POST"])
def studio_create_project():
    """Create output/<date>/<slug>/ project folder, generate py maker script, and save studio_meta.json."""
    req      = request.json or {}
    title    = req.get("title", "").strip()
    script   = req.get("script", "").strip()
    keywords = req.get("keywords", [])
    tags     = req.get("tags", [])
    video_type    = req.get("video_type", "short")
    duration_hint = int(req.get("duration_hint", 60))
    prompts       = req.get("prompts", [])

    if not title:
        return jsonify({"error": "Missing title"}), 400

    if isinstance(keywords, str):
        keywords = [k.strip() for k in keywords.split(",") if k.strip()]
    if isinstance(tags, str):
        tags = [t.strip().lstrip("#") for t in tags.split(",") if t.strip()]

    date_str    = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    slug        = _slugify(title)
    project_dir = OUTPUT_ROOT / date_str / slug
    images_dir  = project_dir / "images"
    project_dir.mkdir(parents=True, exist_ok=True)
    images_dir.mkdir(exist_ok=True)

    # ── Auto-generate Python creator script in my_videos/<date>/ ──────────────
    script_dir  = MY_VIDEOS_ROOT / date_str
    script_dir.mkdir(parents=True, exist_ok=True)
    script_file = script_dir / f"make_{slug}_explainer.py"

    py_code = f'''"""Make a 60 FPS animated explainer video for: '{title}'

Format  : {'9:16 vertical' if video_type == 'short' else '16:9 widescreen'}
Output  : {project_dir}
Manifest: {project_dir / "manifest.json"}

Run via CLI:
    cd {PROJECT_ROOT / "packages" / "ClipPilot"}
    PYTHONPATH="$PWD/src" python3 my_videos/{date_str}/{script_file.name}
"""
import json
import sys
from pathlib import Path

TITLE      = {json.dumps(title)}
SCRIPT     = {json.dumps(script)}
KEYWORDS   = {json.dumps(keywords)}
TAGS       = {json.dumps(tags)}
VIDEO_TYPE = {json.dumps(video_type)}
PROJECT_DIR= Path({json.dumps(str(project_dir))})

if __name__ == "__main__":
    print(f"🎬 Explainer Script for: {{TITLE}}")
    print(f"Output Directory : {{PROJECT_DIR}}")
    print(f"Video Type       : {{VIDEO_TYPE}} (60 FPS, CRF 16)")
    print(f"Manifest Path    : {{PROJECT_DIR / 'manifest.json'}}")
'''
    script_file.write_text(py_code, encoding="utf-8")

    project_id = f"{date_str}/{slug}"
    meta = {
        "project_id":    project_id,
        "date":          date_str,
        "slug":          slug,
        "title":         title,
        "script":        script,
        "keywords":      keywords,
        "tags":          tags,
        "video_type":    video_type,
        "duration_hint": duration_hint,
        "prompts":       prompts,
        "py_script":     str(script_file.relative_to(PROJECT_ROOT)),
        "created_at":    datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "status":        "awaiting_images",
        "images_uploaded": 0,
    }
    (project_dir / "studio_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    return jsonify({
        "success":        True,
        "project_id":     project_id,
        "date":           date_str,
        "slug":           slug,
        "images_dir":     str(images_dir),
        "py_script":     str(script_file.relative_to(PROJECT_ROOT)),
        "expected_images": [p["filename"] for p in prompts],
    })


def studio_upload_image(project_id):
    """Save an uploaded image into output/<project_id>/images/."""
    project_dir = OUTPUT_ROOT / project_id
    if not project_dir.exists():
        return jsonify({"error": f"Project not found: {project_id}"}), 404

    images_dir = project_dir / "images"
    images_dir.mkdir(exist_ok=True)

    image_file = request.files.get("image")
    filename   = request.form.get("filename") or (image_file.filename if image_file else None)

    if not image_file:
        return jsonify({"error": "Missing file field: image"}), 400
    if not filename:
        return jsonify({"error": "Missing filename"}), 400

    safe_name = Path(filename).name
    image_file.save(str(images_dir / safe_name))

    all_imgs = (
        list(images_dir.glob("*.png")) +
        list(images_dir.glob("*.jpg")) +
        list(images_dir.glob("*.jpeg")) +
        list(images_dir.glob("*.webp"))
    )
    total = len(all_imgs)

    meta_path = project_dir / "studio_meta.json"
    if meta_path.exists():
        meta     = json.loads(meta_path.read_text(encoding="utf-8"))
        expected = len(meta.get("prompts", []))
        meta["status"]          = "ready_to_render" if total >= expected else f"uploading ({total}/{expected})"
        meta["images_uploaded"] = total
        meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")

    return jsonify({"success": True, "filename": safe_name, "total_uploaded": total})


def _run_render_job(job_id: str, project_dir: Path, meta: dict):
    """Run the full ClipPilot pipeline in a background thread."""
    _RENDER_JOBS[job_id]["status"] = "running"
    log_lines: list[str] = []

    def log(msg: str):
        print(f"[RENDER {job_id}] {msg}")
        log_lines.append(msg)
        _RENDER_JOBS[job_id]["log"] = "\n".join(log_lines)

    try:
        clip_src = PROJECT_ROOT / "packages" / "ClipPilot" / "src"
        if str(clip_src) not in sys.path:
            sys.path.insert(0, str(clip_src))

        from clippilot.generate import assemble as A
        from clippilot.media import captions as C
        from clippilot.media import edit as E
        from clippilot.media import signals, tts

        images_dir = project_dir / "images"
        script     = meta.get("script") or meta.get("title", "")
        title      = meta.get("title", "Video")
        video_type = meta.get("video_type", "short")
        keywords   = meta.get("keywords", [])
        tags       = meta.get("tags", [])
        date_str   = meta.get("date", datetime.datetime.utcnow().strftime("%Y-%m-%d"))
        slug       = meta.get("slug", "video")
        prompts_list = meta.get("prompts", [])

        # Collect images sorted by filename
        all_imgs = sorted(
            list(images_dir.glob("*.png")) +
            list(images_dir.glob("*.jpg")) +
            list(images_dir.glob("*.jpeg")) +
            list(images_dir.glob("*.webp"))
        )
        image_paths = [str(p) for p in all_imgs]
        log(f"Found {len(image_paths)} images in {images_dir}")

        if not image_paths:
            raise Exception("No images found in images/ — upload images first")

        # ── Step 1: TTS Narration ──────────────────────────────────────────
        log("Step 1/5: Synthesizing narration (edge-tts 48 kHz)...")
        wav = str(project_dir / "narration.wav")
        res = tts.synthesize(script, wav)
        if not res.get("available"):
            raise Exception(f"TTS failed: {res.get('reason')}")
        duration = signals.probe(wav).duration_s or 0.0
        log(f"  Narration: {duration:.1f}s  ({len(script.split())} words)")

        # ── Step 2: 60 FPS Ken-Burns slideshow ────────────────────────────
        base = str(project_dir / "base.mp4")
        log("Step 2/5: Building 60 FPS Ken-Burns slideshow...")
        video = A.assemble_slideshow(image_paths, wav, base, fps=60)
        if not video:
            log("  Falling back to animated gradient title card...")
            video = A.assemble_short(wav, base, title=title, fps=60)
        if not video:
            raise Exception("Slideshow assembly failed — check ffmpeg")
        log("  Base video ready")

        # ── Step 3: Karaoke captions ───────────────────────────────────────
        log("Step 3/5: Generating karaoke captions...")
        from clippilot.media import transcribe as TR
        words_list: list = []
        if TR.whisper_available():
            try:
                tr = TR.transcribe(video, model_size="base")
                words_list = tr.get("words") or []
            except Exception as exc:
                log(f"  Whisper unavailable: {exc}")

        COMBINE_MS = 820
        timing_src = "tts-estimate"
        if words_list:
            pages = C.pages_for_clip(words_list, 0.0, duration, combine_within_ms=COMBINE_MS)
            if pages:
                timing_src = "whisper"
            else:
                words_list = []

        if not words_list:
            toks = tts.word_timings(script, duration)
            raw_pages = C.create_tiktok_style_captions(toks, combine_within_ms=COMBINE_MS)["pages"]
            pages = []
            for p in raw_pages:
                start = p["start_ms"] / 1000.0
                dur_p = p["duration_ms"]
                end   = start + (dur_p / 1000.0 if math.isfinite(dur_p) and dur_p > 0 else 2.0)
                pages.append({"start": round(start, 3), "end": round(end, 3), "tokens": p.get("tokens", [])})

        log(f"  {len(pages)} caption pages ({timing_src})")
        w, h = (1080, 1920) if video_type == "short" else (1920, 1080)
        ass   = str(project_dir / "captions.ass")
        style = E.skin_style("karaoke_yellow")
        E.write_ass_karaoke(pages, ass, width=w, height=h, **style)
        p_ass = Path(ass)
        p_ass.write_text(p_ass.read_text(encoding="utf-8").replace("WrapStyle: 2", "WrapStyle: 0"), encoding="utf-8")

        # ── Step 4: Burn captions → Final MP4 ─────────────────────────────
        log("Step 4/5: Burning captions into final video...")
        final_name = f"Final_{slug}.mp4"
        final_path = str(project_dir / final_name)
        final = E.burn_subtitles(video, ass, final_path)
        if not final:
            raise Exception("Caption burn-in failed — check ffmpeg / libass")
        log(f"  Final: {final_name}")

        # ── Step 5: manifest.json ──────────────────────────────────────────
        log("Step 5/5: Writing manifest.json...")
        per_dur  = duration / max(1, len(image_paths))
        timeline = []
        for idx, img_path in enumerate(image_paths):
            st = idx * per_dur
            et = min(duration, (idx + 1) * per_dur)
            pe = prompts_list[idx] if idx < len(prompts_list) else {}
            slide_f = project_dir / f"slide_{idx:02d}.mp4"
            cap_text = (
                pages[idx]["tokens"][0]["text"]
                if idx < len(pages) and pages[idx].get("tokens")
                else title
            )
            timeline.append({
                "clip_index":       idx,
                "start_s":          round(st, 2),
                "end_s":            round(et, 2),
                "duration_s":       round(et - st, 2),
                "image_path":       str(Path(img_path).resolve()),
                "slide_video_path": str(slide_f.resolve()) if slide_f.exists() else None,
                "keyword":          keywords[idx % len(keywords)] if keywords else "",
                "prompt":           pe.get("prompt", ""),
                "caption_text":     cap_text,
                "filename":         pe.get("filename", Path(img_path).name),
            })

        aspect_ratio = "9:16" if video_type == "short" else "16:9"
        resolution   = "1080x1920 @ 60FPS" if video_type == "short" else "1920x1080 @ 60FPS"
        hashtags     = (["#shorts"] if video_type == "short" else ["#youtube"]) + [f"#{t}" for t in tags[:6]]

        manifest = {
            "project_info": {
                "id":         f"{date_str}/{slug}",
                "created_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "status":     "ready_to_upload",
                "generation_params": {
                    "title":         title,
                    "script":        script,
                    "keywords":      keywords,
                    "tags":          tags,
                    "video_type":    video_type,
                    "duration_hint": meta.get("duration_hint", 60),
                    "target_fps":    60,
                    "target_crf":    16,
                    "aspect_ratio":  aspect_ratio,
                },
            },
            "assets": {
                "video_path":       str(Path(final).resolve()),
                "final_video_name": final_name,
                "narration_path":   wav,
                "captions_path":    ass,
                "images_dir":       str((project_dir / "images").resolve()),
                "image_count":      len(image_paths),
                "aspect_ratio":     aspect_ratio,
                "resolution":       resolution,
                "fps":              60,
                "quality_crf":      16,
                "audio_sample_rate": 48000,
                "audio_bitrate":    "320k",
                "duration_s":       round(duration, 2),
                "image_timeline":   timeline,
            },
            "master_metadata": {
                "title":       title,
                "description": f"Discover the fascinating truth about {title}. Watch till the end!",
                "hashtags":    hashtags,
                "video_tags":  keywords,
                "language":    "en",
            },
            "platforms": {
                "youtube":       {"enabled": True, "title": title,
                                  "description": f"{title}\n\n" + " ".join(hashtags),
                                  "hashtags": [h.lstrip("#") for h in hashtags],
                                  "video_tags": keywords, "scheduled_at": "",
                                  "privacy": "private", "category_id": "28"},
                "instagram":     {"enabled": True, "caption": f"{title}\n\n" + " ".join(hashtags[:5]), "scheduled_at": ""},
                "tiktok":        {"enabled": True, "caption": f"{title} " + " ".join(hashtags[:5]), "scheduled_at": ""},
                "facebook_reels":{"enabled": True, "caption": f"{title}\n\n" + " ".join(hashtags), "scheduled_at": ""},
                "x":             {"enabled": True, "caption": f"{title} " + " ".join(hashtags[:3]), "scheduled_at": ""},
                "threads":       {"enabled": True, "caption": f"{title}\n\n" + " ".join(hashtags), "scheduled_at": ""},
                "snapchat":      {"enabled": True, "caption": title, "scheduled_at": ""},
            },
        }

        manifest_path = project_dir / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

        size_mb = Path(final).stat().st_size / (1024 * 1024)
        log(f"\n[OK] Done! {duration:.1f}s · {resolution} · {size_mb:.1f} MB")

        _RENDER_JOBS[job_id].update({
            "status":        "done",
            "video_path":    str(Path(final).relative_to(OUTPUT_ROOT)),
            "manifest_path": str(manifest_path.relative_to(OUTPUT_ROOT)),
            "duration_s":    round(duration, 2),
            "resolution":    resolution,
            "size_mb":       round(size_mb, 2),
        })

    except Exception as exc:
        import traceback
        log(f"\n[ERROR] {exc}\n{traceback.format_exc()}")
        _RENDER_JOBS[job_id]["status"] = "error"
        _RENDER_JOBS[job_id]["error"]  = str(exc)


@app.route("/api/studio/render/<path:project_id>", methods=["POST"])
def studio_render(project_id):
    """Kick off the rendering pipeline for a studio project (non-blocking)."""
    project_dir = OUTPUT_ROOT / project_id
    meta_path   = project_dir / "studio_meta.json"
    if not project_dir.exists():
        return jsonify({"error": f"Project not found: {project_id}"}), 404
    if not meta_path.exists():
        return jsonify({"error": "studio_meta.json not found in project"}), 404

    meta   = json.loads(meta_path.read_text(encoding="utf-8"))
    job_id = str(uuid.uuid4())[:8]
    _RENDER_JOBS[job_id] = {
        "status":        "starting",
        "project_id":    project_id,
        "log":           "Initializing pipeline…",
        "video_path":    None,
        "manifest_path": None,
        "error":         None,
    }
    threading.Thread(target=_run_render_job, args=(job_id, project_dir, meta), daemon=True).start()
    return jsonify({"job_id": job_id, "status": "starting"})


@app.route("/api/studio/render_status/<job_id>", methods=["GET"])
def studio_render_status(job_id):
    """Poll render job status."""
    job = _RENDER_JOBS.get(job_id)
    if not job:
        return jsonify({"error": f"Job not found: {job_id}"}), 404
    return jsonify(job)


@app.route("/api/studio/projects", methods=["GET"])
def studio_list_projects():
    """List all studio projects under output/."""
    projects = []
    if OUTPUT_ROOT.exists():
        for date_dir in sorted(OUTPUT_ROOT.iterdir(), reverse=True):
            if not date_dir.is_dir() or date_dir.name.startswith("."):
                continue
            for proj_dir in sorted(date_dir.iterdir(), reverse=True):
                if not proj_dir.is_dir():
                    continue
                meta_path = proj_dir / "studio_meta.json"
                if not meta_path.exists():
                    continue
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
                finals   = list(proj_dir.glob("Final_*.mp4"))
                fin_path = str(finals[0].relative_to(OUTPUT_ROOT)) if finals else None
                
                # Check uploaded images count
                images_dir = proj_dir / "images"
                img_count  = len(list(images_dir.glob("*"))) if images_dir.exists() else 0

                projects.append({
                    "project_id":      f"{date_dir.name}/{proj_dir.name}",
                    "title":           meta.get("title", proj_dir.name),
                    "script":          meta.get("script", ""),
                    "keywords":        meta.get("keywords", []),
                    "tags":            meta.get("tags", []),
                    "date":            date_dir.name,
                    "slug":            proj_dir.name,
                    "video_type":      meta.get("video_type", "short"),
                    "status":          meta.get("status", "unknown"),
                    "has_manifest":    (proj_dir / "manifest.json").exists(),
                    "final_video":     fin_path,
                    "created_at":      meta.get("created_at", ""),
                    "images_uploaded": img_count,
                    "total_prompts":   len(meta.get("prompts", [])),
                    "py_script":       meta.get("py_script", ""),
                })
    return jsonify(projects)


@app.route("/api/studio/project/<path:project_id>", methods=["GET"])
def studio_get_project(project_id):
    """Get complete details for a single project including meta, manifest, and uploaded images."""
    project_dir = OUTPUT_ROOT / project_id
    if not project_dir.exists():
        return jsonify({"error": f"Project not found: {project_id}"}), 404

    meta_path = project_dir / "studio_meta.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}

    manifest_path = project_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else None

    images_dir = project_dir / "images"
    uploaded_files = [f.name for f in images_dir.glob("*") if f.is_file()] if images_dir.exists() else []

    finals = list(project_dir.glob("Final_*.mp4"))
    fin_path = str(finals[0].relative_to(OUTPUT_ROOT)) if finals else None

    return jsonify({
        "project_id":     project_id,
        "meta":           meta,
        "manifest":       manifest,
        "uploaded_files": uploaded_files,
        "final_video":    fin_path,
    })


@app.route("/api/studio/project/<path:project_id>", methods=["DELETE", "OPTIONS"])
def studio_delete_project(project_id):
    """Delete a studio project (output directory + python script)."""
    if request.method == "OPTIONS":
        return jsonify({}), 200

    project_dir = OUTPUT_ROOT / project_id
    if not project_dir.exists():
        return jsonify({"error": f"Project not found: {project_id}"}), 404

    try:
        # Force permission fix if needed and delete output directory
        def _on_rm_error(func, path, exc_info):
            import stat
            os.chmod(path, stat.S_IWRITE)
            func(path)

        shutil.rmtree(project_dir, onerror=_on_rm_error)

        # Delete corresponding .py creator script if it exists
        parts = project_id.split("/")
        if len(parts) == 2:
            date_str, slug = parts[0], parts[1]
            script_file = MY_VIDEOS_ROOT / date_str / f"make_{slug}_explainer.py"
            if script_file.exists():
                try:
                    script_file.unlink()
                except Exception:
                    pass
            
            # Clean up date folder if empty
            out_date_dir = OUTPUT_ROOT / date_str
            if out_date_dir.exists() and not any(out_date_dir.iterdir()):
                try:
                    out_date_dir.rmdir()
                except Exception:
                    pass

        return jsonify({"success": True, "message": f"Deleted project {project_id}"})
    except Exception as e:
        return jsonify({"error": f"Failed to delete project: {str(e)}"}), 500


@app.route("/studio/video/<path:filepath>", methods=["GET"])
def serve_studio_video(filepath):
    """Serve studio final MP4 files."""
    full_path = OUTPUT_ROOT / filepath
    if full_path.exists():
        return send_file(full_path, mimetype="video/mp4")
    return jsonify({"error": "Video not found"}), 404


if __name__ == "__main__":
    port = int(os.environ.get("SERVER_PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=True)
