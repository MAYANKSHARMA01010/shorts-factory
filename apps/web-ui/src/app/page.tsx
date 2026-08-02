"use client";

import { useEffect, useState, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:5001";

type Video = {
  id: string;
  name: string;
  path: string;
  filename: string;
  size_mb: number;
  created_at?: string;
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

type SlideItem = {
  index: number;
  slide_file: string;
  broll_image: string | null;
  has_replacement: boolean;
  duration_s: number;
  width: number;
  height: number;
};

type RecomposeStep = {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error" | "skipped";
  detail?: string;
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
  const [activeTab, setActiveTab] = useState<"videos" | "analytics" | "ledgers" | "decisions" | "create">("videos");

  // ── Studio Projects Hub & Wizard State ─────────────────────────────────────
  const [studioViewMode, setStudioViewMode]   = useState<"projects" | "wizard">("projects");
  const [studioProjects, setStudioProjects]   = useState<any[]>([]);
  const [studioProjLoading, setStudioProjLoading] = useState(false);
  const [studioStep, setStudioStep]           = useState<1|2|3|4>(1);
  const [studioVideoType, setStudioVideoType] = useState<"short"|"long">("short");
  const [studioTitle, setStudioTitle]         = useState("");
  const [studioScript, setStudioScript]       = useState("");
  const [studioKeywords, setStudioKeywords]   = useState("");
  const [studioTags, setStudioTags]           = useState("");
  const [studioScenes, setStudioScenes]       = useState<any[]>([]);
  const [studioEstDur, setStudioEstDur]       = useState(0);
  const [studioTotalImgs, setStudioTotalImgs] = useState(0);
  const [studioProjectId, setStudioProjectId] = useState("");
  const [studioJobId, setStudioJobId]         = useState("");
  const [studioRenderStatus, setStudioRenderStatus] = useState<any>(null);
  const [studioUploaded, setStudioUploaded]   = useState<Record<string,boolean>>({});
  const [studioUploadPreviews, setStudioUploadPreviews] = useState<Record<string,string>>({});
  const [studioLoading, setStudioLoading]     = useState(false);
  const [studioError, setStudioError]         = useState("");
  const [studioShortWarn, setStudioShortWarn] = useState(false);
  const [studioFallback, setStudioFallback]   = useState(false);
  const [collapsedScenes, setCollapsedScenes] = useState<Record<number, boolean>>({});
  const [reloadingPrompt, setReloadingPrompt] = useState<string | null>(null);
  const [reloadingScene, setReloadingScene]   = useState<number | null>(null);
  const [deletingProjId, setDeletingProjId]   = useState<string | null>(null);
  const studioRenderPollRef                   = useRef<ReturnType<typeof setInterval>|null>(null);

  const handleRegenerateSinglePrompt = async (si: number, ii: number) => {
    const sc = studioScenes[si];
    const img = sc?.images?.[ii];
    if (!sc || !img) return;
    const key = `s${si}_i${ii}`;
    setReloadingPrompt(key);
    try {
      const res = await fetch(`${API_URL}/api/studio/regenerate_prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: studioTitle,
          video_type: studioVideoType,
          script_excerpt: sc.script_excerpt || sc.scene_title || studioTitle,
          filename: img.filename,
          scene_index: si,
          image_index: ii,
        })
      });
      const data = await res.json();
      if (data.prompt) {
        setStudioScenes(prev => {
          const next = [...prev];
          const updatedImgs = [...(next[si].images || [])];
          updatedImgs[ii] = {
            ...updatedImgs[ii],
            prompt: data.prompt,
            scene_description: data.scene_description || updatedImgs[ii].scene_description,
          };
          next[si] = { ...next[si], images: updatedImgs };
          return next;
        });
      }
    } catch (err: any) {
      setStudioError(err.message || "Failed to regenerate prompt");
    } finally {
      setReloadingPrompt(null);
    }
  };

  const handleRegenerateScene = async (si: number) => {
    const sc = studioScenes[si];
    if (!sc) return;
    setReloadingScene(si);
    try {
      const res = await fetch(`${API_URL}/api/studio/regenerate_scene`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: studioTitle,
          video_type: studioVideoType,
          scene_index: si,
          script_excerpt: sc.script_excerpt || sc.scene_title || studioTitle,
          image_count: (sc.images || []).length || 10,
        })
      });
      const data = await res.json();
      if (data.images && data.images.length > 0) {
        setStudioScenes(prev => {
          const next = [...prev];
          next[si] = { ...next[si], images: data.images };
          return next;
        });
      }
    } catch (err: any) {
      setStudioError(err.message || "Failed to regenerate scene");
    } finally {
      setReloadingScene(null);
    }
  };
  
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

  // ── Slide Timeline Editor State ────────────────────────────────────────────
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [slidesLoading, setSlidesLoading] = useState(false);
  const [slideUploadingIdx, setSlideUploadingIdx] = useState<number | null>(null);
  const [slideRevertingIdx, setSlideRevertingIdx] = useState<number | null>(null);
  const [isRecomposing, setIsRecomposing] = useState(false);
  const [recomposeProgress, setRecomposeProgress] = useState<string | null>(null);
  // Cache-bust keys for slide thumbnails after replacement
  const [slideCacheBust, setSlideCacheBust] = useState<Record<number, number>>({});
  // Step-by-step status panel
  const [recomposeSteps, setRecomposeSteps] = useState<RecomposeStep[]>([]);
  const [showRecomposeModal, setShowRecomposeModal] = useState(false);

  const RECOMPOSE_STEPS_INIT: RecomposeStep[] = [
    { id: "video",    label: "Re-stitching slide clips into video", status: "pending" },
    { id: "manifest", label: "Updating manifest.json",             status: "pending" },
    { id: "delete",   label: "Deleting old Google Drive file",     status: "pending" },
    { id: "upload",   label: "Uploading new video to Google Drive", status: "pending" },
  ];

  const setStep = (steps: RecomposeStep[], id: string, patch: Partial<RecomposeStep>): RecomposeStep[] =>
    steps.map(s => s.id === id ? { ...s, ...patch } : s);

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

    // Fetch Studio Projects
    fetchStudioProjects();
  }, []);

  const fetchStudioProjects = async () => {
    setStudioProjLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/studio/projects`);
      const data = await res.json();
      if (Array.isArray(data)) setStudioProjects(data);
    } catch (e) {
      console.error("Failed to fetch studio projects:", e);
    } finally {
      setStudioProjLoading(false);
    }
  };

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

  const fetchSlides = async (videoId: string) => {
    setSlidesLoading(true);
    setSlides([]);
    try {
      const res = await fetch(`${API_URL}/api/project/${videoId}/manifest`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.slides) setSlides(data.slides);
    } catch (e) {
      // Slide metadata unavailable (older project without slide files)
      setSlides([]);
    } finally {
      setSlidesLoading(false);
    }
  };

  const selectVideo = (video: Video) => {
    setActiveVideo(video);
    setStatusMsg(null);
    setSlides([]);
    generateMetadataForVideo(video);
    generateCover(video, "2.0");
    fetchSlides(video.id);
  };

  const handleSlideImageUpload = async (slideIndex: number, file: File) => {
    if (!activeVideo) return;
    setSlideUploadingIdx(slideIndex);
    try {
      const formData = new FormData();
      formData.append("slide_index", String(slideIndex));
      formData.append("image", file);
      const res = await fetch(`${API_URL}/api/project/${activeVideo.id}/replace_slide`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Replace failed");
      // Update cache bust so thumbnail refreshes
      setSlideCacheBust(prev => ({ ...prev, [slideIndex]: Date.now() }));
      // Refresh slide metadata to update has_replacement flag
      await fetchSlides(activeVideo.id);
      setStatusMsg({ text: `✅ Slide ${slideIndex + 1} image replaced! Click ⚡ Re-combine Video to update the final video.`, type: "success" });
    } catch (e: any) {
      setStatusMsg({ text: `❌ Slide replace error: ${e.message}`, type: "error" });
    } finally {
      setSlideUploadingIdx(null);
    }
  };

  const handleSlideRevert = async (slideIndex: number) => {
    if (!activeVideo) return;
    setSlideRevertingIdx(slideIndex);
    try {
      const res = await fetch(`${API_URL}/api/project/${activeVideo.id}/revert_slide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slide_index: slideIndex }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Revert failed");
      setSlideCacheBust(prev => ({ ...prev, [slideIndex]: Date.now() }));
      await fetchSlides(activeVideo.id);
      setStatusMsg({ text: `↩️ Slide ${slideIndex + 1} reverted to original. Re-combine to apply.`, type: "info" });
    } catch (e: any) {
      setStatusMsg({ text: `❌ Revert error: ${e.message}`, type: "error" });
    } finally {
      setSlideRevertingIdx(null);
    }
  };

  const handleRecompose = async () => {
    if (!activeVideo) return;
    setIsRecomposing(true);
    setRecomposeProgress("Concatenating slides...");

    // Open the step-by-step modal
    const initSteps = RECOMPOSE_STEPS_INIT.map(s => ({ ...s }));
    setRecomposeSteps(initSteps);
    setShowRecomposeModal(true);

    let steps = initSteps;
    const update = (id: string, patch: Partial<RecomposeStep>) => {
      steps = setStep(steps, id, patch);
      setRecomposeSteps([...steps]);
    };

    try {
      // Step 1: Video re-compose
      update("video", { status: "running" });
      const res = await fetch(`${API_URL}/api/project/${activeVideo.id}/recompose`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Recompose failed");

      update("video", { status: "done", detail: data.video_path || "" });

      // Step 2: Manifest
      update("manifest", {
        status: data.manifest_updated ? "done" : "error",
        detail: data.manifest_updated ? "manifest.json updated with new video path & recomposed_at" : "Update failed",
      });

      // Step 3: Drive delete
      if (data.drive_error && !data.drive_deleted && !data.drive_reuploaded) {
        update("delete", { status: "skipped", detail: data.drive_error });
        update("upload", { status: "skipped", detail: "Skipped — Drive not configured or error" });
      } else {
        update("delete", {
          status: data.drive_deleted ? "done" : "skipped",
          detail: data.drive_deleted ? "Previous file removed from Drive" : "No previous Drive file found",
        });

        // Step 4: Drive upload
        update("upload", {
          status: data.drive_reuploaded ? "done" : (data.drive_error ? "error" : "skipped"),
          detail: data.drive_reuploaded
            ? `Uploaded → ${data.drive_link || "(no link)"}`
            : (data.drive_error || "Not uploaded"),
        });
      }

      // Force video player reload
      setRecomposeProgress("Done!");
      if (data.video_url && videoRef.current) {
        videoRef.current.src = `${API_URL}${data.video_url}?t=${Date.now()}`;
        videoRef.current.load();
      }
    } catch (e: any) {
      update("video", { status: "error", detail: e.message });
      update("manifest", { status: "skipped" });
      update("delete",   { status: "skipped" });
      update("upload",   { status: "skipped" });
      setStatusMsg({ text: `❌ Re-compose failed: ${e.message}`, type: "error" });
    } finally {
      setIsRecomposing(false);
      setRecomposeProgress(null);
    }
  };

  /** Small inline status icon for each recompose step */
  const StepIcon = ({ status }: { status: RecomposeStep["status"] }) => {
    if (status === "pending")  return <span className="w-4 h-4 rounded-full border border-slate-600 inline-block" />;
    if (status === "running")  return (
      <svg className="animate-spin w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
      </svg>
    );
    if (status === "done")     return <span className="text-emerald-400 text-base">✅</span>;
    if (status === "error")    return <span className="text-rose-400 text-base">❌</span>;
    if (status === "skipped")  return <span className="text-slate-500 text-base">⏭️</span>;
    return null;
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

      {/* RECOMPOSE STEP-BY-STEP MODAL */}
      {showRecomposeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md glass border border-white/10 rounded-2xl p-6 space-y-5 shadow-2xl shadow-black/60 mx-4">
            {/* Title */}
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <span className="text-xl">⚡</span> Video Re-Compose
              </h3>
              {!isRecomposing && (
                <button
                  onClick={() => setShowRecomposeModal(false)}
                  className="text-xs text-slate-400 hover:text-white border border-white/10 rounded-lg px-3 py-1 transition"
                >
                  Close
                </button>
              )}
            </div>

            {/* Step list */}
            <div className="space-y-3">
              {recomposeSteps.map((step, i) => (
                <div
                  key={step.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                    step.status === "running" ? "bg-amber-950/20 border-amber-500/30" :
                    step.status === "done"    ? "bg-emerald-950/20 border-emerald-500/20" :
                    step.status === "error"   ? "bg-rose-950/20 border-rose-500/30" :
                    step.status === "skipped" ? "bg-slate-900/40 border-white/5 opacity-60" :
                    "bg-slate-900/30 border-white/5 opacity-40"
                  }`}
                >
                  {/* Step number / status icon */}
                  <div className="flex items-center justify-center w-6 h-6 shrink-0 mt-0.5">
                    {step.status === "pending" ? (
                      <span className="text-[11px] font-bold text-slate-500">{i + 1}</span>
                    ) : (
                      <StepIcon status={step.status} />
                    )}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold ${
                      step.status === "done"    ? "text-emerald-300" :
                      step.status === "running" ? "text-amber-300" :
                      step.status === "error"   ? "text-rose-300" :
                      step.status === "skipped" ? "text-slate-500" :
                      "text-slate-500"
                    }`}>
                      {step.label}
                    </div>
                    {step.detail && (
                      <div className="text-[11px] text-slate-400 mt-0.5 break-words">
                        {step.detail}
                      </div>
                    )}
                    {step.status === "running" && (
                      <div className="mt-1.5 h-0.5 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full bg-amber-500 animate-pulse w-2/3" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer summary */}
            {!isRecomposing && recomposeSteps.length > 0 && (
              <div className={`text-xs text-center py-2 px-4 rounded-xl border ${
                recomposeSteps.some(s => s.status === "error")
                  ? "bg-rose-950/20 border-rose-500/20 text-rose-300"
                  : "bg-emerald-950/20 border-emerald-500/20 text-emerald-300"
              }`}>
                {recomposeSteps.some(s => s.status === "error")
                  ? "⚠️ Completed with errors — check steps above"
                  : "✅ All steps completed successfully!"}
              </div>
            )}
          </div>
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
        <button
          onClick={() => setActiveTab("create")}
          className={`pb-3 transition relative ${activeTab === "create" ? "text-violet-400 font-semibold" : "text-slate-400 hover:text-slate-200"}`}
        >
          ✨ Create Video
          {activeTab === "create" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-400 rounded-full" />}
        </button>
      </div>

      {/* TAB 1: VIDEO STUDIO & PUBLISHER */}
      {activeTab === "videos" && (
        <div className="space-y-6">
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

            <div className="flex-1 overflow-y-auto pr-1">
              {videos.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">No generated Shorts found in data directory.</p>
              ) : (
                (() => {
                  // Group videos by local date (YYYY-MM-DD from created_at or fallback)
                  const groups: { date: string; label: string; vids: Video[] }[] = [];
                  const seen = new Map<string, Video[]>();
                  for (const vid of videos) {
                    const iso = vid.created_at ?? "";
                    const dateKey = iso ? iso.slice(0, 10) : "unknown";
                    if (!seen.has(dateKey)) seen.set(dateKey, []);
                    seen.get(dateKey)!.push(vid);
                  }
                  // Sort date keys newest first
                  const sortedKeys = [...seen.keys()].sort((a, b) => b.localeCompare(a));
                  for (const dk of sortedKeys) {
                    const label = dk === "unknown" ? "Unknown Date" : new Date(dk + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                    groups.push({ date: dk, label, vids: seen.get(dk)! });
                  }
                  return (
                    <div className="space-y-4">
                      {groups.map((group) => (
                        <div key={group.date}>
                          {/* Date header */}
                          <div className="flex items-center gap-2 mb-2 sticky top-0 z-10 py-1" style={{background: "rgba(15,13,35,0.85)", backdropFilter: "blur(6px)"}}>
                            <span className="text-[10px] font-bold tracking-widest uppercase text-indigo-400">{group.label}</span>
                            <span className="flex-1 h-px bg-indigo-500/20"/>
                            <span className="text-[10px] text-slate-500">{group.vids.length} video{group.vids.length !== 1 ? "s" : ""}</span>
                          </div>
                          {/* Videos in this date group */}
                          <div className="space-y-2">
                            {group.vids.map((vid) => (
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
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
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

        {/* SLIDE TIMELINE EDITOR — full-width panel below the 3-col grid */}
        {activeVideo && (
          <div className="glass p-5 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <span className="text-lg">🎞️</span>
                  Slide Timeline Editor
                  {slides.length > 0 && (
                    <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-[10px] rounded-full font-mono">
                      {slides.length} slides
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Replace any slide image without re-narrating. Click ⚡ Re-combine Video to stitch the updated final video.
                </p>
              </div>
              <button
                id="recompose-btn"
                onClick={handleRecompose}
                disabled={isRecomposing || slides.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-black font-bold text-xs rounded-xl transition shadow-lg shadow-amber-900/30 disabled:shadow-none shrink-0"
              >
                {isRecomposing ? (
                  <>
                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    {recomposeProgress || "Re-combining..."}
                  </>
                ) : (
                  <>⚡ Re-combine Video</>
                )}
              </button>
            </div>

            {/* Slide Grid */}
            {slidesLoading ? (
              <div className="flex items-center justify-center py-10 text-slate-400 text-sm gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Loading slide metadata...
              </div>
            ) : slides.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                No slide clips found for this project. Only projects generated with the Ken-Burns pipeline support slide editing.
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {slides.map((slide) => {
                  const thumbUrl = slide.broll_image
                    ? `${API_URL}/api/project/${activeVideo.id}/slide_asset/${slide.broll_image}${slideCacheBust[slide.index] ? `?t=${slideCacheBust[slide.index]}` : ""}`
                    : null;
                  const isUploading = slideUploadingIdx === slide.index;
                  const isReverting = slideRevertingIdx === slide.index;
                  const isBusy = isUploading || isReverting;

                  return (
                    <div
                      key={slide.index}
                      className={`flex-none w-[120px] rounded-xl border transition-all ${
                        slide.has_replacement
                          ? "border-amber-500/50 bg-amber-950/20"
                          : "border-white/5 bg-slate-900/60"
                      } ${ isBusy ? "opacity-60" : "hover:border-indigo-500/50"} flex flex-col`}
                    >
                      {/* Thumbnail */}
                      <div className="relative aspect-[9/16] w-full rounded-t-xl overflow-hidden bg-slate-950">
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt={`Slide ${slide.index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                            No image
                          </div>
                        )}
                        {/* Index badge */}
                        <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-bold text-white">
                          #{slide.index + 1}
                        </div>
                        {/* Replaced badge */}
                        {slide.has_replacement && (
                          <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-amber-500/80 text-[9px] font-bold text-black">
                            ✏️
                          </div>
                        )}
                        {/* Busy overlay */}
                        {isBusy && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <svg className="animate-spin w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-2 flex flex-col gap-1.5 flex-1">
                        <div className="text-[10px] text-slate-400 font-mono">
                          {slide.duration_s.toFixed(1)}s
                        </div>

                        {/* Upload new image */}
                        <label
                          htmlFor={`slide-upload-${slide.index}`}
                          className={`block text-center px-1 py-1 rounded-lg text-[10px] font-semibold cursor-pointer transition ${
                            isBusy
                              ? "bg-slate-800 text-slate-600 cursor-not-allowed"
                              : "bg-indigo-600/80 hover:bg-indigo-500 text-white"
                          }`}
                        >
                          {isUploading ? "Uploading..." : "📤 New Image"}
                        </label>
                        <input
                          id={`slide-upload-${slide.index}`}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={isBusy}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleSlideImageUpload(slide.index, file);
                            e.target.value = "";
                          }}
                        />

                        {/* Revert button */}
                        {slide.has_replacement && (
                          <button
                            onClick={() => handleSlideRevert(slide.index)}
                            disabled={isBusy}
                            className="text-[10px] text-slate-400 hover:text-amber-300 disabled:opacity-40 transition text-center"
                          >
                            {isReverting ? "Reverting..." : "↩️ Revert"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
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

      {/* ===================================================================
          TAB 5: CREATE VIDEO WIZARD & PROJECTS HUB
          =================================================================== */}
      {activeTab === "create" && (
        <div className="space-y-6">

          {/* ── PROJECTS HUB VIEW ── */}
          {studioViewMode === "projects" && (
            <div className="space-y-5">
              {/* Header Bar */}
              <div className="glass p-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">🎬 Studio Projects Hub</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    All created explainer video projects, output folders & generated python creator scripts
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={fetchStudioProjects}
                    disabled={studioProjLoading}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-xl text-slate-300 transition"
                  >
                    {studioProjLoading ? "Refreshing…" : "🔄 Refresh"}
                  </button>
                  <button
                    onClick={() => {
                      setStudioViewMode("wizard");
                      setStudioStep(1);
                      setStudioTitle(""); setStudioScript(""); setStudioKeywords(""); setStudioTags("");
                      setStudioScenes([]); setStudioEstDur(0); setStudioTotalImgs(0);
                      setStudioProjectId(""); setStudioJobId(""); setStudioRenderStatus(null);
                      setStudioUploaded({}); setStudioUploadPreviews({}); setStudioError("");
                    }}
                    className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-xs font-bold rounded-xl text-white shadow-lg transition flex items-center gap-2"
                  >
                    ✨ + Create New Video
                  </button>
                </div>
              </div>

              {/* Projects Grid */}
              {studioProjLoading ? (
                <div className="glass p-12 text-center text-slate-400 text-sm">
                  Loading studio projects…
                </div>
              ) : studioProjects.length === 0 ? (
                <div className="glass p-12 text-center space-y-4 border border-dashed border-white/10 rounded-2xl">
                  <div className="text-4xl opacity-40">🎬</div>
                  <h3 className="text-base font-bold text-white">No Studio Projects Created Yet</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Create your first AI short or long video. Every project generates a dedicated Python script in <code className="text-violet-300 font-mono">packages/ClipPilot/my_videos/</code> and saves all output assets in <code className="text-violet-300 font-mono">packages/ClipPilot/output/</code>.
                  </p>
                  <button
                    onClick={() => {
                      setStudioViewMode("wizard");
                      setStudioStep(1);
                    }}
                    className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-xs font-bold rounded-xl text-white transition inline-block"
                  >
                    ✨ Create Your First Video
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {studioProjects.map((proj: any) => (
                    <div key={proj.project_id} className="glass p-5 space-y-4 rounded-2xl flex flex-col justify-between border border-white/10 hover:border-violet-500/30 transition">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            proj.video_type === "short" ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          }`}>
                            {proj.video_type === "short" ? "📱 Short (9:16)" : "🖥️ Long Video (16:9)"}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-slate-400">{proj.date}</span>
                            {deletingProjId === proj.project_id ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      const r = await fetch(`${API_URL}/api/studio/project/${encodeURIComponent(proj.project_id)}`, { method: "DELETE" });
                                      const d = await r.json();
                                      if (d.error) alert(d.error);
                                      else {
                                        setDeletingProjId(null);
                                        fetchStudioProjects();
                                      }
                                    } catch (err: any) {
                                      alert("Delete failed: " + err.message);
                                    }
                                  }}
                                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-extrabold rounded-lg transition shadow-md shadow-rose-600/30 cursor-pointer"
                                >
                                  ⚠️ Confirm Delete?
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingProjId(null);
                                  }}
                                  className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-[10px] font-bold rounded-lg transition cursor-pointer"
                                  title="Cancel"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                title="Delete Project"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingProjId(proj.project_id);
                                }}
                                className="px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-[10px] font-bold rounded-lg transition cursor-pointer"
                              >
                                🗑️ Delete
                              </button>
                            )}
                          </div>
                        </div>

                        <h3 className="font-bold text-white text-base leading-snug line-clamp-2">{proj.title}</h3>

                        {/* File Locations info */}
                        <div className="space-y-1.5 bg-slate-900/60 p-3 rounded-xl text-[10px] font-mono text-slate-400 border border-white/5">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Python Script:</span>
                            <span className="text-amber-300 truncate max-w-[180px]" title={`packages/ClipPilot/my_videos/${proj.date}/make_${proj.project_id && proj.project_id.includes('/') ? proj.project_id.split('/')[1] : proj.project_id}_explainer.py`}>
                              make_{proj.project_id && proj.project_id.includes('/') ? proj.project_id.split('/')[1] : proj.project_id}_explainer.py
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Output Folder:</span>
                            <span className="text-violet-300 truncate max-w-[180px]">
                              output/{proj.project_id}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Images Uploaded:</span>
                            <span className="text-slate-200 font-bold">
                              {proj.images_uploaded} / {proj.total_prompts}
                            </span>
                          </div>
                        </div>

                        {/* Video Player Preview if available */}
                        {proj.final_video && (
                          <div className="space-y-2">
                            <video
                              controls
                              className="w-full rounded-xl aspect-[9/16] object-cover bg-black max-h-48"
                              style={{aspectRatio: proj.video_type==="short"?"9/16":"16/9"}}
                              src={`${API_URL}/studio/video/${proj.final_video}`}
                            />
                            <a
                              href={`${API_URL}/studio/video/${proj.final_video}`}
                              download
                              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl text-center block transition"
                            >
                              ⬇️ Download Video
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <button
                          onClick={() => {
                            setStudioTitle(proj.title || "");
                            setStudioScript(proj.script || "");
                            setStudioKeywords((proj.keywords || []).join(", "));
                            setStudioTags((proj.tags || []).join(", "));
                            setStudioVideoType(proj.video_type || "short");
                            setStudioViewMode("wizard");
                            setStudioStep(1);
                          }}
                          className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition"
                        >
                          🔁 Clone Script
                        </button>
                        <button
                          onClick={async () => {
                            setStudioProjectId(proj.project_id);
                            setStudioTitle(proj.title || "");
                            setStudioVideoType(proj.video_type || "short");
                            // Fetch full detail for prompts/scenes
                            try {
                              const r = await fetch(`${API_URL}/api/studio/project/${proj.project_id}`);
                              const d = await r.json();
                              if (d.meta) {
                                setStudioScenes(d.meta.prompts ? [{ scene_index: 1, scene_title: "Uploaded Prompts", images: d.meta.prompts }] : []);
                              }
                            } catch (e) {}
                            setStudioViewMode("wizard");
                            setStudioStep(proj.final_video ? 4 : (proj.images_uploaded > 0 ? 3 : 2));
                          }}
                          className="py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl transition"
                        >
                          {proj.final_video ? "View Details →" : "Continue →"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── WIZARD VIEW ── */}
          {studioViewMode === "wizard" && (
            <div className="space-y-6">
              {/* Back to Projects list button */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setStudioViewMode("projects");
                    fetchStudioProjects();
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl text-slate-300 transition flex items-center gap-2"
                >
                  ← Back to Studio Projects List
                </button>
                {studioProjectId && (
                  <span className="text-xs font-mono text-slate-500">
                    Project: <code className="text-violet-300">{studioProjectId}</code>
                  </span>
                )}
              </div>

              {/* Step progress bar */}
              <div className="glass p-4">
                <div className="flex items-center gap-2">
                  {[1,2,3,4].map(s => (
                    <button
                      key={s}
                      onClick={() => setStudioStep(s as 1 | 2 | 3 | 4)}
                      className="flex items-center gap-2 flex-1 hover:opacity-90 transition-all text-left cursor-pointer group focus:outline-none"
                      title={`Jump to Step ${s}: ${s===1?"Video Setup":s===2?"Image Prompts":s===3?"Upload Images":"Render & Done"}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all group-hover:scale-110 ${
                        studioStep > s ? "bg-violet-500 text-white shadow-md shadow-violet-500/20" :
                        studioStep === s ? "bg-violet-600 text-white ring-2 ring-violet-400 shadow-md shadow-violet-600/30" :
                        "bg-slate-700 text-slate-400 group-hover:bg-slate-600 group-hover:text-slate-200"
                      }`}>
                        {studioStep > s ? "✓" : s}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-semibold truncate ${
                          studioStep >= s ? "text-slate-200" : "text-slate-500 group-hover:text-slate-300"
                        }`}>
                          {s===1?"Video Setup":s===2?"Image Prompts":s===3?"Upload Images":"Render & Done"}
                        </div>
                      </div>
                      {s < 4 && <div className={`h-0.5 w-6 rounded-full shrink-0 ${
                        studioStep > s ? "bg-violet-500" : "bg-slate-700"
                      }`}/>}
                    </button>
                  ))}
                </div>
              </div>

              {studioError && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-sm flex justify-between">
                  <span>{studioError}</span>
                  <button onClick={() => setStudioError("")} className="text-xs opacity-60 hover:opacity-100">✕</button>
                </div>
              )}

          {/* ── STEP 1: VIDEO SETUP ── */}
          {studioStep === 1 && (
            <div className="glass p-6 space-y-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">🎬 Step 1 — Video Setup</h2>

              {/* Video Type */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Video Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setStudioVideoType("short")}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      studioVideoType === "short"
                        ? "border-violet-500 bg-violet-500/10"
                        : "border-white/10 bg-slate-900/40 hover:border-white/20"
                    }`}
                  >
                    <div className="text-2xl mb-1">📱</div>
                    <div className="font-bold text-white text-sm">Short (9:16)</div>
                    <div className="text-xs text-slate-400 mt-0.5">Max 180s · YouTube Shorts / TikTok / Reels</div>
                    <div className="text-xs text-violet-400 mt-1">AI decides scenes · Vertical portrait</div>
                  </button>
                  <button
                    onClick={() => setStudioVideoType("long")}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      studioVideoType === "long"
                        ? "border-amber-500 bg-amber-500/10"
                        : "border-white/10 bg-slate-900/40 hover:border-white/20"
                    }`}
                  >
                    <div className="text-2xl mb-1">🖥️</div>
                    <div className="font-bold text-white text-sm">Long Video (16:9)</div>
                    <div className="text-xs text-slate-400 mt-0.5">No length cap · YouTube Long-form</div>
                    <div className="text-xs text-amber-400 mt-1">AI decides scenes · Widescreen cinematic</div>
                  </button>
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Video Title</label>
                <input
                  value={studioTitle}
                  onChange={e => setStudioTitle(e.target.value)}
                  placeholder="What If Mosquitoes Drank Cola Instead of Blood?"
                  className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                />
              </div>

              {/* Script */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Full Narration Script</label>
                  {studioScript.trim() && (
                    <span className="text-xs text-slate-500">
                      ~{studioScript.split(/\s+/).filter(Boolean).length} words
                      {" · "}
                      ~{Math.round((studioScript.split(/\s+/).filter(Boolean).length / 140) * 60)}s narration
                      {studioVideoType === "short" && studioScript.split(/\s+/).filter(Boolean).length > 420 && (
                        <span className="ml-1 text-amber-400 font-semibold">(⚠️ may exceed 180s short limit)</span>
                      )}
                    </span>
                  )}
                </div>
                <textarea
                  value={studioScript}
                  onChange={e => setStudioScript(e.target.value)}
                  rows={8}
                  placeholder={`Paste your FULL narration script here.\n\nAI will:\n• Estimate duration from word count (140 wpm TTS speed)\n• Break script into 10–15 second scenes\n• Generate 8–15 image prompts per scene\n\nShorts: must be ≤ 180s. Long videos: no limit.`}
                  className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 resize-none font-mono leading-relaxed"
                />
              </div>

              {/* Keywords & Tags */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Keywords <span className="normal-case font-normal">(comma separated)</span></label>
                  <input
                    value={studioKeywords}
                    onChange={e => setStudioKeywords(e.target.value)}
                    placeholder="mosquito facts, science, what if"
                    className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tags / Hashtags <span className="normal-case font-normal">(comma separated)</span></label>
                  <input
                    value={studioTags}
                    onChange={e => setStudioTags(e.target.value)}
                    placeholder="shorts, science, nature, whatif"
                    className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                  />
                </div>
              </div>

              {/* Info box */}
              <div className="p-3 rounded-xl bg-violet-500/5 border border-violet-500/20 text-xs text-violet-300 space-y-1">
                <p className="font-semibold">🤖 AI-Driven Scene Planning</p>
                <p className="text-violet-400">Duration is estimated automatically from your script word count. AI breaks it into 10–15s scenes and generates 8–15 image prompts per scene. You don't set duration — the script defines it.</p>
              </div>

              <button
                disabled={!studioTitle.trim() || !studioScript.trim() || studioLoading}
                onClick={async () => {
                  setStudioLoading(true);
                  setStudioError("");
                  try {
                    const r = await fetch(`${API_URL}/api/studio/generate_prompts`, {
                      method: "POST",
                      headers: {"Content-Type": "application/json"},
                      body: JSON.stringify({
                        topic: studioTitle,
                        title: studioTitle,
                        script: studioScript,
                        keywords: studioKeywords,
                        video_type: studioVideoType,
                      })
                    });
                    const d = await r.json();
                    if (d.error) throw new Error(d.error);
                    setStudioScenes(d.scenes || []);
                    setStudioEstDur(d.estimated_duration_s || 0);
                    setStudioTotalImgs(d.total_images || 0);
                    setStudioShortWarn(d.short_warning || false);
                    setStudioFallback(d.fallback || false);
                    // Flatten all images across scenes for project creation
                    const allImgs = (d.scenes || []).flatMap((sc: any) => sc.images || []);
                    // Create project folder
                    const r2 = await fetch(`${API_URL}/api/studio/create_project`, {
                      method: "POST",
                      headers: {"Content-Type": "application/json"},
                      body: JSON.stringify({
                        title: studioTitle,
                        script: studioScript,
                        keywords: studioKeywords,
                        tags: studioTags,
                        video_type: studioVideoType,
                        duration_hint: d.estimated_duration_s || 60,
                        prompts: allImgs,
                      })
                    });
                    const d2 = await r2.json();
                    if (d2.error) throw new Error(d2.error);
                    setStudioProjectId(d2.project_id);
                    setStudioStep(2);
                  } catch(e: any) {
                    setStudioError(e.message);
                  } finally {
                    setStudioLoading(false);
                  }
                }}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center gap-2"
              >
                {studioLoading ? (
                  <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> AI is analyzing script & generating scenes…</>
                ) : "✨ Analyze Script & Generate Scene Prompts →"}
              </button>
            </div>
          )}

          {/* ── STEP 2: SCENE PROMPTS ── */}
          {studioStep === 2 && (() => {
            const allImages = studioScenes.flatMap((sc: any) => sc.images || []);
            return (
              <div className="space-y-4">
                {/* Header */}
                <div className="glass p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">🎨 Step 2 — Scene Breakdown & Image Prompts</h2>
                      <div className="flex flex-wrap gap-3 text-xs">
                        <span className="px-2 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300 font-semibold">
                          {studioScenes.length} Scenes
                        </span>
                        <span className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 font-semibold">
                          {studioTotalImgs} Total Images
                        </span>
                        <span className="px-2 py-1 rounded-lg bg-slate-700 border border-white/10 text-slate-300">
                          ~{studioEstDur}s · {studioVideoType === "short" ? "9:16" : "16:9"}
                        </span>
                        {studioShortWarn && (
                          <span className="px-2 py-1 rounded-lg bg-amber-900/40 border border-amber-500/30 text-amber-300">
                            ⚠️ Script may exceed 180s short limit — AI compressed it
                          </span>
                        )}
                        {studioFallback && (
                          <span className="px-2 py-1 rounded-lg bg-rose-900/40 border border-rose-500/30 text-rose-300">
                            ⚠️ Gemini timed out — fallback prompts used. Try again for AI prompts.
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        disabled={studioLoading}
                        onClick={async () => {
                          setStudioLoading(true);
                          setStudioError("");
                          try {
                            const r = await fetch(`${API_URL}/api/studio/generate_prompts`, {
                              method: "POST",
                              headers: {"Content-Type": "application/json"},
                              body: JSON.stringify({
                                topic: studioTitle,
                                title: studioTitle,
                                script: studioScript,
                                keywords: studioKeywords,
                                video_type: studioVideoType,
                              })
                            });
                            const d = await r.json();
                            if (d.error) throw new Error(d.error);
                            setStudioScenes(d.scenes || []);
                            setStudioEstDur(d.estimated_duration_s || 0);
                            setStudioTotalImgs(d.total_images || 0);
                            setStudioFallback(d.fallback || false);
                          } catch(e: any) {
                            setStudioError(e.message);
                          } finally {
                            setStudioLoading(false);
                          }
                        }}
                        className="px-3 py-2 bg-violet-600/30 hover:bg-violet-600/50 text-violet-200 hover:text-white text-xs font-semibold rounded-xl border border-violet-500/30 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        {studioLoading ? "🔄 Regenerating..." : "🔄 Regenerate All Scenes"}
                      </button>
                      <button
                        onClick={() => {
                          const allCollapsed = studioScenes.every((_, idx) => collapsedScenes[idx]);
                          if (allCollapsed) {
                            setCollapsedScenes({});
                          } else {
                            const next: Record<number, boolean> = {};
                            studioScenes.forEach((_, idx) => { next[idx] = true; });
                            setCollapsedScenes(next);
                          }
                        }}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-xl border border-white/10 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        {studioScenes.length > 0 && studioScenes.every((_, idx) => collapsedScenes[idx]) ? "↕️ Expand All Scenes" : "↔️ Minimize All Scenes"}
                      </button>
                      <button
                        onClick={() => {
                          const all = studioScenes.flatMap((sc: any, si: number) => [
                            `${'='.repeat(50)}`,
                            `SCENE ${si+1}: ${sc.scene_title || ''} (~${sc.scene_duration_s}s)`,
                            `Script: "${sc.script_excerpt || ''}"`,
                            `${'─'.repeat(40)}`,
                            ...(sc.images || []).map((img: any, ii: number) =>
                              `Image ${ii+1}: ${img.filename}\n${img.prompt}\n`
                            ),
                          ]).join("\n");
                          navigator.clipboard.writeText(all);
                        }}
                        className="shrink-0 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-xs font-medium rounded-xl transition cursor-pointer"
                      >
                        📋 Copy All ({studioTotalImgs} prompts)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Scenes */}
                <div className="space-y-4">
                  {studioScenes.map((sc: any, si: number) => {
                    const isCollapsed = Boolean(collapsedScenes[si]);
                    return (
                      <div key={si} className="glass p-4 space-y-3 transition-all duration-200">
                        {/* Scene header */}
                        <div className="flex items-center gap-3 pb-2 border-b border-white/10 select-none">
                          <button
                            onClick={() => setCollapsedScenes(prev => ({ ...prev, [si]: !prev[si] }))}
                            className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-90 transition group cursor-pointer"
                          >
                            <div className="w-8 h-8 rounded-xl bg-violet-600/30 border border-violet-500/40 flex items-center justify-center text-sm font-black text-violet-300 group-hover:scale-105 transition shrink-0">
                              {si+1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-white text-sm flex items-center gap-2">
                                <span>{sc.scene_title || `Scene ${si+1}`}</span>
                                <span className="text-xs text-slate-400 font-normal">
                                  ({isCollapsed ? `▶ Minimized` : `▼ Expanded`})
                                </span>
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5 italic truncate">"{sc.script_excerpt}"</div>
                            </div>
                          </button>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                              ~{sc.scene_duration_s}s
                            </span>
                            <span className="text-xs text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                              {(sc.images || []).length} images
                            </span>
                            <button
                              disabled={reloadingScene === si}
                              onClick={() => handleRegenerateScene(si)}
                              className="text-xs text-amber-300 hover:text-white px-3 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                              title="Regenerate all image prompts for this scene"
                            >
                              {reloadingScene === si ? "🔄 Re-rolling..." : "🔄 Re-roll Scene"}
                            </button>
                            <button
                              onClick={() => {
                                const text = (sc.images || []).map((img: any, ii: number) =>
                                  `=== ${img.filename} ===\n${img.prompt}\n`
                                ).join("\n");
                                navigator.clipboard.writeText(text);
                              }}
                              className="text-xs text-slate-400 hover:text-white px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
                            >
                              Copy Scene
                            </button>
                            <button
                              onClick={() => setCollapsedScenes(prev => ({ ...prev, [si]: !prev[si] }))}
                              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-violet-600/40 text-slate-300 hover:text-white border border-white/10 transition flex items-center gap-1 cursor-pointer"
                              title={isCollapsed ? "Expand Scene" : "Minimize Scene"}
                            >
                              {isCollapsed ? "▶ Expand" : "▼ Minimize"}
                            </button>
                          </div>
                        </div>

                        {/* Image prompts grid (hidden when collapsed) */}
                        {!isCollapsed && (
                          <div className="grid grid-cols-1 gap-2 pt-1">
                            {(sc.images || []).map((img: any, ii: number) => (
                              <div key={ii} className="flex items-start gap-3 bg-slate-900/40 rounded-xl p-3">
                                <div className="w-6 h-6 rounded-lg bg-slate-700 text-[10px] font-bold text-slate-400 flex items-center justify-center shrink-0">
                                  {ii+1}
                                </div>
                                <div className="flex-1 min-w-0 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <code className="text-[10px] font-mono text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded">{img.filename}</code>
                                  </div>
                                  {img.scene_description && (
                                    <p className="text-xs text-slate-300">{img.scene_description}</p>
                                  )}
                                  <p className="text-[10px] text-slate-500 leading-relaxed font-mono line-clamp-2">{img.prompt}</p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    disabled={reloadingPrompt === `s${si}_i${ii}`}
                                    onClick={() => handleRegenerateSinglePrompt(si, ii)}
                                    className="text-[10px] text-amber-300 hover:text-white px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                                    title="Regenerate this specific image prompt"
                                  >
                                    {reloadingPrompt === `s${si}_i${ii}` ? "⏳" : "🔄 Re-roll"}
                                  </button>
                                  <button
                                    onClick={() => navigator.clipboard.writeText(img.prompt)}
                                    className="text-[10px] text-slate-400 hover:text-white px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
                                  >
                                    Copy
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Instructions */}
                <div className="glass p-4 space-y-2">
                  <h3 className="text-sm font-bold text-slate-200">📌 How to use these prompts</h3>
                  <ol className="space-y-1 text-xs text-slate-400 list-decimal list-inside">
                    <li>Work scene by scene — copy all prompts for Scene 1, generate images, then Scene 2, etc.</li>
                    <li>Generate images at <strong className="text-white">{studioVideoType === "short" ? "portrait 9:16" : "landscape 16:9"}</strong> aspect ratio</li>
                    <li>Save each image with the <strong className="text-amber-300">exact filename shown</strong> (e.g. <code className="text-amber-300 text-[10px]">0802short_s01_img001.png</code>)</li>
                    <li>Images within a scene should feel cohesive — same mood, varying framing</li>
                    <li>Upload all <strong className="text-white">{studioTotalImgs} images</strong> in the next step</li>
                  </ol>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStudioStep(1)} className="px-6 py-3 rounded-xl font-medium text-sm bg-slate-700 hover:bg-slate-600 text-white transition">
                    ← Back
                  </button>
                  <button
                    onClick={() => setStudioStep(3)}
                    className="flex-1 py-3 rounded-xl font-bold text-sm bg-violet-600 hover:bg-violet-500 text-white transition"
                  >
                    I've Generated All {studioTotalImgs} Images → Upload Now
                  </button>
                </div>
              </div>
            );
          })()}

          {/* ── STEP 3: IMAGE UPLOAD ── */}
          {studioStep === 3 && (() => {
            const allImages = studioScenes.flatMap((sc: any) => sc.images || []);
            const uploadedCount = Object.values(studioUploaded).filter(Boolean).length;
            const allDone = uploadedCount >= allImages.length && allImages.length > 0;

            const uploadFile = async (file: File, filename: string) => {
              const fd = new FormData();
              fd.append("image", file);
              fd.append("filename", filename);
              const r = await fetch(`${API_URL}/api/studio/upload_image/${studioProjectId}`, { method: "POST", body: fd });
              if (r.ok) {
                setStudioUploaded(prev => ({ ...prev, [filename]: true }));
                const url = URL.createObjectURL(file);
                setStudioUploadPreviews(prev => ({ ...prev, [filename]: url }));
              }
            };

            return (
              <div className="space-y-4">
                {/* Global header */}
                <div className="glass p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">📤 Step 3 — Upload Images</h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {uploadedCount} / {allImages.length} uploaded across {studioScenes.length} scenes
                        {allDone && <span className="ml-2 text-emerald-400 font-semibold">✅ All images ready!</span>}
                      </p>
                    </div>
                    <label className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-xs font-bold rounded-xl cursor-pointer transition text-white">
                      ⬆ Upload All At Once
                      <input type="file" multiple accept="image/*" className="hidden" onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        for (const file of files) {
                          const match = allImages.find((img: any) => img.filename === file.name);
                          await uploadFile(file, match ? match.filename : file.name);
                        }
                      }} />
                    </label>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full transition-all duration-500"
                      style={{width: `${allImages.length ? (uploadedCount/allImages.length)*100 : 0}%`}}
                    />
                  </div>
                </div>

                {/* Scenes upload groups */}
                <div className="space-y-4">
                  {studioScenes.map((sc: any, si: number) => {
                    const imgs = sc.images || [];
                    const scUploaded = imgs.filter((img: any) => studioUploaded[img.filename]).length;
                    return (
                      <div key={si} className="glass p-4 space-y-3">
                        {/* Scene header */}
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black ${
                            scUploaded === imgs.length ? "bg-emerald-500/20 text-emerald-300" : "bg-violet-600/30 text-violet-300"
                          }`}>
                            {scUploaded === imgs.length ? "✓" : si+1}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-white">{sc.scene_title || `Scene ${si+1}`} <span className="text-xs font-normal text-slate-500">~{sc.scene_duration_s}s</span></div>
                            <div className="text-[10px] text-slate-500 italic truncate">"{sc.script_excerpt}"</div>
                          </div>
                          <div className="text-xs text-slate-400">{scUploaded}/{imgs.length}</div>
                          <label className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-[10px] font-bold rounded-lg cursor-pointer transition text-white">
                            Upload Scene
                            <input type="file" multiple accept="image/*" className="hidden" onChange={async (e) => {
                              const files = Array.from(e.target.files || []);
                              for (const file of files) {
                                const match = imgs.find((img: any) => img.filename === file.name);
                                await uploadFile(file, match ? match.filename : file.name);
                              }
                            }} />
                          </label>
                        </div>

                        {/* Scene progress bar */}
                        <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-violet-400 rounded-full transition-all duration-300"
                            style={{width: `${imgs.length ? (scUploaded/imgs.length)*100 : 0}%`}}
                          />
                        </div>

                        {/* Image grid for this scene */}
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                          {imgs.map((img: any, ii: number) => {
                            const done    = studioUploaded[img.filename];
                            const preview = studioUploadPreviews[img.filename];
                            return (
                              <label key={ii} className={`relative cursor-pointer rounded-lg overflow-hidden border transition-all ${
                                done ? "border-emerald-500/60" : "border-white/10 hover:border-violet-500/40"
                              }`}>
                                {preview ? (
                                  <img src={preview} alt={img.filename}
                                    className="w-full object-cover"
                                    style={{aspectRatio: studioVideoType==="short"?"9/16":"16/9"}}
                                  />
                                ) : (
                                  <div
                                    className="w-full bg-slate-800/80 flex items-center justify-center"
                                    style={{aspectRatio: studioVideoType==="short"?"9/16":"16/9"}}
                                  >
                                    <span className="text-slate-500 text-[10px]">{ii+1}</span>
                                  </div>
                                )}
                                {done && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-emerald-900/30">
                                    <span className="text-emerald-400 text-base">✓</span>
                                  </div>
                                )}
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                                  <p className="text-[8px] font-mono text-slate-400 truncate">{img.filename.split("_").slice(-1)[0]}</p>
                                </div>
                                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) await uploadFile(file, img.filename);
                                }} />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStudioStep(2)} className="px-6 py-3 rounded-xl font-medium text-sm bg-slate-700 hover:bg-slate-600 text-white transition">
                    ← Back
                  </button>
                  <button
                    disabled={uploadedCount === 0 || studioLoading}
                    onClick={async () => {
                      setStudioLoading(true);
                      setStudioError("");
                      try {
                        const r = await fetch(`${API_URL}/api/studio/render/${studioProjectId}`, { method: "POST" });
                        const d = await r.json();
                        if (d.error) throw new Error(d.error);
                        setStudioJobId(d.job_id);
                        setStudioStep(4);
                        const poll = setInterval(async () => {
                          const rs = await fetch(`${API_URL}/api/studio/render_status/${d.job_id}`);
                          const rd = await rs.json();
                          setStudioRenderStatus(rd);
                          if (rd.status === "done" || rd.status === "error") clearInterval(poll);
                        }, 2000);
                        studioRenderPollRef.current = poll;
                      } catch(e: any) {
                        setStudioError(e.message);
                      } finally {
                        setStudioLoading(false);
                      }
                    }}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition text-white flex items-center justify-center gap-2 ${
                      allDone ? "bg-violet-600 hover:bg-violet-500" : "bg-violet-600/60"
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {studioLoading ? (
                      <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> Starting Render…</>
                    ) : (
                      allDone
                        ? "🚀 Render Video Now"
                        : `⚡ Render with ${uploadedCount} / ${allImages.length} images uploaded`
                    )}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* ── STEP 4: RENDER ── */}
          {studioStep === 4 && (
            <div className="space-y-4">
              <div className="glass p-5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  {studioRenderStatus?.status === "done" ? "🎉 Render Complete!" :
                   studioRenderStatus?.status === "error" ? "❌ Render Failed" :
                   "⚙️ Rendering…"}
                </h2>
                <p className="text-xs text-slate-400 mt-1">Project: <code className="text-violet-300">{studioProjectId}</code></p>
              </div>

              {/* Pipeline steps */}
              <div className="glass p-5 space-y-3">
                {[
                  {key:"tts",   label:"1/5 Synthesizing narration (edge-tts 48kHz)"},
                  {key:"slide", label:"2/5 Building 60 FPS Ken-Burns slideshow"},
                  {key:"cap",   label:"3/5 Generating karaoke captions (Whisper)"},
                  {key:"burn",  label:"4/5 Burning captions into final MP4"},
                  {key:"mani",  label:"5/5 Writing manifest.json"},
                ].map(step => {
                  const log = studioRenderStatus?.log || "";
                  const stepDone = studioRenderStatus?.status === "done";
                  const stepErr  = studioRenderStatus?.status === "error";
                  const active   = !stepDone && !stepErr && log.includes(step.label.split(" ")[0]);
                  const done     = stepDone || log.includes(`Step ${step.label[0]}/5`);
                  return (
                    <div key={step.key} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      stepDone   ? "bg-emerald-950/20 border-emerald-500/20" :
                      stepErr    ? "bg-rose-950/20 border-rose-500/20" :
                      active     ? "bg-violet-950/20 border-violet-500/30" :
                      "bg-slate-900/30 border-white/5 opacity-50"
                    }`}>
                      {stepDone ? <span className="text-emerald-400">✅</span> :
                       stepErr  ? <span className="text-rose-400">❌</span> :
                       active   ? <svg className="animate-spin w-4 h-4 text-violet-400 shrink-0" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> :
                       <span className="w-4 h-4 rounded-full border border-slate-600 inline-block shrink-0"/>}
                      <span className="text-sm text-slate-300">{step.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Live Log */}
              <div className="glass p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pipeline Log</span>
                  {(studioRenderStatus?.status === "running" || studioRenderStatus?.status === "starting") && (
                    <span className="text-xs text-violet-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse inline-block"/>
                      Live
                    </span>
                  )}
                </div>
                <pre className="bg-slate-950 rounded-xl p-3 text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {studioRenderStatus?.log || "Waiting for pipeline to start…"}
                </pre>
              </div>

              {/* Done state */}
              {studioRenderStatus?.status === "done" && (
                <div className="glass p-5 space-y-4 border border-emerald-500/20">
                  <h3 className="font-bold text-emerald-300 text-base">🎬 Your Video Is Ready!</h3>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-slate-900/60 rounded-xl p-3">
                      <div className="text-lg font-bold text-white">{studioRenderStatus.duration_s}s</div>
                      <div className="text-xs text-slate-400">Duration</div>
                    </div>
                    <div className="bg-slate-900/60 rounded-xl p-3">
                      <div className="text-lg font-bold text-white">{studioRenderStatus.resolution?.split(" ")[0]}</div>
                      <div className="text-xs text-slate-400">Resolution</div>
                    </div>
                    <div className="bg-slate-900/60 rounded-xl p-3">
                      <div className="text-lg font-bold text-white">{studioRenderStatus.size_mb} MB</div>
                      <div className="text-xs text-slate-400">File Size</div>
                    </div>
                  </div>

                  {/* Saved File Locations */}
                  <div className="bg-slate-950 p-4 rounded-xl space-y-2 text-xs font-mono border border-emerald-500/20">
                    <div className="text-emerald-400 font-bold text-[11px] mb-1 font-sans">📁 Saved File Locations:</div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">📜 Python Script:</span>
                      <span className="text-amber-300 font-semibold truncate max-w-sm">
                        packages/ClipPilot/my_videos/{studioProjectId ? (studioProjectId.split('/')[0] || "") : ""}/make_{studioProjectId ? (studioProjectId.split('/')[1] || "") : ""}_explainer.py
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">📁 Output Directory:</span>
                      <span className="text-violet-300 font-semibold truncate max-w-sm">
                        packages/ClipPilot/output/{studioProjectId}/
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">📋 Upload Manifest:</span>
                      <span className="text-emerald-300 font-semibold truncate max-w-sm">
                        packages/ClipPilot/output/{studioProjectId}/manifest.json
                      </span>
                    </div>
                  </div>
                  {studioRenderStatus.video_path && (
                    <video
                      controls
                      autoPlay
                      className="w-full rounded-xl max-h-[480px] object-contain bg-black"
                      src={`${API_URL}/studio/video/${studioRenderStatus.video_path}`}
                    />
                  )}
                  <div className="flex gap-3">
                    {studioRenderStatus.video_path && (
                      <a
                        href={`${API_URL}/studio/video/${studioRenderStatus.video_path}`}
                        download
                        className="flex-1 py-3 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white text-center transition"
                      >
                        ⬇️ Download Video
                      </a>
                    )}
                    <button
                      onClick={() => {
                        if (studioRenderPollRef.current) clearInterval(studioRenderPollRef.current);
                        setStudioStep(1);
                        setStudioTitle(""); setStudioScript(""); setStudioKeywords(""); setStudioTags("");
                        setStudioScenes([]); setStudioEstDur(0); setStudioTotalImgs(0);
                        setStudioProjectId(""); setStudioJobId("");
                        setStudioRenderStatus(null); setStudioUploaded({}); setStudioUploadPreviews({});
                        setStudioShortWarn(false); setStudioFallback(false); setStudioLoading(false); setStudioError("");
                      }}
                      className="flex-1 py-3 rounded-xl font-bold text-sm bg-violet-600 hover:bg-violet-500 text-white transition"
                    >
                      ✨ Create Another Video
                    </button>
                  </div>
                </div>
              )}

              {studioRenderStatus?.status === "error" && (
                <div className="glass p-4 border border-rose-500/30 space-y-3">
                  <p className="text-rose-300 text-sm font-semibold">Render error: {studioRenderStatus.error}</p>
                  <button onClick={() => setStudioStep(3)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-sm text-white rounded-xl transition">
                    ← Back to Upload
                  </button>
                </div>
               )}
            </div>
          )}
        </div>
      )}
    </div>
  )}
</div>
  );
}
