import os
import sys
import json
import requests
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS

# Set up paths
HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "packages" / "ClipPilot" / "src"))

from clippilot.publish.youtube import YouTubePublisher

app = Flask(__name__)
CORS(app)

# --- Load Environment Variables ---
def load_env():
    env_file = PROJECT_ROOT / ".env"
    if env_file.exists():
        with open(env_file, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k, v)
load_env()

DATA_DIR = PROJECT_ROOT / "packages" / "ClipPilot" / "data"

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/videos", methods=["GET"])
def get_videos():
    """Scan ClipPilot/data/ for all generated .mp4 videos."""
    videos = []
    if DATA_DIR.exists():
        for item in DATA_DIR.iterdir():
            if item.is_dir() and item.name.startswith("explainer_"):
                # Find mp4 inside
                mp4s = list(item.glob("*.mp4"))
                if mp4s:
                    videos.append({
                        "id": item.name,
                        "name": item.name.replace("explainer_", "").replace("_", " ").title(),
                        "path": str(mp4s[0].relative_to(DATA_DIR)),
                        "filename": mp4s[0].name
                    })
    return jsonify(videos)

@app.route("/video/<path:filepath>")
def serve_video(filepath):
    """Serve the raw .mp4 file to the frontend video player."""
    full_path = DATA_DIR / filepath
    if full_path.exists():
        return send_file(full_path, mimetype="video/mp4")
    return "Not found", 404

def call_gemini(prompt: str) -> str:
    """Helper to call Gemini REST API."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise Exception("GEMINI_API_KEY is not set in .env")
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }
    resp = requests.post(url, json=payload)
    if resp.status_code != 200:
        raise Exception(f"Gemini API Error: {resp.text}")
    
    data = resp.json()
    return data["candidates"][0]["content"]["parts"][0]["text"]

@app.route("/api/generate_metadata", methods=["POST"])
def generate_metadata():
    """Generate initial metadata using Gemini."""
    topic = request.json.get("topic", "")
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
        # Clean up any potential markdown formatting the AI might add
        response_text = response_text.replace("```json", "").replace("```", "").strip()
        metadata = json.loads(response_text)
        return jsonify(metadata)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/rewrite_metadata", methods=["POST"])
def rewrite_metadata():
    """Rewrite a specific metadata field using Gemini based on a user prompt."""
    req = request.json
    field = req.get("field") # 'title', 'description', or 'hashtags'
    current_text = req.get("current_text")
    user_prompt = req.get("prompt")
    
    prompt = f"""
    I have the following {field} for a YouTube Short:
    "{current_text}"
    
    The user has asked to rewrite it based on this instruction:
    "{user_prompt}"
    
    Provide ONLY the rewritten {field} text. Do not include quotes around it or any extra conversational text.
    """
    try:
        new_text = call_gemini(prompt).strip()
        return jsonify({"result": new_text})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/publish", methods=["POST"])
def publish():
    """Upload video to YouTube."""
    req = request.json
    video_rel_path = req.get("video_path")
    title = req.get("title")
    description = req.get("description")
    tags = req.get("hashtags", "").replace("#", "").split()
    visibility = req.get("visibility", "private") # default private
    
    video_path = DATA_DIR / video_rel_path
    if not video_path.exists():
        return jsonify({"error": f"Video not found: {video_path}"}), 404
        
    cid = os.environ.get("YOUTUBE_CLIENT_ID")
    csec = os.environ.get("YOUTUBE_CLIENT_SECRET")
    rt = os.environ.get("YOUTUBE_REFRESH_TOKEN")

    if not cid or not rt:
        return jsonify({"error": "YouTube credentials missing in .env (YOUTUBE_CLIENT_ID, YOUTUBE_REFRESH_TOKEN)"}), 400
        
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
        return jsonify({"error": result.get("error", "Unknown error"), "details": result.get("response")}), 500

if __name__ == "__main__":
    app.run(port=5000, debug=True)
