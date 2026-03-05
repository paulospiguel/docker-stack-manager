// ── Group persistence & seeding ───────────────────────────────────────────────

import type { ContainerGroup, ContainerInfo } from "./types";
import { shortName, classifyService, isFrontendService, getServicePart } from "./utils";

export const STORAGE_KEY = "dsm_groups_v1";
// Bumped to v4 to force re-seed with the new "Dev Frontend" group
export const PREDEFINED_SEED_KEY = "dsm_seeded_v4";

export function loadGroups(): ContainerGroup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ContainerGroup[];
    // Migrate: remove stale hex container IDs (12 hex chars from old format).
    // Groups now use stable shortName keys (e.g. "vision_etcd").
    const hexPattern = /^[0-9a-f]{12}$/;
    for (const g of parsed) {
      g.ids = g.ids.filter((id) => !hexPattern.test(id));
    }
    return parsed;
  } catch {
    return [];
  }
}

export function saveGroups(groups: ContainerGroup[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
}

/**
 * Creates the pre-defined groups (Core, Backend, Frontend, Dev Frontend) the first time
 * containers are loaded and no seed has been done yet.
 * "Dev Frontend" is always kept in sync with *_fe services dynamically.
 * Returns the updated groups array (or the same array if already seeded).
 */
export function seedPredefinedGroups(
  containerList: ContainerInfo[],
  groups: ContainerGroup[],
): ContainerGroup[] {
  if (localStorage.getItem(PREDEFINED_SEED_KEY)) {
    // Even when already seeded, dynamically update the Dev Frontend group ids
    // so newly added *_fe services are always included automatically.
    const devFeGroup = groups.find((g) => g.id === "predefined_dev_frontend");
    if (devFeGroup) {
      devFeGroup.ids = containerList
        .filter((c) => isFrontendService(getServicePart(c.name)))
        .map((c) => shortName(c.name));
      saveGroups(groups);
    }
    return groups;
  }

  const frontendIds = containerList
    .filter((c) => classifyService(c.name) === "frontend")
    .map((c) => shortName(c.name));

  // Dev Frontend: services with _fe suffix (or -app, same as frontend classifier)
  const devFeIds = containerList
    .filter((c) => isFrontendService(getServicePart(c.name)))
    .map((c) => shortName(c.name));

  const coreIds = containerList
    .filter((c) => classifyService(c.name) === "core")
    .map((c) => shortName(c.name));
  const backendIds = containerList
    .filter((c) => classifyService(c.name) === "backend")
    .map((c) => shortName(c.name));

  const predefined: ContainerGroup[] = [
    {
      id: "predefined_core",
      name: "Core",
      color: "#d29922",
      ids: coreIds,
      predefined: true,
    },
    {
      id: "predefined_backend",
      name: "Backend",
      color: "#0086a3",
      ids: backendIds,
      predefined: true,
    },
    {
      id: "predefined_frontend",
      name: "Frontend",
      color: "#1f6feb",
      ids: frontendIds,
      predefined: true,
    },
    {
      id: "predefined_dev_frontend",
      name: "Dev Frontend",
      color: "#8957e5",
      ids: devFeIds,
      predefined: true,
    },
  ];

  // Prepend pre-defined groups before any custom user groups
  const updated = [...predefined, ...groups.filter((g) => !g.predefined)];
  saveGroups(updated);
  localStorage.setItem(PREDEFINED_SEED_KEY, "1");
  return updated;
}
