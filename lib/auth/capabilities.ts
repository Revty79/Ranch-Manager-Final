import type { RanchRole } from "@/lib/db/schema";

export const sectionAccessLevels = ["none", "view", "manage"] as const;
export type SectionAccessLevel = (typeof sectionAccessLevels)[number];

export const appSections = [
  "dashboard",
  "today",
  "needsAttention",
  "team",
  "communication",
  "workOrders",
  "time",
  "payroll",
  "herd",
  "land",
  "settings",
] as const;
export type AppSection = (typeof appSections)[number];

export type SectionAccessMap = Record<AppSection, SectionAccessLevel>;
export type SectionAccessOverrides = Partial<Record<AppSection, SectionAccessLevel>>;

export interface MembershipCapabilityOverrides {
  sections?: SectionAccessOverrides;
}

const sectionAccessRank: Record<SectionAccessLevel, number> = {
  none: 0,
  view: 1,
  manage: 2,
};

export const appSectionByHref: Readonly<Record<string, AppSection>> = {
  "/app": "dashboard",
  "/app/today": "today",
  "/app/needs-attention": "needsAttention",
  "/app/team": "team",
  "/app/communication": "communication",
  "/app/work-orders": "workOrders",
  "/app/time": "time",
  "/app/payroll": "payroll",
  "/app/herd": "herd",
  "/app/land": "land",
  "/app/settings": "settings",
};

export const appHrefBySection: Readonly<Record<AppSection, string>> = {
  dashboard: "/app",
  today: "/app/today",
  needsAttention: "/app/needs-attention",
  team: "/app/team",
  communication: "/app/communication",
  workOrders: "/app/work-orders",
  time: "/app/time",
  payroll: "/app/payroll",
  herd: "/app/herd",
  land: "/app/land",
  settings: "/app/settings",
};

const sectionLaunchOrder: readonly AppSection[] = [
  "dashboard",
  "today",
  "workOrders",
  "time",
  "communication",
  "herd",
  "land",
  "settings",
  "team",
  "needsAttention",
  "payroll",
];

const managerLikeDefaults: SectionAccessMap = {
  dashboard: "manage",
  today: "manage",
  needsAttention: "manage",
  team: "manage",
  communication: "manage",
  workOrders: "manage",
  time: "manage",
  payroll: "manage",
  herd: "manage",
  land: "manage",
  settings: "manage",
};

const workerLikeDefaults: SectionAccessMap = {
  dashboard: "view",
  today: "view",
  needsAttention: "none",
  team: "none",
  communication: "manage",
  workOrders: "view",
  time: "manage",
  payroll: "none",
  herd: "view",
  land: "view",
  settings: "view",
};

const roleDefaultSectionAccess: Record<RanchRole, SectionAccessMap> = {
  owner: managerLikeDefaults,
  manager: managerLikeDefaults,
  worker: workerLikeDefaults,
  seasonal_worker: workerLikeDefaults,
};

const editableWorkerSections: readonly AppSection[] = [
  "dashboard",
  "today",
  "communication",
  "workOrders",
  "time",
  "herd",
  "land",
  "settings",
];

function isSectionAccessLevel(value: unknown): value is SectionAccessLevel {
  return typeof value === "string" && (sectionAccessLevels as readonly string[]).includes(value);
}

function isAppSection(value: unknown): value is AppSection {
  return typeof value === "string" && (appSections as readonly string[]).includes(value);
}

function cloneSectionAccess(access: SectionAccessMap): SectionAccessMap {
  return { ...access };
}

export function getDefaultSectionAccessForRole(role: RanchRole): SectionAccessMap {
  return cloneSectionAccess(roleDefaultSectionAccess[role]);
}

export function getEditableSectionsForRole(role: RanchRole): AppSection[] {
  if (role === "worker" || role === "seasonal_worker") {
    return [...editableWorkerSections];
  }

  return [];
}

function parseSectionOverrides(raw: unknown): SectionAccessOverrides {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const sourceRecord = raw as Record<string, unknown>;
  const nested = sourceRecord.sections;
  const candidate =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : sourceRecord;

  const output: SectionAccessOverrides = {};
  for (const [key, value] of Object.entries(candidate)) {
    if (!isAppSection(key) || !isSectionAccessLevel(value)) {
      continue;
    }
    output[key] = value;
  }

  return output;
}

export function sanitizeCapabilityOverridesForRole(
  role: RanchRole,
  raw: unknown,
): MembershipCapabilityOverrides {
  if (role === "owner" || role === "manager") {
    return {};
  }

  const editable = new Set(getEditableSectionsForRole(role));
  const defaults = roleDefaultSectionAccess[role];
  const parsed = parseSectionOverrides(raw);
  const sections: SectionAccessOverrides = {};

  for (const section of appSections) {
    if (!editable.has(section)) {
      continue;
    }
    const override = parsed[section];
    if (!override || override === defaults[section]) {
      continue;
    }
    sections[section] = override;
  }

  return Object.keys(sections).length ? { sections } : {};
}

export function resolveSectionAccess(
  role: RanchRole,
  rawOverrides: unknown,
): SectionAccessMap {
  const resolved = getDefaultSectionAccessForRole(role);
  if (role === "owner" || role === "manager") {
    return resolved;
  }

  const parsed = parseSectionOverrides(rawOverrides);
  const editable = new Set(getEditableSectionsForRole(role));
  for (const section of appSections) {
    if (!editable.has(section)) {
      continue;
    }
    const override = parsed[section];
    if (override) {
      resolved[section] = override;
    }
  }

  return resolved;
}

export function hasSectionAccess(
  access: SectionAccessMap,
  section: AppSection,
  required: SectionAccessLevel = "view",
): boolean {
  return sectionAccessRank[access[section]] >= sectionAccessRank[required];
}

export function getSectionAccessLabel(value: SectionAccessLevel): string {
  if (value === "none") return "Hidden";
  if (value === "view") return "View only";
  return "Can use";
}

export function getSectionLabel(section: AppSection): string {
  if (section === "needsAttention") return "Needs Attention";
  if (section === "workOrders") return "Work Orders";
  return section.charAt(0).toUpperCase() + section.slice(1);
}

export function resolvePreferredAppPath(access: SectionAccessMap): string {
  for (const section of sectionLaunchOrder) {
    if (hasSectionAccess(access, section, "view")) {
      return appHrefBySection[section];
    }
  }

  return "/app/access-denied";
}
