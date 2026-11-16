// ── Shared AI provider metadata and IPC contracts ─────────────────────────────

export type AiProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "deepseek"
  | "openrouter"
  | "ollama"
  | "azure";

export interface AiProviderInfo {
  id: AiProvider;
  label: string;
  defaultModel: string;
  requiresKey: boolean;
  requiresEndpoint?: boolean;
  requiresDeployment?: boolean;
}

export const AI_PROVIDERS: readonly AiProviderInfo[] = [
  {
    id: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    requiresKey: true,
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    defaultModel: "claude-3-5-haiku-latest",
    requiresKey: true,
  },
  {
    id: "google",
    label: "Google Gemini",
    defaultModel: "gemini-2.0-flash",
    requiresKey: true,
  },
  {
    id: "groq",
    label: "Groq",
    defaultModel: "llama-3.3-70b-versatile",
    requiresKey: true,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    defaultModel: "deepseek-chat",
    requiresKey: true,
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    defaultModel: "openai/gpt-4o-mini",
    requiresKey: true,
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    defaultModel: "llama3.1",
    requiresKey: false,
  },
  {
    id: "azure",
    label: "Azure OpenAI",
    defaultModel: "",
    requiresKey: true,
    requiresEndpoint: true,
    requiresDeployment: true,
  },
];

export function isAiProvider(value: unknown): value is AiProvider {
  return (
    typeof value === "string" &&
    AI_PROVIDERS.some((provider) => provider.id === value)
  );
}

export function getAiProviderInfo(id: string): AiProviderInfo {
  return AI_PROVIDERS.find((provider) => provider.id === id) ?? AI_PROVIDERS[0];
}

export interface AiAnalyzeRequest {
  provider: AiProvider;
  model?: string;
  azureEndpoint?: string;
  azureDeployment?: string;
  ollamaUrl?: string;
  includeLogs?: boolean;
  serviceName: string;
  image: string;
  status: string;
  taskState?: string;
  taskError?: string;
  updateState?: string;
  updateMessage?: string;
}

export interface AiAnalyzeResult {
  ok: boolean;
  analysis?: string;
  error?: string;
  provider?: AiProvider;
  model?: string;
  includesLogs?: boolean;
}

export interface AiKeyStatus {
  hasKey: boolean;
  encrypted: boolean;
}
