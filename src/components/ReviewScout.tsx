
import { useState, useEffect } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion, AnimatePresence } from "motion/react";
import { Radio, MapPin, Clock, CheckCircle2 } from "lucide-react";
export default function ReviewScout() {
  const [broadcasts, setBroadcasts] = useState<
    { id: string; message: string }[]
  >([]);
  useEffect(() => {
    const q = query(
      collection(db, "broadcasts"),
      orderBy("timestamp", "desc"),
      limit(5),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as any,
        );
        setBroadcasts(data);
      },
      (error) => {
        console.warn("ReviewScout listener suppressed:", error.message);
      },
    );
    return () => unsubscribe();
  }, []);
  if (broadcasts.length === 0) return null;
  return (
    <div className=" bg-black/60 backdrop-blur-3xl rounded-[40px] p-8 text-white relative overflow-hidden border border-white/5 shadow-2xl">
      {" "}
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />{" "}
      <div className="flex items-center justify-between mb-8">
        {" "}
        <div className="flex items-center gap-3">
          {" "}
          <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-black relative">
            {" "}
            <Radio size={20} className="animate-pulse" />{" "}
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-black" />{" "}
          </div>{" "}
          <div>
            {" "}
            <h3 className="text-lg font-black italic tracking-tight lowercase">
              Neighborhood Feed.
            </h3>{" "}
            <p className="text-[9px] font-black uppercase text-emerald-400 tracking-widest leading-none mt-1">
              Live Updates
            </p>{" "}
          </div>{" "}
        </div>{" "}
        <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20">
          LIVE ACTIVITY
        </span>{" "}
      </div>{" "}
      <div className="space-y-4">
        {" "}
        <AnimatePresence mode="popLayout">
          {" "}
          {broadcasts.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: i === 0 ? 1 : 0.6, x: 0 }}
              className={`p-6 rounded-[24px] border transition-all duration-700 ${i === 0 ? "bg-white/10 border-emerald-500/30 shadow-glow" : "bg-white/5 border-white/5"}`}
            >
              {" "}
              <div className="flex items-center gap-3 mb-3">
                {" "}
                <MapPin size={12} className="text-emerald-400" />{" "}
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40 italic">
                  {b.neighborhood}
                </span>{" "}
                <span className="text-[9px] text-white/20 ml-auto flex items-center gap-1 font-black uppercase tracking-widest">
                  {" "}
                  <Clock size={10} /> Just now{" "}
                </span>{" "}
              </div>{" "}
              <p
                className={`text-xs font-bold leading-relaxed italic ${i === 0 ? "text-white" : "text-white/40"}`}
              >
                {" "}
                {b.message}{" "}
              </p>{" "}
              {i === 0 && (
                <div className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400 opacity-60">
                  {" "}
                  <CheckCircle2 size={12} /> Privacy Protected{" "}
                </div>
              )}{" "}
            </motion.div>
          ))}{" "}
        </AnimatePresence>{" "}
      </div>{" "}
      <p className="mt-8 text-[9px] text-center text-white/20 font-black uppercase tracking-[0.2em] leading-relaxed italic">
        {" "}
        Pushed live to your Public Website{" "}
      </p>{" "}
    </div>
  );
}
