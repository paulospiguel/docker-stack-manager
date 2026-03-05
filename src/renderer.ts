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
} from "lucide";

import type { Action, ContainerInfo, ContainerGroup, DockerApi, RawContainerInfo } from "./types";
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
const startSelectedBtn = document.getElementById(
  "startSelected",
) as HTMLButtonElement;
const stopSelectedBtn = document.getElementById(
  "stopSelected",
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
let loadingContainers = new Set<string>();
let refreshSerial = 0;

// ── Settings ──────────────────────────────────────────────────────────────────
const SETTINGS_KEY = "dsm_settings_v1";

interface AppSettings {
  visionPath: string;
  useWsl: boolean;
  wslDistro: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  visionPath: "~/vision",
  useWsl: false,
  wslDistro: "Ubuntu",
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw)
      return {
        ...DEFAULT_SETTINGS,
        ...(JSON.parse(raw) as Partial<AppSettings>),
      };
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
    },
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
  const count = document.querySelectorAll<HTMLInputElement>(
    ".container-check:checked",
  ).length;
  const hasSelection = count > 0;
  startSelectedBtn.disabled = !hasSelection;
  stopSelectedBtn.disabled = !hasSelection;
  const label = document.getElementById("selectedLabel");
  if (label)
    label.textContent = hasSelection ? `${count} selected` : "Selected";
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

    const isLoading = loadingContainers.has(c.name);
    const pillClass = isLoading
      ? "pill-loading"
      : c.running
        ? "pill-up"
        : "pill-down";
    const pillLabel = isLoading
      ? "Loading..."
      : escHtml(c.running ? c.status : "Stopped");
    const uptimeHtml =
      c.running && c.uptime && !isLoading
        ? `<span class="text-[9px] font-mono text-dsm-muted/60 leading-none pl-0.5 mt-0.5">${escHtml(c.uptime)}</span>`
        : "";

    const tr = document.createElement("tr");
    tr.dataset["svc"] = shortName(c.name);
    tr.dataset["running"] = String(c.running);
    tr.dataset["fullname"] = c.name;
    tr.innerHTML = `
      <td class="!px-2 text-center">
        <input type="checkbox" class="container-check accent-dsm-primary" value="${fullName}" />
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
          <span class="${pillClass}">${isLoading ? '<span class="pill-spinner"></span>' : '<span class="pill-dot"></span>'} ${pillLabel}</span>
          ${uptimeHtml}
        </div>
      </td>
      <td class="!pr-2">
        <div class="flex items-center gap-1 justify-end">
          <button
            class="flex items-center justify-center w-6 h-6 rounded transition-colors ${c.running ? "text-yellow-400/80 hover:text-yellow-400 hover:bg-yellow-400/10 border border-yellow-400/20" : "text-green-400/80 hover:text-green-400 hover:bg-green-400/10 border border-green-400/20"}"
            data-id="${fullName}"
            data-action="${c.running ? "restart" : "start"}"
            title="${c.running ? "Restart" : "Start"}">
            <i data-lucide="${c.running ? "rotate-ccw" : "play"}" class="icon-xs"></i>
          </button>
          ${
            c.running
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
      const isRunning = tr.dataset["running"] === "true";
      const buildPath = api
        ? await api.findBuildScript(svc, settings.visionPath)
        : null;
      openCtxMenu(svc, fullName, isRunning, buildPath, e.clientX, e.clientY);
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
  containerName: string,
  isRunning: boolean,
  buildPath: string | null,
  x: number,
  y: number,
): void {
  ctxService = svcName;
  ctxContainerName = containerName;
  ctxBuildPath = buildPath;
  // Label start vs restart
  ctxStartLabel.textContent = isRunning ? "Restart" : "Start";
  // Toggle build option
  if (buildPath) {
    ctxBuildBtn.classList.remove("hidden");
    ctxBuildDivider.classList.remove("hidden");
  } else {
    ctxBuildBtn.classList.add("hidden");
    ctxBuildDivider.classList.add("hidden");
  }
  const menuW = 188;
  const menuH = buildPath ? 176 : 132;
  ctxMenuEl.style.left = `${Math.min(x, window.innerWidth - menuW - 8)}px`;
  ctxMenuEl.style.top = `${Math.min(y, window.innerHeight - menuH - 8)}px`;
  ctxMenuEl.classList.remove("hidden");
  renderLucide();
}

function closeCtxMenu(): void {
  ctxMenuEl.classList.add("hidden");
  ctxService = null;
  ctxBuildPath = null;
  ctxContainerName = null;
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

function openSettingsModal(): void {
  settingsVisionPathEl.value = settings.visionPath;
  settingsUseWslEl.checked = settings.useWsl;
  settingsWslDistroEl.value = settings.wslDistro;
  settingsWslDistroRowEl.classList.toggle("hidden", !settings.useWsl);
  settingsPathStatusEl.classList.add("hidden");
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

(
  document.getElementById("settingsClose") as HTMLButtonElement
).addEventListener("click", closeSettingsModal);
(
  document.getElementById("settingsCancel") as HTMLButtonElement
).addEventListener("click", closeSettingsModal);

(document.getElementById("settingsSave") as HTMLButtonElement).addEventListener(
  "click",
  () => {
    settings = {
      visionPath:
        settingsVisionPathEl.value.trim() || DEFAULT_SETTINGS.visionPath,
      useWsl: settingsUseWslEl.checked,
      wslDistro: settingsWslDistroEl.value.trim() || DEFAULT_SETTINGS.wslDistro,
    };
    persistSettings(settings);
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
  // Mark containers as loading
  ids.forEach((id) => loadingContainers.add(id));
  renderTable();
  setStatus(`Running ${action} on ${ids.length} container(s)...`);
  if (!api) {
    setStatus("Electron API unavailable (preload).", "error");
    showToast("Electron API unavailable (preload).", "error");
    ids.forEach((id) => loadingContainers.delete(id));
    renderTable();
    return;
  }

  if (action === "restart") {
    const stopRes = await api.controlContainers("stop", ids);
    if (!stopRes.ok) {
      const msg = `Error stopping for restart: ${stopRes.error ?? "unknown error"}`;
      setStatus(msg, "error");
      showToast(msg, "error");
      ids.forEach((id) => loadingContainers.delete(id));
      renderTable();
      return;
    }
    await new Promise<void>((r) => setTimeout(r, 600));
    const startRes = await api.controlContainers("start", ids);
    if (!startRes.ok) {
      const msg = `Error starting on restart: ${startRes.error ?? "unknown error"}`;
      setStatus(msg, "error");
      showToast(msg, "error");
      ids.forEach((id) => loadingContainers.delete(id));
      renderTable();
      return;
    }
    const okMsg = `Restart completed on ${ids.length} container(s).`;
    setStatus(okMsg, "ok");
    showToast(okMsg, "success");
    ids.forEach((id) => loadingContainers.delete(id));
    await refreshContainers();
    return;
  }

  const result = await api.controlContainers(action, ids);
  if (!result.ok) {
    const msg = `Error running ${action}: ${result.error ?? "unknown error"}`;
    setStatus(msg, "error");
    showToast(msg, "error");
    ids.forEach((id) => loadingContainers.delete(id));
    renderTable();
    return;
  }
  const okMsg = `${action.charAt(0).toUpperCase() + action.slice(1)} completed on ${result.changed ?? 0} container(s).`;
  setStatus(okMsg, "ok");
  showToast(okMsg, "success");
  ids.forEach((id) => loadingContainers.delete(id));
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
(document.getElementById("refresh") as HTMLButtonElement).addEventListener(
  "click",
  () => void refreshContainers(),
);
(document.getElementById("startAll") as HTMLButtonElement).addEventListener(
  "click",
  () =>
    void runAction(
      "start",
      visibleContainers().map((c) => c.id),
    ),
);
(document.getElementById("stopAll") as HTMLButtonElement).addEventListener(
  "click",
  () =>
    void runAction(
      "stop",
      visibleContainers().map((c) => c.id),
    ),
);
(
  document.getElementById("startSelected") as HTMLButtonElement
).addEventListener("click", () => void runAction("start", getSelectedIds()));
(document.getElementById("stopSelected") as HTMLButtonElement).addEventListener(
  "click",
  () => void runAction("stop", getSelectedIds()),
);
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
    const total = document.querySelectorAll(".container-check").length;
    const checked = document.querySelectorAll(
      ".container-check:checked",
    ).length;
    selectAllEl.indeterminate = checked > 0 && checked < total;
    selectAllEl.checked = checked === total && total > 0;
  }
});

filterInput.addEventListener("input", () => {
  filterText = filterInput.value.trim();
  renderTable();
  updateCount();
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
  const count = document.querySelectorAll<HTMLInputElement>(".c-check:checked").length;
  const has = count > 0;
  cStartSelected.disabled = !has;
  cStopSelected.disabled = !has;
  cRestartSelected.disabled = !has;
  cSelectedLabel.textContent = has ? `${count} selected` : "Selected";
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
        <input type="checkbox" class="c-check accent-dsm-primary" value="${escHtml(c.id)}" ${isLoading ? "disabled" : ""} />
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
    const total = document.querySelectorAll(".c-check").length;
    const checked = document.querySelectorAll(".c-check:checked").length;
    cSelectAll.indeterminate = checked > 0 && checked < total;
    cSelectAll.checked = checked === total && total > 0;
  }
});

cStartSelected.addEventListener("click", () => void cRunAction("start", cGetSelected()));
cStopSelected.addEventListener("click", () => void cRunAction("stop", cGetSelected()));
cRestartSelected.addEventListener("click", () => void cRunAction("restart", cGetSelected()));

