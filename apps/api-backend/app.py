import os
import sys
import json
import subprocess
import requests
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

def call_gemini(prompt: str) -> str:
    """Helper to execute Gemini REST API requests using free-tier Gemini models configured via ENV."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise Exception("GEMINI_API_KEY is missing in .env")
    
    primary_model = os.environ.get("GEMINI_PRIMARY_MODEL") or os.environ.get("GEMINI_MODEL") or "gemini-2.0-flash"
    fallback_model = os.environ.get("GEMINI_CANDIDATE_MODEL") or os.environ.get("GEMINI_FALLBACK_MODEL") or "gemini-2.0-flash-lite"
    
    candidate_models = [primary_model, fallback_model]
    models = list(dict.fromkeys([m for m in candidate_models if m]))
    
    last_err = None
    for model in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        payload = {"contents": [{"parts": [{"text": prompt}]}]}
        
        # Try up to 2 attempts per model with short retry delay for 429
        for attempt in range(2):
            try:
                resp = requests.post(url, json=payload, timeout=30)
                if resp.status_code == 200:
                    data = resp.json()
                    try:
                        return data["candidates"][0]["content"]["parts"][0]["text"]
                    except (KeyError, IndexError):
                        raise Exception("Invalid response structure from Gemini API")
                elif resp.status_code == 429:
                    last_err = f"Gemini API Rate Limit (429) on {model}"
                    time.sleep(1.2) # Wait briefly for per-second/minute token bucket
                    continue
                else:
                    last_err = f"Gemini API Error ({resp.status_code}) on {model}: {resp.text}"
                    break
            except Exception as e:
                last_err = str(e)
            
    raise Exception(f"Gemini API Rate Limited (429): {last_err}")

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


if __name__ == "__main__":
    port = int(os.environ.get("SERVER_PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=True)
