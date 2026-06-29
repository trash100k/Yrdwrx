// @ts-nocheck
import React, { createContext, useContext, useState, ReactNode } from "react";

export interface OutboxItem {
  id: string;
  type: "email" | "chat" | "magic-link" | "backup";
  recipient: string;
  subject: string;
  content: string;
  timestamp: string;
  // "sent"   -> logged/delivered (legacy default for addLog)
  // "failed" -> the original action failed
  // "draft"  -> saved but not yet delivered (e.g. email awaiting real send)
  // "sending"-> a real send is in flight
  status: "sent" | "failed" | "draft" | "sending";
}

interface WorkspaceOutboxContextType {
  outbox: OutboxItem[];
  addLog: (
    item: Omit<OutboxItem, "id" | "timestamp" | "status">,
    status?: OutboxItem["status"]
  ) => void;
  setStatus: (id: string, status: OutboxItem["status"]) => void;
  markSent: (id: string) => void;
  removeItem: (id: string) => void;
  clearOutbox: () => void;
}

const WorkspaceOutboxContext = createContext<WorkspaceOutboxContextType | null>(null);

export const WorkspaceOutboxProvider = ({ children }: { children: ReactNode }) => {
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);

  const addLog = (
    item: Omit<OutboxItem, "id" | "timestamp" | "status">,
    status: OutboxItem["status"] = "sent"
  ) => {
    const newItem: OutboxItem = {
      ...item,
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
      status,
    };
    setOutbox((prev) => [newItem, ...prev]);
  };

  const setStatus = (id: string, status: OutboxItem["status"]) => {
    setOutbox((prev) => prev.map((it) => (it.id === id ? { ...it, status } : it)));
  };

  const markSent = (id: string) => setStatus(id, "sent");

  const removeItem = (id: string) => {
    setOutbox((prev) => prev.filter((it) => it.id !== id));
  };

  const clearOutbox = () => setOutbox([]);

  return (
    <WorkspaceOutboxContext.Provider
      value={{ outbox, addLog, setStatus, markSent, removeItem, clearOutbox }}
    >
      {children}
    </WorkspaceOutboxContext.Provider>
  );
};

export const useWorkspaceOutbox = () => {
  const context = useContext(WorkspaceOutboxContext);
  if (!context) {
    throw new Error("useWorkspaceOutbox must be used within a WorkspaceOutboxProvider");
  }
  return context;
};
