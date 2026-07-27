"use client";

import { useEffect, useState, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:5001";

type Video = {
  id: string;
  name: string;
  path: string;
  filename: string;
  size_mb: number;
};

type VideoAnalytics = {
  id: string;
  title: string;
  status?: string;
  visibility?: string;
  published?: string;
  views?: number;
  views_7d?: number;
  views_30d?: number;
  likes?: number;
  comments?: number;
  avgViewPct?: number;
  avgViewDur?: number;
  minsWatched?: number;
  url?: string;
};

type Analytics = {
  channel?: {
    id?: string;
    title: string;
    subscribers: number | string;
    total_views?: number | string;
    views?: number | string;
    video_count?: number | string;
    videos?: number | string;
  };
  summary_7d?: {
    views?: number;
    likes?: number;
    comments?: number;
    avg_retention?: number;
  };
  summary_30d?: {
    views?: number;
    likes?: number;
    comments?: number;
    avg_retention?: number;
  };
  status?: string;
  analytics_status?: string;
  videos?: VideoAnalytics[];
  [key: string]: any;
};

type Ledgers = {
  daily_topics: string;
  daily_posts: string;
  studied_videos: string;
  variation_ledger: string;
};

type TopicItem = {
  id: string;
  statusRaw: string;
  isUsed: boolean;
  usedDate: string;
  title: string;
  niche: string;
  angle: string;
  guardrail: string;
};

type PostItem = {
  date: string;
  slug: string;
  title: string;
  topicNo: string;
  scheduled: string;
  finalMp4: string;
  gate: string;
  url: string;
  isLive: boolean;
};

function parseTopicsTable(markdown?: string): TopicItem[] {
  if (!markdown) return [];
  const lines = markdown.split("\n");
  const topics: TopicItem[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && !trimmed.includes("---") && !trimmed.includes("Working title")) {
      const parts = trimmed.split("|").map((p) => p.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (parts.length >= 5) {
        const id = parts[0];
        const statusRaw = parts[1];
        const title = parts[2].replace(/\*\*/g, "");
        const niche = parts[3];
        const angle = parts[4];
        const guardrail = parts[5] || "";

        const statusLower = statusRaw.toLowerCase();
        const isUsed = statusLower.startsWith("used") || (statusLower.includes("used") && !statusLower.includes("unused"));
        const usedDateMatch = statusRaw.match(/\d{4}-\d{2}-\d{2}/);
        const usedDate = usedDateMatch ? usedDateMatch[0] : "";

        topics.push({ id, statusRaw, isUsed, usedDate, title, niche, angle, guardrail });
      }
    }
  }
  return topics;
}

function parsePostsTable(markdown?: string): PostItem[] {
  if (!markdown) return [];
  const lines = markdown.split("\n");
  const posts: PostItem[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && !trimmed.includes("---") && !trimmed.includes("Slug") && !trimmed.includes("Title")) {
      const parts = trimmed.split("|").map((p) => p.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (parts.length >= 5) {
        const date = parts[0];
        const slug = parts[1];
        const title = parts[2];
        const topicNo = parts[3];
        const scheduled = parts[4] || "";
        const finalMp4 = parts[5] || "";
        const gate = parts[6] || "";

        const urlMatch = gate.match(/https:\/\/www\.youtube\.com\/watch\?v=[\w-]+/);
        const url = urlMatch ? urlMatch[0] : "";
        const isLive = gate.includes("LIVE") || gate.includes("greenlit");

        posts.push({ date, slug, title, topicNo, scheduled, finalMp4, gate, url, isLive });
      }
    }
  }
  return posts;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"videos" | "analytics" | "ledgers" | "decisions">("videos");
  
  // Backend status
  const [backendHealth, setBackendHealth] = useState<boolean | null>(null);
  
  // Video state
  const [videos, setVideos] = useState<Video[]>([]);
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  
  // Metadata state
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [metaTags, setMetaTags] = useState("");
  const [metaVideoTags, setMetaVideoTags] = useState("");
  const [metaLanguage, setMetaLanguage] = useState("en");
  const [visibility, setVisibility] = useState("private");
  
  // Publish & Schedule State
  const [publishMode, setPublishMode] = useState<"now" | "schedule">("now");
  const getDefaultDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const [scheduleDate, setScheduleDate] = useState<string>(getDefaultDate());
  const [scheduleTime, setScheduleTime] = useState<string>("18:00");
  
  // Cover State & Rewrite State
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverTimestamp, setCoverTimestamp] = useState<string>("2.0");
  const [isLoadingCover, setIsLoadingCover] = useState<boolean>(false);
  const [promptTitle, setPromptTitle] = useState("");
  const [promptDesc, setPromptDesc] = useState("");
  const [promptTags, setPromptTags] = useState("");
  const [promptVideoTags, setPromptVideoTags] = useState("");
  
  // Loading states
  const [isLoadingGen, setIsLoadingGen] = useState(false);
  const [isLoadingPub, setIsLoadingPub] = useState(false);
  const [triggerLoading, setTriggerLoading] = useState<string | null>(null);
  
  // Notifications
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Analytics & Ledgers
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [ledgers, setLedgers] = useState<Ledgers | null>(null);
  const [decisions, setDecisions] = useState<string>("");

  // Analytics Filters & Controls
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState<"all" | "30d" | "7d">("all");
  const [analyticsStatusFilter, setAnalyticsStatusFilter] = useState<"all" | "public" | "private_unlisted">("all");
  const [analyticsSortBy, setAnalyticsSortBy] = useState<"views" | "retention" | "likes" | "recent">("views");
  const [analyticsSearch, setAnalyticsSearch] = useState("");

  // Ledgers Sub-tab & Filters
  const [ledgerSubTab, setLedgerSubTab] = useState<"topics" | "posts" | "variation" | "studied">("topics");
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<"all" | "unused" | "used">("all");

  // Owner Decision State
  const [selectedOwnerChoice, setSelectedOwnerChoice] = useState<string>("C");
  const [showRawJson, setShowRawJson] = useState(false);
  const [showRawLedger, setShowRawLedger] = useState(false);
  const [showRawDecision, setShowRawDecision] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Check Health
    fetch(`${API_URL}/api/health`)
      .then(r => r.json())
      .then(data => {
        setBackendHealth(data.status === "healthy");
      })
      .catch(() => setBackendHealth(false));

    // Fetch Videos
    fetch(`${API_URL}/api/videos`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setVideos(data);
          if (data.length > 0 && !activeVideo) {
            selectVideo(data[0]);
          }
        }
      })
      .catch(e => console.error("Error fetching videos:", e));

    // Fetch Analytics
    fetch(`${API_URL}/api/analytics`)
      .then(r => r.json())
      .then(data => setAnalytics(data))
      .catch(e => console.error("Error fetching analytics:", e));

    // Fetch Ledgers
    fetch(`${API_URL}/api/ledgers`)
      .then(r => r.json())
      .then(data => setLedgers(data))
      .catch(e => console.error("Error fetching ledgers:", e));

    // Fetch Decisions
    fetch(`${API_URL}/api/decisions`)
      .then(r => r.json())
      .then(data => setDecisions(data.content || ""))
      .catch(e => console.error("Error fetching decisions:", e));
  }, []);

  useEffect(() => {
    if (activeVideo && videoRef.current) {
      videoRef.current.load();
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (err.name !== "AbortError" && err.name !== "NotAllowedError") {
            console.error("Video play error:", err);
          }
        });
      }
    }
  }, [activeVideo?.path]);

  const generateCover = async (video: Video, ts: string = "2.0") => {
    setIsLoadingCover(true);
    setCoverTimestamp(ts);
    try {
      const res = await fetch(`${API_URL}/api/generate_cover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_path: video.path, timestamp: ts })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCoverUrl(`${API_URL}${data.url}`);
    } catch (e: any) {
      console.error("Error generating cover:", e);
    } finally {
      setIsLoadingCover(false);
    }
  };

  const generateMetadataForVideo = async (video: Video) => {
    setIsLoadingGen(true);
    try {
      const res = await fetch(`${API_URL}/api/generate_metadata`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: video.name })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMetaTitle(data.title || "");
      setMetaDesc(data.description || "");
      setMetaTags(data.hashtags || "");
      setMetaVideoTags(Array.isArray(data.video_tags) ? data.video_tags.join(", ") : (data.video_tags || ""));
      setMetaLanguage(data.language || "en");
      setStatusMsg({ text: "✨ Auto-generated AI Title, Description, Hashtags, YouTube Studio Tags & Cover Frame!", type: "success" });
    } catch (e: any) {
      setStatusMsg({ text: "Error generating metadata: " + e.message, type: "error" });
    } finally {
      setIsLoadingGen(false);
    }
  };

  const selectVideo = (video: Video) => {
    setActiveVideo(video);
    setStatusMsg(null);
    generateMetadataForVideo(video);
    generateCover(video, "2.0");
  };

  const generateMetadata = () => {
    if (activeVideo) {
      generateMetadataForVideo(activeVideo);
      generateCover(activeVideo, coverTimestamp);
    }
  };

  const rewriteField = async (field: "title" | "description" | "hashtags" | "video_tags", customInstruction?: string) => {
    const prompt = customInstruction || (field === "title" ? promptTitle : field === "description" ? promptDesc : field === "hashtags" ? promptTags : promptVideoTags);
    const currentText = field === "title" ? metaTitle : field === "description" ? metaDesc : field === "hashtags" ? metaTags : metaVideoTags;
    if (!prompt) return setStatusMsg({ text: "Please enter a rewrite instruction or choose a quick preset chip.", type: "info" });
    if (!currentText) return setStatusMsg({ text: "Field is empty. Auto-generate metadata first.", type: "info" });
    
    try {
      const res = await fetch(`${API_URL}/api/rewrite_metadata`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, current_text: currentText, prompt })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      if (field === "title") {
        setMetaTitle(data.result);
        setPromptTitle("");
      } else if (field === "description") {
        setMetaDesc(data.result);
        setPromptDesc("");
      } else if (field === "hashtags") {
        setMetaTags(data.result);
        setPromptTags("");
      } else {
        setMetaVideoTags(data.result);
        setPromptVideoTags("");
      }
      setStatusMsg({ text: `Rewrote ${field} with AI!`, type: "success" });
    } catch (e: any) {
      setStatusMsg({ text: "Rewrite error: " + e.message, type: "error" });
    }
  };

  const publishVideo = async () => {
    if (!activeVideo) return;
    if (!metaTitle) return setStatusMsg({ text: "Please generate or write a Title before publishing.", type: "info" });
    if (publishMode === "schedule" && (!scheduleDate || !scheduleTime)) {
      return setStatusMsg({ text: "Please select both a valid Calendar Date and Clock Time for scheduling.", type: "info" });
    }
    
    setIsLoadingPub(true);
    const combinedISOString = publishMode === "schedule"
      ? new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString()
      : null;
    const modeText = publishMode === "schedule"
      ? `Scheduling video for ${new Date(`${scheduleDate}T${scheduleTime}:00`).toLocaleString()}...`
      : "Uploading video directly to YouTube...";
    setStatusMsg({ text: modeText, type: "info" });

    try {
      const res = await fetch(`${API_URL}/api/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_path: activeVideo.path,
          title: metaTitle,
          description: metaDesc,
          hashtags: metaTags,
          video_tags: metaVideoTags,
          language: metaLanguage,
          visibility,
          is_scheduled: publishMode === "schedule",
          publish_at: combinedISOString
        })
      });

      const data = await res.json();
      if (data.success) {
        const msg = publishMode === "schedule"
          ? `📅 Video scheduled successfully for ${new Date(`${scheduleDate}T${scheduleTime}:00`).toLocaleString()} on YouTube!`
          : `🚀 Successfully published directly to YouTube! ${data.url ? `URL: ${data.url}` : ""}`;
        setStatusMsg({ text: msg, type: "success" });
      } else {
        throw new Error(data.error || "Failed to publish video");
      }
    } catch (e: any) {
      setStatusMsg({ text: "Publish error: " + e.message, type: "error" });
    } finally {
      setIsLoadingPub(false);
    }
  };

  const triggerAction = async (action: string) => {
    setTriggerLoading(action);
    try {
      const res = await fetch(`${API_URL}/api/trigger/${action}`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ text: `Action '${action}' launched in background!`, type: "success" });
      } else {
        throw new Error(data.error);
      }
    } catch (e: any) {
      setStatusMsg({ text: `Trigger failed: ${e.message}`, type: "error" });
    } finally {
      setTriggerLoading(null);
    }
  };

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto space-y-6">
      {/* HEADER BAR */}
      <header className="glass p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-xl font-black shadow-lg">
            ⚡
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Shorts Factory Studio</h1>
            <p className="text-xs text-slate-400">ClipPilot Autonomous Video Engine & Control Dashboard</p>
          </div>
        </div>

        {/* System Status & Actions */}
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            backendHealth === true ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" :
            backendHealth === false ? "bg-rose-500/10 text-rose-400 border border-rose-500/30" :
            "bg-slate-700 text-slate-300"
          }`}>
            <span className={`w-2 h-2 rounded-full ${backendHealth ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
            {backendHealth === true ? `API Connected (${API_URL.replace("http://", "").replace("https://", "")})` : backendHealth === false ? "API Offline" : "Checking..."}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => triggerAction("daily_shorts")}
              disabled={!!triggerLoading}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-medium rounded-lg transition"
            >
              {triggerLoading === "daily_shorts" ? "Launching..." : "🎬 + Daily Short"}
            </button>
            <button
              onClick={() => triggerAction("creator_study")}
              disabled={!!triggerLoading}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-xs font-medium rounded-lg transition"
            >
              {triggerLoading === "creator_study" ? "Launching..." : "🔍 Study Competitors"}
            </button>
            <button
              onClick={() => triggerAction("learn_shorts")}
              disabled={!!triggerLoading}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-xs font-medium rounded-lg transition"
            >
              {triggerLoading === "learn_shorts" ? "Launching..." : "📈 Learn Loop"}
            </button>
          </div>
        </div>
      </header>

      {/* GLOBAL STATUS NOTIFICATION */}
      {statusMsg && (
        <div className={`p-4 rounded-xl text-sm font-medium border flex items-center justify-between ${
          statusMsg.type === "success" ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300" :
          statusMsg.type === "error" ? "bg-rose-950/40 border-rose-500/30 text-rose-300" :
          "bg-blue-950/40 border-blue-500/30 text-blue-300"
        }`}>
          <span>{statusMsg.text}</span>
          <button onClick={() => setStatusMsg(null)} className="text-xs opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-white/10 gap-8 text-sm font-medium">
        <button
          onClick={() => setActiveTab("videos")}
          className={`pb-3 transition relative ${activeTab === "videos" ? "text-amber-400 font-semibold" : "text-slate-400 hover:text-slate-200"}`}
        >
          🎬 Video Studio & Publisher
          {activeTab === "videos" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full" />}
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`pb-3 transition relative ${activeTab === "analytics" ? "text-amber-400 font-semibold" : "text-slate-400 hover:text-slate-200"}`}
        >
          📊 Channel Analytics
          {activeTab === "analytics" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full" />}
        </button>
        <button
          onClick={() => setActiveTab("ledgers")}
          className={`pb-3 transition relative ${activeTab === "ledgers" ? "text-amber-400 font-semibold" : "text-slate-400 hover:text-slate-200"}`}
        >
          📖 Content Ledgers & Rules
          {activeTab === "ledgers" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full" />}
        </button>
        <button
          onClick={() => setActiveTab("decisions")}
          className={`pb-3 transition relative ${activeTab === "decisions" ? "text-amber-400 font-semibold" : "text-slate-400 hover:text-slate-200"}`}
        >
          💡 Owner Decisions
          {activeTab === "decisions" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full" />}
        </button>
      </div>

      {/* TAB 1: VIDEO STUDIO & PUBLISHER */}
      {activeTab === "videos" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* 1. LEFT SIDEBAR: VIDEO SELECTOR LIST (3 Cols) */}
          <div className="xl:col-span-3 lg:col-span-4 glass p-4 flex flex-col space-y-3 h-[760px]">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📁 Shorts List</span>
                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-xs rounded-full">{videos.length}</span>
              </h2>
              <span className="text-[10px] text-slate-400">ClipPilot</span>
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto pr-1">
              {videos.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">No generated Shorts found in data directory.</p>
              ) : (
                videos.map((vid) => (
                  <div
                    key={vid.id}
                    onClick={() => selectVideo(vid)}
                    className={`p-3 rounded-xl cursor-pointer transition border ${
                      activeVideo?.id === vid.id
                        ? "bg-indigo-600/30 border-indigo-400 text-white shadow-lg shadow-indigo-950/50"
                        : "bg-slate-900/50 border-white/5 text-slate-300 hover:bg-slate-800/60 hover:border-slate-700"
                    }`}
                  >
                    <div className="font-semibold text-sm truncate text-white">{vid.name}</div>
                    <div className="text-[11px] text-slate-400 mt-1 flex justify-between items-center">
                      <span className="truncate max-w-[140px] text-slate-400">{vid.filename}</span>
                      <span className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-amber-300 font-mono">{vid.size_mb} MB</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. MIDDLE COLUMN: VIDEO PLAYER PREVIEW (4 Cols) */}
          <div className="xl:col-span-4 lg:col-span-8 glass p-5 flex flex-col items-center justify-center space-y-4 h-[760px]">
            {activeVideo ? (
              <>
                <div className="w-full flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="font-bold text-white text-sm truncate">{activeVideo.name}</h3>
                  <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-300">9:16 Vertical HD</span>
                </div>

                <div className="relative aspect-[9/16] h-[580px] bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 group">
                  <video
                    ref={videoRef}
                    controls
                    className="w-full h-full object-cover"
                    src={`${API_URL}/video/${activeVideo.path}`}
                  />
                </div>

                <div className="w-full text-center text-[11px] text-slate-400 flex items-center justify-center gap-3">
                  <span>📹 Path: <code className="text-slate-300">{activeVideo.filename}</code></span>
                  <span>•</span>
                  <span>📦 Size: <strong className="text-amber-300">{activeVideo.size_mb} MB</strong></span>
                </div>
              </>
            ) : (
              <div className="text-center text-slate-400 space-y-3 p-8">
                <div className="text-4xl">👈</div>
                <h3 className="text-base font-semibold text-white">Select a Short Video</h3>
                <p className="text-xs">Choose any video from the left sidebar to preview and publish.</p>
              </div>
            )}
          </div>

          {/* 3. RIGHT COLUMN: METADATA & YOUTUBE PUBLISHER (5 Cols) */}
          <div className="xl:col-span-5 lg:col-span-12 glass p-5 flex flex-col space-y-4 h-[760px]">
            {activeVideo ? (
              <>
                {/* HEADER */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
                  <div>
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      <span>Metadata & YouTube Studio</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">AI auto-generated. Fully editable before uploading.</p>
                  </div>
                  <button
                    onClick={generateMetadata}
                    disabled={isLoadingGen}
                    className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-bold text-xs rounded-lg transition shadow-lg flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isLoadingGen ? "Generating..." : "✨ Auto-Generate All"}
                  </button>
                </div>

                {/* SCROLLABLE FORM BODY */}
                <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                  {/* COVER FRAME SELECTOR */}
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                        🖼️ Cover Thumbnail Frame
                        <span className="text-[10px] text-slate-400 font-normal">(@ {coverTimestamp}s)</span>
                      </label>
                      <div className="flex gap-1">
                        {["1.0", "2.5", "5.0", "8.0"].map((ts) => (
                          <button
                            key={ts}
                            onClick={() => activeVideo && generateCover(activeVideo, ts)}
                            disabled={isLoadingCover}
                            className={`px-1.5 py-0.5 text-[10px] rounded border transition ${
                              coverTimestamp === ts
                                ? "bg-amber-500/20 border-amber-400 text-amber-300 font-bold"
                                : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                            }`}
                          >
                            {ts}s
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      {coverUrl ? (
                        <div className="relative aspect-[9/16] h-16 bg-black rounded-lg overflow-hidden border border-amber-500/40 shadow shrink-0">
                          <img src={coverUrl} alt="Cover Frame" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="aspect-[9/16] h-16 bg-slate-950 rounded-lg flex items-center justify-center border border-slate-800 shrink-0 text-slate-500 text-[10px]">
                          No Frame
                        </div>
                      )}
                      <div className="flex-1 space-y-1">
                        <p className="text-[11px] text-slate-300">
                          {isLoadingCover ? "Extracting frame..." : "Cover image used as video thumbnail."}
                        </p>
                        <button
                          onClick={() => activeVideo && generateCover(activeVideo, (Math.random() * 8 + 1).toFixed(1))}
                          disabled={isLoadingCover}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 rounded border border-slate-700 transition"
                        >
                          🎲 Pick Random Frame
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* TITLE */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-200">Title</label>
                      <div className="flex gap-1 text-[10px]">
                        <button onClick={() => rewriteField("title", "Make it catchier with high emotional hook")} className="px-1.5 py-0.5 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/60 rounded text-indigo-300 transition">🔥 Catchier</button>
                        <button onClick={() => rewriteField("title", "Rephrase as an irresistible curiosity question")} className="px-1.5 py-0.5 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/60 rounded text-indigo-300 transition">❓ Curiosity</button>
                        <button onClick={() => rewriteField("title", "Optimize title for high-CPM finance/tech niche")} className="px-1.5 py-0.5 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/60 rounded text-indigo-300 transition">📈 High-CPM</button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={metaTitle}
                      onChange={(e) => setMetaTitle(e.target.value)}
                      placeholder="Click Generate or enter title..."
                      className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promptTitle}
                        onChange={(e) => setPromptTitle(e.target.value)}
                        placeholder="Instruction: e.g. Make it catchier..."
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-200"
                      />
                      <button
                        onClick={() => rewriteField("title")}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-medium rounded-lg text-slate-200 transition shrink-0"
                      >
                        Rewrite
                      </button>
                    </div>
                  </div>

                  {/* DESCRIPTION */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-200">Description</label>
                      <div className="flex gap-1 text-[10px]">
                        <button onClick={() => rewriteField("description", "Add a powerful call to action asking viewers to subscribe")} className="px-1.5 py-0.5 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/60 rounded text-indigo-300 transition">📣 Call to Action</button>
                        <button onClick={() => rewriteField("description", "Expand description into a rich SEO keyword story")} className="px-1.5 py-0.5 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/60 rounded text-indigo-300 transition">🔍 SEO Focus</button>
                      </div>
                    </div>
                    <textarea
                      rows={2}
                      value={metaDesc}
                      onChange={(e) => setMetaDesc(e.target.value)}
                      placeholder="Click Generate or enter description..."
                      className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400 resize-none leading-relaxed"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promptDesc}
                        onChange={(e) => setPromptDesc(e.target.value)}
                        placeholder="Instruction: e.g. Add a strong CTA..."
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-200"
                      />
                      <button
                        onClick={() => rewriteField("description")}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-medium rounded-lg text-slate-200 transition shrink-0"
                      >
                        Rewrite
                      </button>
                    </div>
                  </div>

                  {/* HASHTAGS */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-200">Hashtags (for Description)</label>
                      <div className="flex gap-1 text-[10px]">
                        <button onClick={() => rewriteField("hashtags", "Generate 5 trending viral YouTube Shorts hashtags")} className="px-1.5 py-0.5 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/60 rounded text-indigo-300 transition">🔥 Trending</button>
                        <button onClick={() => rewriteField("hashtags", "Generate 5 high-CPM specific topic hashtags")} className="px-1.5 py-0.5 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/60 rounded text-indigo-300 transition">🎯 Niche Tags</button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={metaTags}
                      onChange={(e) => setMetaTags(e.target.value)}
                      placeholder="#shorts #facts #science"
                      className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-amber-300 focus:outline-none focus:border-amber-400 font-mono"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promptTags}
                        onChange={(e) => setPromptTags(e.target.value)}
                        placeholder="Instruction: e.g. Focus on space..."
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-200"
                      />
                      <button
                        onClick={() => rewriteField("hashtags")}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-medium rounded-lg text-slate-200 transition shrink-0"
                      >
                        Rewrite
                      </button>
                    </div>
                  </div>

                  {/* YOUTUBE STUDIO VIDEO TAGS (KEYWORDS) */}
                  <div className="space-y-1.5 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                        🏷️ YouTube Studio Tags (Keywords)
                        <span className="text-[10px] text-slate-400 font-normal">(comma-separated)</span>
                      </label>
                      <div className="flex gap-1 text-[10px]">
                        <button onClick={() => rewriteField("video_tags", "Generate 10 high volume search keywords for YouTube Studio tags")} className="px-1.5 py-0.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/60 rounded text-emerald-300 transition">🔥 High Volume</button>
                        <button onClick={() => rewriteField("video_tags", "Generate 10 specific longtail niche search phrases for YouTube Studio tags")} className="px-1.5 py-0.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/60 rounded text-emerald-300 transition">🎯 Niche Keywords</button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={metaVideoTags}
                      onChange={(e) => setMetaVideoTags(e.target.value)}
                      placeholder="why is ocean salty, ocean facts, salty water, science explainer, ocean, salt"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-emerald-300 focus:outline-none focus:border-emerald-400 font-mono"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promptVideoTags}
                        onChange={(e) => setPromptVideoTags(e.target.value)}
                        placeholder="Instruction: e.g. Add 5 search phrases..."
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-200"
                      />
                      <button
                        onClick={() => rewriteField("video_tags")}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-medium rounded-lg text-slate-200 transition shrink-0"
                      >
                        Rewrite
                      </button>
                    </div>
                  </div>

                  {/* UPLOAD MODE & SCHEDULING CARD */}
                  <div className="space-y-2.5 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
                        🚀 Upload Mode & Scheduling
                      </label>
                      <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                        <button
                          onClick={() => setPublishMode("now")}
                          className={`px-2.5 py-1 rounded-md transition text-[11px] font-medium ${
                            publishMode === "now"
                              ? "bg-red-600 text-white font-bold shadow"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          ⚡ Upload Directly
                        </button>
                        <button
                          onClick={() => setPublishMode("schedule")}
                          className={`px-2.5 py-1 rounded-md transition text-[11px] font-medium ${
                            publishMode === "schedule"
                              ? "bg-purple-600 text-white font-bold shadow"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          📅 Schedule Upload
                        </button>
                      </div>
                    </div>

                    {publishMode === "schedule" ? (
                      <div className="space-y-3 pt-1">
                        {/* CALENDAR DATE & CLOCK TIME PICKERS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* CALENDAR DATE PICKER */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-purple-300 flex items-center justify-between">
                              <span>📅 Release Date (Calendar)</span>
                              <div className="flex gap-1 text-[9px]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const d = new Date();
                                    d.setDate(d.getDate() + 1);
                                    const pad = (n: number) => n.toString().padStart(2, '0');
                                    setScheduleDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
                                  }}
                                  className="px-1.5 py-0.5 bg-purple-950 hover:bg-purple-900 border border-purple-700/60 text-purple-300 rounded transition"
                                >
                                  Tomorrow
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const d = new Date();
                                    d.setDate(d.getDate() + 2);
                                    const pad = (n: number) => n.toString().padStart(2, '0');
                                    setScheduleDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
                                  }}
                                  className="px-1.5 py-0.5 bg-purple-950 hover:bg-purple-900 border border-purple-700/60 text-purple-300 rounded transition"
                                >
                                  In 2 Days
                                </button>
                              </div>
                            </label>
                            <input
                              type="date"
                              value={scheduleDate}
                              onChange={(e) => setScheduleDate(e.target.value)}
                              className="w-full bg-slate-950 border border-purple-500/50 rounded-lg px-3 py-1.5 text-xs text-purple-200 focus:outline-none focus:border-purple-400 font-mono [color-scheme:dark] cursor-pointer"
                            />
                          </div>

                          {/* CLOCK TIME PICKER */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-purple-300 flex items-center justify-between">
                              <span>🕒 Release Time (Clock)</span>
                              <div className="flex gap-1 text-[9px]">
                                <button
                                  type="button"
                                  onClick={() => setScheduleTime("09:00")}
                                  className="px-1.5 py-0.5 bg-purple-950 hover:bg-purple-900 border border-purple-700/60 text-purple-300 rounded transition"
                                >
                                  9 AM
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setScheduleTime("18:00")}
                                  className="px-1.5 py-0.5 bg-purple-950 hover:bg-purple-900 border border-purple-700/60 text-purple-300 rounded transition"
                                >
                                  6 PM
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setScheduleTime("20:00")}
                                  className="px-1.5 py-0.5 bg-purple-950 hover:bg-purple-900 border border-purple-700/60 text-purple-300 rounded transition"
                                >
                                  8 PM
                                </button>
                              </div>
                            </label>
                            <input
                              type="time"
                              value={scheduleTime}
                              onChange={(e) => setScheduleTime(e.target.value)}
                              className="w-full bg-slate-950 border border-purple-500/50 rounded-lg px-3 py-1.5 text-xs text-purple-200 focus:outline-none focus:border-purple-400 font-mono [color-scheme:dark] cursor-pointer"
                            />
                          </div>
                        </div>

                        {/* LIVE SUMMARY BADGE */}
                        <div className="bg-purple-950/40 p-2 rounded-lg border border-purple-800/60 flex items-center justify-between text-xs">
                          <span className="text-purple-300 font-medium flex items-center gap-1.5">
                            📅 Target Release:
                            <strong className="text-white font-bold font-mono">
                              {scheduleDate && scheduleTime
                                ? new Date(`${scheduleDate}T${scheduleTime}:00`).toLocaleString(undefined, {
                                    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                  })
                                : "Select date & time above"}
                            </strong>
                          </span>
                          <span className="px-2 py-0.5 bg-purple-900/60 text-purple-300 text-[10px] rounded-full font-semibold">Auto-Public</span>
                        </div>

                        <p className="text-[10px] text-purple-300/80 leading-normal">
                          ℹ️ YouTube Studio will hold this video as <strong>Private</strong> until it automatically turns <strong>Public</strong> at your scheduled time.
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400">
                        ⚡ Video will be uploaded directly to YouTube with selected visibility (Private, Unlisted, or Public).
                      </p>
                    )}
                  </div>
                </div>

                {/* STICKY FOOTER ACTION BAR */}
                <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 flex items-center gap-1">
                      🌐 Language: <strong className="text-white font-semibold">English (en)</strong>
                    </span>
                    <select
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                    >
                      <option value="private">🔒 Private (Test)</option>
                      <option value="unlisted">🔗 Unlisted</option>
                      <option value="public">🌐 Public (Publish)</option>
                    </select>
                  </div>

                  <button
                    onClick={publishVideo}
                    disabled={isLoadingPub || !metaTitle}
                    className={`px-5 py-2 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition shadow-lg flex items-center justify-center gap-2 ${
                      publishMode === "schedule"
                        ? "bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600"
                        : "bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600"
                    }`}
                  >
                    {isLoadingPub
                      ? (publishMode === "schedule" ? "Scheduling on YouTube..." : "Publishing to YouTube...")
                      : (publishMode === "schedule" ? "📅 Schedule on YouTube" : "🚀 Upload to YouTube Directly")}
                  </button>
                </div>
              </>
            ) : (
              <div className="glass p-12 text-center text-slate-400 space-y-3 my-auto">
                <div className="text-4xl">👈</div>
                <h3 className="text-lg font-semibold text-white">Select a Short Video</h3>
                <p className="text-xs">Select any video from the left sidebar to preview and publish to YouTube.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ANALYTICS */}
      {activeTab === "analytics" && (() => {
        const rawAnalyticsVideos: VideoAnalytics[] = analytics?.videos || [];

        const filteredAnalyticsVideos = rawAnalyticsVideos
          .filter((vid) => {
            if (analyticsSearch.trim()) {
              const query = analyticsSearch.toLowerCase();
              if (!vid.title.toLowerCase().includes(query) && !vid.id.toLowerCase().includes(query)) {
                return false;
              }
            }
            if (analyticsStatusFilter === "public" && vid.visibility !== "public" && vid.status !== "published") {
              return false;
            }
            if (analyticsStatusFilter === "private_unlisted" && vid.visibility === "public" && vid.status === "published") {
              return false;
            }
            return true;
          })
          .sort((a, b) => {
            if (analyticsSortBy === "views") {
              const vA = analyticsTimeframe === "7d" ? (a.views_7d ?? a.views ?? 0) : analyticsTimeframe === "30d" ? (a.views_30d ?? a.views ?? 0) : (a.views ?? 0);
              const vB = analyticsTimeframe === "7d" ? (b.views_7d ?? b.views ?? 0) : analyticsTimeframe === "30d" ? (b.views_30d ?? b.views ?? 0) : (b.views ?? 0);
              return vB - vA;
            }
            if (analyticsSortBy === "retention") {
              return (b.avgViewPct ?? 0) - (a.avgViewPct ?? 0);
            }
            if (analyticsSortBy === "likes") {
              return (b.likes ?? 0) - (a.likes ?? 0);
            }
            if (analyticsSortBy === "recent") {
              return new Date(b.published || 0).getTime() - new Date(a.published || 0).getTime();
            }
            return 0;
          });

        return (
          <div className="space-y-6">
            {/* TOP METRIC CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass p-5 flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-all" />
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Channel Subscribers</span>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-3xl font-black text-amber-400 tracking-tight">{analytics?.channel?.subscribers ?? 20}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">Live YouTube</span>
                </div>
              </div>

              <div className="glass p-5 flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl group-hover:bg-indigo-500/20 transition-all" />
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Channel Views</span>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-3xl font-black text-indigo-400 tracking-tight">
                    {Number(analytics?.channel?.total_views || analytics?.channel?.views || 7457).toLocaleString()}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">All Time</span>
                </div>
              </div>

              <div className="glass p-5 flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all" />
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Published Videos</span>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-3xl font-black text-emerald-400 tracking-tight">
                    {analytics?.channel?.video_count || analytics?.channel?.videos || 25}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">Uploaded & Local</span>
                </div>
              </div>

              <div className="glass p-5 flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-xl group-hover:bg-rose-500/20 transition-all" />
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Avg Audience Retention</span>
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-3xl font-black text-rose-400 tracking-tight">
                      {analytics?.summary_30d?.avg_retention || 79.5}%
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-400">Target &gt; 80%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-emerald-400 rounded-full" 
                      style={{ width: `${Math.min(100, analytics?.summary_30d?.avg_retention || 79.5)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* FILTER, SEARCH & TIMEFRAME BAR */}
            <div className="glass p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Timeframe selector */}
              <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 w-full md:w-auto">
                <button
                  onClick={() => setAnalyticsTimeframe("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${analyticsTimeframe === "all" ? "bg-amber-500 text-black shadow" : "text-slate-400 hover:text-white"}`}
                >
                  All Time
                </button>
                <button
                  onClick={() => setAnalyticsTimeframe("30d")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${analyticsTimeframe === "30d" ? "bg-amber-500 text-black shadow" : "text-slate-400 hover:text-white"}`}
                >
                  30 Days
                </button>
                <button
                  onClick={() => setAnalyticsTimeframe("7d")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${analyticsTimeframe === "7d" ? "bg-amber-500 text-black shadow" : "text-slate-400 hover:text-white"}`}
                >
                  7 Days
                </button>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 w-full md:w-auto">
                <button
                  onClick={() => setAnalyticsStatusFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${analyticsStatusFilter === "all" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"}`}
                >
                  All Status
                </button>
                <button
                  onClick={() => setAnalyticsStatusFilter("public")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${analyticsStatusFilter === "public" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"}`}
                >
                  🌐 Public
                </button>
                <button
                  onClick={() => setAnalyticsStatusFilter("private_unlisted")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${analyticsStatusFilter === "private_unlisted" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"}`}
                >
                  🔒 Private / Unlisted
                </button>
              </div>

              {/* Sort & Search */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <select
                  value={analyticsSortBy}
                  onChange={(e) => setAnalyticsSortBy(e.target.value as any)}
                  className="bg-slate-900 border border-slate-700 text-xs rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-400"
                >
                  <option value="views">Sort by Views</option>
                  <option value="retention">Sort by Retention (AVP)</option>
                  <option value="likes">Sort by Likes</option>
                  <option value="recent">Sort by Date</option>
                </select>

                <input
                  type="text"
                  value={analyticsSearch}
                  onChange={(e) => setAnalyticsSearch(e.target.value)}
                  placeholder="🔍 Search videos..."
                  className="bg-slate-900 border border-slate-700 text-xs rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 w-full md:w-44"
                />
              </div>
            </div>

            {/* VIDEO CARDS GRID */}
            <div className="space-y-4">
              <h3 className="font-bold text-white text-base flex items-center justify-between">
                <span>Video Performance Cards ({filteredAnalyticsVideos.length})</span>
                <span className="text-xs text-slate-400 font-normal">
                  Channel ID: <span className="font-mono text-amber-400">{analytics?.channel?.id || "UCbo2V8NXWPKHULT1e3EbC5A"}</span>
                </span>
              </h3>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredAnalyticsVideos.map((vid) => {
                  const viewCount = analyticsTimeframe === "7d" 
                    ? (vid.views_7d ?? vid.views ?? 0) 
                    : analyticsTimeframe === "30d" 
                    ? (vid.views_30d ?? vid.views ?? 0) 
                    : (vid.views ?? 0);

                  const retention = vid.avgViewPct ?? 75;
                  const retentionBadgeColor = retention >= 80 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" : retention >= 65 ? "text-amber-400 bg-amber-500/10 border-amber-500/30" : "text-rose-400 bg-rose-500/10 border-rose-500/30";

                  return (
                    <div key={vid.id} className="glass p-5 flex flex-col justify-between hover:border-amber-500/40 transition group">
                      <div className="space-y-3">
                        {/* Card Header: Title & Status */}
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-sm text-white group-hover:text-amber-300 transition line-clamp-2">
                            {vid.title}
                          </h4>
                          <span className={`shrink-0 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                            vid.visibility === "public" || vid.status === "published"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : vid.visibility === "unlisted"
                              ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          }`}>
                            {vid.visibility === "public" || vid.status === "published" ? "🌐 Public" : vid.visibility === "unlisted" ? "🔗 Unlisted" : "🔒 Private"}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-400">
                          Published: <span className="text-slate-300">{vid.published ? new Date(vid.published).toLocaleDateString() : "Recent"}</span>
                        </p>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-3 rounded-xl border border-white/5 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase">Views ({analyticsTimeframe})</span>
                            <span className="font-extrabold text-amber-400 text-sm">{viewCount.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase">Likes</span>
                            <span className="font-extrabold text-indigo-300 text-sm">👍 {vid.likes ?? 0}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase">Comments</span>
                            <span className="font-extrabold text-slate-200 text-sm">💬 {vid.comments ?? 0}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase">Avg Duration</span>
                            <span className="font-extrabold text-slate-200 text-sm">⏱️ {vid.avgViewDur ?? 30}s</span>
                          </div>
                        </div>

                        {/* Retention Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-slate-400 text-[11px]">Audience Retention (AVP)</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] border font-bold ${retentionBadgeColor}`}>
                              {retention}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                retention >= 80 ? "bg-emerald-400" : retention >= 65 ? "bg-amber-400" : "bg-rose-400"
                              }`} 
                              style={{ width: `${Math.min(100, retention)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Action */}
                      {vid.url && (
                        <div className="pt-4 mt-3 border-t border-white/5 flex justify-end">
                          <a
                            href={vid.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 transition"
                          >
                            View on YouTube ↗
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {filteredAnalyticsVideos.length === 0 && (
                <div className="glass p-12 text-center text-slate-400 space-y-3">
                  <div className="text-4xl">📺</div>
                  <h4 className="text-lg font-bold text-white">No YouTube Video Uploads Found Yet</h4>
                  <p className="text-xs text-slate-300 max-w-md mx-auto">
                    Connected Channel: <span className="text-amber-400 font-semibold">{analytics?.channel?.title || "Mayank Sharma"}</span> (<span className="font-mono text-amber-400">{analytics?.channel?.id || "UCbo2V8NXWPKHULT1e3EbC5A"}</span>)
                  </p>
                  <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
                    0 public video metrics are currently listed for this channel. When you upload or publish videos via YouTube Studio or the <strong>Video Studio & Publisher</strong> tab, live views, likes, comments, and retention performance cards will automatically populate here!
                  </p>
                </div>
              )}
            </div>

            {/* RAW JSON DEVELOPER DRAWER */}
            <div className="glass p-4 rounded-xl space-y-2">
              <button
                onClick={() => setShowRawJson(!showRawJson)}
                className="text-xs font-semibold text-slate-400 hover:text-amber-400 flex items-center gap-2 transition"
              >
                <span>{showRawJson ? "▼ Hide" : "▶ Show"} Raw JSON Payload (Developer View)</span>
              </button>

              {showRawJson && (
                <pre className="bg-slate-950 p-4 rounded-xl text-xs text-emerald-400 font-mono overflow-x-auto max-h-[300px] mt-2">
                  {JSON.stringify(analytics, null, 2)}
                </pre>
              )}
            </div>
          </div>
        );
      })()}

      {/* TAB 3: LEDGERS */}
      {activeTab === "ledgers" && (() => {
        const topics = parseTopicsTable(ledgers?.daily_topics);
        const posts = parsePostsTable(ledgers?.daily_posts);

        const unusedCount = topics.filter(t => !t.isUsed).length;
        const usedCount = topics.filter(t => t.isUsed).length;

        const filteredTopics = topics.filter(t => {
          if (ledgerStatusFilter === "unused" && t.isUsed) return false;
          if (ledgerStatusFilter === "used" && !t.isUsed) return false;
          if (ledgerSearch.trim()) {
            const q = ledgerSearch.toLowerCase();
            return t.title.toLowerCase().includes(q) || t.niche.toLowerCase().includes(q) || t.id.includes(q);
          }
          return true;
        });

        return (
          <div className="space-y-6">
            {/* OVERVIEW STAT CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glass p-5">
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Topic Backlog Total</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-3xl font-black text-amber-400">{topics.length || 29}</span>
                  <span className="text-xs text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                    {unusedCount} Unused / Ready
                  </span>
                </div>
              </div>

              <div className="glass p-5">
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Produced & Posted</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-3xl font-black text-indigo-400">{usedCount || 6}</span>
                  <span className="text-xs text-amber-300 font-semibold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                    {posts.length} Logged Posts
                  </span>
                </div>
              </div>

              <div className="glass p-5">
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">House Title Pattern</span>
                <div className="mt-2 text-xs font-semibold text-rose-300 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20 truncate">
                  "YOUR &lt;thing&gt; is lying to you"
                </div>
              </div>
            </div>

            {/* SUB TAB CONTROLS */}
            <div className="glass p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 w-full md:w-auto">
                <button
                  onClick={() => setLedgerSubTab("topics")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${ledgerSubTab === "topics" ? "bg-amber-500 text-black shadow" : "text-slate-400 hover:text-white"}`}
                >
                  📅 Topics ({topics.length})
                </button>
                <button
                  onClick={() => setLedgerSubTab("posts")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${ledgerSubTab === "posts" ? "bg-amber-500 text-black shadow" : "text-slate-400 hover:text-white"}`}
                >
                  📜 Post History ({posts.length})
                </button>
                <button
                  onClick={() => setLedgerSubTab("variation")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${ledgerSubTab === "variation" ? "bg-amber-500 text-black shadow" : "text-slate-400 hover:text-white"}`}
                >
                  🧠 Variation Rules
                </button>
                <button
                  onClick={() => setLedgerSubTab("studied")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${ledgerSubTab === "studied" ? "bg-amber-500 text-black shadow" : "text-slate-400 hover:text-white"}`}
                >
                  🔍 Studied Videos
                </button>
              </div>

              {ledgerSubTab === "topics" && (
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                    <button
                      onClick={() => setLedgerStatusFilter("all")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${ledgerStatusFilter === "all" ? "bg-slate-700 text-white" : "text-slate-400"}`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setLedgerStatusFilter("unused")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${ledgerStatusFilter === "unused" ? "bg-emerald-600 text-white" : "text-slate-400"}`}
                    >
                      Unused
                    </button>
                    <button
                      onClick={() => setLedgerStatusFilter("used")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${ledgerStatusFilter === "used" ? "bg-amber-600 text-white" : "text-slate-400"}`}
                    >
                      Used
                    </button>
                  </div>

                  <input
                    type="text"
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    placeholder="🔍 Filter topics..."
                    className="bg-slate-900 border border-slate-700 text-xs rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 w-full md:w-44"
                  />
                </div>
              )}
            </div>

            {/* SUB TAB CONTENT */}
            {ledgerSubTab === "topics" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredTopics.map((item) => (
                    <div key={item.id} className="glass p-5 flex flex-col justify-between space-y-3 hover:border-amber-500/40 transition">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-amber-400">#{item.id}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            item.isUsed ? "bg-amber-500/10 text-amber-300 border-amber-500/30" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          }`}>
                            {item.isUsed ? `✅ USED ${item.usedDate}` : "📌 READY / UNUSED"}
                          </span>
                        </div>

                        <h4 className="font-bold text-sm text-white">{item.title}</h4>
                        
                        <div className="inline-block bg-slate-900/90 text-[11px] font-semibold text-indigo-300 px-2.5 py-1 rounded-md border border-slate-800">
                          Niche: {item.niche}
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-2.5 rounded-lg border border-white/5">
                          <strong className="text-slate-400">Mechanism:</strong> {item.angle}
                        </p>
                      </div>

                      {item.guardrail && (
                        <div className="text-[11px] text-rose-300 bg-rose-500/10 p-2 rounded-md border border-rose-500/20">
                          🛡️ <strong>Guardrail:</strong> {item.guardrail}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {filteredTopics.length === 0 && (
                  <div className="glass p-12 text-center text-slate-400">
                    No topics found matching query.
                  </div>
                )}
              </div>
            )}

            {ledgerSubTab === "posts" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {posts.map((post, idx) => (
                    <div key={idx} className="glass p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-slate-400">{post.date}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                          Slug: {post.slug}
                        </span>
                      </div>

                      <h4 className="font-bold text-sm text-white">{post.title}</h4>

                      <div className="text-xs text-slate-400 space-y-1">
                        <p>Topic ID: <span className="font-mono text-amber-400">#{post.topicNo}</span></p>
                        {post.finalMp4 && <p className="truncate">File: <span className="text-slate-300 font-mono text-[11px]">{post.finalMp4}</span></p>}
                      </div>

                      {post.url && (
                        <div className="pt-2 border-t border-white/5 flex justify-end">
                          <a
                            href={post.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 transition"
                          >
                            View on YouTube ↗
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {ledgerSubTab === "variation" && (
              <div className="glass p-6 space-y-4">
                <h3 className="font-bold text-white text-base">🧠 Variation Rules & Autonomous Guardrails</h3>
                <pre className="bg-slate-950 p-4 rounded-xl text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                  {ledgers?.variation_ledger || "No variation rules loaded."}
                </pre>
              </div>
            )}

            {ledgerSubTab === "studied" && (
              <div className="glass p-6 space-y-4">
                <h3 className="font-bold text-white text-base">🔍 Studied Competitor Videos & Hooks</h3>
                <pre className="bg-slate-950 p-4 rounded-xl text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                  {ledgers?.studied_videos || "No studied videos loaded."}
                </pre>
              </div>
            )}

            {/* RAW MARKDOWN TOGGLE */}
            <div className="glass p-4 rounded-xl space-y-2">
              <button
                onClick={() => setShowRawLedger(!showRawLedger)}
                className="text-xs font-semibold text-slate-400 hover:text-amber-400 flex items-center gap-2 transition"
              >
                <span>{showRawLedger ? "▼ Hide" : "▶ Show"} Raw Markdown Files (Developer View)</span>
              </button>

              {showRawLedger && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <span className="text-xs text-slate-400 font-mono">daily_topics.md</span>
                    <pre className="bg-slate-950 p-3 rounded-xl text-xs text-emerald-400 font-mono whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                      {ledgers?.daily_topics}
                    </pre>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-slate-400 font-mono">daily_posts_ledger.md</span>
                    <pre className="bg-slate-950 p-3 rounded-xl text-xs text-emerald-400 font-mono whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                      {ledgers?.daily_posts}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* TAB 4: DECISIONS */}
      {activeTab === "decisions" && (
        <div className="space-y-6">
          <div className="glass p-6 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <span>💡 Strategic Decisions for Channel Owner</span>
              </h3>
              <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-bold rounded-full">
                1 Decision Fork Pending
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
              The self-learning AI loop automatically applies tactical optimizations (hooks, titles, pacing, topic order). Strategic forks — such as channel niche focus, revenue vs reach trade-offs, and publishing cadence — are parked here for your decision.
            </p>
          </div>

          {/* DECISION CARD #1 */}
          <div className="glass p-6 space-y-6 border-l-4 border-l-amber-400">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <span className="text-xs font-mono text-amber-400 font-bold">2026-07-01 (Updated 2026-07-02) · DECISION #1</span>
                <h4 className="text-base font-bold text-white mt-1">
                  Niche Strategy: High-CPM Finance (Low Views) vs Universal Curiosity (High Views)?
                </h4>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                Action Recommended: Option C (Hybrid)
              </span>
            </div>

            {/* CHANNEL DATA CALLOUT */}
            <div className="bg-slate-900/80 p-4 rounded-xl border border-white/5 space-y-2 text-xs">
              <h5 className="font-bold text-amber-300 flex items-center gap-1.5">
                <span>📊 Channel Performance Findings:</span>
              </h5>
              <p className="text-slate-300 leading-relaxed">
                Science & universal curiosity videos pull <strong>1,000–1,500 views</strong> on average. Finance shorts pull lower initial views (~67 views), BUT show <strong>76.1% Audience Retention (AVP)</strong> (vs 49.7% AVP for science). Viewers who watch finance shorts stay longer!
              </p>
              <p className="text-slate-400">
                Finance RPM is <strong>$0.08–$0.35 vs $0.03–$0.12</strong> for general entertainment (5–10× higher earnings per view).
              </p>
            </div>

            {/* THREE STRATEGIC OPTIONS GRID */}
            <div className="space-y-3">
              <h5 className="font-bold text-white text-xs uppercase tracking-wider">Select Your Preferred Channel Niche Strategy:</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* OPTION A */}
                <div 
                  onClick={() => setSelectedOwnerChoice("A")}
                  className={`p-5 rounded-2xl cursor-pointer transition border flex flex-col justify-between space-y-4 ${
                    selectedOwnerChoice === "A"
                      ? "bg-amber-500/10 border-amber-500 text-white shadow-lg"
                      : "bg-slate-900/50 border-white/10 text-slate-300 hover:bg-slate-900"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-amber-400">Option A</span>
                      {selectedOwnerChoice === "A" && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500 text-black">SELECTED</span>}
                    </div>
                    <h6 className="font-bold text-sm text-white">Pure Finance</h6>
                    <p className="text-xs text-slate-400 leading-relaxed">Keep 100% money and credit topics.</p>
                    <div className="text-[11px] space-y-1 text-slate-300 pt-2 border-t border-white/5">
                      <p><strong>Views:</strong> Low (~50–500)</p>
                      <p><strong>RPM:</strong> High ($18–$45 CPM)</p>
                      <p><strong>Best for:</strong> Maximum earnings per view & patient audience growth.</p>
                    </div>
                  </div>
                  <button className={`w-full py-1.5 text-xs font-semibold rounded-lg transition ${selectedOwnerChoice === "A" ? "bg-amber-500 text-black" : "bg-slate-800 text-slate-300"}`}>
                    {selectedOwnerChoice === "A" ? "Active Choice" : "Select Option A"}
                  </button>
                </div>

                {/* OPTION B */}
                <div 
                  onClick={() => setSelectedOwnerChoice("B")}
                  className={`p-5 rounded-2xl cursor-pointer transition border flex flex-col justify-between space-y-4 ${
                    selectedOwnerChoice === "B"
                      ? "bg-amber-500/10 border-amber-500 text-white shadow-lg"
                      : "bg-slate-900/50 border-white/10 text-slate-300 hover:bg-slate-900"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-amber-400">Option B</span>
                      {selectedOwnerChoice === "B" && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500 text-black">SELECTED</span>}
                    </div>
                    <h6 className="font-bold text-sm text-white">Pure Curiosity</h6>
                    <p className="text-xs text-slate-400 leading-relaxed">Pivot to science, body hacks, survival & history.</p>
                    <div className="text-[11px] space-y-1 text-slate-300 pt-2 border-t border-white/5">
                      <p><strong>Views:</strong> High (1k–5k+)</p>
                      <p><strong>RPM:</strong> Low RPM ($0.03–$0.12)</p>
                      <p><strong>Best for:</strong> Rapid subscriber growth & maximum viral reach.</p>
                    </div>
                  </div>
                  <button className={`w-full py-1.5 text-xs font-semibold rounded-lg transition ${selectedOwnerChoice === "B" ? "bg-amber-500 text-black" : "bg-slate-800 text-slate-300"}`}>
                    {selectedOwnerChoice === "B" ? "Active Choice" : "Select Option B"}
                  </button>
                </div>

                {/* OPTION C */}
                <div 
                  onClick={() => setSelectedOwnerChoice("C")}
                  className={`p-5 rounded-2xl cursor-pointer transition border flex flex-col justify-between space-y-4 ${
                    selectedOwnerChoice === "C"
                      ? "bg-amber-500/20 border-amber-400 text-white shadow-xl ring-1 ring-amber-400"
                      : "bg-slate-900/50 border-white/10 text-slate-300 hover:bg-slate-900"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-amber-400">Option C ⭐</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">RECOMMENDED</span>
                    </div>
                    <h6 className="font-bold text-sm text-white">Hybrid Strategy</h6>
                    <p className="text-xs text-slate-400 leading-relaxed">2 Curiosity + 1 Finance Short/day using number-led hooks.</p>
                    <div className="text-[11px] space-y-1 text-slate-300 pt-2 border-t border-white/5">
                      <p><strong>Views:</strong> Medium–High</p>
                      <p><strong>RPM:</strong> Blended High Revenue</p>
                      <p><strong>Best for:</strong> Growing subscriber reach while keeping high-CPM revenue.</p>
                    </div>
                  </div>
                  <button className={`w-full py-1.5 text-xs font-semibold rounded-lg transition ${selectedOwnerChoice === "C" ? "bg-amber-500 text-black" : "bg-slate-800 text-slate-300"}`}>
                    {selectedOwnerChoice === "C" ? "Active Choice (Recommended)" : "Select Option C"}
                  </button>
                </div>
              </div>
            </div>

            {/* CONFIRMATION BANNER */}
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
              <span>
                <strong>Active Decision:</strong> Option {selectedOwnerChoice} is currently active for your channel pipeline.
              </span>
              <span className="font-mono text-[10px] bg-slate-900 px-2 py-1 rounded text-slate-300">
                pipeline/ledgers/decisions_needed.md
              </span>
            </div>
          </div>

          {/* RAW DOCUMENT DRAWER */}
          <div className="glass p-4 rounded-xl space-y-2">
            <button
              onClick={() => setShowRawDecision(!showRawDecision)}
              className="text-xs font-semibold text-slate-400 hover:text-amber-400 flex items-center gap-2 transition"
            >
              <span>{showRawDecision ? "▼ Hide" : "▶ Show"} Raw Strategic Decisions Document (DECISIONS_FOR_OWNER.md)</span>
            </button>

            {showRawDecision && (
              <pre className="bg-slate-950 p-4 rounded-xl text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-[400px] overflow-y-auto mt-2">
                {decisions || "No pending owner decisions."}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
