"use client";

import { useEffect, useState, useRef } from "react";

const API_URL = "http://127.0.0.1:5000";

type Video = {
  id: string;
  name: string;
  path: string;
  filename: string;
};

export default function Dashboard() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [metaTags, setMetaTags] = useState("");
  const [visibility, setVisibility] = useState("private");
  
  const [promptTitle, setPromptTitle] = useState("");
  const [promptDesc, setPromptDesc] = useState("");
  
  const [isLoadingGen, setIsLoadingGen] = useState(false);
  const [isLoadingPub, setIsLoadingPub] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{text: string, type: "success" | "error" | "info"} | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/videos`)
      .then(r => r.json())
      .then(data => setVideos(data))
      .catch(e => console.error("Error fetching videos:", e));
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
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setIsLoadingGen(false);
    }
  };

  const rewriteField = async (field: "title" | "description") => {
    const prompt = field === "title" ? promptTitle : promptDesc;
    const currentText = field === "title" ? metaTitle : metaDesc;
    if (!prompt) return alert("Please enter an instruction.");
    if (!currentText) return alert("Field empty. Generate first.");
    
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
    } catch (e: any) {
      alert("Rewrite error: " + e.message);
    }
  };

  const publishVideo = async () => {
    if (!activeVideo) return;
    setIsLoadingPub(true);
    setStatusMsg({ text: "Uploading... (This may take a minute)", type: "info" });
    
    try {
      const res = await fetch(`${API_URL}/api/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_path: activeVideo.path,
          title: metaTitle || activeVideo.name,
          description: metaDesc,
          hashtags: metaTags,
          visibility
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ text: `Successfully published! URL: ${data.url}`, type: "success" });
      } else {
        throw new Error(data.error || "Upload failed");
      }
    } catch (e: any) {
      setStatusMsg({ text: `Error: ${e.message}`, type: "error" });
    } finally {
      setIsLoadingPub(false);
    }
  };

  return (
    <>
      {/* Sidebar */}
      <aside className="w-80 m-5 p-5 flex flex-col gap-4 overflow-y-auto glass">
        <h2 className="text-xl font-bold text-blue-400 uppercase tracking-wide">Your Videos</h2>
        <div className="flex flex-col gap-3">
          {videos.length === 0 ? (
            <p className="text-slate-400 text-sm">No videos found.</p>
          ) : (
            videos.map(v => (
              <div 
                key={v.id} 
                onClick={() => selectVideo(v)}
                className={`p-4 rounded-xl cursor-pointer transition-all border ${activeVideo?.id === v.id ? 'bg-blue-500/15 border-blue-500 -translate-y-1' : 'bg-white/5 border-transparent hover:bg-blue-500/15 hover:border-blue-500 hover:-translate-y-1'}`}
              >
                <h3 className="font-semibold">{v.name}</h3>
                <p className="text-xs text-slate-400 mt-1">{v.filename}</p>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex gap-6 p-5 pl-0 overflow-hidden">
        
        {/* Player Section */}
        <section className="flex-1 flex flex-col items-center justify-center p-5 glass">
          <div className="w-full max-w-[400px] aspect-[9/16] bg-black rounded-2xl overflow-hidden shadow-2xl relative">
            <video ref={videoRef} controls className="w-full h-full object-contain" />
          </div>
          <p className="mt-5 font-semibold text-lg text-slate-400">
            {activeVideo ? activeVideo.name : "Select a video from the sidebar"}
          </p>
        </section>

        {/* Editor Section */}
        {activeVideo && (
          <section className="w-[450px] p-6 flex flex-col gap-5 overflow-y-auto glass">
            <h2 className="text-2xl font-bold">Metadata Editor</h2>
            
            <button 
              onClick={generateMetadata} 
              disabled={isLoadingGen}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {isLoadingGen && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
              ✨ Auto-Generate with Gemini
            </button>

            {/* Title */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-400">Title</label>
              <input type="text" value={metaTitle} onChange={e => setMetaTitle(e.target.value)} placeholder="Video Title..." className="bg-black/20 border border-white/10 text-white p-3 rounded-xl focus:outline-none focus:border-blue-500" />
              <div className="bg-blue-500/10 border border-dashed border-blue-500/50 p-2 rounded-lg flex gap-2 mt-1">
                <input type="text" value={promptTitle} onChange={e => setPromptTitle(e.target.value)} placeholder="E.g. Make it clickbaity" className="flex-1 bg-transparent text-sm focus:outline-none px-2" />
                <button onClick={() => rewriteField('title')} className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-3 py-1 rounded-md">Rewrite</button>
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-400">Description</label>
              <textarea value={metaDesc} onChange={e => setMetaDesc(e.target.value)} placeholder="Video Description..." className="bg-black/20 border border-white/10 text-white p-3 rounded-xl focus:outline-none focus:border-blue-500 min-h-[100px] resize-y" />
              <div className="bg-blue-500/10 border border-dashed border-blue-500/50 p-2 rounded-lg flex gap-2 mt-1">
                <input type="text" value={promptDesc} onChange={e => setPromptDesc(e.target.value)} placeholder="E.g. Add emojis" className="flex-1 bg-transparent text-sm focus:outline-none px-2" />
                <button onClick={() => rewriteField('description')} className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-3 py-1 rounded-md">Rewrite</button>
              </div>
            </div>

            {/* Hashtags */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-400">Hashtags</label>
              <input type="text" value={metaTags} onChange={e => setMetaTags(e.target.value)} placeholder="#shorts #viral" className="bg-black/20 border border-white/10 text-white p-3 rounded-xl focus:outline-none focus:border-blue-500" />
            </div>

            {/* Visibility */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-400">Visibility</label>
              <select value={visibility} onChange={e => setVisibility(e.target.value)} className="bg-black/20 border border-white/10 text-white p-3 rounded-xl focus:outline-none focus:border-blue-500 [&>option]:bg-slate-800">
                <option value="private">Private (Test)</option>
                <option value="unlisted">Unlisted</option>
                <option value="public">Public</option>
              </select>
            </div>

            <button 
              onClick={publishVideo} 
              disabled={isLoadingPub}
              className="mt-auto bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {isLoadingPub && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
              🚀 Publish to YouTube
            </button>
            
            {statusMsg && (
              <p className={`text-center text-sm ${statusMsg.type === 'success' ? 'text-emerald-400' : statusMsg.type === 'error' ? 'text-red-400' : 'text-slate-300'}`}>
                {statusMsg.text}
              </p>
            )}
          </section>
        )}
      </main>
    </>
  );
}
