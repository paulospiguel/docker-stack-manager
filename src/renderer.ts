import pkg from "../package.json";
import {
  createIcons,
  Play,
  Square,
  RotateCcw,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  PanelLeft,
  Container,
  Search,
  BookmarkPlus,
  Timer,
  Check,
  X,
  Star,
  Layers,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  Hammer,
  Terminal,
  Settings,
  MoreVertical,
  ScrollText,
  Monitor,
  Server,
  HelpCircle,
  Sparkles,
  Copy,
} from "lucide";

import type { Action, ContainerInfo, ContainerGroup, DockerApi, RawContainerInfo } from "./types";
import {
  AI_PROVIDERS,
  getAiProviderInfo,
  type AiAnalyzeRequest,
  type AiAnalyzeResult,
  type AiProvider,
} from "./ai";
import {
  escHtml,
  shortName,
  getStackName,
  getAvailableStacks,
  containerBadge,
  newId,
} from "./utils";
import { loadGroups, saveGroups, seedPredefinedGroups } from "./groups";
import { showToast } from "./toast";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const body = document.getElementById(
  "containersBody",
) as HTMLTableSectionElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const selectAllEl = document.getElementById("selectAll") as HTMLInputElement;
const countEl = document.getElementById("containerCount") as HTMLSpanElement;
const intervalSel = document.getElementById(
  "autoRefreshInterval",
) as HTMLSelectElement;
const countdownEl = document.getElementById(
  "refreshCountdown",
) as HTMLSpanElement;
const filterInput = document.getElementById("filterInput") as HTMLInputElement;
const filterClearBtn = document.getElementById("filterClearBtn") as HTMLButtonElement;
const statusFilterSelectorEl = document.getElementById("statusFilterSelector") as HTMLSelectElement;
const sidebarEl = document.getElementById("sidebar") as HTMLElement;
const sidebarList = document.getElementById("sidebarList") as HTMLDivElement;
const groupModal = document.getElementById("groupModal") as HTMLDivElement;
const modalTitle = document.getElementById("modalTitle") as HTMLHeadingElement;
const groupNameInput = document.getElementById(
  "groupNameInput",
) as HTMLInputElement;
const colorPickerEl = document.getElementById("colorPicker") as HTMLDivElement;
const groupContList = document.getElementById(
  "groupContainerList",
) as HTMLDivElement;
const modalSearchEl = document.getElementById(
  "modalContainerSearch",
) as HTMLInputElement;
const modalSaveBtn = document.getElementById("modalSave") as HTMLButtonElement;
const modalCancelBtn = document.getElementById(
  "modalCancel",
) as HTMLButtonElement;
const modalDeleteBtn = document.getElementById(
  "modalDelete",
) as HTMLButtonElement;
const modalCloseBtn = document.getElementById(
  "modalClose",
) as HTMLButtonElement;
const stackSelectorEl = document.getElementById(
  "stackSelector",
) as HTMLSelectElement;
// Group picker
const groupPickerEl = document.getElementById("groupPicker") as HTMLDivElement;
const groupPickerListEl = document.getElementById(
  "groupPickerList",
) as HTMLDivElement;
// Context menu
const ctxMenuEl = document.getElementById("ctxMenu") as HTMLDivElement;
const ctxStartBtn = document.getElementById("ctxStart") as HTMLButtonElement;
const ctxStartLabel = document.getElementById(
  "ctxStartLabel",
) as HTMLSpanElement;
const ctxStopBtn = document.getElementById("ctxStop") as HTMLButtonElement;
const ctxBuildBtn = document.getElementById("ctxBuild") as HTMLButtonElement;
const ctxBuildDivider = document.getElementById(
  "ctxBuildDivider",
) as HTMLDivElement;
const ctxTerminalBtn = document.getElementById(
  "ctxTerminal",
) as HTMLButtonElement;
const ctxLogsBtn = document.getElementById(
  "ctxLogs",
) as HTMLButtonElement;
const ctxChmodBtn = document.getElementById(
  "ctxChmod",
) as HTMLButtonElement;
const ctxAiBtn = document.getElementById("ctxAi") as HTMLButtonElement;
const openVisionTerminalBtn = document.getElementById(
  "openVisionTerminal",
) as HTMLButtonElement;
const acrLoginBtn = document.getElementById(
  "acrLogin",
) as HTMLButtonElement;
// Settings modal
const settingsModalEl = document.getElementById(
  "settingsModal",
) as HTMLDivElement;
const settingsVisionPathEl = document.getElementById(
  "settingsVisionPath",
) as HTMLInputElement;
const settingsUseWslEl = document.getElementById(
  "settingsUseWsl",
) as HTMLInputElement;
const settingsWslDistroRowEl = document.getElementById(
  "settingsWslDistroRow",
) as HTMLDivElement;
const settingsWslDistroEl = document.getElementById(
  "settingsWslDistro",
) as HTMLInputElement;
const settingsPathStatusEl = document.getElementById(
  "settingsPathStatus",
) as HTMLDivElement;
const settingsAiProviderEl = document.getElementById(
  "settingsAiProvider",
) as HTMLSelectElement;
const settingsAiModelEl = document.getElementById(
  "settingsAiModel",
) as HTMLInputElement;
const settingsAiModelHintEl = document.getElementById(
  "settingsAiModelHint",
) as HTMLParagraphElement;
const settingsAiAzureRowsEl = document.getElementById(
  "settingsAiAzureRows",
) as HTMLDivElement;
const settingsAiAzureEndpointEl = document.getElementById(
  "settingsAiAzureEndpoint",
) as HTMLInputElement;
const settingsAiAzureDeploymentEl = document.getElementById(
  "settingsAiAzureDeployment",
) as HTMLInputElement;
const settingsAiOllamaRowEl = document.getElementById(
  "settingsAiOllamaRow",
) as HTMLDivElement;
const settingsAiOllamaUrlEl = document.getElementById(
  "settingsAiOllamaUrl",
) as HTMLInputElement;
const settingsAiKeyEl = document.getElementById(
  "settingsAiKey",
) as HTMLInputElement;
const settingsAiClearKeyBtn = document.getElementById(
  "settingsAiClearKey",
) as HTMLButtonElement;
const settingsAiKeyStatusEl = document.getElementById(
  "settingsAiKeyStatus",
) as HTMLDivElement;
const settingsAiIncludeLogsEl = document.getElementById(
  "settingsAiIncludeLogs",
) as HTMLInputElement;
const aiModalEl = document.getElementById("aiModal") as HTMLDivElement;
const aiModalTitleEl = document.getElementById(
  "aiModalTitle",
) as HTMLHeadingElement;
const aiModalMetaEl = document.getElementById(
  "aiModalMeta",
) as HTMLParagraphElement;
const aiModalResultEl = document.getElementById(
  "aiModalResult",
) as HTMLPreElement;
const aiModalCopyBtn = document.getElementById(
  "aiModalCopy",
) as HTMLButtonElement;
const aiModalCloseBtn = document.getElementById(
  "aiModalClose",
) as HTMLButtonElement;
const aiModalCloseFooterBtn = document.getElementById(
  "aiModalCloseBtn",
) as HTMLButtonElement;
const startSelectedBtn = document.getElementById(
  "startSelected",
) as HTMLButtonElement;
const stopSelectedBtn = document.getElementById(
  "stopSelected",
) as HTMLButtonElement;
const restartSelectedBtn = document.getElementById(
  "restartSelected",
) as HTMLButtonElement;
const errorFooterEl = document.getElementById("errorFooter") as HTMLDivElement;
const errorFooterMsgEl = document.getElementById(
  "errorFooterMsg",
) as HTMLSpanElement;
const errorFooterCloseBtn = document.getElementById(
  "errorFooterClose",
) as HTMLButtonElement;

errorFooterCloseBtn.addEventListener("click", () => {
  errorFooterEl.classList.add("hidden");
});

function showFooterError(message: string): void {
  errorFooterMsgEl.textContent = message;
  errorFooterEl.classList.remove("hidden");
}

function clearFooterError(): void {
  errorFooterEl.classList.add("hidden");
}

const api = (window as Window & { dockerApi?: DockerApi }).dockerApi;

// ── State ─────────────────────────────────────────────────────────────────────
const STACK_KEY = "dsm_stack_v1";

const GROUP_COLORS = [
  "#1f6feb",
  "#238636",
  "#d29922",
  "#da3633",
  "#8957e5",
  "#0086a3",
  "#e67e22",
  "#bf8700",
];

let containers: ContainerInfo[] = [];
let groups: ContainerGroup[] = loadGroups();
let activeGroupId = "all";
let filterText = "";
let statusFilter: "all" | "running" | "stopped" = "all";
let isInitialLoading = true;
let stackFilter = localStorage.getItem(STACK_KEY) ?? "";
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null;
let countdownTimer: ReturnType<typeof setInterval> | null = null;
let remaining = 0;
let modalMode: "create" | "edit" = "create";
let editingGroupId: string | null = null;
let selectedColor = GROUP_COLORS[0];
let modalContainerFilter = "";
let sortCol: "name" | "image" | "status" | null = null;
let sortDir: "asc" | "desc" = "asc";
let groupPickerService: string | null = null;
let ctxService: string | null = null;
let ctxBuildPath: string | null = null;
let ctxContainerName: string | null = null;
let ctxServiceInfo: ContainerInfo | null = null;
let loadingContainers = new Set<string>();
let refreshSerial = 0;
let aiRequestSerial = 0;

// ── Settings ──────────────────────────────────────────────────────────────────
const SETTINGS_KEY = "dsm_settings_v1";

interface AppSettings {
  visionPath: string;
  useWsl: boolean;
  wslDistro: string;
  aiProvider: AiProvider;
  aiModel: string;
  aiAzureEndpoint: string;
  aiAzureDeployment: string;
  aiOllamaUrl: string;
  aiIncludeLogs: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  visionPath: "~/vision",
  useWsl: false,
  wslDistro: "Ubuntu",
  aiProvider: "openai",
  aiModel: "",
  aiAzureEndpoint: "",
  aiAzureDeployment: "",
  aiOllamaUrl: "http://localhost:11434/v1",
  aiIncludeLogs: true,
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const merged = {
        ...DEFAULT_SETTINGS,
        ...(JSON.parse(raw) as Partial<AppSettings>),
      };
      if (!AI_PROVIDERS.some((provider) => provider.id === merged.aiProvider)) {
        merged.aiProvider = DEFAULT_SETTINGS.aiProvider;
      }
      if (typeof merged.aiIncludeLogs !== "boolean") {
        merged.aiIncludeLogs = DEFAULT_SETTINGS.aiIncludeLogs;
      }
      return merged;
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS };
}

function persistSettings(s: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

let settings: AppSettings = loadSettings();

/** Re-run Lucide icon replacement after DOM mutations */
function renderLucide(): void {
  createIcons({
    icons: {
      Play,
      Square,
      RotateCcw,
      RefreshCw,
      Plus,
      Pencil,
      Trash2,
      PanelLeft,
      Container,
      Search,
      BookmarkPlus,
      Timer,
      Check,
      X,
      Star,
      Layers,
      ChevronsUpDown,
      ChevronUp,
      ChevronDown,
      Hammer,
      Terminal,
      Settings,
      MoreVertical,
      ScrollText,
      Monitor,
      Server,
      HelpCircle,
      Sparkles,
      Copy,
    },
  });
}

/** Custom confirm modal returning Promise<boolean> */
function showConfirmModal(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const confirmModal = document.getElementById("confirmModal") as HTMLDivElement;
    const titleEl = document.getElementById("confirmModalTitle") as HTMLHeadingElement;
    const msgEl = document.getElementById("confirmModalMessage") as HTMLDivElement;
    const okBtn = document.getElementById("confirmModalOk") as HTMLButtonElement;
    const cancelBtn = document.getElementById("confirmModalCancel") as HTMLButtonElement;
    const closeBtn = document.getElementById("confirmModalClose") as HTMLButtonElement;

    titleEl.textContent = title;
    msgEl.textContent = message;
    confirmModal.classList.remove("hidden");

    const cleanup = () => {
      confirmModal.classList.add("hidden");
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      closeBtn.removeEventListener("click", onCancel);
    };

    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    closeBtn.addEventListener("click", onCancel);
  });
}

/** Sync sort arrows on <th data-sort> headers */
function updateSortHeaders(): void {
  for (const th of document.querySelectorAll<HTMLElement>("th[data-sort]")) {
    const col = th.dataset["sort"] as "name" | "image" | "status";
    const isActive = col === sortCol;
    th.classList.toggle("sort-active", isActive);
    const icon = th.querySelector<HTMLElement>("i[data-lucide]");
    if (icon) {
      icon.setAttribute(
        "data-lucide",
        isActive
          ? sortDir === "asc"
            ? "chevron-up"
            : "chevron-down"
          : "chevrons-up-down",
      );
    }
  }
  renderLucide();
}

/** Populate the stack selector with current stacks from loaded containers */
function renderStackSelector(): void {
  const stacks = getAvailableStacks(containers);
  // preserve selection
  const current = stackSelectorEl.value || stackFilter;
  stackSelectorEl.innerHTML = `<option value="">All stacks (${containers.length})</option>`;
  for (const s of stacks) {
    const count = containers.filter((c) => getStackName(c.name) === s).length;
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = `${s}  (${count})`;
    if (s === current) opt.selected = true;
    stackSelectorEl.appendChild(opt);
  }
  // If previous selection is no longer available, reset
  if (current && !stacks.includes(current)) {
    stackFilter = "";
    localStorage.setItem(STACK_KEY, "");
  }
}

function setStatus(message: string, type = ""): void {
  if (type === "error") {
    statusEl.textContent = "";
    statusEl.className = "";
    showFooterError(message);
    return;
  }
  statusEl.textContent = message;
  const colors: Record<string, string> = {
    ok: "text-[11px] text-green-400 transition-colors duration-300",
    "": "text-[11px] text-dsm-muted transition-colors duration-300",
  };
  statusEl.className = colors[type] ?? colors[""];
  if (type === "ok") {
    clearFooterError();
  }
}

function getSelectedIds(): string[] {
  return [
    ...document.querySelectorAll<HTMLInputElement>(".container-check:checked"),
  ].map((el) => el.value);
}

function updateSelectionButtons(): void {
  const checkboxes = document.querySelectorAll<HTMLInputElement>(".container-check");
  const total = checkboxes.length;
  const count = Array.from(checkboxes).filter(cb => cb.checked).length;
  const hasSelection = count > 0;
  startSelectedBtn.disabled = !hasSelection;
  stopSelectedBtn.disabled = !hasSelection;
  if (restartSelectedBtn) restartSelectedBtn.disabled = !hasSelection;
  const label = document.getElementById("selectedLabel");
  if (label)
    label.textContent = hasSelection ? `${count} selected` : "Selected";
  selectAllEl.indeterminate = count > 0 && count < total;
  selectAllEl.checked = count === total && total > 0;
}

type ServicePhase =
  | "running"
  | "starting"
  | "stopping"
  | "failed"
  | "stalled"
  | "stopped";

interface ServiceStatusInfo {
  phase: ServicePhase;
  runningReplicas: number;
  desiredReplicas: number;
  label: string;
  pillClass: string;
  spinning: boolean;
  detail: string;
  tooltip: string;
}

function parseReplicaStatus(status: string): { running: number; desired: number } | null {
  const match = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(status ?? "");
  if (!match) return null;
  return { running: Number(match[1]), desired: Number(match[2]) };
}

function cleanTaskError(error?: string): string {
  const trimmed = (error ?? "").trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function stateWord(value?: string): string {
  return (value ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
}

function getServiceStatus(c: ContainerInfo): ServiceStatusInfo {
  const replicas = parseReplicaStatus(c.status);
  const runningReplicas = replicas ? replicas.running : c.running ? 1 : 0;
  const desiredReplicas = replicas ? replicas.desired : c.running ? 1 : 0;
  const statusText = c.status?.trim() || `${runningReplicas}/${desiredReplicas}`;
  const taskWord = stateWord(c.taskState);
  const updateWord = stateWord(c.updateState);
  const taskError = cleanTaskError(c.taskError);
  const updateMessage = (c.updateMessage ?? "").trim();
  const failedTask = taskWord === "failed" || taskWord === "rejected";
  const inactiveTask = ["shutdown", "complete", "orphaned", "remove"].includes(taskWord);
  const pausedUpdate = updateWord === "paused" || updateWord === "rollback_paused";

  let phase: ServicePhase;
  if (desiredReplicas === 0) {
    phase = runningReplicas > 0 ? "stopping" : "stopped";
  } else if (runningReplicas >= desiredReplicas) {
    phase = "running";
  } else if (failedTask || pausedUpdate) {
    phase = "failed";
  } else if (inactiveTask) {
    phase = "stalled";
  } else if (taskError) {
    phase = "failed";
  } else {
    phase = "starting";
  }

  let label = "Stopped";
  let pillClass = "pill-down";
  let spinning = false;
  let detail = "";
  let tooltip = statusText;

  if (phase === "running") {
    label = statusText;
    pillClass = "pill-up";
  } else if (phase === "starting") {
    label = `Starting (${statusText})`;
    pillClass = "pill-loading";
    spinning = true;
    detail = c.taskState ? `Task: ${c.taskState}` : "Waiting for a task...";
    tooltip = detail;
  } else if (phase === "stopping") {
    label = `Stopping (${statusText})`;
    pillClass = "pill-loading";
    spinning = true;
    detail = c.taskState ?? "";
    tooltip = detail || `Stopping ${statusText}`;
  } else if (phase === "failed") {
    label = `Failed (${statusText})`;
    pillClass = "pill-down";
    detail = taskError || updateMessage || c.taskState || "Last task failed";
    tooltip = [taskError, updateMessage, c.taskState].filter(Boolean).join("\n");
  } else if (phase === "stalled") {
    label = `Stalled (${statusText})`;
    pillClass = "pill-warning";
    detail = c.taskState ? `No active task · ${c.taskState}` : "No active task";
    tooltip = `${detail}\nClick Redeploy to force a new task.`;
  }

  return {
    phase,
    runningReplicas,
    desiredReplicas,
    label,
    pillClass,
    spinning,
    detail,
    tooltip,
  };
}

function visibleContainers(): ContainerInfo[] {
  let list = containers;
  if (activeGroupId !== "all") {
    const g = groups.find((gr) => gr.id === activeGroupId);
    list = g ? containers.filter((c) => g.ids.includes(shortName(c.name))) : [];
  }
  if (stackFilter) {
    list = list.filter((c) => getStackName(c.name) === stackFilter);
  }
  if (statusFilter === "running") {
    list = list.filter((c) => c.running);
  } else if (statusFilter === "stopped") {
    list = list.filter((c) => !c.running);
  }
  if (filterText) {
    const q = filterText.toLowerCase();
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.image.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
    );
  }

  // ── Sort ──
  if (sortCol) {
    list = [...list].sort((a, b) => {
      let va: string;
      let vb: string;
      if (sortCol === "name") {
        va = shortName(a.name).toLowerCase();
        vb = shortName(b.name).toLowerCase();
      } else if (sortCol === "image") {
        va = a.image.toLowerCase();
        vb = b.image.toLowerCase();
      } else {
        // status: running first when asc
        va = a.running ? "0" : "1";
        vb = b.running ? "0" : "1";
      }
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  return list;
}

function renderSkeletonRows(): void {
  body.innerHTML = Array.from({ length: 6 }).map(() => `
    <tr>
      <td class="!px-2 text-center"><div class="skeleton-box w-4 h-4"></div></td>
      <td class="!px-1 text-center"><div class="skeleton-box w-4 h-4"></div></td>
      <td><div class="flex items-center gap-2"><div class="skeleton-box w-32"></div><div class="skeleton-box w-8"></div></div></td>
      <td><div class="skeleton-box w-16"></div></td>
      <td><div class="skeleton-box w-40"></div></td>
      <td><div class="skeleton-box w-24"></div></td>
      <td class="!pr-2 text-right"><div class="skeleton-box w-12 ml-auto"></div></td>
    </tr>
  `).join("");
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function renderSidebar(): void {
  sidebarList.innerHTML = "";

  const allItem = document.createElement("div");
  const allActive = activeGroupId === "all";
  allItem.className = [
    "flex items-center gap-2 px-3 py-2 cursor-pointer select-none transition-colors rounded-sm mx-1",
    allActive
      ? "bg-dsm-primary/15 text-dsm-text"
      : "text-dsm-muted hover:bg-white/5 hover:text-dsm-text",
  ].join(" ");
  allItem.innerHTML = `
    <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:#7d8590"></span>
    <span class="flex-1 text-[12px] truncate">Todos</span>
    <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-white/8 border border-dsm-border font-mono">${containers.length}</span>
  `;
  allItem.addEventListener("click", () => setActiveGroup("all"));
  sidebarList.appendChild(allItem);

  const predefinedGroups = groups.filter((g) => g.predefined);
  const userGroups = groups.filter((g) => !g.predefined);

  /** Helper to render a group item */
  const renderGroup = (g: ContainerGroup): void => {
    const members = containers.filter((c) => g.ids.includes(shortName(c.name)));
    const upCount = members.filter((c) => c.running).length;
    const isActive = activeGroupId === g.id;

    const item = document.createElement("div");
    item.className = [
      "group/item flex items-center gap-2 px-3 py-2 cursor-pointer select-none transition-colors rounded-sm mx-1",
      isActive
        ? "bg-dsm-primary/15 text-dsm-text"
        : "text-dsm-muted hover:bg-white/5 hover:text-dsm-text",
    ].join(" ");

    const predefinedBadge = g.predefined
      ? `<span class="text-[9px] px-1 py-0 rounded border leading-4 flex-shrink-0" style="color:${g.color};border-color:${g.color}40;background:${g.color}14">auto</span>`
      : "";

    item.innerHTML = `
      <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${g.color}"></span>
      <span class="flex-1 text-[12px] truncate">${escHtml(g.name)}</span>
      ${predefinedBadge}
      <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-white/8 border border-dsm-border font-mono flex-shrink-0">${upCount}/${members.length}</span>
      <span class="hidden group-hover/item:flex items-center gap-0.5 flex-shrink-0">
        <button class="p-0.5 rounded hover:bg-white/10 text-green-400/70 hover:text-green-400 transition-colors" data-act="start" title="Start all"><i data-lucide="play" class="icon-xs"></i></button>
        <button class="p-0.5 rounded hover:bg-white/10 text-red-400/70 hover:text-red-400 transition-colors" data-act="stop"  title="Stop all"><i data-lucide="square" class="icon-xs"></i></button>
        <button class="p-0.5 rounded hover:bg-white/10 hover:text-dsm-text transition-colors" data-act="edit"  title="Edit"><i data-lucide="pencil" class="icon-xs"></i></button>
        <button class="p-0.5 rounded hover:bg-white/10 text-red-400/60 hover:text-red-400 transition-colors" data-act="del" title="Delete"><i data-lucide="trash-2" class="icon-xs"></i></button>
      </span>
    `;

    item.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
        "button[data-act]",
      );
      if (btn) {
        e.stopPropagation();
        const act = btn.dataset["act"];
        if (act === "start") void runAction("start", g.ids);
        else if (act === "stop") void runAction("stop", g.ids);
        else if (act === "edit") openModal("edit", g.id);
        else if (act === "del") deleteGroup(g.id);
        return;
      }
      setActiveGroup(g.id);
    });
    sidebarList.appendChild(item);
  };

  if (predefinedGroups.length) {
    const sep = document.createElement("div");
    sep.className =
      "px-3 pt-2.5 pb-1 text-[10px] uppercase tracking-wider text-dsm-muted/50 font-semibold select-none";
    sep.textContent = "Predefined";
    sidebarList.appendChild(sep);
    for (const g of predefinedGroups) renderGroup(g);
  }

  if (userGroups.length) {
    const sep = document.createElement("div");
    sep.className =
      "px-3 pt-2.5 pb-1 text-[10px] uppercase tracking-wider text-dsm-muted/50 font-semibold select-none border-t border-dsm-border2 mt-1";
    sep.textContent = "My Groups";
    sidebarList.appendChild(sep);
    for (const g of userGroups) renderGroup(g);
  }

  renderLucide();
}

function setActiveGroup(id: string): void {
  activeGroupId = id;
  renderSidebar();
  renderTable();
  updateCount();
}

// ── Table ─────────────────────────────────────────────────────────────────────
function renderTable(): void {
  const selectedIds = getSelectedIds();
  body.innerHTML = "";
  const visible = visibleContainers();

  if (visible.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td colspan="7">
        <div class="flex flex-col items-center justify-center gap-2 py-16 text-dsm-muted">
          <i data-lucide="container" style="width:40px;height:40px;opacity:0.15"></i>
          <span class="text-[12px]">${activeGroupId !== "all" ? "No containers in this group." : "No containers found."}</span>
        </div>
      </td>`;
    body.appendChild(tr);
    renderLucide();
    return;
  }

  for (const c of visible) {
    const myGroups = groups.filter((g) => g.ids.includes(shortName(c.name)));
    const tagHtml = myGroups
      .map(
        (g) =>
          `<span class="group-tag text-[10px] px-1.5 leading-4 rounded border" style="color:${g.color};border-color:${g.color}40;background:${g.color}14">${escHtml(g.name)}</span>`,
      )
      .join("");

    const inAnyGroup = myGroups.length > 0;
    const sName = escHtml(shortName(c.name));
    const fullName = escHtml(c.name);
    const rawFullName = c.name;
    const displayTooltip = rawFullName !== shortName(rawFullName)
      ? escHtml(`${shortName(rawFullName)}\n${rawFullName}`)
      : escHtml(rawFullName);
    const svcKey = escHtml(shortName(c.name));
    const badge = containerBadge(c.name);

    const isManualLoading = loadingContainers.has(c.name);
    const statusInfo = getServiceStatus(c);
    const isTransitioning =
      statusInfo.phase === "starting" || statusInfo.phase === "stopping";
    const showWorking = isManualLoading && !isTransitioning;
    const pillClass = showWorking ? "pill-loading" : statusInfo.pillClass;
    const pillLabel = showWorking ? "Working..." : statusInfo.label;
    const showSpinner = showWorking || statusInfo.spinning;
    const showDetail = !showWorking && statusInfo.detail;
    const detailTone =
      statusInfo.phase === "failed"
        ? "text-red-400/80"
        : statusInfo.phase === "stalled"
          ? "text-yellow-400/70"
          : "text-dsm-muted/60";
    const detailHtml = showDetail
      ? `<span class="block max-w-[110px] truncate text-[9px] leading-tight ${detailTone}" title="${escHtml(statusInfo.tooltip || statusInfo.detail)}">${escHtml(statusInfo.detail)}</span>`
      : "";

    const uptimeHtml =
      statusInfo.phase === "running" && c.uptime && !isManualLoading
        ? `<span class="text-[9px] font-mono text-dsm-muted/60 leading-none pl-0.5 mt-0.5">${escHtml(c.uptime)}</span>`
        : "";

    const isRunning = statusInfo.phase === "running";
    const desiredUp = statusInfo.desiredReplicas > 0;
    const startAction = isRunning ? "restart" : "start";
    const startIcon = isRunning || desiredUp ? "rotate-ccw" : "play";
    const startTitle = isRunning
      ? "Restart"
      : desiredUp
        ? "Redeploy (force new task)"
        : "Start";
    const startButtonClass = isRunning
      ? "text-yellow-400/80 hover:text-yellow-400 hover:bg-yellow-400/10 border border-yellow-400/20"
      : desiredUp
        ? "text-orange-300/90 hover:text-orange-200 hover:bg-orange-400/10 border border-orange-400/25"
        : "text-green-400/80 hover:text-green-400 hover:bg-green-400/10 border border-green-400/20";

    const tr = document.createElement("tr");
    tr.dataset["svc"] = shortName(c.name);
    tr.dataset["running"] = String(c.running);
    tr.dataset["fullname"] = c.name;
    tr.innerHTML = `
      <td class="!px-2 text-center">
        <input type="checkbox" class="container-check accent-dsm-primary" value="${fullName}" ${selectedIds.includes(fullName) ? "checked" : ""} />
      </td>
      <td class="!px-1 text-center">
        <button
          class="p-0.5 rounded transition-colors ${inAnyGroup ? "text-yellow-400" : "text-dsm-muted/30 hover:text-yellow-400/70"}"
          data-cid="${svcKey}"
          title="Manage groups">
          <i data-lucide="star" class="icon-xs"></i>
        </button>
      </td>
      <td>
        <div class="flex items-center gap-1 min-w-0">
          <span class="truncate font-mono text-[11px] text-dsm-text" title="${displayTooltip}">${sName}</span>
          ${badge}
          ${tagHtml ? `<div class="flex gap-0.5 flex-wrap">${tagHtml}</div>` : ""}
        </div>
      </td>
      <td class="font-mono text-[10px] text-dsm-muted truncate">${escHtml(c.id)}</td>
      <td class="font-mono text-[10px] text-dsm-muted truncate" title="${escHtml(c.image)}">${escHtml(c.image)}</td>
      <td>
        <div class="flex flex-col items-start gap-0.5">
          <span class="${pillClass}" title="${escHtml(statusInfo.tooltip)}">${showSpinner ? '<span class="pill-spinner"></span>' : '<span class="pill-dot"></span>'} ${escHtml(pillLabel)}</span>
          ${detailHtml}
          ${uptimeHtml}
        </div>
      </td>
      <td class="!pr-2">
        <div class="flex items-center gap-1 justify-end">
          <button
            class="flex items-center justify-center w-6 h-6 rounded transition-colors ${startButtonClass}"
            data-id="${fullName}"
            data-action="${startAction}"
            title="${startTitle}">
            <i data-lucide="${startIcon}" class="icon-xs"></i>
          </button>
          ${
            desiredUp || c.running
              ? `<button class="flex items-center justify-center w-6 h-6 rounded border border-red-400/20 text-red-400/70 hover:text-red-400 hover:bg-red-400/10 transition-colors" data-id="${fullName}" data-action="stop" title="Stop"><i data-lucide="square" class="icon-xs"></i></button>`
              : `<span class="w-6 h-6 flex-shrink-0 inline-block"></span>`
          }
        </div>
      </td>
    `;
    body.appendChild(tr);
  }

  for (const btn of body.querySelectorAll<HTMLButtonElement>(
    "button[data-action]",
  )) {
    btn.addEventListener("click", () => {
      const { id, action } = btn.dataset as { id: string; action: Action };
      void runAction(action, [id]);
    });
  }

  // Star button → group picker
  for (const btn of body.querySelectorAll<HTMLButtonElement>("[data-cid]")) {
    btn.addEventListener("click", (e) =>
      openGroupPicker(btn.dataset["cid"]!, e),
    );
  }

  // Right-click → context menu
  for (const tr of body.querySelectorAll<HTMLTableRowElement>("tr[data-svc]")) {
    tr.addEventListener("contextmenu", async (e) => {
      e.preventDefault();
      const svc = tr.dataset["svc"]!;
      const fullName = tr.dataset["fullname"]!;
      const container = containers.find((item) => item.name === fullName);
      if (!container) return;
      const buildPath = api
        ? await api.findBuildScript(svc, settings.visionPath)
        : null;
      openCtxMenu(svc, container, buildPath, e.clientX, e.clientY);
    });
  }

  renderLucide();
  updateSelectionButtons();
}

// ── Group picker ────────────────────────────────────────────────────────────────────
function openGroupPicker(serviceName: string, evt: MouseEvent): void {
  evt.stopPropagation();
  groupPickerService = serviceName;
  // Position near clicked element
  const btn = evt.currentTarget as HTMLElement;
  const rect = btn.getBoundingClientRect();
  groupPickerEl.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - 280)}px`;
  groupPickerEl.style.left = `${Math.min(rect.left, window.innerWidth - 200)}px`;
  // Build group list
  groupPickerListEl.innerHTML = "";
  if (!groups.length) {
    groupPickerListEl.innerHTML = `<div class="px-3 py-2 text-dsm-muted italic text-[11px]">No groups created</div>`;
  } else {
    for (const g of groups) {
      const inGroup = g.ids.includes(serviceName);
      const row = document.createElement("button");
      row.className =
        "flex items-center gap-2.5 w-full px-3 py-1.5 text-left hover:bg-white/5 transition-colors text-dsm-muted hover:text-dsm-text";
      row.innerHTML = `
        <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${g.color}"></span>
        <span class="flex-1 truncate">${escHtml(g.name)}</span>
        ${inGroup ? `<svg data-lucide="check" class="icon-xs text-dsm-primary flex-shrink-0"></svg>` : `<span class="w-3 h-3"></span>`}
      `;
      row.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = g.ids.indexOf(serviceName);
        if (idx >= 0) g.ids.splice(idx, 1);
        else g.ids.push(serviceName);
        saveGroups(groups);
        // re-render the list in place
        openGroupPicker(serviceName, {
          currentTarget: btn,
          stopPropagation: () => {},
        } as unknown as MouseEvent);
        renderSidebar();
        renderTable();
      });
      groupPickerListEl.appendChild(row);
    }
  }
  groupPickerEl.classList.remove("hidden");
  renderLucide();
}

function closeGroupPicker(): void {
  groupPickerEl.classList.add("hidden");
  groupPickerService = null;
}

// Bind "New group" button in picker
(
  document.getElementById("groupPickerNew") as HTMLButtonElement
).addEventListener("click", (e) => {
  e.stopPropagation();
  const preIds = groupPickerService ? [groupPickerService] : [];
  closeGroupPicker();
  openModal("create", undefined, preIds);
});

// ── Context menu ──────────────────────────────────────────────────────────────────
function openCtxMenu(
  svcName: string,
  container: ContainerInfo,
  buildPath: string | null,
  x: number,
  y: number,
): void {
  ctxService = svcName;
  ctxContainerName = container.name;
  ctxServiceInfo = container;
  ctxBuildPath = buildPath;
  const status = getServiceStatus(container);
  const hasError = status.phase === "failed" || status.phase === "stalled";

  // Label start vs restart
  ctxStartLabel.textContent =
    status.phase === "running"
      ? "Restart"
      : hasError
        ? "Redeploy"
        : "Start";
  // Toggle build option
  if (buildPath) {
    ctxBuildBtn.classList.remove("hidden");
    ctxBuildDivider.classList.remove("hidden");
  } else {
    ctxBuildBtn.classList.add("hidden");
    ctxBuildDivider.classList.add("hidden");
  }
  ctxAiBtn.disabled = !hasError;
  ctxAiBtn.title = hasError
    ? "Analyze the last task error with AI"
    : "Service has no detected error";

  ctxMenuEl.classList.remove("hidden");
  renderLucide();
  const menuW = ctxMenuEl.offsetWidth;
  const menuH = ctxMenuEl.offsetHeight;
  const left = Math.max(8, Math.min(x, window.innerWidth - menuW - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - menuH - 8));
  ctxMenuEl.style.left = `${left}px`;
  ctxMenuEl.style.top = `${top}px`;
}

function closeCtxMenu(): void {
  ctxMenuEl.classList.add("hidden");
  ctxService = null;
  ctxBuildPath = null;
  ctxContainerName = null;
  ctxServiceInfo = null;
}

ctxStartBtn.addEventListener("click", () => {
  if (ctxService) void runAction("start", [ctxService]);
  closeCtxMenu();
});
ctxStopBtn.addEventListener("click", () => {
  if (ctxService) void runAction("stop", [ctxService]);
  closeCtxMenu();
});
ctxBuildBtn.addEventListener("click", () => {
  if (ctxBuildPath && api) {
    setStatus(`Force build: ${ctxService ?? ""}...`);
    void api.buildService(ctxBuildPath).then((r) => {
      if (r.ok) setStatus(`Build started for ${ctxService ?? ""}`, "ok");
      else setStatus(`Error starting build: ${r.error ?? ""}`, "error");
    });
  }
  closeCtxMenu();
});

ctxLogsBtn.addEventListener("click", () => {
  if (ctxContainerName && api) {
    void api.openServiceLogs(ctxContainerName).then((r) => {
      if (!r.ok) showToast(`Error opening logs: ${r.error ?? ""}`, "error");
    });
  }
  closeCtxMenu();
});

ctxChmodBtn.addEventListener("click", () => {
  if (ctxBuildPath && api) {
    const dir = ctxBuildPath.replace(/\/[^/]+$/, "");
    void api.fixShPermissions(dir).then((r) => {
      if (r.ok)
        showToast(`Permissions fixed (chmod +x *.sh) in ${dir}`, "success");
      else showToast(`Error fixing permissions: ${r.error ?? ""}`, "error");
    });
  } else {
    showToast("No build script found for this service.", "error");
  }
  closeCtxMenu();
});

ctxAiBtn.addEventListener("click", () => {
  const container = ctxServiceInfo;
  closeCtxMenu();
  if (container) void analyzeServiceErrorWithAi(container);
});

function closeAiModal(): void {
  aiRequestSerial += 1;
  aiModalEl.classList.add("hidden");
}

async function analyzeServiceErrorWithAi(
  container: ContainerInfo,
): Promise<void> {
  if (!api) return;
  const providerInfo = getAiProviderInfo(settings.aiProvider);
  const serviceLabel = shortName(container.name);

  const keyStatus = await api.getAiKeyStatus(providerInfo.id);
  if (providerInfo.requiresKey && !keyStatus.hasKey) {
    showToast(
      `Configure the ${providerInfo.label} API key in Settings → AI Error Analysis.`,
      "error",
    );
    openSettingsModal();
    return;
  }
  if (
    providerInfo.requiresEndpoint &&
    !settings.aiAzureEndpoint.trim()
  ) {
    showToast("Configure the Azure OpenAI endpoint in Settings.", "error");
    openSettingsModal();
    return;
  }
  if (
    providerInfo.requiresDeployment &&
    !settings.aiAzureDeployment.trim()
  ) {
    showToast("Configure the Azure OpenAI deployment in Settings.", "error");
    openSettingsModal();
    return;
  }

  aiModalTitleEl.textContent = `AI Error Analysis · ${serviceLabel}`;
  aiModalMetaEl.textContent = `Analyzing with ${providerInfo.label}...`;
  aiModalResultEl.textContent =
    "Consultando o provedor de IA. Isso pode levar alguns segundos...";
  aiModalCopyBtn.disabled = true;
  aiModalEl.classList.remove("hidden");
  renderLucide();
  const serial = ++aiRequestSerial;

  const request: AiAnalyzeRequest = {
    provider: settings.aiProvider,
    model: settings.aiModel,
    azureEndpoint: settings.aiAzureEndpoint,
    azureDeployment: settings.aiAzureDeployment,
    ollamaUrl: settings.aiOllamaUrl,
    includeLogs: settings.aiIncludeLogs,
    serviceName: serviceLabel,
    image: container.image,
    status: container.status,
    taskState: container.taskState,
    taskError: container.taskError,
    updateState: container.updateState,
    updateMessage: container.updateMessage,
  };

  const result: AiAnalyzeResult = await api.analyzeServiceError(request);
  if (serial !== aiRequestSerial) return;
  if (!result.ok) {
    aiModalMetaEl.textContent = `${providerInfo.label} · error`;
    aiModalResultEl.textContent = result.error ?? "Unknown error";
    return;
  }

  aiModalMetaEl.textContent = [
    providerInfo.label,
    result.model,
    result.includesLogs ? "includes recent logs" : "no logs sent",
  ]
    .filter(Boolean)
    .join(" · ");
  aiModalResultEl.textContent = result.analysis ?? "";
  aiModalCopyBtn.disabled = false;
}

aiModalCloseBtn.addEventListener("click", closeAiModal);
aiModalCloseFooterBtn.addEventListener("click", closeAiModal);
aiModalEl.addEventListener("click", (e) => {
  if (e.target === aiModalEl) closeAiModal();
});
aiModalCopyBtn.addEventListener("click", async () => {
  const text = aiModalResultEl.textContent ?? "";
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast("Analysis copied.", "success");
  } catch {
    showToast("Could not copy the analysis.", "error");
  }
});

ctxTerminalBtn.addEventListener("click", () => {
  if (ctxService && api) {
    void api
      .findServiceDirectory(ctxService, settings.visionPath)
      .then((dir) => {
        if (dir && api.openTerminal) {
          void api
            .openTerminal(dir, {
              useWsl: settings.useWsl,
              wslDistro: settings.wslDistro,
            })
            .then((r) => {
              if (r.ok) {
                showToast(
                  `Terminal opened for ${shortName(ctxService ?? "")}`,
                  "success",
                );
              } else {
                showToast(`Error opening terminal: ${r.error ?? ""}`, "error");
              }
            });
        } else {
          showToast(
            `Directory not found for ${shortName(ctxService ?? "")}`,
            "error",
          );
        }
      });
  }
  closeCtxMenu();
});

openVisionTerminalBtn.addEventListener("click", () => {
  if (api && api.openTerminal) {
    void api
      .openTerminal(settings.visionPath, {
        useWsl: settings.useWsl,
        wslDistro: settings.wslDistro,
      })
      .then((r) => {
        if (r.ok) {
          showToast(`Terminal opened in ${settings.visionPath}`, "success");
        } else {
          showToast(`Error opening terminal: ${r.error ?? ""}`, "error");
        }
      });
  }
});

acrLoginBtn.addEventListener("click", () => {
  if (api) {
    showToast("Running az acr login...", "success");
    void api.acrLogin().then((r) => {
      if (r.ok) showToast("ACR login successful!", "success");
      else showToast(`ACR login failed: ${r.error ?? ""}`, "error");
    });
  }
});

// Close overlays on outside click
document.addEventListener("click", (e) => {
  if (!groupPickerEl.contains(e.target as Node)) closeGroupPicker();
  if (!ctxMenuEl.contains(e.target as Node)) closeCtxMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeGroupPicker();
    closeCtxMenu();
    closeSettingsModal();
    closeAiModal();
  }
});

// ── Settings modal ─────────────────────────────────────────────────────────────
async function checkSettingsPath(testPath: string): Promise<void> {
  if (!testPath || !api) return;
  const result = await api.checkVisionPath(testPath);
  settingsPathStatusEl.classList.remove("hidden");
  if (result.exists) {
    settingsPathStatusEl.className =
      "text-[11px] px-2.5 py-1.5 rounded-lg bg-green-500/10 border border-green-500/25 text-green-400";
    settingsPathStatusEl.textContent = `✓ Path found: ${result.resolved}`;
  } else {
    settingsPathStatusEl.className =
      "text-[11px] px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400";
    settingsPathStatusEl.textContent = `✗ Path not found: ${result.resolved}`;
  }
}

function populateAiProviderOptions(): void {
  if (settingsAiProviderEl.options.length > 0) return;
  for (const provider of AI_PROVIDERS) {
    const option = document.createElement("option");
    option.value = provider.id;
    option.textContent = provider.label;
    settingsAiProviderEl.appendChild(option);
  }
}

function currentAiProvider(): ReturnType<typeof getAiProviderInfo> {
  return getAiProviderInfo(settingsAiProviderEl.value);
}

async function refreshAiKeyStatus(): Promise<void> {
  const info = currentAiProvider();
  settingsAiKeyStatusEl.className = "text-[11px] text-dsm-muted/60";
  settingsAiKeyStatusEl.textContent = "";
  settingsAiClearKeyBtn.classList.add("hidden");
  if (!api) return;

  const providerId = info.id;
  const status = await api.getAiKeyStatus(providerId);
  if (settingsAiProviderEl.value !== providerId) return;

  if (status.hasKey) {
    settingsAiKeyStatusEl.className = "text-[11px] text-green-400";
    settingsAiKeyStatusEl.textContent = status.encrypted
      ? "API key saved (encrypted by the OS)."
      : "API key saved (not encrypted — OS keychain unavailable).";
    settingsAiClearKeyBtn.classList.remove("hidden");
  } else if (info.requiresKey) {
    settingsAiKeyStatusEl.className = "text-[11px] text-yellow-400";
    settingsAiKeyStatusEl.textContent = "No API key saved for this provider.";
  } else {
    settingsAiKeyStatusEl.textContent = "No API key required for this provider.";
  }
}

function syncAiProviderRows(): void {
  const info = currentAiProvider();
  settingsAiModelEl.placeholder =
    info.defaultModel || (info.id === "azure" ? "Deployment name" : "Provider default");
  settingsAiModelHintEl.textContent = info.defaultModel
    ? `Leave the model empty to use ${info.defaultModel}.`
    : info.id === "azure"
      ? "Azure uses the deployment name as the model."
      : "";
  settingsAiAzureRowsEl.classList.toggle("hidden", info.id !== "azure");
  settingsAiOllamaRowEl.classList.toggle("hidden", info.id !== "ollama");
  settingsAiKeyEl.placeholder = info.requiresKey
    ? "Paste API key"
    : "Optional for local providers";
  void refreshAiKeyStatus();
}

function openSettingsModal(): void {
  settingsVisionPathEl.value = settings.visionPath;
  settingsUseWslEl.checked = settings.useWsl;
  settingsWslDistroEl.value = settings.wslDistro;
  settingsWslDistroRowEl.classList.toggle("hidden", !settings.useWsl);
  settingsPathStatusEl.classList.add("hidden");

  populateAiProviderOptions();
  settingsAiProviderEl.value = settings.aiProvider;
  settingsAiModelEl.value = settings.aiModel;
  settingsAiAzureEndpointEl.value = settings.aiAzureEndpoint;
  settingsAiAzureDeploymentEl.value = settings.aiAzureDeployment;
  settingsAiOllamaUrlEl.value = settings.aiOllamaUrl;
  settingsAiIncludeLogsEl.checked = settings.aiIncludeLogs;
  settingsAiKeyEl.value = "";
  syncAiProviderRows();

  settingsModalEl.classList.remove("hidden");
  renderLucide();
  settingsVisionPathEl.focus();
  void checkSettingsPath(settings.visionPath);
}

function closeSettingsModal(): void {
  settingsModalEl.classList.add("hidden");
}

(document.getElementById("openSettings") as HTMLButtonElement).addEventListener(
  "click",
  openSettingsModal,
);

settingsModalEl.addEventListener("click", (e) => {
  if (e.target === settingsModalEl) closeSettingsModal();
});

settingsUseWslEl.addEventListener("change", () => {
  settingsWslDistroRowEl.classList.toggle("hidden", !settingsUseWslEl.checked);
});

settingsAiProviderEl.addEventListener("change", () => {
  settingsAiKeyEl.value = "";
  syncAiProviderRows();
});

settingsAiClearKeyBtn.addEventListener("click", async () => {
  if (!api) return;
  const info = currentAiProvider();
  const confirmed = await showConfirmModal(
    "Remove API Key",
    `Remove the saved API key for ${info.label}?`,
  );
  if (!confirmed) return;
  const result = await api.clearAiApiKey(info.id);
  if (!result.ok) {
    showToast(`Error removing API key: ${result.error ?? "unknown error"}`, "error");
    return;
  }
  showToast("API key removed.", "success");
  await refreshAiKeyStatus();
});

(
  document.getElementById("settingsClose") as HTMLButtonElement
).addEventListener("click", closeSettingsModal);
(
  document.getElementById("settingsCancel") as HTMLButtonElement
).addEventListener("click", closeSettingsModal);

(document.getElementById("settingsSave") as HTMLButtonElement).addEventListener(
  "click",
  async () => {
    settings = {
      visionPath:
        settingsVisionPathEl.value.trim() || DEFAULT_SETTINGS.visionPath,
      useWsl: settingsUseWslEl.checked,
      wslDistro: settingsWslDistroEl.value.trim() || DEFAULT_SETTINGS.wslDistro,
      aiProvider:
        (settingsAiProviderEl.value as AiProvider) ||
        DEFAULT_SETTINGS.aiProvider,
      aiModel: settingsAiModelEl.value.trim(),
      aiAzureEndpoint: settingsAiAzureEndpointEl.value.trim(),
      aiAzureDeployment: settingsAiAzureDeploymentEl.value.trim(),
      aiOllamaUrl:
        settingsAiOllamaUrlEl.value.trim() || DEFAULT_SETTINGS.aiOllamaUrl,
      aiIncludeLogs: settingsAiIncludeLogsEl.checked,
    };
    persistSettings(settings);

    const newKey = settingsAiKeyEl.value.trim();
    if (newKey && api) {
      const result = await api.saveAiApiKey(settings.aiProvider, newKey);
      if (!result.ok) {
        showToast(
          `Error saving API key: ${result.error ?? "unknown error"}`,
          "error",
        );
        return;
      }
      settingsAiKeyEl.value = "";
    }
    await refreshAiKeyStatus();
    closeSettingsModal();
    showToast("Settings saved.", "success");
  },
);

(
  document.getElementById("settingsTestPath") as HTMLButtonElement
).addEventListener("click", () => {
  void checkSettingsPath(settingsVisionPathEl.value.trim());
});

// ── Count ─────────────────────────────────────────────────────────────────────
function updateCount(): void {
  const visible = visibleContainers();
  const running = visible.filter((c) => c.running).length;
  const gName = groups.find((g) => g.id === activeGroupId)?.name ?? "";
  const prefix = activeGroupId !== "all" ? `${gName} · ` : "";
  countEl.textContent = `${prefix}${running} up / ${visible.length}`;
}

// ── Auto-refresh ──────────────────────────────────────────────────────────────
function stopAutoRefresh(): void {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  countdownEl.textContent = "";
}

function startAutoRefresh(seconds: number): void {
  stopAutoRefresh();
  if (seconds <= 0) return;
  remaining = seconds;
  countdownEl.textContent = `${remaining}s`;
  countdownTimer = setInterval(() => {
    remaining -= 1;
    countdownEl.textContent = remaining > 0 ? `${remaining}s` : "...";
  }, 1000);
  autoRefreshTimer = setInterval(() => {
    remaining = parseInt(intervalSel.value, 10);
    void refreshContainers();
  }, seconds * 1000);
}

/** Reset the countdown to full interval whenever a manual refresh triggers */
function resetCountdown(): void {
  const seconds = parseInt(intervalSel.value, 10);
  if (seconds > 0 && countdownTimer) {
    remaining = seconds;
    countdownEl.textContent = `${seconds}s`;
  }
}

// ── Data loading ──────────────────────────────────────────────────────────────
async function refreshContainers(): Promise<void> {
  const serial = ++refreshSerial;
  resetCountdown();
  setStatus("Loading...");
  if (isInitialLoading) {
    renderSkeletonRows();
  }
  if (!api) {
    setStatus("Electron API unavailable (preload).", "error");
    return;
  }
  const result = await api.listContainers();
  // Discard stale responses — a newer refresh was already triggered
  if (serial !== refreshSerial) return;
  if (!result.ok) {
    setStatus(`Error: ${result.error ?? "unknown error"}`, "error");
    return;
  }
  containers = result.containers ?? [];
  isInitialLoading = false;
  groups = seedPredefinedGroups(containers, groups);
  renderStackSelector();
  renderTable();
  renderSidebar();
  updateCount();
  const visible = visibleContainers();
  const running = visible.filter((c) => c.running).length;
  const suffix = stackFilter ? ` · stack: ${stackFilter}` : "";
  setStatus(`${running} running · ${visible.length} total${suffix}`, "ok");
}

async function runAction(action: Action, ids: string[]): Promise<void> {
  if (!ids.length) {
    setStatus("No container selected.", "error");
    showToast("No container selected.", "error");
    return;
  }
  // Map service IDs back to names so the row spinners light up for bulk actions too
  const names = ids.map(
    (id) => containers.find((c) => c.id === id || c.name === id)?.name ?? id,
  );
  names.forEach((name) => loadingContainers.add(name));
  renderTable();
  setStatus(`Running ${action} on ${ids.length} container(s)...`);
  if (!api) {
    setStatus("Electron API unavailable (preload).", "error");
    showToast("Electron API unavailable (preload).", "error");
    names.forEach((name) => loadingContainers.delete(name));
    renderTable();
    return;
  }

  // A restart is a force-redeploy in Swarm: scale to 1 and create a new task.
  // Using a single update avoids the race between scale-down and scale-up.
  const apiAction: Action = action === "restart" ? "start" : action;
  const result = await api.controlContainers(apiAction, ids);
  if (!result.ok) {
    const msg = `Error running ${action}: ${result.error ?? "unknown error"}`;
    setStatus(msg, "error");
    showToast(msg, "error");
    names.forEach((name) => loadingContainers.delete(name));
    renderTable();
    return;
  }
  const verb = action === "restart" ? "Restart" : action.charAt(0).toUpperCase() + action.slice(1);
  const okMsg = `${verb} completed on ${result.changed ?? 0} container(s).`;
  if (result.warning) {
    setStatus(result.warning, "error");
    showToast(result.warning, "error");
  } else {
    setStatus(okMsg, "ok");
    showToast(okMsg, "success");
  }
  names.forEach((name) => loadingContainers.delete(name));
  await refreshContainers();
}

// ── Group CRUD ────────────────────────────────────────────────────────────────
function deleteGroup(id: string): void {
  groups = groups.filter((g) => g.id !== id);
  saveGroups(groups);
  if (activeGroupId === id) setActiveGroup("all");
  else {
    renderSidebar();
    renderTable();
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function buildColorPicker(current: string): void {
  colorPickerEl.innerHTML = "";
  for (const color of GROUP_COLORS) {
    const sw = document.createElement("span");
    sw.className = `color-swatch${color === current ? " selected" : ""}`;
    sw.style.background = color;
    sw.title = color;
    sw.addEventListener("click", () => {
      selectedColor = color;
      buildColorPicker(color);
    });
    colorPickerEl.appendChild(sw);
  }
}

function buildContainerChecklist(preselected: string[], filter = ""): void {
  groupContList.innerHTML = "";
  const q = filter.toLowerCase();
  const filtered = containers.filter(
    (c) =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      shortName(c.name).toLowerCase().includes(q),
  );

  if (!containers.length) {
    groupContList.innerHTML = `<div class="px-4 py-3 text-[11px] text-dsm-muted italic">No containers available</div>`;
    return;
  }
  if (!filtered.length) {
    groupContList.innerHTML = `<div class="px-4 py-3 text-[11px] text-dsm-muted italic">No results for "${escHtml(filter)}"</div>`;
    return;
  }

  for (const c of filtered) {
    const sn = shortName(c.name);
    const label = document.createElement("label");
    label.className =
      "flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors";
    label.innerHTML = `
      <input type="checkbox" value="${escHtml(shortName(c.name))}"${preselected.includes(shortName(c.name)) ? " checked" : ""} class="accent-dsm-primary flex-shrink-0 cursor-pointer" />
      <span class="flex-1 font-mono text-[11px] text-dsm-text truncate" title="${escHtml(c.name)}">${escHtml(sn)}${containerBadge(c.name)}</span>
      <span class="text-[10px] flex-shrink-0 ${c.running ? "text-green-400" : "text-dsm-muted/50"}">${c.running ? "● running" : "● stopped"}</span>
    `;
    groupContList.appendChild(label);
  }
}

function openModal(
  mode: "create" | "edit",
  groupId?: string,
  preIds?: string[],
): void {
  modalMode = mode;
  editingGroupId = groupId ?? null;
  modalContainerFilter = "";
  if (modalSearchEl) modalSearchEl.value = "";

  const predefinedNoteEl = document.getElementById("modalPredefinedNote");
  if (mode === "create") {
    modalTitle.textContent = "New Group";
    groupNameInput.value = "";
    selectedColor = GROUP_COLORS[groups.length % GROUP_COLORS.length];
    modalDeleteBtn.classList.add("hidden");
    if (predefinedNoteEl) predefinedNoteEl.classList.add("hidden");
    buildColorPicker(selectedColor);
    buildContainerChecklist(preIds ?? []);
  } else {
    const g = groups.find((gr) => gr.id === groupId)!;
    modalTitle.textContent = "Edit Group";
    groupNameInput.value = g.name;
    selectedColor = g.color;
    modalDeleteBtn.classList.remove("hidden");
    if (predefinedNoteEl) {
      if (g.predefined) {
        predefinedNoteEl.classList.remove("hidden");
      } else {
        predefinedNoteEl.classList.add("hidden");
      }
    }
    buildColorPicker(g.color);
    buildContainerChecklist(g.ids);
  }
  groupModal.classList.remove("hidden");
  groupNameInput.focus();
  renderLucide();
}

function closeModal(): void {
  groupModal.classList.add("hidden");
}

function saveModal(): void {
  const name = groupNameInput.value.trim();
  if (!name) {
    groupNameInput.focus();
    return;
  }
  const checkedIds = [
    ...groupContList.querySelectorAll<HTMLInputElement>("input:checked"),
  ].map((el) => el.value);
  if (modalMode === "create") {
    const g: ContainerGroup = {
      id: newId(),
      name,
      color: selectedColor,
      ids: checkedIds,
    };
    groups.push(g);
    activeGroupId = g.id;
  } else {
    const g = groups.find((gr) => gr.id === editingGroupId)!;
    g.name = name;
    g.color = selectedColor;
    g.ids = checkedIds;
  }
  saveGroups(groups);
  closeModal();
  renderSidebar();
  renderTable();
  updateCount();
}

// ── Modal events ──────────────────────────────────────────────────────────────
modalSaveBtn.addEventListener("click", saveModal);
modalCancelBtn.addEventListener("click", closeModal);
modalCloseBtn.addEventListener("click", closeModal);
modalDeleteBtn.addEventListener("click", () => {
  if (editingGroupId) {
    deleteGroup(editingGroupId);
    closeModal();
  }
});
groupModal.addEventListener("click", (e) => {
  if (e.target === groupModal) closeModal();
});
groupNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveModal();
  if (e.key === "Escape") closeModal();
});

if (modalSearchEl) {
  modalSearchEl.addEventListener("input", () => {
    modalContainerFilter = modalSearchEl.value.trim();
    // Preserve already-checked state across filter changes
    const preIds = [
      ...groupContList.querySelectorAll<HTMLInputElement>("input:checked"),
    ].map((el) => el.value);
    buildContainerChecklist(preIds, modalContainerFilter);
  });
}

// ── Toolbar bindings ──────────────────────────────────────────────────────────
// ── Toolbar bindings ──────────────────────────────────────────────────────────
(document.getElementById("refresh") as HTMLButtonElement).addEventListener(
  "click",
  () => void refreshContainers(),
);
(document.getElementById("startAll") as HTMLButtonElement).addEventListener(
  "click",
  async () => {
    const targets = visibleContainers().filter(
      (c) => getServiceStatus(c).phase !== "running",
    );
    if (!targets.length) {
      showToast("All visible services are already running.", "success");
      setStatus("All visible services are already running.", "ok");
      return;
    }
    const confirmed = await showConfirmModal(
      "Start All Services",
      `Are you sure you want to START/REDEPLOY ${targets.length} visible service(s)?`,
    );
    if (confirmed) {
      void runAction(
        "start",
        targets.map((c) => c.id),
      );
    }
  }
);
(document.getElementById("stopAll") as HTMLButtonElement).addEventListener(
  "click",
  async () => {
    const confirmed = await showConfirmModal(
      "Stop All Services",
      "Are you sure you want to STOP ALL visible services?",
    );
    if (confirmed) {
      void runAction(
        "stop",
        visibleContainers().map((c) => c.id),
      );
    }
  }
);
(
  document.getElementById("startSelected") as HTMLButtonElement
).addEventListener("click", () => void runAction("start", getSelectedIds()));
(document.getElementById("stopSelected") as HTMLButtonElement).addEventListener(
  "click",
  () => void runAction("stop", getSelectedIds()),
);
if (restartSelectedBtn) {
  restartSelectedBtn.addEventListener(
    "click",
    () => void runAction("restart", getSelectedIds()),
  );
}
(document.getElementById("saveGroupBtn") as HTMLButtonElement).addEventListener(
  "click",
  // normalize full container names to short service names for group membership
  () =>
    openModal(
      "create",
      undefined,
      getSelectedIds().map((n) => shortName(n)),
    ),
);
(document.getElementById("newGroupBtn") as HTMLButtonElement).addEventListener(
  "click",
  () => openModal("create"),
);
(
  document.getElementById("sidebarToggle") as HTMLButtonElement
).addEventListener("click", () => {
  const isCollapsed = sidebarEl.style.width === "0px";
  sidebarEl.style.width = isCollapsed ? "" : "0px";
  sidebarEl.style.overflow = isCollapsed ? "" : "hidden";
});

selectAllEl.addEventListener("change", (e) => {
  const checked = (e.target as HTMLInputElement).checked;
  for (const cb of document.querySelectorAll<HTMLInputElement>(
    ".container-check",
  )) {
    cb.checked = checked;
  }
  updateSelectionButtons();
});

body.addEventListener("change", (e) => {
  if ((e.target as HTMLElement).classList.contains("container-check")) {
    updateSelectionButtons();
  }
});

filterInput.addEventListener("input", () => {
  filterText = filterInput.value.trim();
  if (filterClearBtn) {
    filterClearBtn.classList.toggle("hidden", filterText === "");
  }
  renderTable();
  updateCount();
});

if (filterClearBtn) {
  filterClearBtn.addEventListener("click", () => {
    filterInput.value = "";
    filterText = "";
    filterClearBtn.classList.add("hidden");
    renderTable();
    updateCount();
  });
}

if (statusFilterSelectorEl) {
  statusFilterSelectorEl.addEventListener("change", () => {
    statusFilter = statusFilterSelectorEl.value as "all" | "running" | "stopped";
    renderTable();
    updateCount();
  });
}

// Global Keyboard Shortcuts
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
    e.preventDefault();
    if (activeTab === "services") {
      filterInput.focus();
      filterInput.select();
    } else {
      cFilterInput.focus();
      cFilterInput.select();
    }
  } else if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
    e.preventDefault();
    if (activeTab === "services") {
      filterInput.focus();
      filterInput.select();
    } else {
      cFilterInput.focus();
      cFilterInput.select();
    }
  } else if (e.key === "F5" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r")) {
    e.preventDefault();
    void refreshContainers();
    if (activeTab === "containers") void refreshRawContainers();
  }
});

// Background Idle Pause
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopAutoRefresh();
  } else {
    startAutoRefresh(parseInt(intervalSel.value, 10));
  }
});

intervalSel.addEventListener("change", () => {
  startAutoRefresh(parseInt(intervalSel.value, 10));
});

stackSelectorEl.addEventListener("change", () => {
  stackFilter = stackSelectorEl.value;
  localStorage.setItem(STACK_KEY, stackFilter);
  renderTable();
  renderSidebar();
  updateCount();
  const visible = visibleContainers();
  const running = visible.filter((c) => c.running).length;
  const suffix = stackFilter ? ` · stack: ${stackFilter}` : "";
  setStatus(`${running} running · ${visible.length} total${suffix}`, "ok");
});

// ── Column resize ─────────────────────────────────────────────────────────────
function initColResize(): void {
  const ths =
    document.querySelectorAll<HTMLTableCellElement>("thead th[data-col]");
  for (const th of ths) {
    th.querySelector(".resize-handle")?.remove();
    const col = document.getElementById(
      th.dataset["col"]!,
    ) as HTMLElement | null;
    if (!col) continue;
    const handle = document.createElement("span");
    handle.className = "resize-handle";
    handle.addEventListener("mousedown", (startEvt) => {
      startEvt.preventDefault();
      handle.classList.add("dragging");
      const startX = startEvt.clientX;
      const startW = th.offsetWidth;
      const onMove = (e: MouseEvent) => {
        col.style.width = `${Math.max(50, startW + (e.clientX - startX))}px`;
      };
      const onUp = () => {
        handle.classList.remove("dragging");
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
    th.appendChild(handle);
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
(document.getElementById("appVersion") as HTMLSpanElement).textContent =
  `v${pkg.version}`;
populateAiProviderOptions();
renderLucide();
void refreshContainers().then(() => {
  startAutoRefresh(parseInt(intervalSel.value, 10));
  initColResize(); // bind sort header clicks after first render
  for (const th of document.querySelectorAll<HTMLElement>("th[data-sort]")) {
    th.addEventListener("click", () => {
      const col = th.dataset["sort"] as "name" | "image" | "status";
      if (sortCol === col) {
        sortDir = sortDir === "asc" ? "desc" : "asc";
      } else {
        sortCol = col;
        sortDir = "asc";
      }
      updateSortHeaders();
      renderTable();
    });
  }
});
// ── Header menu (3 dots) ─────────────────────────────────────────────────────
const headerMenuBtn = document.getElementById(
  "headerMenuBtn",
) as HTMLButtonElement;
const headerMenu = document.getElementById("headerMenu") as HTMLDivElement;
const restoreFavGroupsBtn = document.getElementById(
  "restoreFavGroups",
) as HTMLButtonElement;

headerMenuBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  headerMenu.classList.toggle("hidden");
});
document.addEventListener("click", (e) => {
  if (!headerMenu.contains(e.target as Node) && e.target !== headerMenuBtn) {
    headerMenu.classList.add("hidden");
  }
});
restoreFavGroupsBtn.addEventListener("click", () => {
  localStorage.removeItem("dsm_seeded_v4");
  groups = seedPredefinedGroups(
    containers,
    groups.filter((g) => !g.predefined),
  );
  saveGroups(groups);
  renderSidebar();
  renderTable();
  showToast("Favorite groups restored.", "success");
  headerMenu.classList.add("hidden");
});

// ── Sidebar groups menu (3 dots) ─────────────────────────────────────────────
const groupsMenuBtn = document.getElementById(
  "groupsMenuBtn",
) as HTMLButtonElement;
const groupsMenu = document.getElementById("groupsMenu") as HTMLDivElement;
const sidebarRestoreGroupsBtn = document.getElementById(
  "sidebarRestoreGroups",
) as HTMLButtonElement;

groupsMenuBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  groupsMenu.classList.toggle("hidden");
});
document.addEventListener("click", (e) => {
  if (!groupsMenu.contains(e.target as Node) && e.target !== groupsMenuBtn) {
    groupsMenu.classList.add("hidden");
  }
});
sidebarRestoreGroupsBtn.addEventListener("click", () => {
  localStorage.removeItem("dsm_seeded_v4");
  groups = seedPredefinedGroups(
    containers,
    groups.filter((g) => !g.predefined),
  );
  saveGroups(groups);
  renderSidebar();
  renderTable();
  showToast("Default groups restored.", "success");
  groupsMenu.classList.add("hidden");
});

// ══════════════════════════════════════════════════════════════════════════════
// ── CONTAINERS TAB ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// ── DOM refs ──────────────────────────────────────────────────────────────────
const panelServices = document.getElementById("panelServices") as HTMLDivElement;
const panelContainers = document.getElementById("panelContainers") as HTMLDivElement;
const tabServicesBtn = document.getElementById("tabServices") as HTMLButtonElement;
const tabContainersBtn = document.getElementById("tabContainers") as HTMLButtonElement;
const sidebarToggleBtn = document.getElementById("sidebarToggle") as HTMLButtonElement;

const cBody = document.getElementById("cBody") as HTMLTableSectionElement;
const cFilterInput = document.getElementById("cFilterInput") as HTMLInputElement;
const cShowAll = document.getElementById("cShowAll") as HTMLInputElement;
const cSelectAll = document.getElementById("cSelectAll") as HTMLInputElement;
const cCount = document.getElementById("cCount") as HTMLSpanElement;
const cSelectedLabel = document.getElementById("cSelectedLabel") as HTMLSpanElement;
const cStartSelected = document.getElementById("cStartSelected") as HTMLButtonElement;
const cStopSelected = document.getElementById("cStopSelected") as HTMLButtonElement;
const cRestartSelected = document.getElementById("cRestartSelected") as HTMLButtonElement;
const cRefreshBtn = document.getElementById("cRefresh") as HTMLButtonElement;

// ── State ─────────────────────────────────────────────────────────────────────
let rawContainers: RawContainerInfo[] = [];
let cFilterText = "";
let cLoadingIds = new Set<string>();
let activeTab: "services" | "containers" = "services";

// ── Tab switching ─────────────────────────────────────────────────────────────
function switchTab(tab: "services" | "containers"): void {
  activeTab = tab;
  if (tab === "services") {
    panelServices.classList.remove("hidden");
    panelContainers.classList.add("hidden");
    tabServicesBtn.className = "flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium transition-all tab-active";
    tabContainersBtn.className = "flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium transition-all tab-inactive";
    sidebarToggleBtn.style.display = "";
  } else {
    panelServices.classList.add("hidden");
    panelContainers.classList.remove("hidden");
    tabServicesBtn.className = "flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium transition-all tab-inactive";
    tabContainersBtn.className = "flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium transition-all tab-active";
    sidebarToggleBtn.style.display = "none";
    void refreshRawContainers();
  }
  renderLucide();
}

tabServicesBtn.addEventListener("click", () => switchTab("services"));
tabContainersBtn.addEventListener("click", () => switchTab("containers"));

// ── Helpers ───────────────────────────────────────────────────────────────────
function cGetSelected(): string[] {
  return [...document.querySelectorAll<HTMLInputElement>(".c-check:checked")].map((el) => el.value);
}

function cUpdateSelectionButtons(): void {
  const checkboxes = document.querySelectorAll<HTMLInputElement>(".c-check");
  const total = checkboxes.length;
  const count = Array.from(checkboxes).filter(cb => cb.checked).length;
  const has = count > 0;
  cStartSelected.disabled = !has;
  cStopSelected.disabled = !has;
  cRestartSelected.disabled = !has;
  cSelectedLabel.textContent = has ? `${count} selected` : "Selected";
  
  cSelectAll.indeterminate = count > 0 && count < total;
  cSelectAll.checked = count === total && total > 0;
}

function cVisibleContainers(): RawContainerInfo[] {
  let list = rawContainers;
  if (cFilterText) {
    const q = cFilterText.toLowerCase();
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.image.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q),
    );
  }
  return list;
}

function cStatePill(c: RawContainerInfo): string {
  const isLoading = cLoadingIds.has(c.id);
  if (isLoading) {
    return `<span class="pill-loading"><span class="pill-spinner"></span> Working...</span>`;
  }
  const state = c.state.toLowerCase();
  if (state === "running") {
    return `<span class="pill-up"><span class="pill-dot"></span> ${escHtml(c.uptime || "running")}</span>`;
  }
  if (state === "paused") {
    return `<span class="pill-paused"><span class="pill-dot"></span> Paused</span>`;
  }
  if (state === "exited" || state === "dead") {
    return `<span class="pill-exited"><span class="pill-dot"></span> ${escHtml(c.status)}</span>`;
  }
  return `<span class="pill-down"><span class="pill-dot"></span> ${escHtml(c.state)}</span>`;
}

// ── Render ────────────────────────────────────────────────────────────────────
function cRenderTable(): void {
  const selectedIds = cGetSelected();
  cBody.innerHTML = "";
  const visible = cVisibleContainers();
  const running = visible.filter((c) => c.running).length;
  cCount.textContent = `${running} up / ${visible.length}`;

  if (visible.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td colspan="7">
        <div class="flex flex-col items-center justify-center gap-2 py-16 text-dsm-muted">
          <i data-lucide="container" style="width:40px;height:40px;opacity:0.15"></i>
          <span class="text-[12px]">${cFilterText ? "No containers match filter." : cShowAll.checked ? "No containers found." : "No running containers. Enable 'Show stopped' to see all."}</span>
        </div>
      </td>`;
    cBody.appendChild(tr);
    renderLucide();
    return;
  }

  for (const c of visible) {
    const isLoading = cLoadingIds.has(c.id);
    const tr = document.createElement("tr");
    tr.dataset["cid"] = c.id;

    const portsHtml = c.ports
      ? `<span class="font-mono text-[10px] text-dsm-muted/70 truncate" title="${escHtml(c.ports)}">${escHtml(c.ports.split(",")[0])}${c.ports.includes(",") ? " …" : ""}</span>`
      : `<span class="text-dsm-muted/30 text-[10px]">—</span>`;

    tr.innerHTML = `
      <td class="!px-2 text-center">
        <input type="checkbox" class="c-check accent-dsm-primary" value="${escHtml(c.id)}" ${isLoading ? "disabled" : ""} ${selectedIds.includes(c.id) ? "checked" : ""} />
      </td>
      <td>
        <div class="flex items-center gap-1 min-w-0">
          <span class="truncate font-mono text-[11px] text-dsm-text" title="${escHtml(c.name)}">${escHtml(c.name)}</span>
        </div>
      </td>
      <td class="font-mono text-[10px] text-dsm-muted truncate">${escHtml(c.id)}</td>
      <td class="font-mono text-[10px] text-dsm-muted truncate" title="${escHtml(c.image)}">${escHtml(c.image)}</td>
      <td>${cStatePill(c)}</td>
      <td>${portsHtml}</td>
      <td class="!pr-2">
        <div class="flex items-center gap-1 justify-end">
          ${c.running
            ? `<button class="flex items-center justify-center w-6 h-6 rounded transition-colors text-yellow-400/80 hover:text-yellow-400 hover:bg-yellow-400/10 border border-yellow-400/20" data-caction="restart" data-cid="${escHtml(c.id)}" title="Restart"><i data-lucide="rotate-ccw" class="icon-xs"></i></button>
               <button class="flex items-center justify-center w-6 h-6 rounded border border-red-400/20 text-red-400/70 hover:text-red-400 hover:bg-red-400/10 transition-colors" data-caction="stop" data-cid="${escHtml(c.id)}" title="Stop"><i data-lucide="square" class="icon-xs"></i></button>`
            : `<button class="flex items-center justify-center w-6 h-6 rounded transition-colors text-green-400/80 hover:text-green-400 hover:bg-green-400/10 border border-green-400/20" data-caction="start" data-cid="${escHtml(c.id)}" title="Start"><i data-lucide="play" class="icon-xs"></i></button>
               <span class="w-6 h-6 flex-shrink-0 inline-block"></span>`}
          <button class="flex items-center justify-center w-6 h-6 rounded border border-purple-400/20 text-purple-400/70 hover:text-purple-400 hover:bg-purple-400/10 transition-colors" data-caction="logs" data-cid="${escHtml(c.id)}" title="View Logs"><i data-lucide="scroll-text" class="icon-xs"></i></button>
          ${c.running
            ? `<button class="flex items-center justify-center w-6 h-6 rounded border border-blue-400/20 text-blue-400/70 hover:text-blue-400 hover:bg-blue-400/10 transition-colors" data-caction="exec" data-cid="${escHtml(c.id)}" title="Open Shell"><i data-lucide="terminal" class="icon-xs"></i></button>`
            : `<span class="w-6 h-6 flex-shrink-0 inline-block"></span>`}
        </div>
      </td>
    `;
    cBody.appendChild(tr);
  }

  // Wire action buttons
  for (const btn of cBody.querySelectorAll<HTMLButtonElement>("button[data-caction]")) {
    btn.addEventListener("click", () => {
      const { caction, cid } = btn.dataset as { caction: string; cid: string };
      if (caction === "logs") {
        if (api) void api.openContainerLogs(cid).then((r) => { if (!r.ok) showToast(`Logs error: ${r.error ?? ""}`, "error"); });
      } else if (caction === "exec") {
        if (api) void api.execContainer(cid).then((r) => { if (!r.ok) showToast(`Shell error: ${r.error ?? ""}`, "error"); });
      } else {
        void cRunAction(caction as "start" | "stop" | "restart", [cid]);
      }
    });
  }

  renderLucide();
  cUpdateSelectionButtons();
}

// ── Actions ───────────────────────────────────────────────────────────────────
async function cRunAction(action: "start" | "stop" | "restart", ids: string[]): Promise<void> {
  if (!ids.length || !api) return;
  ids.forEach((id) => cLoadingIds.add(id));
  cRenderTable();
  const result = await api.controlRawContainers(action, ids);
  ids.forEach((id) => cLoadingIds.delete(id));
  if (!result.ok) {
    showToast(`Error: ${result.error ?? "unknown"}`, "error");
  } else {
    showToast(`${action.charAt(0).toUpperCase() + action.slice(1)} done on ${result.changed ?? ids.length} container(s).`, "success");
  }
  await refreshRawContainers();
}

async function refreshRawContainers(): Promise<void> {
  if (!api) return;
  const result = await api.listRawContainers(cShowAll.checked);
  if (!result.ok) {
    showToast(`Containers error: ${result.error ?? "unknown"}`, "error");
    return;
  }
  rawContainers = (result.containers ?? []) as RawContainerInfo[];
  cRenderTable();
}

// ── Events ────────────────────────────────────────────────────────────────────
cRefreshBtn.addEventListener("click", () => void refreshRawContainers());
cShowAll.addEventListener("change", () => void refreshRawContainers());

cFilterInput.addEventListener("input", () => {
  cFilterText = cFilterInput.value.trim();
  cRenderTable();
});

cSelectAll.addEventListener("change", () => {
  const checked = cSelectAll.checked;
  for (const cb of document.querySelectorAll<HTMLInputElement>(".c-check")) {
    cb.checked = checked;
  }
  cUpdateSelectionButtons();
});

cBody.addEventListener("change", (e) => {
  if ((e.target as HTMLElement).classList.contains("c-check")) {
    cUpdateSelectionButtons();
  }
});

cStartSelected.addEventListener("click", () => void cRunAction("start", cGetSelected()));
cStopSelected.addEventListener("click", () => void cRunAction("stop", cGetSelected()));
cRestartSelected.addEventListener("click", () => void cRunAction("restart", cGetSelected()));

