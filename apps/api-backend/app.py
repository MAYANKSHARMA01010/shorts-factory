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

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# --- Load Environment Variables ---
def load_env():
    env_file = PROJECT_ROOT / ".env"
    if env_file.exists():
        with open(env_file, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())
load_env()

DATA_DIR = PROJECT_ROOT / "packages" / "ClipPilot" / "data"

# =============================================================================
# HEALTH & STATUS ENDPOINTS
# =============================================================================

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

@app.route("/api/videos", methods=["GET"])
def get_videos():
    """Scan ClipPilot/data/ for generated .mp4 video projects."""
    videos = []
    if DATA_DIR.exists():
        for item in DATA_DIR.iterdir():
            if item.is_dir() and (item.name.startswith("explainer_") or item.name.startswith("short_")):
                mp4s = list(item.glob("*.mp4"))
                if mp4s:
                    videos.append({
                        "id": item.name,
                        "name": item.name.replace("explainer_", "").replace("short_", "").replace("_", " ").title(),
                        "path": str(mp4s[0].relative_to(DATA_DIR)),
                        "filename": mp4s[0].name,
                        "size_mb": round(mp4s[0].stat().st_size / (1024 * 1024), 2)
                    })
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

def call_gemini(prompt: str) -> str:
    """Helper to execute Gemini REST API requests."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise Exception("GEMINI_API_KEY is missing in .env")
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }
    resp = requests.post(url, json=payload, timeout=30)
    if resp.status_code != 200:
        raise Exception(f"Gemini API Error ({resp.status_code}): {resp.text}")
    
    data = resp.json()
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        raise Exception("Invalid response structure from Gemini API")

@app.route("/api/generate_metadata", methods=["POST"])
def generate_metadata():
    """Generate viral Title, Description, and Hashtags using Gemini."""
    topic = request.json.get("topic", "") if request.json else ""
    if not topic:
        return jsonify({"error": "No topic provided"}), 400
    
    prompt = f"""
    You are an expert YouTube Shorts creator. 
    I have a short vertical video about: "{topic}".
    Generate a JSON object with a viral Title, Description, and a list of 5 Hashtags.
    Format your response EXACTLY as raw JSON with no markdown formatting.
    {{
        "title": "...",
        "description": "...",
        "hashtags": "#tag1 #tag2 #tag3 #tag4 #tag5"
    }}
    """
    try:
        response_text = call_gemini(prompt)
        response_text = response_text.replace("```json", "").replace("```", "").strip()
        metadata = json.loads(response_text)
        return jsonify(metadata)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/rewrite_metadata", methods=["POST"])
def rewrite_metadata():
    """Rewrite title or description using Gemini based on user instruction."""
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
        return jsonify({"error": str(e)}), 500

# =============================================================================
# YOUTUBE PUBLISHING ENDPOINT
# =============================================================================

@app.route("/api/publish", methods=["POST"])
def publish():
    """Upload video directly to YouTube."""
    if not YouTubePublisher:
        return jsonify({"error": "YouTubePublisher module unavailable"}), 500
        
    req = request.json or {}
    video_rel_path = req.get("video_path")
    title = req.get("title")
    description = req.get("description")
    tags = req.get("hashtags", "").replace("#", "").split()
    visibility = req.get("visibility", "private")
    
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
        tags=tags,
        privacy=visibility
    )
    
    if result.get("success"):
        return jsonify({"success": True, "url": result.get("url")})
    else:
        return jsonify({"error": result.get("error", "Upload failed"), "details": result.get("response")}), 500

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

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
