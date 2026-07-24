# 🎈 Free Dashboard: Simple Guide (5-Year-Old Style)

Welcome! This guide explains how the **Free Dashboard** in **Shorts Factory** works in the simplest, easiest way possible! 🚀

---

## 🏬 1. The Two Main Parts & Their Ports

Think of the Free Dashboard like a toy store with a **Front Window (Frontend)** and a **Back Room (Backend)**.

```
       🌐 YOU (Browser)
             │
             │ Opens http://localhost:3000
             ▼
 🎨 FRONTEND (Port 3000)   ──(Requests Data)──►  ⚙️ API BACKEND (Port 5001)
    Next.js User Interface                         Flask Python Engine
                                                            │
                                             ┌──────────────┴──────────────┐
                                             ▼                             ▼
                                    🧠 Gemini AI (Title/Tags)   🎬 Python Render Engine (Videos)
```

### 1. 🎨 The Frontend (Port `3000`)
* **What it is:** The webpage you open in your browser (`http://localhost:3000`).
* **Analogy:** It’s like a TV remote with shiny buttons, video previews, and status lights.
* **Job:** Shows your finished videos, lets you click "Generate Metadata" or "Publish to YouTube", and displays channel status.

### 2. ⚙️ The Backend (Port `5001`)
* **What it is:** A hidden Python server running on `http://127.0.0.1:5001` (or `localhost:5001`).
* **Analogy:** It’s like the kitchen in a restaurant. You press a button on the menu (Frontend), and the kitchen (Backend) cooks up the response.
* **Job:** Fetches video files, talks to Gemini AI, handles YouTube uploads, and runs background video generation scripts.

*(Note: There is also a classic retro terminal status page on Port `8899` for live logging!)*

---

## 🧠 2. How the "Brain" Works with the Free Dashboard

Even without complex setup, the Free Dashboard has a smart **3-Step Brain Workflow**:

### Step 1: 💡 Story & Voice (Script & TTS)
1. You trigger a video generation request from the dashboard or background runner (`daily_shorts.sh`).
2. The python engine generates the script text and converts it into realistic speech audio using **Edge-TTS** (free text-to-speech voice).

### Step 2: 🎬 Video Assembly (FFmpeg & MoviePy)
1. The engine cuts and stitches background clips (or GTA/gameplay background footage) into a vertical **9:16 Short** format.
2. It automatically burns in subtitles frame-by-frame and adds background music.
3. The rendered `.mp4` file is stored in `packages/ClipPilot/data/`.

### Step 3: ✨ Metadata Brain (Gemini 2.0 Flash)
1. When you select a video in the Frontend (Port 3000), it sends a message to the Backend (Port 5001).
2. The Backend asks **Gemini 2.0 Flash** (`gemini-2.0-flash`), Google's flagship 100% free-tier AI model:
   > *"Give me a viral title, short description, and top 5 hashtags for this video topic!"*
3. If rate limits occur, it automatically falls back to `gemini-2.0-flash-lite`.
4. Gemini returns catchy titles, and the Frontend instantly displays them for you!

---

## ⚙️ 3. Environment Configuration (`.env` & `.env.example`)

Both apps use environment variable files so you can change ports, API keys, or AI models without editing code!

### ⚙️ Backend Environment (`apps/api-backend/.env` & `.env.example`)
* **`SERVER_PORT=5001`** — Controls which port the backend runs on.
* **`GEMINI_PRIMARY_MODEL=gemini-2.0-flash`** — Controls the primary free AI model.
* **`GEMINI_CANDIDATE_MODEL=gemini-2.0-flash-lite`** — Fallback AI model for rate-limit protection.
* **`YOUTUBE_CLIENT_ID`**, **`YOUTUBE_CLIENT_SECRET`**, **`YOUTUBE_REFRESH_TOKEN`** — Credentials for YouTube uploads.

### 🎨 Frontend Environment (`apps/web-ui/.env` & `.env.example`)
* **`PORT=3000`** — Controls which port the Next.js UI runs on.
* **`NEXT_PUBLIC_API_URL=http://127.0.0.1:5001`** — Connects the UI to the Flask backend.

---

## 🚀 4. How to Start Everything with One Command

### ⚡ One-Command Startup (Recommended):
Run from the root project directory:
```bash
pnpm run dev-free
```
This automatic master script (`scripts/runners/bash/dev_free.sh`):
1. 🧹 Checks and automatically frees ports `3000` and `5001`.
2. 🐍 Checks/activates Python `.venv` and installs dependencies from `requirements.txt`.
3. 📦 Installs frontend dependencies in `apps/web-ui`.
4. 🚀 Launches both Backend (5001) & Frontend (3000) concurrently!

*To open in separate macOS Terminal windows:*
```bash
pnpm run dev-free:terms
```

Now open `http://localhost:3000` in your browser and enjoy your automated Shorts factory! 🎉

---

---

## 📊 5. Complete 4-Tab Dashboard Reference & Zero Dummy Data Policy

The **Shorts Factory Studio** interface (`http://localhost:3000`) contains 4 interactive tabs designed for autonomous video generation, YouTube publishing, intelligence monitoring, and strategic channel management:

### 🎬 Tab 1: Video Studio & Publisher
* **Video Selector**: Lists all locally generated Shorts `.mp4` files from `packages/ClipPilot/data/` (e.g. `Final_Ocean_Salty.mp4`, `Final_Blackhole.mp4`).
* **HTML5 Video Player**: High-definition vertical preview player with smooth, uninterrupted `.play()` promise error handling.
* **Auto AI Metadata & Cover Frame Extractor**: Selecting a video automatically generates AI Titles, Descriptions, Hashtags (Gemini 2.0 Flash), and extracts a high-quality cover thumbnail frame.
* **Cover Frame Selector**: Switch cover frame timestamps (`1.0s`, `2.5s`, `5.0s`, `8.0s`, `🎲 Random`) or extract custom frames.
* **1-Click Field-Level Presets & AI Rewrites**:
  * **Title**: Preset chips (`🔥 Catchier`, `❓ Curiosity`, `📈 High-CPM`) + custom rewrite prompt.
  * **Description**: Preset chips (`📣 Call to Action`, `🔍 SEO Focus`) + custom rewrite prompt.
  * **Hashtags**: Preset chips (`🔥 Trending`, `🎯 Niche Tags`) + custom rewrite prompt.
  * **YouTube Studio Tags**: Preset chips (`🔥 High Volume`, `🎯 Niche Keywords`) + custom rewrite prompt. Automatically populates the YouTube Studio Tags box!
* **Default English Language**: Configured `defaultLanguage: "en"` and `defaultAudioLanguage: "en"` so YouTube Studio automatically recognizes the video as English.
* **Full Manual Access**: Edit any word in the generated fields before publishing.
* **YouTube Publisher & Scheduler**:
  * **⚡ Direct Upload**: Uploads videos directly to your YouTube channel as `Private`, `Unlisted`, or `Public`.
  * **📅 Schedule Upload**: Schedule videos for auto-release with dedicated **Calendar Release Date (`📅`)** and **Clock Release Time (`🕒`)** pickers. Includes 1-click date chips (`Tomorrow`, `In 2 Days`) and peak clock chips (`9 AM`, `6 PM`, `8 PM`). YouTube Studio holds scheduled uploads as Private and automatically turns them Public at release time!
  * **Universal Visibility Selector**: The visibility dropdown (`🔒 Private (Test)`, `🔗 Unlisted`, `🌐 Public (Publish)`) is always active and accessible across both modes.

### 📈 Tab 2: Channel Analytics Dashboard (Strict Zero Dummy Data)
* **Real Channel Metrics**: Displays live YouTube data for **Mayank Sharma** (20 Subscribers, Channel ID: `UCbo2V8NXWPKHULT1e3EbC5A`).
* **Strict Zero Dummy Data Policy**: No fake mock video cards are ever generated. If 0 public video snapshots exist on your channel, a clean channel status banner is shown. When videos are published or fetched, their live views, likes, comments, and retention performance cards populate automatically!
* **Timeframe & Status Filters**: Filter by `All Time`, `30 Days`, `7 Days`, and status (`Public` vs `Private/Unlisted`).
* **Developer View**: Collapsible drawer for inspecting raw JSON payloads.

### 📅 Tab 3: Content Ledgers & Rules
* **Topic Backlog (`daily_topics.md`)**: Interactive catalog of 29 topic ideas categorized by status (`📌 UNUSED / READY` vs `✅ USED`), CPM niche tags ($18–$45 CPM), true mechanisms, and brand-safety guardrails.
* **Post History Ledger (`daily_posts_ledger.md`)**: Card history of all posted shorts with date, slug, title, and `View on YouTube ↗` links.
* **Variation Rules & Studied Videos**: Sub-tabs displaying house title patterns ("YOUR <thing> is lying to you") and competitor research.

### 💡 Tab 4: Owner Decisions Hub
* **Strategic Decision Forks**: Strategic forks (channel niche focus, monetization vs reach trade-offs) are parked here for your decision.
* **Decision #1 (Niche Strategy)**: Interactive card pickers for **Option A** (*Pure Finance*), **Option B** (*Pure Curiosity*), and **Option C** (*Hybrid Strategy ⭐ Recommended*). Click any card to set your active channel strategy!
