import React, { useState } from "react";
import { Sparkles, Brain, Search, MapPin, Database, Camera, Image, Mic, Play, Settings } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Tabs } from "../components/Tabs";
import { auth, db } from "../lib/firebase";
import { doc, setDoc } from "firebase/firestore";

export default function AiPlayground() {
  const [activeTab, setActiveTab] = useState("Chat");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [prompt, setPrompt] = useState("");
  const [imageRatio, setImageRatio] = useState("16:9");
  const [imageQuality, setImageQuality] = useState("standard");
  const [chatHistory, setChatHistory] = useState<any[]>([]);

  const handleTestChat = async (mode: string) => {
    if (!prompt) return;
    setLoading(true);
    setResult("Typing...");
    
    const newHistory = [...chatHistory];
    
    try {
      const isLite = mode === "lite";
      const enableThinking = mode === "thinking";
      const enableSearch = mode === "search";
      const enableMaps = mode === "maps";
      
      const res = await fetch("/api/playground/chat", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ message: prompt, history: newHistory, isLite, enableThinking, enableSearch, enableMaps })
      });
      const data = await res.json();
      
      const updatedHistory = [...newHistory, 
         { role: "user", parts: [{ text: prompt }] },
         { role: "model", parts: [{ text: data.text }] }
      ];
      setChatHistory(updatedHistory);
      setResult(data.text);
      setPrompt("");
    } catch (e: any) {
      setResult("Error: " + e.message);
    }
    setLoading(false);
  };

  const handleGenerateMusic = async (isPro: boolean) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/playground/generate-music", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ prompt: prompt || "A relaxing acoustic guitar melody", isPro })
      });
      const data = await res.json();
      setResult(data.text || data.error);
    } catch (e: any) {
      setResult("Error: " + e.message);
    }
    setLoading(false);
  };

  const handleGenerateImage = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/playground/generate-image", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ prompt: prompt || "A beautiful serene landscape", aspectRatio: imageRatio, quality: imageQuality })
      });
      const data = await res.json();
      if (data.imageBase64) {
        setResult(<img src={`data:image/jpeg;base64,${data.imageBase64}`} className="rounded-xl mt-4 w-full" />);
      } else {
        setResult("Error: " + data.error);
      }
    } catch (e: any) {
      setResult("Error: " + e.message);
    }
    setLoading(false);
  };

  const handleTranscribe = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const res = await fetch("/api/playground/transcribe", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({ mimeType: file.type, data: base64 })
        });
        const data = await res.json();
        setResult(data.text);
      } catch (err: any) {
        setResult("Error: " + err.message);
      }
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateVideo = async (e?: React.ChangeEvent<HTMLInputElement>) => {
    setLoading(true);
    setResult(null);
    try {
      let imageBase64 = undefined;
      let mimeType = undefined;
      
      if (e?.target?.files?.[0]) {
        const file = e.target.files[0];
        mimeType = file.type;
        const reader = new FileReader();
        imageBase64 = await new Promise((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
      }

      const res = await fetch("/api/playground/generate-video", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ prompt: prompt || "A sweeping cinematic shot", aspectRatio: imageRatio, imageData: imageBase64, imageMimeType: mimeType })
      });
      const data = await res.json();
      if (data.operationName) {
         setResult(`Video generation started successfully.\nOperation Name: ${data.operationName}\nYou can poll the Gemini API to check status.`);
      } else {
         setResult("Error: " + data.error);
      }
    } catch (err: any) {
      setResult("Error: " + err.message);
    }
    setLoading(false);
  };

  const handleAnalyzeMedia = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const res = await fetch("/api/playground/analyze-media", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({ mimeType: file.type, data: base64, prompt: prompt || "Analyze this media." })
        });
        const data = await res.json();
        setResult(data.text);
      } catch (err: any) {
        setResult("Error: " + err.message);
      }
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleTestDatabase = async () => {
    setLoading(true);
    if (!auth.currentUser) {
       setResult("Please log in using Google Auth first to test database.");
       setLoading(false);
       return;
    }
    try {
      await setDoc(doc(db, "telemetry", auth.currentUser.uid), {
        lastInteraction: new Date().toISOString(),
        testData: "Firebase functionality successfully confirmed."
      });
      setResult("Database connection successful. Wrote test data to Firestore under your user ID.");
    } catch (e: any) {
      setResult("Database Error: " + e.message);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center gap-3 mb-8">
        <Sparkles className="text-forest-400" size={32} />
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">AI Capabilities Showcase</h1>
          <p className="text-zinc-400">Interact with the state-of-the-art Gemini integration suite.</p>
        </div>
      </div>

      <Tabs 
        tabs={["Chat", "Grounding", "Vision & Video", "Audio", "Infrastructure"]} 
        activeTab={activeTab} 
        onChange={setActiveTab} 
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div className="space-y-6">
          
          {activeTab === "Chat" && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Brain size={18}/> Gemini Chatbot & Intelligence</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Input placeholder="Enter prompt..." value={prompt} onChange={e => setPrompt(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                   <Button onClick={() => handleTestChat("standard")} isLoading={loading} variant="secondary">Gemini Flash</Button>
                   <Button onClick={() => handleTestChat("lite")} isLoading={loading} variant="secondary">Flash Lite (Low Latency)</Button>
                   <Button onClick={() => handleTestChat("thinking")} isLoading={loading} variant="forest">High Thinking (Pro)</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "Grounding" && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Search size={18}/> Search & Maps Grounding</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Input placeholder="Ask about recent news or places..." value={prompt} onChange={e => setPrompt(e.target.value)} />
                <div className="flex gap-2">
                   <Button onClick={() => handleTestChat("search")} isLoading={loading} variant="secondary"><Search size={16} className="mr-2"/> Google Search</Button>
                   <Button onClick={() => handleTestChat("maps")} isLoading={loading} variant="secondary"><MapPin size={16} className="mr-2"/> Google Maps</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "Vision & Video" && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Camera size={18}/> Image & Video Generation</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Input placeholder="Describe an image..." value={prompt} onChange={e => setPrompt(e.target.value)} />
                <div className="flex gap-2 items-center text-sm text-zinc-400">
                  Ratio: 
                  <select value={imageRatio} onChange={(e) => setImageRatio(e.target.value)} className="bg-zinc-900 border border-white/10 p-2 rounded-lg text-white">
                    <option value="1:1">1:1</option>
                    <option value="2:3">2:3</option>
                    <option value="3:2">3:2</option>
                    <option value="3:4">3:4</option>
                    <option value="4:3">4:3</option>
                    <option value="9:16">9:16</option>
                    <option value="16:9">16:9</option>
                    <option value="21:9">21:9</option>
                  </select>
                  Quality: 
                  <select value={imageQuality} onChange={(e) => setImageQuality(e.target.value)} className="bg-zinc-900 border border-white/10 p-2 rounded-lg text-white">
                    <option value="standard">Standard (Flash)</option>
                    <option value="high">High Quality (Pro)</option>
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                   <Button onClick={() => handleGenerateVideo()} isLoading={loading} variant="forest"><Play size={16} className="mr-2"/> Generate Video (Text)</Button>
                   <label className="flex items-center px-4 py-2 bg-forest-500 hover:bg-forest-600 rounded-xl cursor-pointer text-sm font-bold text-white transition-colors">
                     <Play size={16} className="mr-2"/> Animate Image
                     <input type="file" className="hidden" accept="image/*" onChange={handleGenerateVideo} />
                   </label>
                   <Button onClick={handleGenerateImage} isLoading={loading} variant="secondary"><Image size={16} className="mr-2"/> High-Quality Image</Button>
                   <label className="flex items-center px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl cursor-pointer text-sm font-bold transition-colors">
                     <Camera size={16} className="mr-2"/> Analyze Media
                     <input type="file" className="hidden" accept="image/*,video/*" onChange={handleAnalyzeMedia} />
                   </label>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "Audio" && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Mic size={18}/> Voice, Transcription & Music</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Input placeholder="Describe the music you want to hear..." value={prompt} onChange={e => setPrompt(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                   <Button onClick={() => handleGenerateMusic(false)} isLoading={loading} variant="forest"><Play size={16} className="mr-2"/> Generate Music Clip (30s)</Button>
                   <Button onClick={() => handleGenerateMusic(true)} isLoading={loading} variant="secondary"><Play size={16} className="mr-2"/> Full Length Track (Pro)</Button>
                </div>
                <div className="w-full h-px border-b border-white/10 my-4" />
                <div className="flex flex-wrap gap-2">
                   <label className="flex items-center px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-white/10 rounded-xl cursor-pointer text-sm font-bold text-white transition-colors">
                     <Mic size={16} className="mr-2"/> Upload Audio to Transcribe
                     <input type="file" className="hidden" accept="audio/*" onChange={handleTranscribe} />
                   </label>
                </div>
                <p className="text-xs text-zinc-500 mt-2">Live API Voice Conversations are natively integrated via the global "Live Ear" menu toggle in the sidebar.</p>
              </CardContent>
            </Card>
          )}

          {activeTab === "Infrastructure" && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Database size={18}/> Firebase Auth & Firestore</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-zinc-400">User Identity: {auth.currentUser ? auth.currentUser.email : "Not Authenticated"}</p>
                <div className="flex gap-2">
                   <Button onClick={handleTestDatabase} isLoading={loading} variant="secondary">Test Firestore Write</Button>
                </div>
              </CardContent>
            </Card>
          )}

        </div>

        <div className="h-full">
          <Card className="h-full min-h-[400px] flex flex-col bg-black/60">
            <CardHeader className="border-white/5 bg-black/40"><CardTitle className="text-sm text-zinc-400 block font-mono">OUTPUT__</CardTitle></CardHeader>
            <CardContent className="flex-1 p-6 text-sm text-zinc-300 whitespace-pre-wrap font-mono overflow-auto custom-scrollbar flex flex-col gap-4">
               {chatHistory.length > 0 && activeTab === "Chat" && (
                 <div className="flex flex-col gap-3 mb-4 border-b border-white/10 pb-4">
                   {chatHistory.map((msg, i) => (
                     <div key={i} className={`p-3 rounded-lg max-w-[80%] ${msg.role === 'user' ? 'bg-forest-500/20 self-end text-forest-200' : 'bg-white/5 self-start text-zinc-300'}`}>
                       <span className="text-xs opacity-50 uppercase tracking-widest">{msg.role}</span><br />
                       {msg.parts[0].text}
                     </div>
                   ))}
                 </div>
               )}
               {loading ? (
                 <div className="flex items-center text-forest-400 animate-pulse"><Sparkles size={16} className="mr-2"/> Computing...</div>
               ) : typeof result === 'string' ? (
                 result || "Ready for input."
               ) : result !== null ? (
                 result
               ) : chatHistory.length === 0 ? "Ready for input." : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
