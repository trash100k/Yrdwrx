import { fetchApi } from "../lib/api";
// @ts-nocheck

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sun,
  Moon,
  Zap,
  AlertCircle,
  TrendingUp,
  Sparkles,
  X,
  ChevronRight,
  Mail,
  Brain,
  Info,
} from "lucide-react";
import { useTenant } from "../contexts/TenantContext";
import { useToast } from "../contexts/ToastContext";
export function DailyBriefing() {
  const { tenant } = useTenant();
  const { showToast } = useToast();
  const [show, setShow] = useState(true);
  const [briefing, setBriefing] = useState<Record<string, any> | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [type, setType] = useState<"morning" | "evening">("morning");
  useEffect(() => {
    const hour = new Date().getHours();
    setType(hour < 14 ? "morning" : "evening");
    generateBriefing();
  }, []);
  const generateBriefing = async () => {
    setIsGenerating(true);
    try {
      const res = await fetchApi("/api/daily-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: type }),
      });
      const data = await res.json();
      setBriefing(data);
    } catch (err) {
      console.error(err);
      // Honest fallback: no fabricated metrics. Surface that the briefing
      // couldn't be generated rather than showing made-up numbers.
      setBriefing({
        title: type === "morning" ? "Morning Overview" : "End of Day Summary",
        hook: "We couldn't generate your briefing right now. Please try again shortly.",
        alerts: [],
        stats: [],
        priorityJob: null,
      });
    } finally {
      setIsGenerating(false);
    }
  };
  if (!show || !briefing) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className=" bg-linear-to-br from-forest-500/10 to-celtic-500/10 p-8 rounded-[48px] border-white/10 relative overflow-hidden group shadow-2xl"
    >
      {" "}
      <div className="absolute top-0 right-0 w-64 h-64 bg-forest-500/5 blur-3xl -mr-32 -mt-32 animate-pulse" />{" "}
      <div className="flex items-center justify-between mb-8 relative">
        {" "}
        <div className="flex items-center gap-4">
          {" "}
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center ${type === "morning" ? "bg-amber-400/20 text-amber-400" : "bg-celtic-400/20 text-celtic-400"}`}
          >
            {" "}
            {type === "morning" ? <Sun size={24} /> : <Moon size={24} />}{" "}
          </div>{" "}
          <div>
            {" "}
            <h3 className="text-xl font-black italic uppercase tracking-normal md:tracking-tighter text-white">
              {briefing.title}
            </h3>{" "}
            <p className="text-xs md:text-[10px] font-bold text-white/40 uppercase tracking-widest">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>{" "}
          </div>{" "}
        </div>{" "}
        <button
          onClick={() => setShow(false)}
          className="text-white/20 hover:text-white transition-colors"
        >
          {" "}
          <X size={20} />{" "}
        </button>{" "}
      </div>{" "}
      <p className="text-lg font-medium text-white/80 leading-relaxed mb-8 italic">
        {" "}
        "{briefing.hook}"{" "}
      </p>{" "}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {" "}
        <div className="space-y-4">
          {" "}
          <p className="text-xs md:text-[10px] font-black uppercase tracking-widest text-forest-400/60">
            Action Items
          </p>{" "}
          {briefing.alerts?.map(
            (alert: {
              id: number;
              text: string;
              type: string;
              action?: string;
            }) => (
              <div
                key={alert.id}
                className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5 group hover:border-forest-500/30 transition-all"
              >
                {" "}
                <AlertCircle
                  size={14}
                  className={
                    alert.type === "inventory"
                      ? "text-rose-400"
                      : "text-celtic-400"
                  }
                />{" "}
                <span className="text-xs font-bold text-white/90 flex-1">
                  {alert.text}
                </span>{" "}
                <button
                  onClick={() => {
                    showToast(`Help: Explanation for "${alert.text}" task...`);
                  }}
                  className="p-1.5 opacity-0 group-hover:opacity-100 hover:text-celtic-400 transition-all"
                  title="Explain Task"
                >
                  {" "}
                  <Info size={14} />{" "}
                </button>{" "}
                {alert.action === "email_supplier" && (
                  <button className="flex items-center gap-2 px-3 py-1.5 bg-forest-500 text-black rounded-lg text-[9px] font-black uppercase tracking-widest hover:scale-105 transition-all">
                    {" "}
                    <Mail size={12} /> Email{" "}
                  </button>
                )}{" "}
              </div>
            ),
          )}{" "}
        </div>{" "}
        <div className="space-y-4">
          {" "}
          <p className="text-xs md:text-[10px] font-black uppercase tracking-widest text-celtic-400/60">
            Top Priority
          </p>{" "}
          {briefing.priorityJob && (
            <div className="bg-white/5 p-6 rounded-3xl border border-white/5 flex items-center justify-between">
              {" "}
              <div>
                {" "}
                <h4 className="text-sm font-black text-white mb-1 uppercase italic tracking-tight">
                  {briefing.priorityJob.name}
                </h4>{" "}
                <p className="text-xs md:text-[10px] text-white/60 font-bold uppercase">
                  {briefing.priorityJob.task}
                </p>{" "}
              </div>{" "}
              <div className="text-right">
                {" "}
                <span className="text-[9px] font-black text-forest-400 bg-forest-500/10 px-2 py-1 rounded-lg border border-forest-500/20 uppercase">
                  High Priority
                </span>{" "}
              </div>{" "}
            </div>
          )}{" "}
          {briefing.priorityJob?.reason && (
            <p className="text-xs md:text-[10px] font-medium text-white/40 italic">
              "{briefing.priorityJob.reason}"
            </p>
          )}{" "}
        </div>{" "}
      </div>{" "}
      <div className="pt-8 border-t border-white/5 flex items-center justify-between">
        {" "}
        <div className="flex gap-8">
          {" "}
          {briefing.stats?.map(
            (
              stat: { label: string; value: string; trend: string },
              i: number,
            ) => (
              <div key={i}>
                {" "}
                <p className="text-[8px] font-black uppercase tracking-widest text-white/40 mb-1">
                  {stat.label}
                </p>{" "}
                <div className="flex items-center gap-2">
                  {" "}
                  <span className="text-lg font-black text-white italic">
                    {stat.value}
                  </span>{" "}
                  <span className="text-xs md:text-[10px] font-bold text-forest-400">
                    {stat.trend}
                  </span>{" "}
                </div>{" "}
              </div>
            ),
          )}{" "}
        </div>{" "}
        <button className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-2xl font-black text-xs md:text-[10px] uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all">
          {" "}
          Start Your Day <ChevronRight size={14} />{" "}
        </button>{" "}
      </div>{" "}
    </motion.div>
  );
}
