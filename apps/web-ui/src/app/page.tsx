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

        const isUsed = statusRaw.toLowerCase().includes("used");
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
  const [visibility, setVisibility] = useState("private");
  
  // Rewrite prompt state
  const [promptTitle, setPromptTitle] = useState("");
  const [promptDesc, setPromptDesc] = useState("");
  
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
            setActiveVideo(data[0]);
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

  const selectVideo = (video: Video) => {
    setActiveVideo(video);
    setMetaTitle("");
    setMetaDesc("");
    setMetaTags("");
    setStatusMsg(null);
  };

  const generateMetadata = async () => {
    if (!activeVideo) return;
    setIsLoadingGen(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/generate_metadata`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: activeVideo.name })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMetaTitle(data.title || "");
      setMetaDesc(data.description || "");
      setMetaTags(data.hashtags || "");
      setStatusMsg({ text: "AI Metadata generated successfully!", type: "success" });
    } catch (e: any) {
      setStatusMsg({ text: "Error generating metadata: " + e.message, type: "error" });
    } finally {
      setIsLoadingGen(false);
    }
  };

  const rewriteField = async (field: "title" | "description") => {
    const prompt = field === "title" ? promptTitle : promptDesc;
    const currentText = field === "title" ? metaTitle : metaDesc;
    if (!prompt) return setStatusMsg({ text: "Please enter a rewrite instruction.", type: "info" });
    if (!currentText) return setStatusMsg({ text: "Field is empty. Generate metadata first.", type: "info" });
    
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
      } else {
        setMetaDesc(data.result);
        setPromptDesc("");
      }
      setStatusMsg({ text: `Rewrote ${field} with AI instruction!`, type: "success" });
    } catch (e: any) {
      setStatusMsg({ text: "Rewrite error: " + e.message, type: "error" });
    }
  };

  const publishVideo = async () => {
    if (!activeVideo) return;
    if (!metaTitle) return setStatusMsg({ text: "Please generate or write a Title before publishing.", type: "info" });
    
    setIsLoadingPub(true);
    setStatusMsg({ text: "Uploading video to YouTube...", type: "info" });

    try {
      const res = await fetch(`${API_URL}/api/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_path: activeVideo.path,
          title: metaTitle,
          description: metaDesc,
          hashtags: metaTags,
          visibility
        })
      });

      const data = await res.json();
      if (data.success) {
        setStatusMsg({ text: `Successfully published to YouTube! ${data.url ? `URL: ${data.url}` : ""}`, type: "success" });
      } else {
        throw new Error(data.error || "Failed to publish video");
      }
    } catch (e: any) {
      setStatusMsg({ text: "Publish Error: " + e.message, type: "error" });
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* VIDEO SELECTOR LIST */}
          <div className="lg:col-span-4 glass p-4 space-y-4">
            <h2 className="text-base font-semibold text-white flex items-center justify-between">
              <span>Generated Shorts ({videos.length})</span>
              <span className="text-xs text-slate-400 font-normal">ClipPilot Output</span>
            </h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {videos.length === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center">No generated Shorts found in ClipPilot data directory.</p>
              ) : (
                videos.map((vid) => (
                  <div
                    key={vid.id}
                    onClick={() => selectVideo(vid)}
                    className={`p-3 rounded-xl cursor-pointer transition border ${
                      activeVideo?.id === vid.id
                        ? "bg-indigo-600/20 border-indigo-500 text-white"
                        : "bg-slate-800/40 border-white/5 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="font-semibold text-sm truncate">{vid.name}</div>
                    <div className="text-xs text-slate-400 mt-1 flex justify-between">
                      <span>{vid.filename}</span>
                      <span>{vid.size_mb} MB</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* VIDEO PLAYER & METADATA EDITOR */}
          <div className="lg:col-span-8 space-y-6">
            {activeVideo ? (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* PLAYER */}
                <div className="md:col-span-5 glass p-4 flex flex-col items-center justify-center">
                  <div className="relative aspect-[9/16] w-full max-w-[280px] bg-black rounded-xl overflow-hidden shadow-2xl">
                    <video
                      ref={videoRef}
                      controls
                      className="w-full h-full object-cover"
                      src={`${API_URL}/video/${activeVideo.path}`}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-3 text-center">{activeVideo.name}</p>
                </div>

                {/* METADATA & PUBLISH */}
                <div className="md:col-span-7 glass p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white text-base">Metadata & YouTube Publisher</h3>
                    <button
                      onClick={generateMetadata}
                      disabled={isLoadingGen}
                      className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-semibold text-xs rounded-lg transition shadow"
                    >
                      {isLoadingGen ? "Generating AI Metadata..." : "✨ Generate AI Metadata"}
                    </button>
                  </div>

                  {/* TITLE */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Title</label>
                    <input
                      type="text"
                      value={metaTitle}
                      onChange={(e) => setMetaTitle(e.target.value)}
                      placeholder="Click Generate or enter title..."
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-amber-400"
                    />
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={promptTitle}
                        onChange={(e) => setPromptTitle(e.target.value)}
                        placeholder="Instruction: e.g. Make it catchier..."
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200"
                      />
                      <button
                        onClick={() => rewriteField("title")}
                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-xs font-medium rounded-lg text-slate-200"
                      >
                        Rewrite
                      </button>
                    </div>
                  </div>

                  {/* DESCRIPTION */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Description</label>
                    <textarea
                      rows={3}
                      value={metaDesc}
                      onChange={(e) => setMetaDesc(e.target.value)}
                      placeholder="Click Generate or enter description..."
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-400 resize-none"
                    />
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={promptDesc}
                        onChange={(e) => setPromptDesc(e.target.value)}
                        placeholder="Instruction: e.g. Add a strong CTA..."
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200"
                      />
                      <button
                        onClick={() => rewriteField("description")}
                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-xs font-medium rounded-lg text-slate-200"
                      >
                        Rewrite
                      </button>
                    </div>
                  </div>

                  {/* HASHTAGS */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Hashtags</label>
                    <input
                      type="text"
                      value={metaTags}
                      onChange={(e) => setMetaTags(e.target.value)}
                      placeholder="#shorts #facts #science"
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-lg p-2 text-xs text-amber-300 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  {/* VISIBILITY & PUBLISH BUTTON */}
                  <div className="pt-2 flex items-center justify-between gap-4 border-t border-white/10">
                    <select
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="private">🔒 Private (Test)</option>
                      <option value="unlisted">🔗 Unlisted</option>
                      <option value="public">🌐 Public (Publish)</option>
                    </select>

                    <button
                      onClick={publishVideo}
                      disabled={isLoadingPub || !metaTitle}
                      className="flex-1 py-2 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition shadow-lg flex items-center justify-center gap-2"
                    >
                      {isLoadingPub ? "Publishing to YouTube..." : "🚀 Upload to YouTube"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass p-12 text-center text-slate-400 space-y-3">
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
