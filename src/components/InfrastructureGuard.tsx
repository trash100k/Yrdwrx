// @ts-nocheck

import React from "react";
import { ErrorBoundary } from "react-error-boundary";
import { AlertTriangle, RefreshCcw } from "lucide-react";

function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 bg-black h-[100dvh] text-center">
      <div className="w-20 h-20 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center text-rose-500 mb-8 shadow-2xl shadow-rose-500/10">
        <AlertTriangle size={40} />
      </div>
      <h2 className="text-2xl sm:text-3xl font-black italic tracking-normal md:tracking-tighter uppercase text-white mb-4">
        Neural Grid Disrupted
      </h2>
      <p className="text-white/40 max-w-md mx-auto mb-10 font-medium leading-relaxed">
        The system encountered a logic reconciliation error. Your local state
        has been preserved, but the view must be recalibrated.
      </p>
      <pre className="text-xs md:text-[10px] font-mono text-rose-400 bg-rose-500/5 p-6 rounded-2xl border border-rose-500/10 mb-8 max-w-lg overflow-auto">
        {error.message}
      </pre>
      <button
        onClick={resetErrorBoundary}
        className="flex items-center gap-3 bg-white text-black px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 active:scale-95 transition-all shadow-2xl"
      >
        <RefreshCcw size={16} />
        Recalibrate View
      </button>
    </div>
  );
}

export function InfrastructureGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        window.location.reload();
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
