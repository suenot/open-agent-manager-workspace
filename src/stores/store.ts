import { create } from "zustand";
import type { Project, TerminalSession } from "../types";

export type TeammateMode = "auto" | "in-process" | "tmux";

export interface AppSettings {
  useTmux: boolean;
  teammateMode: TeammateMode;
  dangerouslySkipPermissions: boolean;
}

const SETTINGS_KEY = "ccam-settings";

const defaultSettings: AppSettings = {
  useTmux: false,
  teammateMode: "auto",
  dangerouslySkipPermissions: true,
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultSettings;
}

function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

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

  showSettings: boolean;
  setShowSettings: (show: boolean) => void;

  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
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

  showSettings: false,
  setShowSettings: (show) => set({ showSettings: show }),

  settings: loadSettings(),
  updateSettings: (patch) =>
    set((state) => {
      const next = { ...state.settings, ...patch };
      saveSettings(next);
      return { settings: next };
    }),
}));
