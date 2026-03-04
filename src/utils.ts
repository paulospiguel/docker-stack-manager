// ── Pure utility functions (no DOM, no state) ─────────────────────────────────

import type { ContainerInfo } from "./types";

/** Escape a string for safe HTML injection */
export function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** "vision_etcd.1.75oheqe4l3et7" → "vision_etcd" */
export function shortName(name: string): string {
  return name.split(".")[0];
}

/**
 * Extract the stack prefix from a service name.
 * "vision_etcd" → "vision", "portainer" → "" (standalone)
 */
export function getStackName(name: string): string {
  const base = shortName(name);
  const idx = base.indexOf("_");
  return idx >= 0 ? base.substring(0, idx) : "";
}

/** "vision_identityserver" → "identityserver" */
export function getServicePart(name: string): string {
  const base = shortName(name);
  const idx = base.indexOf("_");
  return idx >= 0 ? base.substring(idx + 1) : base;
}

/** Sub-patterns (against the part after stack prefix) that classify a service as Core. */
export const CORE_PATTERNS = [
  "etcd",
  "redis",
  "cassandra",
  "apache",
  "archive",
  "refdata",
  "caservice",
  "identityserver",
  "identity",
  "openai",
  "translator",
] as const;

enum ServiceType {
  Frontend = "frontend",
  Backend = "backend",
  Core = "core",
}

export function classifyService(name: string): ServiceType {
  const svc = getServicePart(name).toLowerCase();
  if (svc.includes("-app")) return ServiceType.Frontend;
  if (CORE_PATTERNS.some((p) => svc.includes(p))) return ServiceType.Core;
  return ServiceType.Backend;
}

/** Returns sorted unique stack names present in the given container list */
export function getAvailableStacks(containers: ContainerInfo[]): string[] {
  const names = new Set<string>();
  for (const c of containers) {
    const s = getStackName(c.name);
    if (s) names.add(s);
  }
  return [...names].sort();
}

/** FE badge if name contains "-app", BE otherwise */
export function containerBadge(name: string): string {
  const isFE = name.includes("-app");
  return isFE
    ? `<span class="badge-fe" title="Frontend">FE</span>`
    : `<span class="badge-be" title="Backend">BE</span>`;
}

/** Generate a short random unique ID */
export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
