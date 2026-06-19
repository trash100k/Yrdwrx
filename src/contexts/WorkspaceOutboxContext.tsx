import React, { createContext, useContext, useState, ReactNode } from "react";

export interface OutboxItem {
  id: string;
  type: "email" | "chat" | "magic-link" | "backup";
  recipient: string;
  subject: string;
  content: string;
  timestamp: string;
  status: "sent" | "failed";
}

interface WorkspaceOutboxContextType {
  outbox: OutboxItem[];
  addLog: (item: Omit<OutboxItem, "id" | "timestamp" | "status">, status?: "sent" | "failed") => void;
  clearOutbox: () => void;
}

const WorkspaceOutboxContext = createContext<WorkspaceOutboxContextType | null>(null);

export const WorkspaceOutboxProvider = ({ children }: { children: ReactNode }) => {
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);

  const addLog = (item: Omit<OutboxItem, "id" | "timestamp" | "status">, status: "sent" | "failed" = "sent") => {
    const newItem: OutboxItem = {
      ...item,
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
      status,
    };
    setOutbox((prev) => [newItem, ...prev]);
  };

  const clearOutbox = () => setOutbox([]);

  return (
    <WorkspaceOutboxContext.Provider value={{ outbox, addLog, clearOutbox }}>
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
