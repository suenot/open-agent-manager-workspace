export interface Project {
  id: string;
  name: string;
  path: string;
  icon: string;
  description?: string;
  env_vars: Record<string, string>;
}

export interface TerminalSession {
  id: string;
  projectId: string;
  projectName: string;
  projectIcon: string;
  status: "running" | "stopped" | "error";
}
