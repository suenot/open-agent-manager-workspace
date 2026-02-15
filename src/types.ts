export interface RemoteConfig {
  type?: "cmdop" | "ssh"; // default "cmdop" for backward compat
  // CMDOP fields
  machine?: string;
  remote_path: string;
  // SSH fields
  host?: string;
  user?: string;
  port?: number;
  identity_file?: string;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  icon: string;
  description?: string;
  env_vars: Record<string, string>;
  remote?: RemoteConfig;
  cli?: string;
  archived?: boolean;
  server_id?: string;
}

export interface Server {
  id: string;
  name: string;
  type: "ssh" | "cmdop";
  host?: string;
  user?: string;
  port?: number;
  identity_file?: string;
  machine?: string;
  default_projects_path: string;
}

export type SidebarTab = "active" | "archive" | "import";

export interface PromptCard {
  id: string;
  text: string;
  images: string[];
}

export type TaskStatus = "todo" | "in_progress" | "done";

export interface TaskCard {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  created_at: number;
}

export interface TerminalSession {
  id: string;
  projectId: string;
  projectName: string;
  projectIcon: string;
  status: "running" | "stopped" | "error";
  cli?: string;
}

export interface CmdopAuth {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface AppError {
  id: string;
  timestamp: number;
  source: string;
  message: string;
  details?: string;
}
