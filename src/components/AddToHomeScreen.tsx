import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X } from 'lucide-react';

// Declare global interface for BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export function AddToHomeScreen() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Wait a bit before showing to avoid interrupting initial load
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-80 bg-zinc-900 border border-emerald-500/30 shadow-2xl rounded-2xl p-4 z-[9999] flex items-start gap-4"
        >
          <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center shrink-0">
            <Download className="text-emerald-400" size={24} />
          </div>
          <div className="flex-1 pt-1">
            <h4 className="text-white font-bold text-sm mb-1 uppercase tracking-wide">Install App</h4>
            <p className="text-xs text-zinc-400 mb-3 leading-relaxed">
              Add our OS to your home screen for quick access, offline capabilities, and a full-screen mobile experience.
            </p>
            <div className="flex gap-2">
              <button 
                onClick={handleInstallClick} 
                className="flex-1 bg-emerald-500 text-black font-bold text-xs uppercase tracking-wide py-2 rounded-lg hover:bg-emerald-400 transition-colors active:scale-95"
              >
                Install Now
              </button>
              <button 
                onClick={handleDismiss} 
                className="px-3 bg-white/5 border border-white/10 text-white font-bold text-xs uppercase tracking-wide rounded-lg hover:bg-white/10 transition-colors active:scale-95"
              >
                Later
              </button>
            </div>
          </div>
          <button onClick={handleDismiss} className="absolute top-2 right-2 p-1 text-zinc-500 hover:text-white transition-colors" aria-label="Dismiss">
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
