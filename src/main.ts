import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import os from "node:os";
import { execFile, spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";

interface ContainerInfo {
  id: string;
  name: string;
  status: string;
  image: string;
  running: boolean;
  uptime?: string;
}

interface ScriptResult {
  ok: boolean;
  error?: string;
  containers?: ContainerInfo[];
  changed?: number;
}

function parseScriptJson(raw?: string): ScriptResult | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ScriptResult;
  } catch {
    return null;
  }
}

function runScript(args: string[]): Promise<ScriptResult> {
  const basePath = app.isPackaged
    ? process.resourcesPath
    : path.resolve(__dirname, "..");
  const scriptsPath = app.isPackaged
    ? path.join(process.resourcesPath, "scripts")
    : path.join(__dirname, "../scripts");

  const pyScript = path.join(scriptsPath, "docker_control.py");
  const shScript = path.join(scriptsPath, "docker_control.sh");

  if (!existsSync(pyScript) && !existsSync(shScript)) {
    return Promise.resolve({
      ok: false,
      error: `docker scripts not found at ${path.join(scriptsPath)}`,
    });
  }

  return new Promise((resolve) => {
    execFile(
      "python3",
      [pyScript, ...args],
      { cwd: basePath },
      (pyErr, pyStdout, pyStderr) => {
        const pyParsed = parseScriptJson(pyStdout) ?? parseScriptJson(pyStderr);

        if (!pyErr && pyParsed) {
          resolve(pyParsed);
          return;
        }

        if (pyParsed && pyParsed.ok === false) {
          resolve(pyParsed);
          return;
        }

        execFile(
          "bash",
          [shScript, ...args],
          { cwd: basePath },
          (shErr, shStdout, shStderr) => {
            const shParsed =
              parseScriptJson(shStdout) ?? parseScriptJson(shStderr);

            if (shParsed) {
              resolve(shParsed);
              return;
            }

            if (shErr) {
              const details =
                shStderr?.trim() ||
                pyStderr?.trim() ||
                pyErr?.message ||
                shErr.message;
              resolve({
                ok: false,
                error: details || "failed to run docker scripts (python/bash)",
              });
              return;
            }

            resolve({ ok: false, error: "invalid response from bash script" });
          },
        );
      },
    );
  });
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, "index.html"));
}

ipcMain.handle("containers:list", async () => runScript(["list"]));

ipcMain.handle(
  "containers:control",
  async (_event, payload: { action: "start" | "stop"; ids: string[] }) =>
    runScript([payload.action, ...payload.ids]),
);

// ── Raw containers (docker ps) ─────────────────────────────────────────────────

function runContainerScript(args: string[]): Promise<{ ok: boolean; error?: string; containers?: unknown[] }> {
  const basePath = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, "..");
  const scriptsPath = app.isPackaged
    ? path.join(process.resourcesPath, "scripts")
    : path.join(__dirname, "../scripts");
  const pyScript = path.join(scriptsPath, "docker_containers.py");

  if (!existsSync(pyScript)) {
    return Promise.resolve({ ok: false, error: `docker_containers.py not found at ${scriptsPath}` });
  }

  return new Promise((resolve) => {
    execFile("python3", [pyScript, ...args], { cwd: basePath }, (err, stdout, stderr) => {
      try {
        const parsed = JSON.parse(stdout || stderr);
        resolve(parsed as { ok: boolean; error?: string; containers?: unknown[] });
      } catch {
        resolve({ ok: false, error: err?.message || "invalid response from docker_containers.py" });
      }
    });
  });
}

ipcMain.handle("rawcontainers:list", async (_event, includeAll: boolean) =>
  runContainerScript(includeAll ? ["list", "--all"] : ["list"]),
);

ipcMain.handle(
  "rawcontainers:control",
  async (_event, payload: { action: "start" | "stop" | "restart"; ids: string[] }) =>
    runContainerScript([payload.action, ...payload.ids]),
);

ipcMain.handle("rawcontainers:logs", (_event, containerId: string) => {
  const cmd = `docker logs -f --tail=200 '${containerId}'; echo; echo '── End of logs. Press Enter to close ──'; read`;
  try {
    const proc = spawn("gnome-terminal", ["--", "bash", "-c", cmd], { detached: true, stdio: "ignore" });
    proc.unref();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle("rawcontainers:exec", (_event, containerId: string) => {
  const cmd = `docker exec -it '${containerId}' sh -c 'command -v bash && exec bash || exec sh'; echo; echo '── Session ended. Press Enter to close ──'; read`;
  try {
    const proc = spawn("gnome-terminal", ["--", "bash", "-c", cmd], { detached: true, stdio: "ignore" });
    proc.unref();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});


// ── Build scripts ─────────────────────────────────────────────────────────────

function resolvePath(rawPath: string): string {
  if (rawPath.startsWith("~")) {
    return path.join(os.homedir(), rawPath.slice(1));
  }
  return rawPath;
}

function normalizeBuildName(s: string): string {
  return s.replace(/[-_]/g, "").toLowerCase();
}

function findBuildScript(
  serviceName: string,
  visionPath: string,
): string | null {
  const resolvedPath = resolvePath(visionPath);
  const withoutStack = serviceName.includes("_")
    ? serviceName.substring(serviceName.indexOf("_") + 1)
    : serviceName;
  const normalized = normalizeBuildName(withoutStack);
  if (!existsSync(resolvedPath)) return null;
  try {
    for (const entry of readdirSync(resolvedPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const scriptPath = path.join(
        resolvedPath,
        entry.name,
        "BuildAndUpdate.sh",
      );
      if (
        existsSync(scriptPath) &&
        normalizeBuildName(entry.name) === normalized
      ) {
        return scriptPath;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

ipcMain.handle(
  "service:findBuildScript",
  (_event, serviceName: string, visionPath: string) =>
    findBuildScript(serviceName, visionPath),
);

function findServiceDirectory(
  serviceName: string,
  visionPath: string,
): string | null {
  const resolvedPath = resolvePath(visionPath);
  const withoutStack = serviceName.includes("_")
    ? serviceName.substring(serviceName.indexOf("_") + 1)
    : serviceName;
  const normalized = normalizeBuildName(withoutStack);
  if (!existsSync(resolvedPath)) return null;
  try {
    for (const entry of readdirSync(resolvedPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (normalizeBuildName(entry.name) === normalized) {
        return path.join(resolvedPath, entry.name);
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

ipcMain.handle(
  "service:findDirectory",
  (_event, serviceName: string, visionPath: string) =>
    findServiceDirectory(serviceName, visionPath),
);

ipcMain.handle(
  "vision:checkPath",
  (_event, visionPath: string): { exists: boolean; resolved: string } => {
    const resolved = resolvePath(visionPath);
    return { exists: existsSync(resolved), resolved };
  },
);

ipcMain.handle("service:logs", (_event, serviceName: string) => {
  const cmd = `docker service logs -f --tail=200 '${serviceName}'; echo; echo '── End of logs. Press Enter to close ──'; read`;
  try {
    const proc = spawn("gnome-terminal", ["--", "bash", "-c", cmd], {
      detached: true,
      stdio: "ignore",
    });
    proc.unref();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});

ipcMain.handle("service:build", (_event, scriptPath: string) => {
  const cwd = path.dirname(scriptPath);
  const cmd = `cd '${cwd}' && bash '${scriptPath}'; echo; echo '── Done. Press Enter to close ──'; read`;
  const proc = spawn("gnome-terminal", ["--", "bash", "-c", cmd], {
    detached: true,
    stdio: "ignore",
    cwd,
  });
  proc.unref();
  return { ok: true };
});

ipcMain.handle("service:fixShPermissions", (_event, dir: string) => {
  try {
    const resolved = resolvePath(dir);
    const proc = spawn(
      "gnome-terminal",
      ["--", "bash", "-c", `cd '${resolved}' && chmod +x *.sh && echo 'Done! Permissions fixed.' && sleep 2`],
      { detached: true, stdio: "ignore", cwd: resolved },
    );
    proc.unref();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});

ipcMain.handle("acr:login", () => {
  const acrName = process.env["ACR_NAME"] ?? "vortal";
  const cmd = `az acr login --name '${acrName}' && echo '' && echo '── Login successful. Press Enter to close ──' && read || (echo '' && echo '── Login failed. Press Enter to close ──' && read)`;
  try {
    const proc = spawn("gnome-terminal", ["--", "bash", "-c", cmd], {
      detached: true,
      stdio: "ignore",
    });
    proc.unref();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});

ipcMain.handle(
  "terminal:open",
  (
    _event,
    targetPath: string,
    opts: { useWsl?: boolean; wslDistro?: string } = {},
  ) => {
    try {
      const expanded = resolvePath(targetPath);
      const { useWsl = false, wslDistro = "Ubuntu" } = opts;

      if (useWsl) {
        // Convert Linux path to WSL UNC path: /home/user/x → \\wsl.localhost\Ubuntu\home\user\x
        const uncPath = `\\\\wsl.localhost\\${wslDistro}${expanded.replace(/\//g, "\\")}`;
        // Try Windows Terminal first, fallback to plain wsl.exe
        try {
          const proc = spawn("wt.exe", ["-p", wslDistro, "-d", uncPath], {
            detached: true,
            stdio: "ignore",
          });
          proc.unref();
        } catch {
          const proc = spawn(
            "cmd.exe",
            ["/c", "start", "wt.exe", "-p", wslDistro, "-d", uncPath],
            { detached: true, stdio: "ignore", shell: false },
          );
          proc.unref();
        }
        return { ok: true };
      }

      const proc = spawn("gnome-terminal", ["--working-directory", expanded], {
        detached: true,
        stdio: "ignore",
      });
      proc.unref();
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
);

app.whenReady().then(() => {
  // Load .env for ACR_NAME and other config
  const envPath = app.isPackaged
    ? path.join(process.resourcesPath, ".env")
    : path.join(__dirname, "../.env");
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (key && !(key in process.env)) process.env[key] = val;
    }
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
