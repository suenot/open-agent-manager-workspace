import { create } from "zustand";
import type { Project, TerminalSession } from "../types";

interface AppState {
  projects: Project[];
  setProjects: (projects: Project[]) => void;

  sessions: TerminalSession[];
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;

  addSession: (session: TerminalSession) => void;
  removeSession: (sessionId: string) => void;
  updateSessionStatus: (
    sessionId: string,
    status: TerminalSession["status"],
  ) => void;

  showAddProject: boolean;
  setShowAddProject: (show: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  projects: [],
  setProjects: (projects) => set({ projects }),

  sessions: [],
  activeSessionId: null,
  setActiveSessionId: (id) => set({ activeSessionId: id }),

  addSession: (session) =>
    set((state) => ({
      sessions: [...state.sessions, session],
      activeSessionId: session.id,
    })),

  removeSession: (sessionId) =>
    set((state) => {
      const remaining = state.sessions.filter((s) => s.id !== sessionId);
      const newActive =
        state.activeSessionId === sessionId
          ? remaining.length > 0
            ? remaining[remaining.length - 1].id
            : null
          : state.activeSessionId;
      return { sessions: remaining, activeSessionId: newActive };
    }),

  updateSessionStatus: (sessionId, status) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, status } : s,
      ),
    })),

  showAddProject: false,
  setShowAddProject: (show) => set({ showAddProject: show }),
}));
