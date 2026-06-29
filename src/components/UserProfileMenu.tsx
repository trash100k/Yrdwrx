import React from "react";
import { User, Settings, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, signOutUser } from "../lib/supabase";

export const UserProfileMenu = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {

  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const displayName = currentUser?.displayName || "Supervisor";
  const displayEmail = currentUser?.email || "supervisor@yardworx.com";

  const goToSettings = () => {
    onClose();
    navigate("/admin/settings");
  };

  const handleSignOut = async () => {
    onClose();
    await signOutUser();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[190]" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-20 right-4 sm:right-8 w-64 bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[200]"
          >
            <div className="p-5 border-b border-white/5 bg-black/50">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Signed in as</p>
              <p className="font-bold text-white text-sm">{displayName}</p>
              <p className="text-xs text-zinc-400 mt-1">{displayEmail}</p>
            </div>
            
            <div className="p-2 space-y-1">
              <button onClick={goToSettings} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-zinc-300 text-sm font-medium transition-colors">
                <User size={16} className="text-zinc-400" /> My Profile
              </button>
              <button onClick={goToSettings} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-zinc-300 text-sm font-medium transition-colors">
                <Settings size={16} className="text-zinc-400" /> Preferences
              </button>
            </div>
            
            <div className="p-2 border-t border-white/5 bg-black/50">
               <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-rose-500/10 text-rose-400 text-sm font-medium transition-colors">
                  <LogOut size={16} /> Sign Out
               </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
