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

def _load_env_file(filepath):
    p = Path(filepath)
    if p.exists():
        with open(p, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ[k.strip()] = v.strip().strip("'\"")

_load_env_file(PROJECT_ROOT / ".env")
_load_env_file(HERE / ".env")

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
def list_videos():
    """List all final generated videos from both OUTPUT_ROOT (new Studio videos) and DATA_DIR."""
    import json as _json
    import datetime
    videos = []
    seen_paths = set()

    # 1. Scan OUTPUT_ROOT (new Studio generated videos)
    if OUTPUT_ROOT.exists():
        for date_dir in sorted(OUTPUT_ROOT.iterdir(), reverse=True):
            if not date_dir.is_dir() or date_dir.name.startswith("."):
                continue
            for proj_dir in sorted(date_dir.iterdir(), reverse=True):
                if not proj_dir.is_dir() or proj_dir.name.startswith("."):
                    continue
                finals = list(proj_dir.glob("Final_*.mp4"))
                if not finals:
                    finals = [
                        f for f in proj_dir.glob("*.mp4")
                        if not f.name.startswith("slide_")
                        and not f.name.startswith("slides_")
                        and not f.name.startswith("mnorm_")
                        and f.name not in ("base.mp4", "silent.mp4", "mmontage_silent.mp4")
                    ]
                if finals:
                    final_video = finals[0]
                    rel_path = str(final_video.relative_to(OUTPUT_ROOT))
                    if rel_path in seen_paths:
                        continue
                    seen_paths.add(rel_path)

                    created_at = None
                    meta_path = proj_dir / "studio_meta.json"
                    if meta_path.exists():
                        try:
                            with open(meta_path, "r", encoding="utf-8") as mf:
                                mdata = _json.load(mf)
                            created_at = mdata.get("created_at") or mdata.get("updated_at")
                        except Exception:
                            pass
                    if not created_at:
                        mtime = final_video.stat().st_mtime
                        created_at = datetime.datetime.fromtimestamp(mtime, datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

                    title = None
                    if meta_path.exists():
                        try:
                            with open(meta_path, "r", encoding="utf-8") as mf:
                                title = _json.load(mf).get("title")
                        except Exception:
                            pass
                    name = title or proj_dir.name.replace("_", " ").title()

                    videos.append({
                        "id": f"{date_dir.name}/{proj_dir.name}",
                        "name": name,
                        "path": rel_path,
                        "filename": final_video.name,
                        "size_mb": round(final_video.stat().st_size / (1024 * 1024), 2),
                        "created_at": created_at,
                        "source": "output",
                    })

    # 2. Scan DATA_DIR (Legacy explainer videos)
    if DATA_DIR.exists():
        for item in sorted(DATA_DIR.iterdir(), reverse=True):
            if item.is_dir() and (item.name.startswith("explainer_") or item.name.startswith("short_")):
                final_video = find_final_video(item)
                if final_video:
                    rel_path = str(final_video.relative_to(DATA_DIR))
                    if rel_path in seen_paths:
                        continue
                    seen_paths.add(rel_path)

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
                        mtime = final_video.stat().st_mtime
                        created_at = datetime.datetime.fromtimestamp(mtime, datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

                    videos.append({
                        "id": item.name,
                        "name": item.name.replace("explainer_", "").replace("short_", "").replace("_", " ").title(),
                        "path": rel_path,
                        "filename": final_video.name,
                        "size_mb": round(final_video.stat().st_size / (1024 * 1024), 2),
                        "created_at": created_at,
                        "source": "data",
                    })

    # Sort newest first by created_at
    videos.sort(key=lambda v: v.get("created_at", ""), reverse=True)
    return jsonify(videos)

@app.route("/video/<path:filepath>", methods=["GET"])
def serve_video(filepath):
    """Serve .mp4 video files to the frontend video player from DATA_DIR or OUTPUT_ROOT."""
    full_path = DATA_DIR / filepath
    if not full_path.exists():
        full_path = OUTPUT_ROOT / filepath
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
    
    primary_model  = os.environ.get("GEMINI_PRIMARY_MODEL") or os.environ.get("GEMINI_MODEL") or "gemini-flash-lite-latest"
    fallback_model = os.environ.get("GEMINI_CANDIDATE_MODEL") or os.environ.get("GEMINI_FALLBACK_MODEL") or "gemini-3.5-flash-lite"
    
    candidate_models = [
        primary_model,
        "gemini-flash-lite-latest",
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash",
        fallback_model,
        "gemini-3.6-flash",
        "gemini-flash-latest"
    ]
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
        video_path = OUTPUT_ROOT / video_rel_path
    if not video_path.exists():
        return jsonify({"error": f"Video file not found: {video_path}"}), 404
        
    base_dir = video_path.parent
    cover_dir = base_dir / "covers"
    cover_dir.mkdir(parents=True, exist_ok=True)
    
    clean_name = video_path.stem.replace(" ", "_")
    cover_filename = f"cover_{clean_name}_{str(timestamp).replace('.', '_')}.jpg"
    cover_path = cover_dir / cover_filename
    
    cmd = [
        "ffmpeg", "-y", "-ss", str(timestamp), "-i", str(video_path),
        "-vframes", "1", "-q:v", "2", str(cover_path)
    ]
    try:
        res = subprocess.run(cmd, capture_output=True)
        if res.returncode != 0 or not cover_path.exists() or cover_path.stat().st_size == 0:
            # Fallback: check for project images to use as cover thumbnail
            imgs = sorted(list((base_dir / "images").glob("*.png")) + list((base_dir / "images").glob("*.jpg")))
            if imgs:
                import shutil
                shutil.copyfile(imgs[0], cover_path)
            else:
                return jsonify({"error": f"Cover extraction failed: FFmpeg returned exit status {res.returncode}"}), 400

        if cover_path.is_relative_to(OUTPUT_ROOT):
            rel_cover = str(cover_path.relative_to(OUTPUT_ROOT))
        else:
            rel_cover = str(cover_path.relative_to(DATA_DIR))
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
    """Serve thumbnail cover images from DATA_DIR or OUTPUT_ROOT."""
    full_path = DATA_DIR / filepath
    if not full_path.exists():
        full_path = OUTPUT_ROOT / filepath
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

    # Resolve project directory (check OUTPUT_ROOT first, then DATA_DIR)
    if Path(video_id).is_absolute():
        project_dir = Path(video_id)
    elif (OUTPUT_ROOT / video_id).exists():
        project_dir = OUTPUT_ROOT / video_id
    else:
        project_dir = DATA_DIR / video_id

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
        # Persist gdrive details into manifest.json and studio_meta.json
        manifest_path = project_dir / "manifest.json"
        if manifest_path.exists():
            try:
                mdata = json.loads(manifest_path.read_text(encoding="utf-8"))
                mdata["gdrive"] = {
                    "drive_file_id": result.get("drive_file_id"),
                    "drive_link": result.get("drive_link"),
                    "upload_name": result.get("upload_name"),
                    "date_folder": result.get("date_folder"),
                    "uploaded_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
                }
                manifest_path.write_text(json.dumps(mdata, indent=2), encoding="utf-8")
            except Exception:
                pass
                
        meta_path = project_dir / "studio_meta.json"
        if meta_path.exists():
            try:
                metadata = json.loads(meta_path.read_text(encoding="utf-8"))
                metadata["gdrive_link"] = result.get("drive_link")
                metadata["gdrive_file_id"] = result.get("drive_file_id")
                meta_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
            except Exception:
                pass

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


def resolve_project_dir(project_id: str):
    """Resolve a project directory from either DATA_DIR or OUTPUT_ROOT."""
    if not project_id:
        return None
    p1 = DATA_DIR / project_id
    if p1.exists() and p1.is_dir():
        return p1
    p2 = OUTPUT_ROOT / project_id
    if p2.exists() and p2.is_dir():
        return p2
    if project_id.startswith("studio_"):
        raw_id = project_id[7:]
        p3 = OUTPUT_ROOT / raw_id
        if p3.exists() and p3.is_dir():
            return p3
    if OUTPUT_ROOT.exists():
        for date_dir in OUTPUT_ROOT.iterdir():
            if date_dir.is_dir() and not date_dir.name.startswith("."):
                candidate = date_dir / project_id
                if candidate.exists() and candidate.is_dir():
                    return candidate
    return None


@app.route("/api/project/<path:project_id>/manifest", methods=["GET"])
def get_project_manifest(project_id):
    """Return per-slide metadata for the Slide Timeline Editor UI."""
    project_dir = resolve_project_dir(project_id)
    if not project_dir:
        return jsonify({"error": f"Project not found: {project_id}"}), 404

    if not _RECOMPOSE_AVAILABLE:
        return jsonify({"error": "recompose module unavailable — check ClipPilot installation"}), 500

    try:
        data = get_slide_metadata(project_dir)
        return jsonify(data)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/project/<path:project_id>/slide_asset/<path:filename>", methods=["GET"])
def serve_slide_asset(project_id, filename):
    """Serve slide broll images for the Web UI timeline thumbnails."""
    project_dir = resolve_project_dir(project_id)
    if not project_dir:
        return jsonify({"error": "Project not found"}), 404
    asset_path = project_dir / filename
    if not asset_path.exists():
        return jsonify({"error": "Asset not found"}), 404

    ext = asset_path.suffix.lower()
    mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".png": "image/png", ".webp": "image/webp"}.get(ext, "application/octet-stream")
    return send_file(asset_path, mimetype=mime)


@app.route("/api/project/<path:project_id>/replace_slide", methods=["POST"])
def replace_slide_endpoint(project_id):
    """Replace a slide's background image and re-render slide_XX.mp4."""
    project_dir = resolve_project_dir(project_id)
    if not project_dir:
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


@app.route("/api/project/<path:project_id>/revert_slide", methods=["POST"])
def revert_slide_endpoint(project_id):
    """Revert a slide to its original broll image."""
    project_dir = resolve_project_dir(project_id)
    if not project_dir:
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


@app.route("/api/project/<path:project_id>/recompose", methods=["POST"])
def recompose_endpoint(project_id):
    """Re-stitch all slide clips, mux with narration, re-burn captions."""
    project_dir = resolve_project_dir(project_id)
    if not project_dir:
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
MY_VIDEOS_ROOT = PROJECT_ROOT / "packages" / "ClipPilot" / "my_videos"
_RENDER_JOBS: dict = {}   # job_id -> status dict (in-memory)


def _slugify(text: str) -> str:
    """Convert title to a safe directory name."""
    import re
    text = re.sub(r"[^\w\s-]", "", text.strip()).lower()
    return re.sub(r"[\s_]+", "_", text)[:50] or "video"


# ── Studio Image Style Presets ───────────────────────────────────────────────
STUDIO_STYLE_PRESETS = {
    "cinematic_photorealism": {
        "name": "Google Flow Nano Banana Pro (Photorealistic 8k)",
        "short_desc": "Vertical portrait 9:16 framing, subject centered in frame, full subject visible, natural skin texture, volumetric cinematic lighting, photorealistic 8k, crisp focal detail, 85mm prime lens, creamy bokeh, authentic physical interactions",
        "long_desc": "Widescreen 16:9 cinematic shot, expansive rule-of-thirds composition, authentic physical interactions, volumetric amber key lighting, photorealistic 8k, 35mm anamorphic prime lens, deep cinematic color grade",
    },
    "investigative_doc": {
        "name": "Investigative Photojournalism (NatGeo / Reuters)",
        "short_desc": "Vertical portrait 9:16 photojournalism style, candid street documentary photography, authentic raw lighting, natural environment, 50mm documentary lens, sharp focal depth",
        "long_desc": "Widescreen 16:9 documentary establishing shot, authentic real-world grit, natural daylight, 35mm photojournalism lens, cinematic realism",
    },
    "cyberpunk_scifi": {
        "name": "Cyberpunk & Futuristic Sci-Fi",
        "short_desc": "Vertical 9:16 high-tech sci-fi aesthetic, glowing neon blue and magenta rim lighting, holographic UI overlays, futuristic machinery and metallic textures, volumetric fog, 8k render",
        "long_desc": "Widescreen 16:9 futuristic cyberpunk panorama, glowing holographic displays, neon street reflections, atmospheric volumetric haze, 8k cinematic render",
    },
    "dark_satire_comedy": {
        "name": "Dark Satire & Comedic Drama",
        "short_desc": "Vertical 9:16 dramatic comedic framing, exaggerated expressive character reactions, vibrant saturated palette, punchy studio key lighting, crisp macro details of storytelling props",
        "long_desc": "Widescreen 16:9 dramatic comedic scene, vibrant rich colors, expressive character actions, theatrical lighting, rich storytelling environment",
    },
    "3d_pixar_animation": {
        "name": "3D Cinematic Animation (Pixar/Unreal 5)",
        "short_desc": "Vertical 9:16 stylized 3D animated character render, soft subsurface scattering skin, expressive animated eyes, vibrant whimsical lighting, Octane render, 8k detail",
        "long_desc": "Widescreen 16:9 3D animated movie still, lush detailed environment, whimsical cinematic lighting, Unreal Engine 5 render, rich textures",
    }
}

STUDIO_NEGATIVE_PROMPT = (
    "nudity, naked, nsfw, pornographic, explicit content, sexual content, "
    "uncensored, revealing clothing, watermark, text overlay, logo, blurry, "
    "low quality, cropped head, missing limbs, bad anatomy, deformed"
)


def _sanitize_prompt_safety(text: str) -> str:
    """Post-processing filter ensuring strict compliance with Google Flow safety filters.
    Currency symbols, exact dollar amounts, and explicit words trigger safety rejections
    which push blocked images to the bottom of the Flow board and break ordering."""
    import re
    # Preserve negative prompt segment as-is
    if "Negative:" in text:
        pos, neg = text.split("Negative:", 1)
        neg_suffix = " Negative:" + neg
    else:
        pos = text
        neg_suffix = ""

    # 1. Quoted amounts first (e.g. '$47.00', "$50") -> descriptive document label
    pos = re.sub(r'[\'"][^\'"]{0,30}[\$\€\£\¥\₹\d\.]+[^\'"]{0,30}[\'"]', 'an official document stamped in red', pos)
    # 2. Standalone currency symbols with amounts (e.g. $47.00, €50, etc.) -> descriptive prop
    pos = re.sub(r'[\$\€\£\¥\₹]\s*[\d,]+(?:\.\d+)?', 'a formal overdue notice', pos)
    # 3. Numeric word currency (e.g. 47 dollars, 5 cents)
    pos = re.sub(r'\b\d+\s*(?:dollars?|euros?|rupees?|cents?|USD|EUR)\b', 'an overdue fee', pos, flags=re.IGNORECASE)
    # 4. Sensitive alarmist trigger words in positive description -> safe cinematic equivalents
    substitutions = [
        (r'\bpanicked\b', 'alarmed and distressed'),
        (r'\bpanic\b', 'distress'),
        (r'\bpanicking\b', 'visibly stunned'),
        (r'\bbloody\b', 'intense red-lit'),
        (r'\bscrewed\b', 'in deep trouble'),
        (r'\bnaked\b', 'unclothed'),
        (r'\bnude\b', 'natural'),
    ]
    for pattern, repl in substitutions:
        pos = re.sub(pattern, repl, pos, flags=re.IGNORECASE)
    # Clean up double spaces or duplicate periods
    pos = re.sub(r'\s{2,}', ' ', pos)
    pos = re.sub(r'\.{2,}', '.', pos)
    return (pos.strip() + neg_suffix).strip()


def _clean_narration_and_extract_mood(raw_script: str) -> tuple[str, str]:
    """Clean narration of audio/TTS emotional cues like (serious), [dramatic pause], (whispering)
    while extracting overall emotional tone for scene prompt engineering."""
    import re
    tags = re.findall(r'[\(\[\{]([^\)\]\}]+)[\)\]\}]', raw_script)
    mood_cues = [t.strip().lower() for t in tags if len(t.strip()) < 30]
    inferred_mood = ", ".join(dict.fromkeys(mood_cues)) if mood_cues else "cinematic, engaging, high energy"
    # Strip bracketed/parenthetical cues from narration text
    clean_text = re.sub(r'[\(\[\{][^\)\]\}]+[\)\]\}]\s*', '', raw_script)
    clean_text = re.sub(r'\s{2,}', ' ', clean_text).strip()
    return clean_text, inferred_mood


@app.route("/api/studio/generate_prompts", methods=["POST"])
def studio_generate_prompts():
    """
    Senior Prompt Engine for Google Flow / Nano Banana Pro.
    1. Cleans script of vocal/emotion tags while capturing tone.
    2. Dynamically segments script into thematic narrative scenes.
    3. Produces ultra-cinematic, diverse image prompts with concrete physical action,
       camera optics, volumetric lighting, zero-crop framing, and strict safety filtering.
    """
    import re
    import math
    import json
    import time
    import concurrent.futures

    req         = request.json or {}
    title       = req.get("title", "") or req.get("topic", "Untitled Video")
    raw_script  = req.get("script", "") or req.get("topic", "")
    keywords    = req.get("keywords", "")
    video_type  = req.get("video_type", "short")   # "short" | "long"
    image_style = req.get("image_style") or req.get("style") or "cinematic_photorealism"

    clean_script, script_mood = _clean_narration_and_extract_mood(raw_script)
    word_count   = len(clean_script.split())
    # 140 words per minute TTS pacing
    est_dur_secs = max(10, round((word_count / 140) * 60))

    aspect = "9:16" if video_type == "short" else "16:9"
    prefix = "short" if video_type == "short" else "long"

    style_cfg = STUDIO_STYLE_PRESETS.get(image_style, STUDIO_STYLE_PRESETS["cinematic_photorealism"])
    style_defaults = style_cfg["short_desc"] if video_type == "short" else style_cfg["long_desc"]
    style_name = style_cfg["name"]
    negative = STUDIO_NEGATIVE_PROMPT

    def _build_fn(si: int, ii: int) -> str:
        return f"{prefix}_s{si+1:03d}_img{ii+1:03d}.png"

    def _parse_json(raw: str):
        raw = raw.replace("```json", "").replace("```", "").strip()
        start = raw.find("{")
        end   = raw.rfind("}") + 1
        if start < 0 or end <= start:
            start = raw.find("[")
            end   = raw.rfind("]") + 1
            if start < 0 or end <= start:
                raise ValueError("No JSON found in response")
        return json.loads(raw[start:end])

    # ── Phase 1: Dynamic Scene Breakdown ─────────────────────────────────────
    # Shorts (<=180s): each scene covers ~10-25s of narration (3 to 8 scenes)
    # Long videos: each scene covers ~30-60s of narration
    if video_type == "short":
        target_scene_dur = 18
        target_n_scenes = max(1, min(12, math.ceil(est_dur_secs / target_scene_dur)))
    else:
        target_scene_dur = 45
        target_n_scenes = max(1, math.ceil(est_dur_secs / target_scene_dur))

    scene_plan_prompt = (
        "You are an elite video director and screenplay structure specialist.\n\n"
        "TASK: Break the following narration script into " + str(target_n_scenes) + " cinematic scenes.\n\n"
        'VIDEO TITLE: "' + title + '"\n'
        "VIDEO TYPE: " + video_type + " (" + aspect + ")\n"
        "TOTAL DURATION: ~" + str(est_dur_secs) + " seconds (" + str(word_count) + " words)\n"
        "OVERALL MOOD: " + script_mood + "\n\n"
        "NARRATION SCRIPT:\n"
        "---\n" + clean_script + "\n---\n\n"
        "SCENE BREAKDOWN RULES:\n"
        "1. Every sentence of the narration must be covered sequentially across the scenes (100% coverage).\n"
        "2. Each scene represents one distinct narrative beat or thematic location.\n"
        "3. Specify the exact sentences covered in 'script_excerpt'.\n\n"
        "Return ONLY a JSON object with this exact schema:\n"
        '{\n'
        '  "scenes": [\n'
        '    {\n'
        '      "scene_index": 1,\n'
        '      "scene_title": "Descriptive Scene Title",\n'
        '      "script_excerpt": "Exact sentences from narration...",\n'
        '      "scene_duration_s": ' + str(round(est_dur_secs / target_n_scenes)) + ',\n'
        '      "scene_mood": "Mood and visual atmosphere"\n'
        '    }\n'
        '  ]\n'
        '}'
    )

    scene_plan = []
    try:
        raw_plan = call_gemini(scene_plan_prompt, timeout=40, json_mode=True)
        plan_data = _parse_json(raw_plan)
        scene_plan = plan_data if isinstance(plan_data, list) else plan_data.get("scenes", [])
    except Exception as e:
        print(f"[studio] AI scene breakdown fallback: {e}")

    # Fallback scene planner if AI fails
    if not scene_plan:
        sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', clean_script) if s.strip()]
        chunk_size = max(1, math.ceil(len(sentences) / target_n_scenes))
        scene_plan = []
        for si in range(target_n_scenes):
            chunk = sentences[si * chunk_size : (si + 1) * chunk_size]
            if not chunk:
                continue
            excerpt = " ".join(chunk)
            scene_plan.append({
                "scene_index": si + 1,
                "scene_title": f"Scene {si+1}: {chunk[0][:40]}...",
                "script_excerpt": excerpt,
                "scene_duration_s": max(5, round(est_dur_secs / target_n_scenes)),
                "scene_mood": script_mood
            })

    # ── Phase 2: Nano Banana Pro Prompt Generation Per Scene ─────────────────
    SHOT_VARIATIONS = [
        ("Medium Action Shot", "50mm / 85mm lens, character torso and hands interacting with physical prop, expressive facial reaction, shallow depth of field"),
        ("Prop Macro Close-Up", "100mm macro prime lens, crisp extreme detail on key object, tactile texture, glowing indicator or stamped document label"),
        ("Environmental Wide Shot", "24mm wide angle lens, deep depth of field, full room / outdoor scale, cinematic atmosphere and ambient lighting"),
        ("Dramatic Hero Shot", "Low-angle 35mm hero shot, dramatic rim backlight, subject framed against expansive backdrop, intense determined expression"),
        ("Over-The-Shoulder View", "50mm perspective looking past character toward key visual reveal, atmospheric volumetric haze"),
        ("Tight Emotional Portrait", "85mm f/1.4 prime lens, intense facial detail, visible eye reflections, soft cinematic bokeh background"),
    ]

    def _generate_prompts_for_scene(item):
        si, sc = item
        scene_title = sc.get("scene_title", f"Scene {si+1}")
        excerpt     = sc.get("script_excerpt", "")
        duration_s  = sc.get("scene_duration_s", round(est_dur_secs / max(1, len(scene_plan))))
        mood        = sc.get("scene_mood", script_mood)

        # Scale image count to duration: fast pace ~3-4s per image
        if duration_s <= 15:
            n_imgs = max(3, min(6, math.ceil(duration_s / 3.5)))
        elif duration_s <= 35:
            n_imgs = max(5, min(10, math.ceil(duration_s / 4.0)))
        else:
            n_imgs = max(8, min(15, math.ceil(duration_s / 4.5)))

        eg_fn1 = _build_fn(si, 0)
        eg_fn2 = _build_fn(si, 1)

        prompt_gen_instruction = (
            "You are an elite Google Flow (Nano Banana Pro / Imagen 3) master prompt engineer.\n\n"
            "TASK: Generate " + str(n_imgs) + " distinct, ultra-cinematic image prompts for Scene " + str(si+1) + ".\n\n"
            'VIDEO: "' + title + '"\n'
            'SCENE: "' + scene_title + '" (~' + str(duration_s) + 's)\n'
            "MOOD / ATMOSPHERE: " + mood + "\n"
            "ASPECT RATIO: " + aspect + " (" + ("Vertical Portrait 9:16" if aspect == "9:16" else "Widescreen 16:9") + ")\n"
            "STYLE PRESET: " + style_name + "\n\n"
            'SCENE NARRATION:\n"' + excerpt + '"\n\n'
            "NANO BANANA PRO PROMPT ENGINEERING RULES:\n"
            "1. ANCHOR WITH PHYSICAL ACTION FIRST: Describe characters actively doing things with visible hands, facial expressions, and physical props.\n"
            "2. ROTATE CAMERA OPTICS & SHOTS: Close-up macro on props, medium action shot, environmental wide, low-angle hero.\n"
            "3. VOLUMETRIC LIGHTING: Include cinematic shadows, rim light, golden hour shafts, or neon haze.\n"
            "4. ZERO-CROP COMPOSITION: Subject centered, fully in-frame, no cropped limbs/heads.\n"
            "5. STRICT CONTENT SAFETY (CRITICAL): NEVER write currency symbols ($ € £ ¥ ₹) or exact numeric amounts. Describe props visually (e.g. 'official document with bold red overdue notice').\n"
            "6. PROMPT STRUCTURE: '<Fluent photographic description of subject, action, props, lighting, framing>. " + style_defaults + ". Save this image as: <filename>. Negative: " + negative + ".'\n\n"
            "Return JSON only:\n"
            '{\n'
            '  "images": [\n'
            '    {\n'
            '      "image_index": 1,\n'
            '      "filename": "' + eg_fn1 + '",\n'
            '      "scene_description": "Crisp one-sentence summary of this shot",\n'
            '      "prompt": "Detailed cinematic prompt... ' + style_defaults + '. Save this image as: ' + eg_fn1 + '. Negative: ' + negative + '."\n'
            '    }\n'
            '  ]\n'
            '}'
        )

        scene_imgs = []
        is_fallback = False
        try:
            raw_resp = call_gemini(prompt_gen_instruction, timeout=40, json_mode=True)
            data = _parse_json(raw_resp)
            raw_imgs = data if isinstance(data, list) else data.get("images", [])
            for ii, im in enumerate(raw_imgs[:n_imgs]):
                fn = _build_fn(si, ii)
                im["image_index"]  = ii + 1
                im["filename"]     = fn
                im["aspect_ratio"] = aspect
                p = _sanitize_prompt_safety(im.get("prompt", ""))
                if style_defaults not in p:
                    p = p.rstrip(". ") + f". {style_defaults}."
                if fn not in p:
                    p = p.rstrip(". ") + f" Save this image as: {fn}."
                if "Negative:" not in p:
                    p = p.rstrip(". ") + f" Negative: {negative}."
                im["prompt"] = p
                scene_imgs.append(im)
        except Exception as ex:
            print(f"[studio] Scene {si+1} Gemini prompt generation fallback: {ex}")
            is_fallback = True

        # Algorithmic high-quality fallback if Gemini call failed
        if not scene_imgs:
            core_words = excerpt[:140].rstrip(".")
            for ii in range(n_imgs):
                fn = _build_fn(si, ii)
                shot_name, shot_lens = SHOT_VARIATIONS[ii % len(SHOT_VARIATIONS)]
                desc = f"{shot_name}: {core_words}"
                p = (
                    f"{shot_name} ({shot_lens}) depicting {core_words}. "
                    f"Volumetric dramatic lighting, intense atmospheric mood, photorealistic 8k detail. "
                    f"{style_defaults}. Save this image as: {fn}. Negative: {negative}."
                )
                scene_imgs.append({
                    "image_index": ii + 1,
                    "filename": fn,
                    "scene_description": desc,
                    "prompt": _sanitize_prompt_safety(p),
                    "aspect_ratio": aspect
                })

        return (si, {
            "scene_index": si + 1,
            "scene_title": scene_title,
            "script_excerpt": excerpt,
            "scene_duration_s": duration_s,
            "images": scene_imgs
        }, is_fallback)

    # Parallel scene prompt generation across thread pool
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(4, len(scene_plan))) as executor:
        results = list(executor.map(_generate_prompts_for_scene, enumerate(scene_plan)))

    scenes = []
    total_images = 0
    any_fallback = False
    for si, scene_obj, fb in sorted(results, key=lambda x: x[0]):
        scenes.append(scene_obj)
        total_images += len(scene_obj["images"])
        if fb:
            any_fallback = True

    short_warning = video_type == "short" and est_dur_secs > 180

    return jsonify({
        "estimated_duration_s": est_dur_secs,
        "scene_count": len(scenes),
        "total_images": total_images,
        "aspect_ratio": aspect,
        "video_type": video_type,
        "short_warning": short_warning,
        "word_count": word_count,
        "scenes": scenes,
        "fallback": any_fallback
    })


@app.route("/api/studio/enhance_prompt", methods=["POST"])
def studio_enhance_prompt():
    """Enhance an individual image prompt specifically for Google Flow / Nano Banana Pro."""
    req            = request.json or {}
    base_prompt    = req.get("prompt", "").strip()
    video_type     = req.get("video_type", "short")
    image_style    = req.get("image_style", "cinematic_photorealism")
    filename       = req.get("filename", "image.png")
    scene_excerpt  = req.get("script_excerpt", "")
    
    aspect = "9:16" if video_type == "short" else "16:9"
    style_cfg = STUDIO_STYLE_PRESETS.get(image_style, STUDIO_STYLE_PRESETS["cinematic_photorealism"])
    style_defaults = style_cfg["short_desc"] if video_type == "short" else style_cfg["long_desc"]
    negative = STUDIO_NEGATIVE_PROMPT

    if base_prompt:
        p = (
            "You are a master Google Flow (Nano Banana Pro) image prompt engineer.\n"
            "Enhance and rewrite this prompt into an ultra-cinematic, photorealistic prompt for " + aspect + " video.\n\n"
            'ORIGINAL IDEA: "' + base_prompt + '"\n'
            'SCENE CONTEXT: "' + scene_excerpt + '"\n\n'
            "RULES:\n"
            "1. Describe characters performing concrete physical actions with hands, facial expressions, and physical props.\n"
            "2. Specify cinematic camera framing, lens focal length, volumetric lighting, and fine textures.\n"
            "3. NO currency symbols or exact prices.\n"
            '4. End with: "' + style_defaults + '. Save this image as: ' + filename + '. Negative: ' + negative + '."\n\n'
            "Return JSON only:\n"
            '{"prompt": "<Enhanced cinematic prompt>. ' + style_defaults + '. Save this image as: ' + filename + '. Negative: ' + negative + '.", "scene_description": "<one crisp sentence summary>"}'
        )
        try:
            raw = call_gemini(p, timeout=20, json_mode=True)
            d = json.loads(raw.replace("```json", "").replace("```", "").strip())
            return jsonify({
                "filename": filename,
                "prompt": _sanitize_prompt_safety(d.get("prompt", base_prompt)),
                "scene_description": d.get("scene_description", "Enhanced cinematic prompt")
            })
        except Exception as ex:
            print(f"[studio] Enhance prompt fallback: {ex}")

    enhanced = _sanitize_prompt_safety(
        f"{base_prompt.rstrip('.')} — volumetric dramatic lighting, photorealistic 8k detail, authentic textures. "
        f"{style_defaults}. Save this image as: {filename}. Negative: {negative}."
    )
    return jsonify({
        "filename": filename,
        "prompt": enhanced,
        "scene_description": "Enhanced Google Flow cinematic prompt"
    })


@app.route("/api/studio/regenerate_prompt", methods=["POST"])
def studio_regenerate_prompt():
    """Regenerate a single image prompt using AI with diverse framing."""
    req            = request.json or {}
    title          = req.get("title", "Video")
    video_type     = req.get("video_type", "short")
    script_excerpt = req.get("script_excerpt", "")
    filename       = req.get("filename", "short_s001_img001.png")
    image_style    = req.get("image_style", "cinematic_photorealism")
    
    aspect = "9:16" if video_type == "short" else "16:9"
    style_cfg = STUDIO_STYLE_PRESETS.get(image_style, STUDIO_STYLE_PRESETS["cinematic_photorealism"])
    style_defaults = style_cfg["short_desc"] if video_type == "short" else style_cfg["long_desc"]
    negative = STUDIO_NEGATIVE_PROMPT

    prompt_text = None
    scene_desc  = ""
    p = (
        "Create 1 cinematic Google Flow (Nano Banana Pro) image prompt for video '" + title + "'.\n"
        "Aspect ratio: " + aspect + ".\n"
        'Scene excerpt: "' + script_excerpt + '".\n'
        "Save filename: " + filename + ".\n"
        "Rule: Start prompt with concrete visual subject performing physical action with props FIRST.\n"
        "NO currency symbols.\n"
        'End prompt with: "' + style_defaults + '. Save this image as: ' + filename + '. Negative: ' + negative + '."\n\n'
        "Return JSON only:\n"
        '{"prompt": "<fluent cinematic prompt>. ' + style_defaults + '. Save this image as: ' + filename + '. Negative: ' + negative + '.", "scene_description": "<one sentence>"}'
    )
    try:
        raw = call_gemini(p, timeout=25, json_mode=True)
        d = json.loads(raw.replace("```json", "").replace("```", "").strip())
        prompt_text = _sanitize_prompt_safety(d.get("prompt", ""))
        scene_desc  = d.get("scene_description", "")
    except Exception:
        prompt_text = None

    if not prompt_text:
        import random
        angles = [
            ("Dramatic close-up reaction shot", "tight 85mm portrait, intense facial emotion, reflective eyes"),
            ("Wide cinematic establishing shot", "24mm deep focus landscape, atmospheric environmental lighting"),
            ("Low-angle heroic perspective", "35mm dynamic low-angle hero framing against dramatic sky"),
            ("Macro focal view", "100mm macro close-up on key storytelling prop with crisp fine detail"),
            ("Dynamic action moment", "50mm action freeze-frame with authentic physical motion"),
        ]
        chosen_angle, lens_info = random.choice(angles)
        prompt_text = _sanitize_prompt_safety(
            f"{chosen_angle} ({lens_info}) depicting {script_excerpt[:120].rstrip('.')}. "
            f"Volumetric cinematic lighting, rich authentic colors, photorealistic 8k. "
            f"{style_defaults}. Save this image as: {filename}. Negative: {negative}."
        )
        scene_desc = f"{chosen_angle} for: '{script_excerpt[:60]}...'"

    return jsonify({"filename": filename, "prompt": prompt_text, "scene_description": scene_desc})


@app.route("/api/studio/regenerate_scene", methods=["POST"])
def studio_regenerate_scene():
    """Regenerate all image prompts for a single scene."""
    req            = request.json or {}
    title          = req.get("title", "Video")
    video_type     = req.get("video_type", "short")
    scene_index    = req.get("scene_index", 0)
    script_excerpt = req.get("script_excerpt", "")
    image_count    = req.get("image_count", 8)
    image_style    = req.get("image_style", "cinematic_photorealism")
    
    prefix = "short" if video_type == "short" else "long"
    aspect = "9:16" if video_type == "short" else "16:9"
    style_cfg = STUDIO_STYLE_PRESETS.get(image_style, STUDIO_STYLE_PRESETS["cinematic_photorealism"])
    style_defaults = style_cfg["short_desc"] if video_type == "short" else style_cfg["long_desc"]
    negative = STUDIO_NEGATIVE_PROMPT

    def _build_fn(s_idx, i_idx):
        return f"{prefix}_s{s_idx+1:03d}_img{i_idx+1:03d}.png"

    images = []
    p = (
        "You are an elite Google Flow (Nano Banana Pro) prompt engineer.\n"
        "Create " + str(image_count) + " cinematic image prompts for Scene " + str(scene_index+1) + " of '" + title + "'.\n"
        'Excerpt: "' + script_excerpt + '".\n'
        "Filenames: " + _build_fn(scene_index, 0) + " to " + _build_fn(scene_index, image_count-1) + ".\n"
        "Aspect ratio: " + aspect + ".\n\n"
        "Rules:\n"
        "1. Describe characters actively doing things with hands, facial expressions, and physical props.\n"
        "2. Vary framing: Medium action shot, Macro close-up on props, Environmental wide, Low-angle hero.\n"
        "3. NO currency symbols or exact dollar amounts.\n"
        '4. End prompts with: "' + style_defaults + '. Save this image as: <filename>. Negative: ' + negative + '."\n\n'
        "Return JSON only:\n"
        '{"images": [{"filename": "' + _build_fn(scene_index, 0) + '", "prompt": "<cinematic description>. ' + style_defaults + '. Save this image as: ' + _build_fn(scene_index, 0) + '. Negative: ' + negative + '.", "scene_description": "..."}]}'
    )
    try:
        raw = call_gemini(p, timeout=40, json_mode=True)
        d = json.loads(raw.replace("```json", "").replace("```", "").strip())
        raw_imgs = d.get("images") or []
        for ii, im in enumerate(raw_imgs[:image_count]):
            fn = _build_fn(scene_index, ii)
            im["image_index"] = ii + 1
            im["filename"] = fn
            im["aspect_ratio"] = aspect
            im["prompt"] = _sanitize_prompt_safety(im.get("prompt", ""))
            images.append(im)
    except Exception:
        images = []

    if not images:
        SHOT_VARIATIONS = [
            ("Extreme close-up macro shot", "100mm macro prime, tactile textures and sharp focus"),
            ("Medium action shot", "50mm lens, subject torso and hands interacting with physical props"),
            ("Wide establishing shot", "24mm wide angle, deep focus environmental scale"),
            ("Overhead bird's-eye view", "aerial top-down perspective with dynamic atmospheric lighting"),
            ("Low-angle hero shot", "35mm low-angle heroic framing against dramatic backdrop"),
            ("Tight portrait framing", "85mm f/1.4 prime lens, intense facial emotion and bokeh"),
            ("Dramatic side silhouette", "high-contrast cinematic rim light silhouette"),
            ("Three-quarter angle view", "50mm cinematic three-quarter perspective"),
        ]
        images = []
        for ii in range(image_count):
            fn = _build_fn(scene_index, ii)
            shot_name, shot_lens = SHOT_VARIATIONS[ii % len(SHOT_VARIATIONS)]
            prompt = _sanitize_prompt_safety(
                f"{shot_name} ({shot_lens}) visualizing {script_excerpt[:120].rstrip('.')}. "
                f"Volumetric cinematic lighting, rich authentic colors, photorealistic 8k. "
                f"{style_defaults}. Save this image as: {fn}. Negative: {negative}."
            )
            images.append({
                "image_index": ii + 1,
                "filename": fn,
                "prompt": prompt,
                "scene_description": f"{shot_name} for '{script_excerpt[:50]}...'",
                "aspect_ratio": aspect
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
        "project_id":         project_id,
        "date":               date_str,
        "slug":               slug,
        "title":              title,
        "script":             script,
        "keywords":           keywords,
        "tags":               tags,
        "video_type":         video_type,
        "duration_hint":      duration_hint,
        "scenes":             req.get("scenes", []),
        "prompts":            prompts,
        "fallback":           req.get("fallback", False),
        "total_images":       req.get("total_images", len(prompts)),
        "voice_preset":       req.get("voice_preset", "default"),
        "voice":              req.get("voice", "en-US-AndrewMultilingualNeural"),
        "subtitle_font":      req.get("subtitle_font", "Arial Black"),
        "subtitle_color":     req.get("subtitle_color", "&H00FFFFFF"),
        "subtitle_highlight": req.get("subtitle_highlight", "&H0000FFFF"),
        "subtitle_size":      req.get("subtitle_size", 100),
        "subtitle_position":  req.get("subtitle_position", "bottom"),
        "bgm_preset":         req.get("bgm_preset", "none"),
        "bgm_volume":         req.get("bgm_volume", "0.12"),
        "py_script":          str(script_file.relative_to(PROJECT_ROOT)),
        "created_at":         datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "status":             "awaiting_images",
        "images_uploaded":     0,
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


@app.route("/api/studio/update_project/<path:project_id>", methods=["POST"])
def studio_update_project(project_id):
    """Update title, script, keywords, tags, scenes, fallback, video_type, voice, subtitles, or bgm in studio_meta.json."""
    project_dir = OUTPUT_ROOT / project_id
    if not project_dir.exists():
        return jsonify({"error": f"Project not found: {project_id}"}), 404

    meta_path = project_dir / "studio_meta.json"
    meta      = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}

    req = request.json or {}
    if "title" in req:
        meta["title"] = req["title"].strip()
    if "script" in req:
        meta["script"] = req["script"].strip()
    if "keywords" in req:
        kws = req["keywords"]
        meta["keywords"] = [k.strip() for k in kws.split(",") if k.strip()] if isinstance(kws, str) else kws
    if "tags" in req:
        tgs = req["tags"]
        meta["tags"] = [t.strip().lstrip("#") for t in tgs.split(",") if t.strip()] if isinstance(tgs, str) else tgs
    if "video_type" in req:
        meta["video_type"] = req["video_type"]
    if "scenes" in req:
        meta["scenes"] = req["scenes"]
    if "prompts" in req:
        meta["prompts"] = req["prompts"]
    if "fallback" in req:
        meta["fallback"] = req["fallback"]
    if "total_images" in req:
        meta["total_images"] = req["total_images"]

    for field in ["voice_preset", "voice", "subtitle_font", "subtitle_color", "subtitle_highlight", "subtitle_size", "subtitle_position", "bgm_preset", "bgm_volume"]:
        if field in req:
            meta[field] = req[field]

    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return jsonify({"success": True, "meta": meta})


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


import urllib.parse
import re as _re
import io as _io
from PIL import Image as _PILImage

# ── Fictional/satirical concept keywords that cannot be stock-photographed ──────────────
_FICTIONAL_CONCEPT_PATTERNS = [
    # Personified objects / talking entities
    r'\b(?:expressive|wooden|bark)\s+face\b',
    r'\b(?:tree|plant|leaf|flower|rock|cloud|sun|moon)\s+(?:with|forming|having)\s+(?:a|an)?\s*(?:face|expression|smile|frown|eyes|mouth|scowl|grin)\b',
    r'\btalking\s+(?:tree|plant|leaf|cloud|animal|object)\b',
    r'\bpersonified\b',
    r'\bTree\s+Union\b',
    r'\bspokesperson\s+(?:tree|plant|leaf|nature)\b',
    # Fictional documents / impossible objects
    r'\b(?:tax\s+document|oxygen\s+bill|breath\s+charge|oxygen\s+invoice|oxygen\s+tax)\b',
    r'\bQR\s+code\s+(?:saying|reading|that\s+says|labeled|with\s+text)\b',
    r'\b(?:leaf|branch|tree)\s+holding\s+(?:a|an)?\s*(?:sign|bill|document|paper|card|letter)\b',
    # Breaking news / satire graphics
    r'\bbreaking\s+news\s+(?:chyron|banner|ticker|graphic|screen)\b',
    r'\bnews\s+ticker\b',
    r'\bsatire\b',
    # Impossible / fantasy scenes
    r'\b(?:trees?|plants?)\s+(?:marching|protesting|holding\s+signs?|waving\s+banners?)\b',
    r'\b(?:magical|surreal|fantastical|animated|cartoon|illustrated|digital\s+art)\b',
    r'\bwaving\s+(?:a|their)?\s*(?:bill|receipt|invoice|paper)\b',
    # Human crowd with very specific impossible signs
    r'\bPAY\s+TO\s+BREATHE\b',
    r'\bOxygen\s+(?:is\s+(?:our|my)\s+right|subscription|plan|premium)\b',
    # Emotionally attributed non-human subjects
    r'\b(?:stern|angry|gleeful|smirking|concerned|worried)\s+(?:tree|leaf|branch|root|plant)\b',
    r'\b(?:tree|leaf|plant)\s+(?:spokesperson|leader|representative|collector|union)\b',
]
_FICTIONAL_RE = [_re.compile(p, _re.IGNORECASE) for p in _FICTIONAL_CONCEPT_PATTERNS]


def _is_fictional_concept(prompt: str) -> bool:
    """Return True if the prompt describes a concept that cannot be stock-photographed."""
    p = prompt
    if "Negative:" in p:
        p = p.split("Negative:")[0]
    p = _re.sub(r'Save this image as:\s*\S+', '', p, flags=_re.IGNORECASE).strip()
    
    for pattern in _FICTIONAL_RE:
        if pattern.search(p):
            return True
    return False


# ── Style Presets ─────────────────────────────────────────────────────────────
STYLE_PRESETS = {
    "photorealistic": "Candid editorial photography, sharp focus, natural textures and real lighting, authentic 35mm documentary film still, vertical 9:16 composition",
    "3d_pixar": "High quality 3D animated movie render, Pixar Disney character design, expressive facial features, soft studio lighting, vibrant colors, 8k resolution, vertical 9:16 composition",
    "comic_graphic": "Dynamic graphic novel illustration, bold linework, rich cinematic color palette, detailed comic book art style, vertical 9:16 composition",
    "cyberpunk": "Cyberpunk aesthetic, neon reflections, futuristic night atmosphere, volumetric lighting, highly detailed 8k, vertical 9:16 composition",
    "vintage_film": "Vintage 1970s 35mm Kodachrome film photograph, film grain, nostalgic warm tones, candid composition, 8k, vertical 9:16 composition",
    "anime_ghibli": "Studio Ghibli inspired anime illustration, hand-painted digital art, beautiful watercolor aesthetic, expressive characters, vertical 9:16 composition",
}

# ── Ethnicity & Character Diversity Descriptors ──────────────────────────────
ETHNICITY_DESCRIPTORS = {
    "cauc_western": "Caucasian Western subject with short styled brown hair and natural features",
    "latino": "Latino Hispanic subject with dark hair and warm skin tones",
    "african_american": "African American subject with textured hair and rich skin tones",
    "south_asian": "South Asian subject with dark hair and expressive features",
    "east_asian": "East Asian subject with short dark hair and natural facial features",
    "diverse_global": "distinct global character features and natural skin texture",
}


# Anti-anime suppressors injected into every photorealistic FLUX prompt
_FLUX_PHOTOREALISTIC_NEGATIVE = (
    "anime, cartoon, illustration, drawing, painting, CGI, render, 3D, manga, "
    "stylized, artistic, digital art, concept art, fantasy art, unrealistic skin, "
    "Asian anime female, big eyes, cute, chibi, long straight black hair girl, "
    "perfect skin, airbrushed, smooth, plastic, doll-like, symmetric perfection"
)


def _build_flux_prompt(prompt: str, style: str = "photorealistic", ethnicity: str = "cauc_western", negative_prompt: str = "") -> str:
    """Build an optimal FLUX AI prompt by cleaning boilerplate and ensuring natural descriptive storytelling."""
    p = prompt
    if "Negative:" in p:
        p = p.split("Negative:")[0]
    p = _re.sub(r'Save this image as:\s*\S+', '', p, flags=_re.IGNORECASE).strip()

    # Regex patterns for legacy camera / resolution / framing tag spam to clean up
    tag_patterns = [
        r'^(?:Vertical portrait 9:16 composition|Widescreen 16:9 cinematic shot)[^.]*\.\s*',
        r'^(?:subject centered in frame|rule of thirds|full subject visible|expansive view)[^.]*\.\s*',
        r'(?:RAW photo,?\s*|DSLR,?\s*|85mm DSLR lens,?\s*|f/1\.8 aperture,?\s*|natural skin texture,?\s*|genuine expression,?\s*|dramatic cinematic lighting,?\s*|photorealistic 8k\.?)',
        r'(?:photorealistic 8k resolution,?\s*|hyper-detailed professional photography,?\s*|vertical 9:16 portrait composition\.?)',
    ]
    
    for pat in tag_patterns:
        p = _re.sub(pat, '', p, flags=_re.IGNORECASE).strip()

    # Clean up double spaces or trailing punctuation
    p = _re.sub(r'\s{2,}', ' ', p).strip(' .,')

    # Retrieve style preset
    style_desc = STYLE_PRESETS.get(style, STYLE_PRESETS["photorealistic"])

    if style == "photorealistic":
        final_prompt = f"{p}. {style_desc}"
    else:
        final_prompt = f"{p}, {style_desc}"

    # Clean up duplicate periods / spaces
    final_prompt = _re.sub(r'\.{2,}', '.', final_prompt)
    final_prompt = _re.sub(r'\s{2,}', ' ', final_prompt).strip()

    if len(final_prompt) > 850:
        final_prompt = final_prompt[:850].rsplit(' ', 1)[0]

    return final_prompt


def _enhance_prompt_for_realism(prompt: str) -> str:
    """Transform abstract script prompts into National Geographic 8K photorealistic photography prompts.
    Used only for REAL/concrete concepts sent to Pexels/Wikimedia or as fallback FLUX prompt.
    """
    p = prompt
    if "Negative:" in p:
        p = p.split("Negative:")[0]
    p = _re.sub(r'Save this image as:\s*\S+', '', p, flags=_re.IGNORECASE).strip()
    
    # Strip style boilerplate header
    boilerplate_end = r'(?:depth of field|wallpaper quality|focal detail)(?:.)?\.\s*'
    full_boilerplate = _re.compile(r'^.*?' + boilerplate_end, _re.IGNORECASE | _re.DOTALL)
    stripped = full_boilerplate.sub('', p).strip()
    if len(stripped) > 10:
        p = stripped

    # Clean up abstract metaphors
    p = _re.sub(r'glowing like a warm ruby light bulb', 'glowing with warm red light', p, flags=_re.IGNORECASE)
    p = _re.sub(r'illuminated fractures like glowing cracked glass', 'glowing with cracked light patterns', p, flags=_re.IGNORECASE)

    p = _re.sub(r'\s{2,}', ' ', p).strip(' .,')

    # Frame with photorealism tags for concrete real-world subjects
    prefix = "Award-winning National Geographic photograph, 8k resolution, photorealistic, 35mm lens, sharp focus, dramatic lighting. "
    enhanced = prefix + p
    
    if len(enhanced) > 400:
        enhanced = enhanced[:400].rsplit(' ', 1)[0]
    
    return enhanced


def _extract_topic_query(prompt: str) -> str:
    """Extract 2-4 concrete nouns from a prompt for Pexels/Wikimedia stock photo search.
    Only called for non-fictional prompts. Focuses on photographable subjects only.
    """
    p = prompt
    if "Negative:" in p:
        p = p.split("Negative:")[0]
    p = _re.sub(r'Save this image as:\s*\S+', '', p, flags=_re.IGNORECASE).strip()
    
    # Find the scene description sentence (skip the boilerplate style sentence)
    sentences = [s.strip() for s in p.split('.') if s.strip()]
    scene_sentence = ""
    for s in sentences:
        if not _re.search(r'\b(?:85mm|9:16|f/1\.4|depth of field|composition|focal detail|wallpaper quality|photorealistic|8k|portrait|vertical)\b', s, _re.IGNORECASE):
            scene_sentence = s
            break
    if not scene_sentence:
        scene_sentence = sentences[-1] if sentences else p
        
    # Strip camera direction prefix
    scene_sentence = _re.sub(
        r'^(?:Mid-shot|Wide shot|Close-up|Macro|Extreme macro|Low-angle|High-angle|Overhead|Eye-level|Aerial|Tight|Bird.s-eye)\s+(?:of|shot of|angle|view|perspective)?\s*',
        '', scene_sentence, flags=_re.IGNORECASE
    ).strip()
    
    # Keep only concrete photographable nouns — skip verbs, adjectives, prepositions, org names
    skip_words = {
        "with", "from", "this", "that", "there", "their", "about", "above", "under",
        "where", "portrait", "vertical", "shot", "view", "composition", "angle",
        "close", "macro", "lens", "camera", "photo", "photography", "detail",
        "light", "visible", "centered", "frame", "showing", "holding", "wearing",
        "union", "spokesperson", "expressive", "intricate", "stern", "glowing",
        "crisp", "official", "grand", "ancient", "bright", "medium", "wide",
        "having", "forming", "featuring", "leaning", "standing", "sitting",
    }
    words = [
        w for w in _re.findall(r'\b[a-zA-Z]{3,}\b', scene_sentence)
        if w.lower() not in skip_words
    ]
    
    # Prefer concrete nouns that Pexels actually has good photos for
    query = " ".join(words[:3])
    return query.strip() if len(query.strip()) > 3 else scene_sentence[:50]


def _fetch_pexels_hd_photo(prompt: str, dest_path: Path, width: int = 1080, height: int = 1920, seed: int = 42) -> bool:
    """Fetch 8K curated vertical portrait photography from Pexels API."""
    key = os.environ.get("PEXELS_API_KEY") or "dXcpV7fToES4flec2pQzrKOeBLxQCQa9V4FRso8Hk8hkUD2x15dgdRhD"
    if not key:
        return False
        
    query = _extract_topic_query(prompt)
    
    print(f"[pexels-hd] Querying 8K photo for topic: '{query}' (seed={seed})...")
    headers = {"Authorization": key}
    url = f"https://api.pexels.com/v1/search?query={urllib.parse.quote(query)}&orientation=portrait&per_page=15"
    
    try:
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code == 200:
            photos = r.json().get("photos", [])
            if photos:
                photo = photos[seed % len(photos)]
                src = photo.get("src", {})
                img_url = src.get("portrait") or src.get("large2x") or src.get("original")
                if img_url:
                    print(f"[pexels-hd] Downloading Pexels photo ID {photo['id']}...")
                    r_img = requests.get(img_url, headers=headers, timeout=12)
                    if r_img.status_code == 200 and len(r_img.content) > 35000:
                        dest_path.parent.mkdir(parents=True, exist_ok=True)
                        dest_path.write_bytes(r_img.content)
                        print(f"[pexels-hd] ✓ Saved 8K Pexels Photo {dest_path.name} ({len(r_img.content)//1024} KB)")
                        return True
    except Exception as e:
        print(f"[pexels-hd] Exception: {e}")
        
    return False


def _fetch_wikimedia_hd_photo(prompt: str, dest_path: Path, width: int = 1080, height: int = 1920) -> bool:
    """Fallback engine: fetch real HD photography from Wikimedia Commons, topic-matched to the prompt."""
    search_q = _extract_topic_query(prompt)
    if not search_q or len(search_q) < 3:
        search_q = prompt[:60]
        
    print(f"[hd-photo-fallback] Searching real 8K photo for: '{search_q}'...")
    url = f"https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(search_q)}&srnamespace=6&format=json&srlimit=8"
    headers = {"User-Agent": "ShortsFactory/1.0 (contact@example.com)"}
    
    try:
        r = requests.get(url, headers=headers, timeout=8)
        if r.status_code != 200:
            return False
        results = r.json().get("query", {}).get("search", [])
        
        for item in results:
            title = item.get("title", "")
            info_url = f"https://commons.wikimedia.org/w/api.php?action=query&titles={urllib.parse.quote(title)}&prop=imageinfo&iiprop=url|mime|size&format=json"
            r_info = requests.get(info_url, headers=headers, timeout=8)
            pages = r_info.json().get("query", {}).get("pages", {})
            for pid, pdata in pages.items():
                info = pdata.get("imageinfo", [{}])[0]
                img_url = info.get("url", "")
                mime = info.get("mime", "")
                size = info.get("size", 0)
                if mime not in ("image/jpeg", "image/png") or size < 500_000:
                    continue
                try:
                    r_img = requests.get(img_url, headers=headers, timeout=15, stream=True)
                    if r_img.status_code != 200:
                        continue
                    raw = b"".join(r_img.iter_content(8192))
                    if len(raw) < 100_000:
                        continue
                    img = _PILImage.open(_io.BytesIO(raw)).convert("RGB")
                    orig_w, orig_h = img.size
                    # Smart crop to 9:16 preserving subject
                    target_ratio = width / height
                    orig_ratio = orig_w / orig_h
                    if orig_ratio > target_ratio:
                        crop_w = int(orig_h * target_ratio)
                        crop_x = (orig_w - crop_w) // 2
                        img_cropped = img.crop((crop_x, 0, crop_x + crop_w, orig_h))
                    else:
                        crop_h = int(orig_w / target_ratio)
                        crop_y = (orig_h - crop_h) // 2
                        img_cropped = img.crop((0, crop_y, orig_w, crop_y + crop_h))
                    img_final = img_cropped.resize((width, height), _PILImage.Resampling.LANCZOS)
                    dest_path.parent.mkdir(parents=True, exist_ok=True)
                    img_final.save(dest_path, "PNG")
                    print(f"[hd-photo-fallback] ✓ Saved 9:16 8K HD Photo {dest_path.name} ({dest_path.stat().st_size//1024} KB)")
                    return True
                except Exception:
                    continue
    except Exception as e:
        print(f"[hd-photo-fallback] Exception: {e}")
    return False


def _download_pollinations_image(
    prompt: str,
    dest_path: Path,
    width: int = 1080,
    height: int = 1920,
    seed: int = 42,
    provider: str = "auto",
    style: str = "photorealistic",
    ethnicity: str = "cauc_western",
    negative_prompt: str = ""
) -> bool:
    """Download photorealistic image via FLUX AI with Style Presets, Ethnicity Descriptors, and Multi-Provider Routing."""
    import subprocess
    import time
    import random
    
    clean_p = _enhance_prompt_for_realism(prompt)
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    
    flux_prompt = _build_flux_prompt(prompt, style=style, ethnicity=ethnicity, negative_prompt=negative_prompt)
    print(f"[image-gen] 🎨 Full Prompt ({len(flux_prompt)} chars): '{flux_prompt}'")

    def _make_urls(cur_seed: int):
        encoded_prompt = urllib.parse.quote(flux_prompt)
        # Pass anti-anime suppressors as Pollinations' dedicated negative URL parameter
        encoded_neg = urllib.parse.quote(_FLUX_PHOTOREALISTIC_NEGATIVE) if style == "photorealistic" else ""
        nonce = random.randint(10000, 99999)
        neg_param = f"&negative={encoded_neg}" if encoded_neg else ""
        return [
            (f"https://image.pollinations.ai/prompt/{encoded_prompt}?width={width}&height={height}&model=flux&nologo=true&seed={cur_seed}&cache=false{neg_param}&nc={nonce}", "Pollinations FLUX"),
            (f"https://image.pollinations.ai/prompt/{encoded_prompt}?width={width}&height={height}&model=turbo&nologo=true&seed={cur_seed}&cache=false{neg_param}&nc={nonce}", "Pollinations Turbo"),
            (f"https://image.pollinations.ai/prompt/{encoded_prompt}?width={width}&height={height}&nologo=true&seed={cur_seed}&cache=false{neg_param}&nc={nonce}", "Pollinations Default"),
            (f"https://image.pollinations.ai/prompt/{encoded_prompt}?width={width}&height={height}&model=sdxl&nologo=true&seed={cur_seed}&cache=false&nc={nonce}", "Pollinations SDXL"),
        ]
    
    def _robust_ai_download(url: str, max_time: int = 50) -> bool:
        """Download via clean curl -s -L with python requests fallback, return True on success."""
        if dest_path.exists():
            try:
                dest_path.unlink()
            except Exception:
                pass

        # 1. Clean curl -s -L execution
        cmd = ["curl", "-s", "-L", "--max-time", str(max_time), "-o", str(dest_path), url]
        subprocess.run(cmd, capture_output=True)
        if dest_path.exists() and dest_path.stat().st_size > 35000:
            return True

        if dest_path.exists():
            try:
                dest_path.unlink()
            except Exception:
                pass

        # 2. Python requests fallback with 429 backoff
        import requests
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        
        session = requests.Session()
        session.headers.update({
            "User-Agent": f"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/12{random.randint(4,6)}.0.0.0 Safari/537.36",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            "Cache-Control": "no-cache",
        })

        for attempt in range(3):
            try:
                r = session.get(url, timeout=max_time, verify=False)
                if r.status_code == 200 and len(r.content) > 35000:
                    dest_path.write_bytes(r.content)
                    return True
                elif r.status_code == 429:
                    print(f"[image-gen] ⚠️ Rate limit 429 on attempt {attempt+1} — waiting 5s for IP window reset...")
                    time.sleep(5.0)
            except Exception as ex:
                print(f"[image-gen] Attempt {attempt+1} download error: {ex}")
                time.sleep(3.0)

        if dest_path.exists() and dest_path.stat().st_size <= 35000:
            try:
                dest_path.unlink()
            except Exception:
                pass
        return False
    
    prov = (provider or "auto").lower()

    # Unconditionally unlink any stale file on disk before generation
    if dest_path.exists():
        try:
            dest_path.unlink()
        except Exception:
            pass

    if prov == "pexels":
        print(f"[image-gen] 📷 Engine: PEXELS STOCK ONLY | Query: '{_extract_topic_query(prompt)}'")
        if _fetch_pexels_hd_photo(prompt, dest_path, width=width, height=height, seed=seed):
            return True
        print(f"[image-gen] Pexels failed → FLUX fallback...")
        urls = _make_urls(seed)
        if _robust_ai_download(urls[0][0], max_time=30):
            return True

    elif prov in ("auto", "smart"):
        print(f"[image-gen] ⚡ Engine: SMART AUTO (FLUX AI Primary + Pexels Fallback)")
        urls = _make_urls(seed)
        for url, label in urls:
            if _robust_ai_download(url, max_time=30):
                print(f"[image-gen] ✓ {label} saved {dest_path.name} ({dest_path.stat().st_size//1024}KB)")
                return True
            time.sleep(0.5)
        print(f"[image-gen] FLUX AI rate-limited → Pexels 8K HD Photo Fallback...")
        if _fetch_pexels_hd_photo(prompt, dest_path, width=width, height=height, seed=seed):
            return True

    elif prov in ("flux", "ai"):
        print(f"[image-gen] 🎨 Engine: FLUX AI ONLY")
        urls = _make_urls(seed)
        for url, label in urls:
            if _robust_ai_download(url, max_time=30):
                print(f"[image-gen] ✓ {label} saved {dest_path.name} ({dest_path.stat().st_size//1024}KB)")
                return True
            time.sleep(1.0)
        # If FLUX AI is 429 rate limited, fall back to Pexels 8K HD Photo safety net!
        print(f"[image-gen] ⚠️ FLUX AI rate-limited → Pexels 8K HD Photo Fallback...")
        if _fetch_pexels_hd_photo(prompt, dest_path, width=width, height=height, seed=seed):
            return True

    elif prov == "wikimedia":
        print(f"[image-gen] 🏛️ Engine: WIKIMEDIA ONLY | Query: '{_extract_topic_query(prompt)}'")
        if _fetch_wikimedia_hd_photo(prompt, dest_path, width=width, height=height):
            return True
        print(f"[image-gen] Wikimedia failed → FLUX fallback...")
        urls = _make_urls(seed)
        if _robust_ai_download(urls[0][0], max_time=30):
            return True

    if dest_path.exists() and dest_path.stat().st_size <= 30000:
        try:
            dest_path.unlink()
        except Exception:
            pass

    print(f"[image-gen] ✗ All stages failed for {dest_path.name}")
    return False


@app.route("/api/studio/generate_images/<path:project_id>", methods=["POST"])
def studio_generate_images(project_id):
    """Auto-generate all image prompts using selected provider (FLUX AI, Pexels, Wikimedia, or Auto)."""
    project_dir = OUTPUT_ROOT / project_id
    if not project_dir.exists():
        return jsonify({"error": f"Project not found: {project_id}"}), 404

    meta_path = project_dir / "studio_meta.json"
    if not meta_path.exists():
        return jsonify({"error": "studio_meta.json missing in project"}), 400

    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    prompts = meta.get("prompts", [])
    if not prompts:
        return jsonify({"error": "No image prompts found in studio_meta.json"}), 400

    video_type = meta.get("video_type", "short")
    width, height = (768, 1344) if video_type == "short" else (1344, 768)
    images_dir = project_dir / "images"
    images_dir.mkdir(exist_ok=True)

    req_data = request.json or {}
    force    = req_data.get("force", False)
    provider = req_data.get("provider") or req_data.get("image_provider") or meta.get("image_provider") or "auto"
    style    = req_data.get("style") or req_data.get("image_style") or meta.get("image_style") or "photorealistic"
    ethnicity = req_data.get("ethnicity") or req_data.get("character_ethnicity") or meta.get("character_ethnicity") or "cauc_western"
    negative_prompt = req_data.get("negative_prompt", "")

    meta["image_provider"] = provider
    meta["image_style"] = style
    meta["character_ethnicity"] = ethnicity

    total_generated = 0
    failed_images = []

    for idx, p in enumerate(prompts):
        fname = p.get("filename")
        prompt = p.get("prompt")
        if not fname or not prompt:
            continue

        dest = images_dir / Path(fname).name
        if dest.exists() and not force and dest.stat().st_size > 1000:
            total_generated += 1
            print(f"[image-gen] ⏩ [{total_generated}/{len(prompts)}] Already exists: {fname}", flush=True)
            continue

        if idx > 0:
            time.sleep(1.5)  # IP rate-limit buffer for batch generation

        pct = int(((idx + 1) / len(prompts)) * 100)
        print(f"[image-gen] 🎨 [Image {idx+1}/{len(prompts)} ({pct}%)] Generating {fname} via {provider}...", flush=True)
        seed = (idx * 101) + 42
        ok   = _download_pollinations_image(
            prompt, dest, width=width, height=height, seed=seed,
            provider=provider, style=style, ethnicity=ethnicity, negative_prompt=negative_prompt
        )
        if ok:
            total_generated += 1
            print(f"[image-gen] ✅ [{total_generated}/{len(prompts)}] Successfully saved: {fname}", flush=True)
        else:
            failed_images.append(fname)
            print(f"[image-gen] ❌ [{idx+1}/{len(prompts)}] Failed to generate: {fname}", flush=True)

    all_imgs = list(images_dir.glob("*.png")) + list(images_dir.glob("*.jpg")) + list(images_dir.glob("*.jpeg")) + list(images_dir.glob("*.webp"))
    total    = len(all_imgs)

    meta["status"]          = "ready_to_render" if total >= len(prompts) else f"uploading ({total}/{len(prompts)})"
    meta["images_uploaded"] = total
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")

    return jsonify({
        "success": True,
        "total_generated": total_generated,
        "total_images": total,
        "expected_images": len(prompts),
        "failed_images": failed_images,
        "ready_to_render": total >= len(prompts)
    })


@app.route("/api/studio/clear_images/<path:project_id>", methods=["DELETE", "POST"])
def studio_clear_images(project_id):
    """Delete all existing images in a project's images/ and broll/ folders so they can be regenerated."""
    project_dir = OUTPUT_ROOT / project_id
    if not project_dir.exists():
        return jsonify({"error": f"Project not found: {project_id}"}), 404
    images_dir = project_dir / "images"
    broll_dir  = project_dir / "broll"
    deleted = 0
    for d in [images_dir, broll_dir]:
        if d.exists():
            for f in d.glob("*"):
                if f.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
                    try:
                        f.unlink()
                        deleted += 1
                    except Exception:
                        pass
    # Reset status in meta
    meta_path = project_dir / "studio_meta.json"
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            meta["status"] = "prompts_ready"
            meta["images_uploaded"] = 0
            meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
        except Exception:
            pass
    print(f"[studio-clear-images] Deleted {deleted} image files from {project_id}")
    return jsonify({"success": True, "deleted": deleted})


@app.route("/api/studio/delete_single_image/<path:project_id>", methods=["DELETE", "POST"])
def studio_delete_single_image(project_id):
    """Delete a specific single image from a project's images/ and broll/ folders."""
    project_dir = OUTPUT_ROOT / project_id
    if not project_dir.exists():
        return jsonify({"error": f"Project not found: {project_id}"}), 404
    req_data = request.json or {}
    filename = req_data.get("filename") or request.args.get("filename")
    if not filename:
        return jsonify({"error": "filename is required"}), 400
    
    cleaned_fn = Path(filename).name
    images_dir = project_dir / "images"
    broll_dir  = project_dir / "broll"
    
    deleted = False
    for d in [images_dir, broll_dir]:
        target = d / cleaned_fn
        if target.exists():
            try:
                target.unlink()
                deleted = True
            except Exception as e:
                print(f"[delete-err] {e}")
    
    # Update status in meta
    all_imgs = [f for f in (list(images_dir.glob("*.png")) + list(images_dir.glob("*.jpg")) + list(images_dir.glob("*.jpeg")) + list(images_dir.glob("*.webp"))) if f.stat().st_size > 3000] if images_dir.exists() else []
    total = len(all_imgs)
    
    meta_path = project_dir / "studio_meta.json"
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            expected = len(meta.get("prompts", []))
            meta["images_uploaded"] = total
            meta["status"] = "ready_to_render" if total >= expected else f"uploading ({total}/{expected})"
            meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
        except Exception:
            pass
    
    print(f"[studio-delete-single-image] Deleted {cleaned_fn} from {project_id} (remaining: {total})")
    return jsonify({"success": True, "filename": cleaned_fn, "deleted": deleted, "total_uploaded": total})


@app.route("/api/studio/clear_scene_images/<path:project_id>", methods=["DELETE", "POST"])
def studio_clear_scene_images(project_id):
    """Delete all images belonging to a specific scene."""
    project_dir = OUTPUT_ROOT / project_id
    if not project_dir.exists():
        return jsonify({"error": f"Project not found: {project_id}"}), 404
    req_data = request.json or {}
    filenames = req_data.get("filenames") or []
    if not filenames:
        return jsonify({"error": "filenames list is required"}), 400
    
    images_dir = project_dir / "images"
    broll_dir  = project_dir / "broll"
    deleted_count = 0
    for fn in filenames:
        clean_fn = Path(fn).name
        for d in [images_dir, broll_dir]:
            target = d / clean_fn
            if target.exists():
                try:
                    target.unlink()
                    deleted_count += 1
                except Exception:
                    pass
    
    all_imgs = [f for f in (list(images_dir.glob("*.png")) + list(images_dir.glob("*.jpg")) + list(images_dir.glob("*.jpeg")) + list(images_dir.glob("*.webp"))) if f.stat().st_size > 3000] if images_dir.exists() else []
    total = len(all_imgs)
    
    meta_path = project_dir / "studio_meta.json"
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            expected = len(meta.get("prompts", []))
            meta["images_uploaded"] = total
            meta["status"] = "ready_to_render" if total >= expected else f"uploading ({total}/{expected})"
            meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
        except Exception:
            pass
    
    print(f"[studio-clear-scene-images] Deleted {deleted_count} files from {project_id} (remaining: {total})")
    return jsonify({"success": True, "deleted_count": deleted_count, "total_uploaded": total})


@app.route("/api/studio/generate_single_image/<path:project_id>", methods=["POST"])
def studio_generate_single_image(project_id):
    """Generate or re-roll a single image using Pollinations FLUX API or selected provider."""
    project_dir = OUTPUT_ROOT / project_id
    if not project_dir.exists():
        return jsonify({"error": f"Project not found: {project_id}"}), 404

    meta_path = project_dir / "studio_meta.json"
    meta      = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
    video_type = meta.get("video_type", "short")
    width, height = (768, 1344) if video_type == "short" else (1344, 768)

    req_data = request.json or {}
    filename = req_data.get("filename")
    prompt   = req_data.get("prompt")
    provider = req_data.get("provider") or req_data.get("image_provider") or meta.get("image_provider") or "auto"
    style    = req_data.get("style") or req_data.get("image_style") or meta.get("image_style") or "photorealistic"
    ethnicity = req_data.get("ethnicity") or req_data.get("character_ethnicity") or meta.get("character_ethnicity") or "cauc_western"
    negative_prompt = req_data.get("negative_prompt", "")

    if not filename or not prompt:
        return jsonify({"error": "Missing filename or prompt"}), 400

    images_dir = project_dir / "images"
    images_dir.mkdir(exist_ok=True)
    dest = images_dir / Path(filename).name

    if provider == "google_flow":
        try:
            sys_gen_path = str(PROJECT_ROOT / "scripts" / "generators")
            if sys_gen_path not in sys.path:
                sys.path.insert(0, sys_gen_path)
            import flow_clippilot_direct_cdp
            print(f"[studio-single-image] Generating {filename} via Google Flow CDP (waiting for lock)...")
            with _FLOW_LOCK:
                ok = flow_clippilot_direct_cdp.generate_single_flow_image_sync(project_id, filename, prompt)
        except Exception as flow_err:
            print(f"[FLOW-SINGLE-ERR] {flow_err}")
            ok = False
    else:
        import random
        seed = random.randint(1, 999999)
        print(f"[studio-single-image] Generating {filename} (style='{style}', ethnicity='{ethnicity}', provider='{provider}', seed={seed})...")
        ok   = _download_pollinations_image(
            prompt, dest, width=width, height=height, seed=seed,
            provider=provider, style=style, ethnicity=ethnicity, negative_prompt=negative_prompt
        )

    if not ok:
        if dest.exists() and dest.stat().st_size <= 3000:
            try:
                dest.unlink()
            except Exception:
                pass
        return jsonify({"error": f"Failed to generate image {filename} via provider '{provider}'"}), 500

    all_imgs = [f for f in (list(images_dir.glob("*.png")) + list(images_dir.glob("*.jpg")) + list(images_dir.glob("*.jpeg")) + list(images_dir.glob("*.webp"))) if f.stat().st_size > 3000]
    total    = len(all_imgs)

    if meta_path.exists():
        expected = len(meta.get("prompts", []))
        meta["status"]          = "ready_to_render" if total >= expected else f"uploading ({total}/{expected})"
        meta["images_uploaded"] = total
        meta["image_provider"]  = provider
        meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")

    return jsonify({"success": True, "filename": filename, "total_uploaded": total})


# ─────────────────────────────────────────────────────────────────────────────
# Google Flow AI Studio Integration
# ─────────────────────────────────────────────────────────────────────────────
_FLOW_LOCK = threading.Lock()
_FLOW_JOBS: dict = {}  # project_id -> status dict
_FLOW_CANCEL_EVENTS: dict[str, threading.Event] = {}

def _run_flow_job(project_id: str, options: dict, cancel_event: threading.Event):
    """Run Google Flow CDP automation in a background worker thread with lock protection."""
    if project_id not in _FLOW_JOBS:
        _FLOW_JOBS[project_id] = {}
    _FLOW_JOBS[project_id]["status"] = "running"
    _FLOW_JOBS[project_id]["log"] = "Acquiring Google Flow browser session lock..."

    def progress_callback(info: dict):
        if project_id in _FLOW_JOBS:
            _FLOW_JOBS[project_id].update(info)

    try:
        sys_gen_path = str(PROJECT_ROOT / "scripts" / "generators")
        if sys_gen_path not in sys.path:
            sys.path.insert(0, sys_gen_path)

        import flow_clippilot_direct_cdp

        with _FLOW_LOCK:
            if cancel_event.is_set():
                _FLOW_JOBS[project_id]["status"] = "cancelled"
                _FLOW_JOBS[project_id]["message"] = "Flow generation was cancelled."
                return

            res = flow_clippilot_direct_cdp.run_flow_pipeline_sync(
                project_id=project_id,
                flow_url=options.get("flow_url"),
                start_idx=options.get("start_index", 0),
                count=options.get("count"),
                progress_callback=progress_callback,
                cancel_check=lambda: cancel_event.is_set(),
                dry_run=options.get("dry_run", False),
                force=options.get("force", True)
            )

        if cancel_event.is_set() or res.get("status") == "cancelled":
            _FLOW_JOBS[project_id].update({
                "status": "cancelled",
                "message": "Flow generation was stopped.",
                "completed_filenames": res.get("completed_filenames", [])
            })
        else:
            _FLOW_JOBS[project_id].update({
                "status": "completed" if res.get("success") else "completed_with_errors",
                "percent": 100,
                "message": f"Done! Generated {res.get('generated_count', 0)}/{res.get('total_images', 0)} images.",
                "completed_filenames": res.get("completed_filenames", [])
            })
    except Exception as exc:
        import traceback
        print(f"[FLOW-ERROR {project_id}] {exc}\n{traceback.format_exc()}")
        _FLOW_JOBS[project_id]["status"] = "error"
        _FLOW_JOBS[project_id]["error"] = str(exc)
        _FLOW_JOBS[project_id]["message"] = f"Error: {exc}"


@app.route("/api/studio/generate_flow_images/<path:project_id>", methods=["POST"])
def studio_generate_flow_images(project_id):
    """Trigger sequential automated image generation via Google Flow CDP."""
    project_dir = OUTPUT_ROOT / project_id
    if not project_dir.exists():
        return jsonify({"error": f"Project not found: {project_id}"}), 404
    meta_path = project_dir / "studio_meta.json"
    if not meta_path.exists():
        return jsonify({"error": "studio_meta.json missing in project"}), 400

    req_data = request.json or {}
    current_job = _FLOW_JOBS.get(project_id, {})
    if current_job.get("status") == "running":
        return jsonify({"success": True, "project_id": project_id, "status": "running", "already_running": True})

    cancel_event = threading.Event()
    _FLOW_CANCEL_EVENTS[project_id] = cancel_event

    _FLOW_JOBS[project_id] = {
        "status": "starting",
        "project_id": project_id,
        "current_index": 0,
        "total_images": 0,
        "current_filename": "",
        "current_description": "",
        "percent": 0,
        "message": "Initializing Google Flow automation...",
        "error": None
    }
    threading.Thread(target=_run_flow_job, args=(project_id, req_data, cancel_event), daemon=True).start()
    return jsonify({"success": True, "project_id": project_id, "status": "started"})


@app.route("/api/studio/flow_status/<path:project_id>", methods=["GET"])
def studio_flow_status(project_id):
    """Poll status of Google Flow generation for a project."""
    job = _FLOW_JOBS.get(project_id)
    if not job:
        project_dir = OUTPUT_ROOT / project_id
        images_dir = project_dir / "images"
        meta_path = project_dir / "studio_meta.json"
        expected = 0
        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
                expected = len(meta.get("prompts", []))
            except Exception:
                pass
        existing = len(list(images_dir.glob("*.png"))) if images_dir.exists() else 0
        return jsonify({
            "status": "idle",
            "project_id": project_id,
            "total_images": expected,
            "generated_count": existing
        })
    return jsonify(job)


@app.route("/api/studio/cancel_flow_generation/<path:project_id>", methods=["POST"])
def studio_cancel_flow_generation(project_id):
    """Cancel/reset Google Flow generation status."""
    if project_id in _FLOW_CANCEL_EVENTS:
        _FLOW_CANCEL_EVENTS[project_id].set()
    if project_id in _FLOW_JOBS:
        _FLOW_JOBS[project_id]["status"] = "cancelled"
        _FLOW_JOBS[project_id]["message"] = "Generation was cancelled."
    return jsonify({"success": True, "project_id": project_id, "status": "cancelled"})


@app.route("/api/studio/launch_flow_chrome", methods=["POST"])
def studio_launch_flow_chrome():
    """Launch Google Chrome with remote debugging on port 9222."""
    try:
        sys_gen_path = str(PROJECT_ROOT / "scripts" / "generators")
        if sys_gen_path not in sys.path:
            sys.path.insert(0, sys_gen_path)
        import flow_clippilot_direct_cdp
        cdp_url = os.getenv("GOOGLE_FLOW_CDP_URL", "http://127.0.0.1:9222")
        ok = flow_clippilot_direct_cdp.ensure_chrome_running(cdp_url)
        return jsonify({"success": ok, "cdp_url": cdp_url, "running": ok})
    except Exception as ex:
        return jsonify({"success": False, "error": str(ex)}), 500


@app.route("/api/studio/import_from_flow/<path:project_id>", methods=["POST"])
def studio_import_from_flow(project_id):
    """
    Directly import and sync all generated images / Veo video clips from the active
    Google Flow board over Chrome CDP into the ClipPilot project directories.
    """
    project_dir = OUTPUT_ROOT / project_id
    if not project_dir.exists():
        return jsonify({"error": f"Project not found: {project_id}"}), 404
    meta_path = project_dir / "studio_meta.json"
    if not meta_path.exists():
        return jsonify({"error": "studio_meta.json missing in project"}), 400

    import asyncio
    import base64
    from pathlib import Path
    
    images_dir = project_dir / "images"
    broll_dir = project_dir / "broll"
    images_dir.mkdir(parents=True, exist_ok=True)
    broll_dir.mkdir(parents=True, exist_ok=True)

    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception as e:
        return jsonify({"error": f"Invalid studio_meta.json: {e}"}), 400

    all_img_defs = []
    for sc in meta.get("scenes", []):
        for img in sc.get("images", []):
            all_img_defs.append(img.get("filename"))

    if not all_img_defs:
        return jsonify({"error": "No image definitions found in project scenes"}), 400

    async def _do_sync():
        from playwright.async_api import async_playwright
        cdp_url = os.getenv("GOOGLE_FLOW_CDP_URL", "http://127.0.0.1:9222")
        sys_gen_path = str(PROJECT_ROOT / "scripts" / "generators")
        if sys_gen_path not in sys.path:
            sys.path.insert(0, sys_gen_path)
        import flow_clippilot_direct_cdp
        flow_clippilot_direct_cdp.ensure_chrome_running(cdp_url)

        async with async_playwright() as pw:
            try:
                browser = await pw.chromium.connect_over_cdp(cdp_url)
            except Exception as e:
                raise RuntimeError(f"Could not connect to Chrome CDP at {cdp_url}: {e}. Ensure Chrome is running with remote debugging.")
                
            context = browser.contexts[0]
            flow_page = None
            # Search all open pages for a Flow tab
            for p in context.pages:
                url = p.url or ""
                if "labs.google/fx/tools/flow" in url or "flow.google.com" in url:
                    flow_page = p
                    break

            if not flow_page:
                # No Flow tab open — auto-open the user's Flow project URL
                flow_url = (
                    meta.get("flow_project_url")
                    or os.getenv("GOOGLE_FLOW_PROJECT_URL", "https://labs.google/fx/tools/flow")
                )
                print(f"[FLOW-IMPORT] No Flow tab found. Auto-opening: {flow_url}")
                flow_page = await context.new_page()
                await flow_page.goto(flow_url, wait_until="domcontentloaded", timeout=30000)
                # Wait for Flow board to fully hydrate
                await flow_page.wait_for_timeout(5000)

            await flow_page.bring_to_front()

            # Extract both images and videos from the Flow board in DOM order
            flow_media = await flow_page.evaluate("""() => {
                const list = [];
                // Check images
                document.querySelectorAll("img").forEach(img => {
                    const src = img.src || '';
                    const alt = img.alt || '';
                    if (src && (src.includes("getMediaUrlRedirect") || alt === "Generated image")) {
                        list.push({ type: 'image', src: src });
                    }
                });
                // Check videos (if Veo video generation was used)
                document.querySelectorAll("video").forEach(v => {
                    const src = v.src || v.currentSrc || '';
                    if (src && src.includes("getMediaUrlRedirect")) {
                        list.push({ type: 'video', src: src });
                    }
                });
                return list;
            }""")

            if not flow_media:
                raise RuntimeError("No generated media found on the active Google Flow board.")

            downloaded = []
            for idx, item in enumerate(flow_media):
                if idx >= len(all_img_defs):
                    break
                filename = all_img_defs[idx]
                src = item["src"]
                
                # Fetch bytes inside browser session
                b64_data = await flow_page.evaluate("""async (url) => {
                    const res = await fetch(url);
                    const blob = await res.blob();
                    return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result.split(',')[1]);
                        reader.readAsDataURL(blob);
                    });
                }""", src)

                raw_bytes = base64.b64decode(b64_data)
                img_dest = images_dir / filename
                broll_dest = broll_dir / filename
                img_dest.write_bytes(raw_bytes)
                broll_dest.write_bytes(raw_bytes)
                downloaded.append(filename)
                print(f"[FLOW-IMPORT] [{idx+1}/{len(all_img_defs)}] Saved {filename} ({len(raw_bytes):,} bytes)")

            return downloaded

    try:
        loop = asyncio.new_event_loop()
        downloaded_files = loop.run_until_complete(_do_sync())
        loop.close()

        # Update studio_meta.json
        meta["images_generated"] = len(downloaded_files)
        meta["images_ready"] = len(downloaded_files) >= len(all_img_defs)
        meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")

        return jsonify({
            "success": True,
            "project_id": project_id,
            "imported_count": len(downloaded_files),
            "total_needed": len(all_img_defs),
            "filenames": downloaded_files
        })
    except Exception as exc:
        import traceback
        print(f"[FLOW-IMPORT-ERROR] {exc}\n{traceback.format_exc()}")
        return jsonify({"error": str(exc)}), 500


def _run_render_job(job_id: str, project_dir: Path, meta: dict, mode: str = "full"):
    """Run the ClipPilot pipeline in a background thread with granular re-rendering mode support."""
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
        # SFX & emotion engine
        _sfx_gen_path = str(PROJECT_ROOT / "scripts" / "generators")
        if _sfx_gen_path not in sys.path:
            sys.path.insert(0, _sfx_gen_path)
        from sfx_engine import (
            parse_sfx_markers, locate_sfx_timestamps,
            mix_sfx_into_narration, build_ssml_with_emotions,
            generate_preset_sfx,
        )
        _SFX_DIR = PROJECT_ROOT / "packages" / "ClipPilot" / "assets" / "sfx"
        generate_preset_sfx(_SFX_DIR)   # idempotent — skips existing files

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

        # ── Pre-Step 1: Parse SFX & emotion markers from script ───────────
        script_raw   = meta.get("script") or meta.get("title", "")
        clean_script, sfx_events = parse_sfx_markers(script_raw)
        sfx_only     = [e for e in sfx_events if e["type"] == "sfx"]
        emotion_evts = [e for e in sfx_events if e["type"] == "emotion"]
        if sfx_events:
            log(f"  Detected {len(sfx_only)} SFX tag(s) + {len(emotion_evts)} emotion tag(s)")
        # Clean script used for captions & manifest
        script = clean_script

        wav = str(project_dir / "narration.wav")
        mixed_wav = str(project_dir / "narration_sfx.wav")
        base = str(project_dir / "base.mp4")
        ass = str(project_dir / "captions.ass")
        final_name = f"Final_{slug}.mp4"
        final_path = str(project_dir / final_name)
        w, h = (1080, 1920) if video_type == "short" else (1920, 1080)
        aspect_ratio = "9:16" if video_type == "short" else "16:9"
        resolution   = "1080x1920 @ 60FPS" if video_type == "short" else "1920x1080 @ 60FPS"

        # ── Audio Processing (Required for 'full', 'narration_only', or initial runs) ──
        need_audio = mode in ("full", "narration_only") or not Path(wav).exists()
        
        if need_audio:
            # Step A: Synthesize Speech (with expressive multi-emotion prosody)
            voice_name = meta.get("voice", "en-US-AndrewMultilingualNeural")
            log(f"Step 1/5: Synthesizing narration ({voice_name}, 48 kHz, {len(emotion_evts)} emotion tags)...")
            res = tts.synthesize(script_raw, wav, voice=voice_name)
            if not res.get("available"):
                raise Exception(f"TTS failed: {res.get('reason')}")
            duration = signals.probe(wav).duration_s or 0.0
            log(f"  Narration: {duration:.1f}s  ({len(script.split())} words)")

            # Step B: Transcribe with Whisper for perfect word timings & captions
            log("Step 2/5: Transcribing narration for captions & SFX sync...")
            from clippilot.media import transcribe as TR
            words_list: list = []
            if TR.whisper_available():
                try:
                    tr = TR.transcribe(wav, model_size="base")
                    words_list = tr.get("words") or []
                except Exception as exc:
                    log(f"  Whisper fallback: {exc}")

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

            # Step C: Mix all SFX markers into narration at exact timestamps
            master_audio = wav
            if sfx_only:
                log(f"  Mixing {len(sfx_only)} SFX tag(s) into narration at exact timestamps...")
                if words_list:
                    wt = [{"start_ms": int(w.get("start", 0) * 1000), "end_ms": int(w.get("end", 0) * 1000)}
                          for w in words_list]
                else:
                    wt = [{"start_ms": t["start_ms"], "end_ms": t["end_ms"]}
                          for t in tts.word_timings(script, duration)]
                sfx_ms = locate_sfx_timestamps(sfx_only, wt)
                sfx_vol = float(meta.get("sfx_volume", 0.85))
                master_audio = mix_sfx_into_narration(wav, sfx_ms, _SFX_DIR, mixed_wav, sfx_volume=sfx_vol)
                log(f"  SFX mix complete: {master_audio}")

            # Step D: Mix Background Music (BGM) if selected
            bgm_preset = meta.get("bgm_preset", "none")
            if bgm_preset and bgm_preset != "none":
                bgm_file = PROJECT_ROOT / "packages" / "ClipPilot" / "assets" / "bgm" / f"{bgm_preset}.wav"
                if bgm_file.exists():
                    log(f"  Mixing Background Music Bed ({bgm_preset})...")
                    bgm_mixed = str(project_dir / "master_audio_bgm.wav")
                    vol = float(meta.get("bgm_volume", 0.12))
                    cmd = [
                        "ffmpeg", "-y", "-i", str(master_audio), "-stream_loop", "-1", "-i", str(bgm_file),
                        "-filter_complex", f"[1:a]volume={vol}[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[a]",
                        "-map", "[a]", "-c:a", "pcm_s16le", "-ar", "48000", bgm_mixed
                    ]
                    subprocess.run(cmd, capture_output=True, timeout=60)
                    if Path(bgm_mixed).exists() and Path(bgm_mixed).stat().st_size > 0:
                        master_audio = bgm_mixed

            # Step E: Generate ASS karaoke subtitles
            sub_font = meta.get("subtitle_font", "Arial Black")
            sub_color = meta.get("subtitle_color", "&H00FFFFFF")
            sub_highlight = meta.get("subtitle_highlight", "&H0000FFFF")
            sub_size = int(meta.get("subtitle_size", 100))
            sub_pos = meta.get("subtitle_position", "bottom")
            margin_v = 360 if sub_pos == "bottom" else (800 if sub_pos == "center" else 1400)
            custom_style = {
                "font": sub_font, "fontsize": sub_size,
                "primary": sub_highlight, "secondary": sub_color, "margin_v": margin_v
            }
            style = {**E.skin_style("karaoke_yellow"), **custom_style}
            E.write_ass_karaoke(pages, ass, width=w, height=h, **style)
            p_ass = Path(ass)
            p_ass.write_text(p_ass.read_text(encoding="utf-8").replace("WrapStyle: 2", "WrapStyle: 0"), encoding="utf-8")

        else:
            # Use existing audio track
            master_audio = str(project_dir / "master_audio_bgm.wav") if (project_dir / "master_audio_bgm.wav").exists() else (
                str(project_dir / "narration_sfx.wav") if (project_dir / "narration_sfx.wav").exists() else wav
            )
            duration = signals.probe(master_audio).duration_s or 0.0

        # ── Slideshow Processing (Required for 'full', 'slideshow_only', or when base.mp4 is missing) ──
        need_slides = mode in ("full", "slideshow_only") or not Path(base).exists()
        
        if need_slides:
            log("Step 3/5: Building 60 FPS Ken-Burns slideshow...")
            video = A.assemble_slideshow(image_paths, master_audio, base, fps=60, log_fn=log)
            if not video:
                log("  Falling back to animated gradient title card...")
                video = A.assemble_short(master_audio, base, title=title, fps=60)
            if not video:
                raise Exception("Slideshow assembly failed — check ffmpeg")
            log("  Base video ready")
        else:
            video = base
            log("  Using existing 60 FPS slideshow video (fast audio/caption update)...")

        # ── Subtitles Re-styling (If mode is 'subtitles_only') ──
        if mode == "subtitles_only":
            log("Regenerating ASS subtitles styling...")
            from clippilot.media import transcribe as TR
            words_list = []
            if TR.whisper_available():
                try:
                    tr = TR.transcribe(wav if Path(wav).exists() else master_audio, model_size="base")
                    words_list = tr.get("words") or []
                except Exception:
                    pass
            pages = C.pages_for_clip(words_list, 0.0, duration, combine_within_ms=820) if words_list else []
            if not pages:
                toks = tts.word_timings(script, duration)
                raw_pages = C.create_tiktok_style_captions(toks, combine_within_ms=820)["pages"]
                pages = [{"start": round(p["start_ms"]/1000.0, 3), "end": round((p["start_ms"]+p["duration_ms"])/1000.0, 3), "tokens": p.get("tokens", [])} for p in raw_pages]
            
            sub_font = meta.get("subtitle_font", "Arial Black")
            sub_color = meta.get("subtitle_color", "&H00FFFFFF")
            sub_highlight = meta.get("subtitle_highlight", "&H0000FFFF")
            sub_size = int(meta.get("subtitle_size", 100))
            sub_pos = meta.get("subtitle_position", "bottom")
            margin_v = 360 if sub_pos == "bottom" else (800 if sub_pos == "center" else 1400)
            custom_style = {
                "font": sub_font, "fontsize": sub_size,
                "primary": sub_highlight, "secondary": sub_color, "margin_v": margin_v
            }
            style = {**E.skin_style("karaoke_yellow"), **custom_style}
            E.write_ass_karaoke(pages, ass, width=w, height=h, **style)
            p_ass = Path(ass)
            p_ass.write_text(p_ass.read_text(encoding="utf-8").replace("WrapStyle: 2", "WrapStyle: 0"), encoding="utf-8")

        # ── Final Video Assembly: Burn Captions + Master Audio (SFX + BGM) ──
        log("Step 4/5: Burning captions & embedding master 48kHz audio...")
        final = E.burn_subtitles(video, ass, final_path, audio_path=master_audio)
        if not final:
            raise Exception("Caption burn-in failed — check ffmpeg / libass")
        log(f"  Final video ready: {final_name}")

        # ── Step 5: Write manifest.json ────────────────────────────────────
        log("Step 5/5: Writing manifest.json...")
        per_dur  = duration / max(1, len(image_paths))
        timeline = []
        for idx, img_path in enumerate(image_paths):
            st = idx * per_dur
            et = min(duration, (idx + 1) * per_dur)
            pe = prompts_list[idx] if idx < len(prompts_list) else {}
            slide_f = project_dir / f"slide_{idx:02d}.mp4"
            timeline.append({
                "clip_index":       idx,
                "start_s":          round(st, 2),
                "end_s":            round(et, 2),
                "duration_s":       round(et - st, 2),
                "image_path":       str(Path(img_path).resolve()),
                "slide_video_path": str(slide_f.resolve()) if slide_f.exists() else None,
                "keyword":          keywords[idx % len(keywords)] if keywords else "",
                "prompt":           pe.get("prompt", ""),
                "caption_text":     pe.get("filename", Path(img_path).name),
                "filename":         pe.get("filename", Path(img_path).name),
            })

        hashtags = (["#shorts"] if video_type == "short" else ["#youtube"]) + [f"#{t}" for t in tags[:6]]

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
                "master_audio_path": master_audio,
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
        log(f"\n[OK] Done ({mode})! {duration:.1f}s · {resolution} · {size_mb:.1f} MB")

        _RENDER_JOBS[job_id].update({
            "status":        "done",
            "video_path":    str(Path(final).relative_to(OUTPUT_ROOT)),
            "manifest_path": str(manifest_path.relative_to(OUTPUT_ROOT)),
            "duration_s":    round(duration, 2),
            "resolution":    resolution,
            "size_mb":       round(size_mb, 2),
            "mode":          mode,
        })

    except Exception as exc:
        import traceback
        log(f"\n[ERROR] {exc}\n{traceback.format_exc()}")
        _RENDER_JOBS[job_id]["status"] = "error"
        _RENDER_JOBS[job_id]["error"]  = str(exc)


@app.route("/api/studio/render/<path:project_id>", methods=["POST"])
def studio_render(project_id):
    """Kick off the rendering pipeline for a studio project (non-blocking).
    Supports granular modes: 'full', 'narration_only', 'slideshow_only', 'subtitles_only'."""
    project_dir = OUTPUT_ROOT / project_id
    meta_path   = project_dir / "studio_meta.json"
    if not project_dir.exists():
        return jsonify({"error": f"Project not found: {project_id}"}), 404
    if not meta_path.exists():
        return jsonify({"error": "studio_meta.json not found in project"}), 404

    data = request.get_json(silent=True) or {}
    mode = data.get("mode", "full")

    # Update meta with any passed overrides (e.g. voice, sfx_volume, bgm_preset, subtitle styles)
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    for k, v in data.items():
        if k != "mode" and v is not None:
            meta[k] = v
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")

    # Clean up according to mode
    if mode == "full":
        for old_file in list(project_dir.glob("Final_*.mp4")) + list(project_dir.glob("slide_*.mp4")) + [
            project_dir / "manifest.json", project_dir / "base.mp4", project_dir / "slides_silent.mp4",
            project_dir / "slides_concat.txt", project_dir / "narration.wav", project_dir / "narration_sfx.wav",
            project_dir / "master_audio_bgm.wav", project_dir / "captions.ass"
        ]:
            try:
                if old_file.exists():
                    old_file.unlink()
            except Exception:
                pass
    elif mode == "narration_only":
        for old_file in list(project_dir.glob("Final_*.mp4")) + [
            project_dir / "narration.wav", project_dir / "narration_sfx.wav",
            project_dir / "master_audio_bgm.wav", project_dir / "captions.ass"
        ]:
            try:
                if old_file.exists():
                    old_file.unlink()
            except Exception:
                pass
    elif mode == "slideshow_only":
        for old_file in list(project_dir.glob("Final_*.mp4")) + list(project_dir.glob("slide_*.mp4")) + [
            project_dir / "base.mp4", project_dir / "slides_silent.mp4", project_dir / "slides_concat.txt"
        ]:
            try:
                if old_file.exists():
                    old_file.unlink()
            except Exception:
                pass

    job_id = str(uuid.uuid4())[:8]
    _RENDER_JOBS[job_id] = {
        "status":        "starting",
        "project_id":    project_id,
        "mode":          mode,
        "log":           f"Initializing {mode} pipeline…",
        "video_path":    None,
        "manifest_path": None,
        "error":         None,
    }
    threading.Thread(target=_run_render_job, args=(job_id, project_dir, meta, mode), daemon=True).start()
    return jsonify({"job_id": job_id, "status": "starting", "mode": mode})


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

                # Derive true status — if Final video exists on disk it's always complete
                status = "complete" if fin_path else meta.get("status", "unknown")

                projects.append({
                    "project_id":      f"{date_dir.name}/{proj_dir.name}",
                    "title":           meta.get("title", proj_dir.name),
                    "script":          meta.get("script", ""),
                    "keywords":        meta.get("keywords", []),
                    "tags":            meta.get("tags", []),
                    "date":            date_dir.name,
                    "slug":            proj_dir.name,
                    "video_type":      meta.get("video_type", "short"),
                    "status":          status,
                    "has_manifest":    (proj_dir / "manifest.json").exists(),
                    "final_video":     fin_path,
                    "final_video_url": f"/studio/video/{fin_path}" if fin_path else None,
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


@app.route("/studio/image/<path:filepath>", methods=["GET"])
def serve_studio_image(filepath):
    """Serve studio generated/uploaded image files for UI previews."""
    full_path = OUTPUT_ROOT / filepath
    if full_path.exists():
        if full_path.stat().st_size > 3000:
            ext = full_path.suffix.lower()
            mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}.get(ext, "image/png")
            return send_file(full_path, mimetype=mime)
        else:
            try:
                full_path.unlink()
            except Exception:
                pass
    return jsonify({"error": "Image not found"}), 404


@app.route("/api/studio/preview_voice/<voice_id>", methods=["GET"])
def preview_voice(voice_id):
    """Generate and serve a quick 2s voice audio preview via Edge-TTS."""
    try:
        sample_dir = PROJECT_ROOT / "packages" / "ClipPilot" / "data" / "voice_samples"
        sample_dir.mkdir(parents=True, exist_ok=True)
        sample_file = str(sample_dir / f"sample_{voice_id}.mp3")
        if not Path(sample_file).exists() or Path(sample_file).stat().st_size == 0:
            parts = voice_id.split("-")
            clean_name = parts[2].replace("Neural", "") if len(parts) > 2 else voice_id
            script = f"Hello! This is the {clean_name} voice for your video."
            tts._synth_edge(script, sample_file, voice=voice_id)
        if Path(sample_file).exists() and Path(sample_file).stat().st_size > 0:
            return send_file(sample_file, mimetype="audio/mp3")
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    return jsonify({"error": "Voice preview failed"}), 400


@app.route("/studio/audio/<path:filepath>", methods=["GET"])
def serve_studio_audio(filepath):
    """Serve studio audio files (narration.wav, narration_sfx.wav, etc.)."""
    full_path = OUTPUT_ROOT / filepath
    if full_path.exists():
        ext = full_path.suffix.lower()
        mime = {".wav": "audio/wav", ".mp3": "audio/mpeg", ".aac": "audio/aac", ".m4a": "audio/mp4"}.get(ext, "audio/wav")
        return send_file(full_path, mimetype=mime)
    return jsonify({"error": "Audio file not found"}), 404


@app.route("/studio/audio_preview/<filename>", methods=["GET"])
def serve_audio_preview(filename):
    """Serve synthesized audio preview files."""
    preview_dir = PROJECT_ROOT / "packages" / "ClipPilot" / "data" / "audio_previews"
    full_path = preview_dir / filename
    if full_path.exists():
        ext = full_path.suffix.lower()
        mime = {".wav": "audio/wav", ".mp3": "audio/mpeg", ".aac": "audio/aac"}.get(ext, "audio/wav")
        return send_file(full_path, mimetype=mime)
    return jsonify({"error": "Preview not found"}), 404


@app.route("/api/studio/preview_audio", methods=["POST"])
def studio_preview_audio():
    """Synthesize narration from script and mix all SFX & BGM tags for in-browser instant preview."""
    try:
        data = request.get_json(silent=True) or {}
        script_raw = data.get("script", "")
        if not script_raw.strip():
            return jsonify({"error": "Script is empty"}), 400

        voice_name = data.get("voice", "en-US-AndrewMultilingualNeural")
        sfx_vol = float(data.get("sfx_volume", 0.85))
        bgm_preset = data.get("bgm_preset", "none")
        bgm_vol = float(data.get("bgm_volume", 0.12))

        preview_dir = PROJECT_ROOT / "packages" / "ClipPilot" / "data" / "audio_previews"
        preview_dir.mkdir(parents=True, exist_ok=True)
        prev_id = str(uuid.uuid4())[:8]
        raw_wav = str(preview_dir / f"prev_raw_{prev_id}.wav")
        out_wav = str(preview_dir / f"prev_mix_{prev_id}.wav")

        # Parse SFX & emotion markers
        _sfx_gen_path = str(PROJECT_ROOT / "scripts" / "generators")
        if _sfx_gen_path not in sys.path:
            sys.path.insert(0, _sfx_gen_path)
        from clippilot.media import signals, tts
        from sfx_engine import parse_sfx_markers, locate_sfx_timestamps, mix_sfx_into_narration, generate_preset_sfx
        _SFX_DIR = PROJECT_ROOT / "packages" / "ClipPilot" / "assets" / "sfx"
        generate_preset_sfx(_SFX_DIR)

        clean_script, sfx_events = parse_sfx_markers(script_raw)
        sfx_only = [e for e in sfx_events if e["type"] == "sfx"]
        emotion_evts = [e for e in sfx_events if e["type"] == "emotion"]

        # Synthesize voice with emotion prosody
        res = tts.synthesize(script_raw, raw_wav, voice=voice_name)
        if not res.get("available") or not Path(raw_wav).exists():
            return jsonify({"error": f"TTS synthesis failed: {res.get('reason')}"}), 500

        dur = signals.probe(raw_wav).duration_s or 0.0

        # Transcribe or estimate word timings
        from clippilot.media import transcribe as TR
        words_list = []
        if TR.whisper_available():
            try:
                tr = TR.transcribe(raw_wav, model_size="base")
                words_list = tr.get("words") or []
            except Exception:
                pass

        if words_list:
            wt = [{"start_ms": int(w.get("start", 0) * 1000), "end_ms": int(w.get("end", 0) * 1000)}
                  for w in words_list]
        else:
            wt = [{"start_ms": t["start_ms"], "end_ms": t["end_ms"]}
                  for t in tts.word_timings(clean_script, dur)]

        # Mix SFX
        master = raw_wav
        if sfx_only:
            sfx_ms = locate_sfx_timestamps(sfx_only, wt)
            master = mix_sfx_into_narration(raw_wav, sfx_ms, _SFX_DIR, out_wav, sfx_volume=sfx_vol)

        # Mix BGM if requested
        if bgm_preset and bgm_preset != "none":
            bgm_file = PROJECT_ROOT / "packages" / "ClipPilot" / "assets" / "bgm" / f"{bgm_preset}.wav"
            if bgm_file.exists():
                bgm_out = str(preview_dir / f"prev_bgm_{prev_id}.wav")
                cmd = [
                    "ffmpeg", "-y", "-i", str(master), "-stream_loop", "-1", "-i", str(bgm_file),
                    "-filter_complex", f"[1:a]volume={bgm_vol}[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[a]",
                    "-map", "[a]", "-c:a", "pcm_s16le", "-ar", "48000", bgm_out
                ]
                subprocess.run(cmd, capture_output=True, timeout=30)
                if Path(bgm_out).exists() and Path(bgm_out).stat().st_size > 0:
                    master = bgm_out

        final_filename = Path(master).name
        return jsonify({
            "audio_url": f"/studio/audio_preview/{final_filename}",
            "duration_s": round(dur, 2),
            "sfx_count": len(sfx_only),
            "emotion_count": len(emotion_evts),
            "clean_script": clean_script,
        })
    except Exception as e:
        import traceback
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500


@app.route("/api/studio/preview_bgm/<bgm_preset>", methods=["GET"])
def preview_bgm(bgm_preset):
    """Serve stock BGM audio sample."""
    bgm_file = PROJECT_ROOT / "packages" / "ClipPilot" / "assets" / "bgm" / f"{bgm_preset}.wav"
    if bgm_file.exists():
        return send_file(bgm_file, mimetype="audio/wav")
    return jsonify({"error": f"BGM track {bgm_preset} not found"}), 404


# ── SFX Library & Preview ─────────────────────────────────────────────────────

@app.route("/api/sfx/library", methods=["GET"])
def sfx_library():
    """Return all available SFX tags with emoji, description and preview URL."""
    _sfx_gen_path = str(PROJECT_ROOT / "scripts" / "generators")
    if _sfx_gen_path not in sys.path:
        sys.path.insert(0, _sfx_gen_path)
    from sfx_engine import get_sfx_library
    return jsonify(get_sfx_library())


@app.route("/api/sfx/preview/<tag>", methods=["GET"])
def sfx_preview(tag):
    """Stream the WAV file for an SFX tag (for in-browser click-to-hear).
    If the preset doesn't exist yet, generate it on demand.
    """
    _sfx_gen_path = str(PROJECT_ROOT / "scripts" / "generators")
    if _sfx_gen_path not in sys.path:
        sys.path.insert(0, _sfx_gen_path)
    from sfx_engine import resolve_sfx_asset, generate_preset_sfx

    # Sanitise tag — alphanumeric + underscore only
    import re as _re
    if not _re.match(r'^[a-zA-Z][a-zA-Z0-9_]{0,40}$', tag):
        return jsonify({"error": "Invalid tag name"}), 400

    sfx_dir = PROJECT_ROOT / "packages" / "ClipPilot" / "assets" / "sfx"
    generate_preset_sfx(sfx_dir)   # idempotent

    wav_path = resolve_sfx_asset(tag, sfx_dir)
    if wav_path and Path(wav_path).exists():
        return send_file(wav_path, mimetype="audio/wav")
    return jsonify({"error": f"SFX [{tag}] not found"}), 404


if __name__ == "__main__":
    port = int(os.environ.get("SERVER_PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=True)
