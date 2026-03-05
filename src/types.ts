// ── Shared types ──────────────────────────────────────────────────────────────

export type Action = "start" | "stop" | "restart";

export interface ContainerInfo {
  id: string;
  name: string;
  status: string;
  image: string;
  running: boolean;
  uptime?: string;
}

export interface RawContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  ports: string;
  running: boolean;
  uptime: string;
}

export interface ApiResult {
  ok: boolean;
  error?: string;
  containers?: ContainerInfo[];
  changed?: number;
}

export interface TerminalOpts {
  useWsl?: boolean;
  wslDistro?: string;
}

export interface DockerApi {
  listContainers: () => Promise<ApiResult>;
  controlContainers: (action: Action, ids: string[]) => Promise<ApiResult>;
  findBuildScript: (
    serviceName: string,
    visionPath: string,
  ) => Promise<string | null>;
  findServiceDirectory: (
    serviceName: string,
    visionPath: string,
  ) => Promise<string | null>;
  checkVisionPath: (
    visionPath: string,
  ) => Promise<{ exists: boolean; resolved: string }>;
  buildService: (
    scriptPath: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  openTerminal: (
    targetPath: string,
    opts?: TerminalOpts,
  ) => Promise<{ ok: boolean; error?: string }>;
  openServiceLogs: (
    containerName: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  fixShPermissions: (
    dir: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  acrLogin: () => Promise<{ ok: boolean; error?: string }>;
  listRawContainers: (
    includeAll: boolean,
  ) => Promise<{ ok: boolean; error?: string; containers?: RawContainerInfo[] }>;
  controlRawContainers: (
    action: "start" | "stop" | "restart",
    ids: string[],
  ) => Promise<{ ok: boolean; error?: string; changed?: number }>;
  openContainerLogs: (
    containerId: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  execContainer: (
    containerId: string,
  ) => Promise<{ ok: boolean; error?: string }>;
}

export interface ContainerGroup {
  id: string;
  name: string;
  color: string;
  ids: string[];
  predefined?: boolean;
}
