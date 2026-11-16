import { app, BrowserWindow, ipcMain, safeStorage } from "electron";
import path from "node:path";
import os from "node:os";
import { execFile, spawn } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import {
  getAiProviderInfo,
  isAiProvider,
  type AiAnalyzeRequest,
  type AiAnalyzeResult,
  type AiKeyStatus,
} from "./ai";

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
  warning?: string;
  failed?: string[];
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

// ── AI error analysis ─────────────────────────────────────────────────────────

interface SecretEntry {
  encrypted: boolean;
  value: string;
}

interface SecretsFile {
  version: 1;
  keys: Record<string, SecretEntry>;
}

const AI_SYSTEM_PROMPT = [
  "Você é um engenheiro sênior de Docker Swarm e DevOps.",
  "Analise a falha do serviço usando APENAS as evidências fornecidas.",
  "Responda em português do Brasil, em texto simples, com as seções:",
  "1) Diagnóstico provável",
  "2) Evidências",
  "3) Correção sugerida (inclua comandos quando aplicável)",
  "4) Como verificar",
  "Se as evidências forem insuficientes, diga exatamente o que verificar.",
  "Não invente causas nem comandos.",
].join(" ");

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function secretsFilePath(): string {
  return path.join(app.getPath("userData"), "ai-secrets.json");
}

function canEncryptSecrets(): boolean {
  try {
    if (!safeStorage.isEncryptionAvailable()) return false;
    if (
      process.platform === "linux" &&
      safeStorage.getSelectedStorageBackend() === "basic_text"
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function readSecrets(): SecretsFile {
  try {
    const parsed = JSON.parse(
      readFileSync(secretsFilePath(), "utf-8"),
    ) as Partial<SecretsFile>;
    return {
      version: 1,
      keys:
        parsed.keys && typeof parsed.keys === "object" ? parsed.keys : {},
    };
  } catch {
    return { version: 1, keys: {} };
  }
}

function writeSecrets(secrets: SecretsFile): void {
  const filePath = secretsFilePath();
  if (Object.keys(secrets.keys).length === 0) {
    try {
      unlinkSync(filePath);
    } catch {
      /* ignore */
    }
    return;
  }
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(secrets), { mode: 0o600 });
  try {
    chmodSync(filePath, 0o600);
  } catch {
    /* ignore (Windows) */
  }
}

function saveProviderKey(
  provider: string,
  key: string,
): { encrypted: boolean } {
  const encrypted = canEncryptSecrets();
  const value = encrypted
    ? safeStorage.encryptString(key).toString("base64")
    : Buffer.from(key, "utf-8").toString("base64");
  const secrets = readSecrets();
  secrets.keys[provider] = { encrypted, value };
  writeSecrets(secrets);
  return { encrypted };
}

function getProviderKey(provider: string): string | null {
  const entry = readSecrets().keys[provider];
  if (!entry || typeof entry.value !== "string") return null;
  try {
    if (entry.encrypted) {
      if (!safeStorage.isEncryptionAvailable()) return null;
      return safeStorage.decryptString(Buffer.from(entry.value, "base64"));
    }
    return Buffer.from(entry.value, "base64").toString("utf-8");
  } catch {
    return null;
  }
}

function providerKeyStatus(provider: string): AiKeyStatus {
  const entry = readSecrets().keys[provider];
  if (!entry) return { hasKey: false, encrypted: false };
  return {
    hasKey: getProviderKey(provider) !== null,
    encrypted: Boolean(entry.encrypted && canEncryptSecrets()),
  };
}

function collectServiceLogs(serviceName: string): Promise<string> {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(serviceName)) {
    return Promise.resolve("");
  }
  return new Promise((resolve) => {
    execFile(
      "docker",
      ["service", "logs", "--tail", "120", serviceName],
      { timeout: 15_000, maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err && !stdout) {
          resolve("");
          return;
        }
        const raw = `${stdout}\n${stderr}`.trim();
        resolve(raw.length > 14_000 ? raw.slice(-14_000) : raw);
      },
    );
  });
}

function buildAnalysisPrompt(request: AiAnalyzeRequest, logs: string): string {
  const sections = [
    `Serviço: ${request.serviceName}`,
    `Imagem: ${request.image}`,
    `Réplicas: ${request.status}`,
    `Estado da última task: ${request.taskState || "desconhecido"}`,
    `Erro da última task: ${request.taskError || "nenhum"}`,
    `Estado do update: ${request.updateState || "desconhecido"}`,
    `Mensagem do update: ${request.updateMessage || "nenhuma"}`,
    `Plataforma: ${process.platform}`,
  ];
  if (logs) {
    sections.push("", "Logs recentes (últimas 120 linhas):", logs);
  }
  return sections.join("\n");
}

async function callJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<Record<string, unknown> | null> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  const raw = await response.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    /* non-JSON error body */
  }
  if (!response.ok) {
    const errorNode = parsed?.["error"] as
      | Record<string, unknown>
      | string
      | undefined;
    const message =
      (typeof errorNode === "object" && errorNode
        ? (errorNode["message"] as string | undefined)
        : typeof errorNode === "string"
          ? errorNode
          : undefined) ||
      (parsed?.["message"] as string | undefined) ||
      raw.slice(0, 600).trim() ||
      `${response.status} ${response.statusText}`;
    throw new Error(`${response.status}: ${message}`);
  }
  return parsed;
}

function joinTextParts(parts: unknown): string {
  if (typeof parts === "string") return parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object") {
        const text = (part as { text?: unknown }).text;
        if (typeof text === "string") return text;
      }
      return "";
    })
    .join("");
}

async function callOpenAiCompatible(
  baseUrl: string,
  key: string | null,
  model: string,
  prompt: string,
): Promise<string> {
  const data = await callJson(
    `${baseUrl.replace(/\/+$/, "")}/chat/completions`,
    key ? { Authorization: `Bearer ${key}` } : {},
    {
      model,
      messages: [
        { role: "system", content: AI_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 1200,
    },
  );
  const choices = data?.["choices"] as
    | Array<Record<string, unknown>>
    | undefined;
  const message = choices?.[0]?.["message"] as
    | Record<string, unknown>
    | undefined;
  return (
    joinTextParts(message?.["content"]) ||
    joinTextParts(choices?.[0]?.["text"])
  );
}

async function analyzeServiceError(
  request: AiAnalyzeRequest,
): Promise<AiAnalyzeResult> {
  if (!request || typeof request !== "object") {
    return { ok: false, error: "Invalid AI request." };
  }
  if (!isAiProvider(request.provider)) {
    return { ok: false, error: "Invalid AI provider." };
  }
  if (
    typeof request.serviceName !== "string" ||
    !request.serviceName.trim()
  ) {
    return { ok: false, error: "Invalid service name." };
  }

  const info = getAiProviderInfo(request.provider);
  const key = getProviderKey(request.provider);
  if (info.requiresKey && !key) {
    return {
      ok: false,
      error: `No API key configured for ${info.label}. Open Settings → AI Error Analysis.`,
    };
  }

  let model = (request.model ?? "").trim() || info.defaultModel;
  let azureEndpoint = "";
  let azureDeployment = "";
  if (request.provider === "azure") {
    azureEndpoint = (request.azureEndpoint ?? "").trim().replace(/\/+$/, "");
    azureDeployment = (request.azureDeployment ?? "").trim();
    if (!azureEndpoint || !azureDeployment) {
      return {
        ok: false,
        error: "Azure OpenAI endpoint and deployment are required in Settings.",
      };
    }
    model = azureDeployment;
  } else if (!model) {
    return { ok: false, error: "No model configured for the AI provider." };
  }

  const logs = request.includeLogs
    ? await collectServiceLogs(request.serviceName)
    : "";
  const prompt = buildAnalysisPrompt(request, logs);

  let analysis = "";
  switch (request.provider) {
    case "anthropic": {
      const data = await callJson(
        "https://api.anthropic.com/v1/messages",
        {
          "x-api-key": key ?? "",
          "anthropic-version": "2023-06-01",
        },
        {
          model,
          max_tokens: 1200,
          temperature: 0.2,
          system: AI_SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }],
        },
      );
      analysis = joinTextParts(data?.["content"]);
      break;
    }
    case "google": {
      const modelPath = model.replace(/^models\//, "");
      const data = await callJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelPath)}:generateContent`,
        { "x-goog-api-key": key ?? "" },
        {
          systemInstruction: { parts: [{ text: AI_SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1200,
          },
        },
      );
      const candidates = data?.["candidates"] as
        | Array<Record<string, unknown>>
        | undefined;
      const content = candidates?.[0]?.["content"] as
        | Record<string, unknown>
        | undefined;
      analysis = joinTextParts(content?.["parts"]);
      break;
    }
    case "azure": {
      const base = azureEndpoint.endsWith("/openai")
        ? `${azureEndpoint}/deployments`
        : `${azureEndpoint}/openai/deployments`;
      const data = await callJson(
        `${base}/${encodeURIComponent(azureDeployment)}/chat/completions?api-version=2024-10-21`,
        { "api-key": key ?? "" },
        {
          messages: [
            { role: "system", content: AI_SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 1200,
        },
      );
      const choices = data?.["choices"] as
        | Array<Record<string, unknown>>
        | undefined;
      const message = choices?.[0]?.["message"] as
        | Record<string, unknown>
        | undefined;
      analysis = joinTextParts(message?.["content"]);
      break;
    }
    case "ollama":
      analysis = await callOpenAiCompatible(
        request.ollamaUrl?.trim() || "http://localhost:11434/v1",
        key,
        model,
        prompt,
      );
      break;
    case "openai":
      analysis = await callOpenAiCompatible(
        "https://api.openai.com/v1",
        key,
        model,
        prompt,
      );
      break;
    case "groq":
      analysis = await callOpenAiCompatible(
        "https://api.groq.com/openai/v1",
        key,
        model,
        prompt,
      );
      break;
    case "deepseek":
      analysis = await callOpenAiCompatible(
        "https://api.deepseek.com",
        key,
        model,
        prompt,
      );
      break;
    case "openrouter":
      analysis = await callOpenAiCompatible(
        "https://openrouter.ai/api/v1",
        key,
        model,
        prompt,
      );
      break;
  }

  const trimmed = analysis.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: "The AI provider returned an empty response.",
    };
  }
  return {
    ok: true,
    analysis: trimmed,
    provider: request.provider,
    model,
    includesLogs: Boolean(logs),
  };
}

ipcMain.handle("ai:keyStatus", (_event, provider: unknown): AiKeyStatus => {
  if (!isAiProvider(provider)) return { hasKey: false, encrypted: false };
  return providerKeyStatus(provider);
});

ipcMain.handle(
  "ai:saveKey",
  (
    _event,
    provider: unknown,
    key: unknown,
  ): { ok: boolean; error?: string; encrypted?: boolean } => {
    if (!isAiProvider(provider)) {
      return { ok: false, error: "Invalid AI provider." };
    }
    if (typeof key !== "string" || !key.trim()) {
      return { ok: false, error: "API key is empty." };
    }
    if (key.length > 20_000) {
      return { ok: false, error: "API key is too long." };
    }
    try {
      const result = saveProviderKey(provider, key.trim());
      return { ok: true, ...result };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  },
);

ipcMain.handle(
  "ai:clearKey",
  (_event, provider: unknown): { ok: boolean; error?: string } => {
    if (!isAiProvider(provider)) {
      return { ok: false, error: "Invalid AI provider." };
    }
    try {
      const secrets = readSecrets();
      delete secrets.keys[provider];
      writeSecrets(secrets);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  },
);

ipcMain.handle(
  "ai:analyze",
  async (_event, request: unknown): Promise<AiAnalyzeResult> => {
    try {
      return await analyzeServiceError(request as AiAnalyzeRequest);
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  },
);

// ── Terminal launcher helper for Linux/Cross-platform ─────────────────────────

function spawnLinuxTerminal(bashCommand: string, workingDir?: string): boolean {
  const terminals = [
    { bin: "gnome-terminal", args: ["--", "bash", "-c", bashCommand] },
    { bin: "konsole", args: ["-e", "bash", "-c", bashCommand] },
    { bin: "xfce4-terminal", args: ["-e", `bash -c "${bashCommand.replace(/"/g, '\\"')}"`] },
    { bin: "alacritty", args: ["-e", "bash", "-c", bashCommand] },
    { bin: "kitty", args: ["bash", "-c", bashCommand] },
    { bin: "xterm", args: ["-e", "bash", "-c", bashCommand] },
  ];

  for (const t of terminals) {
    try {
      const proc = spawn(t.bin, t.args, {
        detached: true,
        stdio: "ignore",
        cwd: workingDir,
      });
      proc.unref();
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

function spawnLinuxDirTerminal(targetDir: string): boolean {
  const dirTerminals = [
    { bin: "gnome-terminal", args: ["--working-directory", targetDir] },
    { bin: "konsole", args: ["--workdir", targetDir] },
    { bin: "xfce4-terminal", args: ["--working-directory", targetDir] },
    { bin: "alacritty", args: ["--working-directory", targetDir] },
    { bin: "kitty", args: ["--directory", targetDir] },
    { bin: "xterm", args: [] },
  ];

  for (const t of dirTerminals) {
    try {
      const proc = spawn(t.bin, t.args, {
        detached: true,
        stdio: "ignore",
        cwd: targetDir,
      });
      proc.unref();
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

ipcMain.handle("rawcontainers:logs", (_event, containerId: string) => {
  const cmd = `docker logs -f --tail=200 '${containerId}'; echo; echo '── End of logs. Press Enter to close ──'; read`;
  const ok = spawnLinuxTerminal(cmd);
  return ok ? { ok: true } : { ok: false, error: "Failed to open terminal (gnome-terminal/konsole/xfce4-terminal not found)" };
});

ipcMain.handle("rawcontainers:exec", (_event, containerId: string) => {
  const cmd = `docker exec -it '${containerId}' sh -c 'command -v bash && exec bash || exec sh'; echo; echo '── Session ended. Press Enter to close ──'; read`;
  const ok = spawnLinuxTerminal(cmd);
  return ok ? { ok: true } : { ok: false, error: "Failed to open terminal (gnome-terminal/konsole/xfce4-terminal not found)" };
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
  const ok = spawnLinuxTerminal(cmd);
  return ok ? { ok: true } : { ok: false, error: "Failed to open terminal" };
});

ipcMain.handle("service:build", (_event, scriptPath: string) => {
  const cwd = path.dirname(scriptPath);
  const cmd = `cd '${cwd}' && bash '${scriptPath}'; echo; echo '── Done. Press Enter to close ──'; read`;
  const ok = spawnLinuxTerminal(cmd, cwd);
  return ok ? { ok: true } : { ok: false, error: "Failed to open terminal" };
});

ipcMain.handle("service:fixShPermissions", (_event, dir: string) => {
  try {
    const resolved = resolvePath(dir);
    const cmd = `cd '${resolved}' && chmod +x *.sh && echo 'Done! Permissions fixed.' && sleep 2`;
    const ok = spawnLinuxTerminal(cmd, resolved);
    return ok ? { ok: true } : { ok: false, error: "Failed to open terminal" };
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
  const ok = spawnLinuxTerminal(cmd);
  return ok ? { ok: true } : { ok: false, error: "Failed to open terminal" };
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

      const ok = spawnLinuxDirTerminal(expanded);
      return ok ? { ok: true } : { ok: false, error: "Failed to open terminal" };
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
