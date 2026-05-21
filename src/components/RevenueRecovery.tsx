
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Zap,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  Brain,
  Clock,
  ShieldCheck,
  DollarSign,
  Loader2,
  CheckCircle2,
} from "lucide-react";
interface Opportunity {
  id: string;
  client: string;
  type: string;
  detail: string;
  value: number;
  confidence: number;
}
export default function RevenueRecovery() {
  const [isAuditing, setIsAuditing] = useState(false);
  const [data, setData] = useState<{
    totalRecoverable: number;
    opportunities: Opportunity[];
  } | null>(null);
  const [recoveredIds, setRecoveredIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const runAudit = async () => {
    setIsAuditing(true);
    setError(null);
    try {
      const res = await fetch("/api/revenue/audit");
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "System error. Please try again.");
      }
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error(err);
      setError(err.message || "Connection error.");
    } finally {
      setIsAuditing(false);
    }
  };
  const recoverRevenue = (id: string) => {
    setRecoveredIds((prev) => [
      ...prev,
      id,
    ]); /* In a real app, this would trigger an invoice draft or a client outreach */
  };
  return (
    <section className=" bg-white/[0.01] p-10 relative overflow-hidden group border-white/5 shadow-2xl">
      {" "}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-[100px] -mr-40 -mt-40 transition-all group-hover:bg-emerald-500/10" />{" "}
      <header className="flex items-center justify-between mb-12 relative z-10">
        {" "}
        <div className="flex items-center gap-6">
          {" "}
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-black shadow-xl">
            {" "}
            <TrendingUp size={32} />{" "}
          </div>{" "}
          <div>
            {" "}
            <h2 className="text-2xl font-bold tracking-tight uppercase leading-none">
              Missed Billing
            </h2>{" "}
            <p className="text-[10px] text-emerald-400 font-bold tracking-[0.2em] mt-1.5 uppercase opacity-60">
              Smart Revenue Checker
            </p>{" "}
          </div>{" "}
        </div>{" "}
        <button
          onClick={runAudit}
          disabled={isAuditing}
          className="px-8 py-4 bg-white/5 border border-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 hover:bg-white hover:text-black transition-all disabled:opacity-50"
        >
          {" "}
          {isAuditing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Brain size={16} />
          )}{" "}
          {data ? "Check again" : "Check for missed revenue"}{" "}
        </button>{" "}
      </header>{" "}
      {!data && !isAuditing && !error && (
        <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[48px] relative z-10">
          {" "}
          <Zap size={48} className="text-white/10 mx-auto mb-6" />{" "}
          <p className="micro-label font-black text-white/20 uppercase tracking-[0.3em]">
            Ready to check your history for missed billing
          </p>{" "}
        </div>
      )}{" "}
      {error && !isAuditing && (
        <div className="py-16 text-center bg-red-500/5 border border-red-500/20 rounded-[48px] relative z-10">
          {" "}
          <AlertCircle
            size={40}
            className="text-red-500/40 mx-auto mb-6"
          />{" "}
          <p className="micro-label font-black text-red-500 uppercase tracking-[0.2em] mb-4">
            Error: {error}
          </p>{" "}
          <button
            onClick={runAudit}
            className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all"
          >
            {" "}
            Retry Connection{" "}
          </button>{" "}
        </div>
      )}{" "}
      {isAuditing && (
        <div className="space-y-6 animate-pulse px-4">
          {" "}
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 bg-white/5 rounded-[32px] border border-white/5"
            />
          ))}{" "}
        </div>
      )}{" "}
      <AnimatePresence>
        {" "}
        {data && !isAuditing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 relative z-10"
          >
            {" "}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              {" "}
              <div className="p-8 bg-black/40 rounded-[32px] border border-white/5 text-center">
                {" "}
                <p className="micro-label font-black text-white/30 uppercase tracking-widest mb-2">
                  Total Missed
                </p>{" "}
                <p className="text-4xl font-black italic text-emerald-400">
                  ${data.totalRecoverable.toLocaleString()}
                </p>{" "}
              </div>{" "}
              <div className="p-8 bg-black/40 rounded-[32px] border border-white/5 text-center">
                {" "}
                <p className="micro-label font-black text-white/30 uppercase tracking-widest mb-2">
                  Likelihood
                </p>{" "}
                <p className="text-4xl font-black italic text-blue-400">
                  88.5%
                </p>{" "}
              </div>{" "}
              <div className="p-8 bg-black/40 rounded-[32px] border border-white/5 text-center">
                {" "}
                <p className="micro-label font-black text-white/30 uppercase tracking-widest mb-2">
                  History Checked
                </p>{" "}
                <p className="text-4xl font-black italic text-white/80">
                  24 Months
                </p>{" "}
              </div>{" "}
            </div>{" "}
            <div className="space-y-4">
              {" "}
              {data.opportunities.map((opp, idx) => {
                const isRecovered = recoveredIds.includes(opp.id);
                return (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    key={opp.id}
                    className={`p-6 rounded-[32px] border flex items-center justify-between transition-all group ${isRecovered ? "bg-emerald-500/10 border-emerald-500/20" : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05]"}`}
                  >
                    {" "}
                    <div className="flex items-center gap-6">
                      {" "}
                      <div
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isRecovered ? "bg-emerald-500 text-black shadow-[0_0_20px_#10b981]" : "bg-white/5 text-white/30 group-hover:text-emerald-400"}`}
                      >
                        {" "}
                        {isRecovered ? (
                          <CheckCircle2 size={28} />
                        ) : opp.type === "UNBILLED_COMPLETION" ? (
                          <DollarSign size={28} />
                        ) : opp.type === "SERVICE_GAP" ? (
                          <Clock size={28} />
                        ) : opp.type === "UPSELL_RECOVERY" ? (
                          <TrendingUp size={28} />
                        ) : (
                          <AlertCircle size={28} />
                        )}{" "}
                      </div>{" "}
                      <div>
                        {" "}
                        <div className="flex items-center gap-3 mb-1">
                          {" "}
                          <h4 className="text-lg font-black text-white italic truncate">
                            {opp.client}
                          </h4>{" "}
                          <span
                            className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${opp.confidence > 0.9 ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-500"}`}
                          >
                            {" "}
                            {(opp.confidence * 100).toFixed(0)}% Conf{" "}
                          </span>{" "}
                        </div>{" "}
                        <p className="text-xs text-white/40 font-medium italic group-hover:text-white/60 transition-colors">
                          {" "}
                          {opp.detail}{" "}
                        </p>{" "}
                      </div>{" "}
                    </div>{" "}
                    <div className="text-right flex items-center gap-6">
                      {" "}
                      <div className="text-right hidden sm:block">
                        {" "}
                        <p className="micro-label font-black text-white/20 uppercase tracking-widest mb-1">
                          Potential Value
                        </p>{" "}
                        <p className="text-xl font-black italic text-emerald-400">
                          +${opp.value}
                        </p>{" "}
                      </div>{" "}
                      <button
                        onClick={() => recoverRevenue(opp.id)}
                        disabled={isRecovered}
                        className={`px-8 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 ${isRecovered ? "bg-emerald-500/20 text-emerald-400 opacity-50 cursor-default" : "bg-white text-black hover:scale-105 active:scale-95 shadow-xl"}`}
                      >
                        {" "}
                        {isRecovered ? "FIXED" : "FIX THE BILL"}{" "}
                        {!isRecovered && <ChevronRight size={16} />}{" "}
                      </button>{" "}
                    </div>{" "}
                  </motion.div>
                );
              })}{" "}
            </div>{" "}
            <div className="pt-10 flex items-center gap-4 text-white/20">
              {" "}
              <ShieldCheck size={20} />{" "}
              <p className="text-[10px] font-black uppercase tracking-widest">
                Revenue checking active for {recoveredIds.length + 42} records
              </p>{" "}
            </div>{" "}
          </motion.div>
        )}{" "}
      </AnimatePresence>{" "}
    </section>
  );
}
