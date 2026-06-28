import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTenant } from "../contexts/TenantContext";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { ChevronLeft, ChevronRight, Play, Pause, Maximize2, Loader2, Sparkles, CheckCircle2 } from "lucide-react";

export default function Portfolio() {
  const { tenant } = useTenant();
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const tenantId = tenant?.id || "genesis-1";
    const q = query(
      collection(db, "jobs"),
      where("tenantId", "==", tenantId),
      where("status", "==", "completed")
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const jobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }))
            .filter(doc => doc.departurePhotoUrl);
        setPhotos(jobs);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "jobs");
        setLoading(false);
      }
    );

    // Safety: never spin forever if Firestore is slow/unreachable — fall back to the empty state.
    const t = setTimeout(() => setLoading(false), 6000);
    return () => { unsub(); clearTimeout(t); };
  }, [tenant?.id]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && photos.length > 0) {
      interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % photos.length);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, photos.length]);

  const handleNext = () => setCurrentIndex((prev) => (prev + 1) % photos.length);
  const handlePrev = () => setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error("Error attempting to enable fullscreen:", err);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20 h-full w-full bg-zinc-950">
        <Loader2 className="animate-spin text-forest-500" size={48} />
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 h-full w-full bg-zinc-950">
        <div className="w-24 h-24 mb-6 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-white/20">
          <Sparkles size={48} />
        </div>
        <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-2">No Portfolio Items Yet</h2>
        <p className="text-zinc-500 font-bold max-w-sm text-center">Complete jobs with departure photos to build your automatic project showcase.</p>
      </div>
    );
  }

  const currentJob = photos[currentIndex];

  return (
    <div className={`flex flex-col bg-zinc-950 text-white ${isFullscreen ? 'fixed inset-0 z-50' : 'h-full w-full rounded-[40px] overflow-hidden border border-white/5'}`}>
        
        {/* Top Bar */}
        <div className="flex items-center justify-between p-6 shrink-0 absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent">
            <div>
                <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                    <Sparkles className="text-forest-500" />
                    Project Showcase
                </h1>
                <p className="text-xs font-black uppercase tracking-widest text-forest-400 mt-1">Client Presentation Mode</p>
            </div>
            
            <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 transition-all backdrop-blur-md"
                >
                    {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                </button>
                <button 
                  onClick={toggleFullscreen}
                  className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 transition-all backdrop-blur-md"
                >
                    <Maximize2 size={20} />
                </button>
            </div>
        </div>

        {/* Main View Area */}
        <div className="flex-1 relative group overflow-hidden bg-black flex flex-col justify-center">
            
            {/* Progress indicators */}
            <div className="absolute top-24 left-0 right-0 z-10 px-6 flex items-center justify-center gap-1">
                {photos.map((_, idx) => (
                    <div 
                        key={idx} 
                        className={`h-1 rounded-full transition-all duration-500 ${idx === currentIndex ? "w-8 bg-forest-500" : "w-2 bg-white/20"}`}
                    />
                ))}
            </div>

            <AnimatePresence mode="wait">
                <motion.img 
                    key={currentIndex}
                    src={currentJob.departurePhotoUrl}
                    alt={"Project " + currentJob.id}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                    className="absolute inset-0 w-full h-full object-cover opacity-80"
                />
            </AnimatePresence>
            
            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent pointer-events-none" />

            {/* Content Bottom */}
            <div className="absolute bottom-0 left-0 right-0 p-8 sm:p-12 md:p-20 z-10">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex + "-text"}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="max-w-4xl"
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <span className="px-4 py-2 bg-forest-500/20 text-forest-400 font-black uppercase tracking-widest text-xs rounded-[10px] border border-forest-500/20 backdrop-blur-md">
                                Completed Project
                            </span>
                            {currentJob.varianceFound === false && (
                                <span className="px-4 py-2 border border-white/20 text-white/80 font-black uppercase tracking-widest text-xs rounded-[10px] backdrop-blur-md flex items-center gap-2">
                                    <CheckCircle2 size={14} className="text-forest-500" />
                                    AI Verified Quality
                                </span>
                            )}
                        </div>

                        <h2 className="text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-tight leading-[0.9] mb-6 shadow-2xl drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]">
                            {currentJob.title || "Feature Property"}
                        </h2>
                        
                        <p className="text-lg sm:text-xl text-zinc-300 font-bold max-w-2xl leading-relaxed drop-shadow-xl text-balance">
                           {currentJob.snapshotNotes || currentJob.description || "Top tier landscaping and maintenance completed to strict quality standards."}
                        </p>
                        
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Navigation Arrows */}
            <button 
                onClick={handlePrev}
                className="absolute left-6 top-1/2 -translate-y-1/2 w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center rounded-3xl bg-black/40 border border-white/10 hover:bg-white/10 hover:scale-110 active:scale-95 transition-all text-white/50 hover:text-white backdrop-blur-xl z-20 group-hover:opacity-100 opacity-0"
            >
                <ChevronLeft size={32} />
            </button>
            <button 
                onClick={handleNext}
                className="absolute right-6 top-1/2 -translate-y-1/2 w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center rounded-3xl bg-black/40 border border-white/10 hover:bg-white/10 hover:scale-110 active:scale-95 transition-all text-white/50 hover:text-white backdrop-blur-xl z-20 group-hover:opacity-100 opacity-0"
            >
                <ChevronRight size={32} />
            </button>
        </div>
    </div>
  );
}
