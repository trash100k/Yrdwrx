// @ts-nocheck

import * as React from "react";
import { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { motion } from "motion/react";
import { logSystemEvent } from "../lib/firebase";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}
export class GlobalErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.handleGlobalRejection = this.handleGlobalRejection.bind(this);
    this.handleGlobalError = this.handleGlobalError.bind(this);
  }
  public state: State = { hasError: false, error: null };
  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("CRITICAL SYSTEM FAILURE:", error, errorInfo);
    try {
      logSystemEvent("UI_CRITICAL_CRASH", { error: error.message, stack: error.stack, componentStack: errorInfo.componentStack });
    } catch(e) {
      console.error("Failed to log system event", e);
    }
  }
  private handleGlobalRejection(event: PromiseRejectionEvent) {
    this.setState({ hasError: true, error: event.reason instanceof Error ? event.reason : new Error(String(event.reason)) });
    try {
      logSystemEvent("UNHANDLED_PROMISE_REJECTION", { error: String(event.reason) });
    } catch(e) {
      // Ignore
    }
  }
  private handleGlobalError(event: ErrorEvent) {
    this.setState({ hasError: true, error: event.error || new Error(event.message) });
    try {
      logSystemEvent("WINDOW_ERROR", { error: event.message });
    } catch(e) {
      // Ignore
    }
  }
  public componentDidMount() {
    window.addEventListener("unhandledrejection", this.handleGlobalRejection);
    window.addEventListener("error", this.handleGlobalError);
  }
  public componentWillUnmount() {
    window.removeEventListener("unhandledrejection", this.handleGlobalRejection);
    window.removeEventListener("error", this.handleGlobalError);
  }
  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] bg-black flex items-center justify-center p-6 relative overflow-hidden">
          {" "}
          <div className="atmosphere" aria-hidden="true" />{" "}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl w-full p-12 border-rose-500/20 bg-rose-500/[0.02] text-center relative z-10"
          >
            {" "}
            <div className="w-24 h-24 bg-rose-500 rounded-2xl flex items-center justify-center text-black shadow-[0_0_50px_rgba(239,68,68,0.3)] mx-auto mb-10">
              {" "}
              <AlertTriangle size={48} />{" "}
            </div>{" "}
            <h1 className="text-3xl sm:text-4xl font-black italic tracking-normal md:tracking-tighter text-white uppercase mb-4">
              Neural Grid Desynced.
            </h1>{" "}
            <p className="text-rose-400 font-bold tracking-widest uppercase text-xs md:text-[10px] mb-8">
              System Exception Captured
            </p>{" "}
            <div className="bg-black/40 border border-white/5 rounded-3xl p-6 mb-10 text-left">
              <p className="text-xs font-mono text-white/40 leading-relaxed break-all">
                {import.meta.env.DEV ? this.state.error?.message || "Unknown protocol violation" : "A critical system error occurred. The technical details have been logged securely. Please retry the operation."}
              </p>
            </div>{" "}
            <div className="flex flex-col md:flex-row gap-4">
              {" "}
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-5 bg-white text-black rounded-2xl font-black text-xs md:text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
              >
                {" "}
                <RotateCcw size={18} /> Reboot System{" "}
              </button>{" "}
              <button
                onClick={() => (window.location.href = "/")}
                className="flex-1 py-5 bg-white/5 border border-white/10 text-white rounded-2xl font-black text-xs md:text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-white/10 active:scale-95 transition-all"
              >
                {" "}
                <Home size={18} /> Return to Hub{" "}
              </button>{" "}
            </div>{" "}
            <p className="mt-12 micro-label opacity-20">
              {" "}
              Error logged. Persistence suggested.{" "}
            </p>{" "}
          </motion.div>{" "}
        </div>
      );
    }
    return this.props.children;
  }
}
