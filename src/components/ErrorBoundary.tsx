import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-zinc-950 border border-red-500/20 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-rose-500" />
             <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={32} className="text-red-500" />
             </div>
             <h1 className="text-2xl font-black italic uppercase tracking-tighter mb-2">System Interruption</h1>
             <p className="text-zinc-400 text-sm leading-relaxed mb-8">
               An unexpected error occurred in the component tree. Don't worry, your data is safe. Let's restart the interface.
             </p>
             <button
                onClick={() => window.location.reload()}
                className="w-full flex items-center justify-center gap-3 py-4 bg-white text-black font-black uppercase text-xs tracking-widest rounded-xl hover:bg-zinc-200 transition-colors"
             >
                <RefreshCw size={16} /> Reload Application
             </button>
             
             {this.state.error && (
               <div className="mt-8 p-4 bg-black/50 border border-white/5 rounded-xl text-left overflow-x-auto">
                 <p className="text-[10px] font-mono text-zinc-500 whitespace-pre">{this.state.error.toString()}</p>
               </div>
             )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
