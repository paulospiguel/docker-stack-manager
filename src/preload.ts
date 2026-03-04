import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("dockerApi", {
  listContainers: () => ipcRenderer.invoke("containers:list"),
  controlContainers: (action: "start" | "stop", ids: string[]) =>
    ipcRenderer.invoke("containers:control", { action, ids }),
  findBuildScript: (serviceName: string, visionPath: string) =>
    ipcRenderer.invoke("service:findBuildScript", serviceName, visionPath),
  findServiceDirectory: (serviceName: string, visionPath: string) =>
    ipcRenderer.invoke("service:findDirectory", serviceName, visionPath),
  checkVisionPath: (visionPath: string) =>
    ipcRenderer.invoke("vision:checkPath", visionPath),
  buildService: (scriptPath: string) =>
    ipcRenderer.invoke("service:build", scriptPath),
  openTerminal: (
    targetPath: string,
    opts?: { useWsl?: boolean; wslDistro?: string },
  ) => ipcRenderer.invoke("terminal:open", targetPath, opts),
  openServiceLogs: (containerName: string) =>
    ipcRenderer.invoke("service:logs", containerName),
});
