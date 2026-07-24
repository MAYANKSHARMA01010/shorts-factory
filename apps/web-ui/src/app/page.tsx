"use client";

import { useEffect, useState, useRef } from "react";

const API_URL = "http://127.0.0.1:5000";

type Video = {
  id: string;
  name: string;
  path: string;
  filename: string;
  size_mb: number;
};

type Analytics = {
  channel?: {
    title: string;
    subscribers: number;
    views: number;
    videos: number;
  };
  status?: string;
  [key: string]: any;
};

type Ledgers = {
  daily_topics: string;
  daily_posts: string;
  studied_videos: string;
  variation_ledger: string;
};

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
        if (Array.isArray(data)) setVideos(data);
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

  const selectVideo = (video: Video) => {
    setActiveVideo(video);
    setMetaTitle("");
    setMetaDesc("");
    setMetaTags("");
    setStatusMsg(null);
    if (videoRef.current) {
      videoRef.current.src = `${API_URL}/video/${video.path}`;
      videoRef.current.play();
    }
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
            {backendHealth === true ? "API Connected (Port 5000)" : backendHealth === false ? "API Offline" : "Checking..."}
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
      {activeTab === "analytics" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="glass p-5">
              <span className="text-xs text-slate-400 font-medium">Channel Subscribers</span>
              <p className="text-3xl font-black text-amber-400 mt-1">{analytics?.channel?.subscribers ?? 26}</p>
            </div>
            <div className="glass p-5">
              <span className="text-xs text-slate-400 font-medium">Total Channel Views</span>
              <p className="text-3xl font-black text-indigo-400 mt-1">{analytics?.channel?.views?.toLocaleString() ?? "7,457"}</p>
            </div>
            <div className="glass p-5">
              <span className="text-xs text-slate-400 font-medium">Published Videos</span>
              <p className="text-3xl font-black text-emerald-400 mt-1">{analytics?.channel?.videos ?? 25}</p>
            </div>
            <div className="glass p-5">
              <span className="text-xs text-slate-400 font-medium">Target Avg View % (AVP)</span>
              <p className="text-3xl font-black text-rose-400 mt-1">&gt; 80 %</p>
            </div>
          </div>

          <div className="glass p-6 space-y-4">
            <h3 className="font-bold text-white text-base">YouTube Performance Data & Insights</h3>
            {analytics?.status && <p className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-white/5">{analytics.status}</p>}
            <pre className="bg-slate-950 p-4 rounded-xl text-xs text-emerald-400 font-mono overflow-x-auto max-h-[400px]">
              {JSON.stringify(analytics, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 3: LEDGERS */}
      {activeTab === "ledgers" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass p-5 space-y-3">
            <h3 className="font-bold text-white text-sm">📅 Upcoming Topics (daily_topics.md)</h3>
            <pre className="bg-slate-950 p-3 rounded-xl text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-[300px] overflow-y-auto">
              {ledgers?.daily_topics || "Loading topics..."}
            </pre>
          </div>
          <div className="glass p-5 space-y-3">
            <h3 className="font-bold text-white text-sm">📜 Post History Ledger (daily_posts_ledger.md)</h3>
            <pre className="bg-slate-950 p-3 rounded-xl text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-[300px] overflow-y-auto">
              {ledgers?.daily_posts || "Loading post history..."}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 4: DECISIONS */}
      {activeTab === "decisions" && (
        <div className="glass p-6 space-y-4">
          <h3 className="font-bold text-white text-base">💡 Strategic Decisions for Channel Owner</h3>
          <div className="bg-slate-950 p-5 rounded-xl border border-white/10 text-xs text-slate-200 leading-relaxed font-mono whitespace-pre-wrap max-h-[500px] overflow-y-auto">
            {decisions || "No pending owner decisions."}
          </div>
        </div>
      )}
    </div>
  );
}
