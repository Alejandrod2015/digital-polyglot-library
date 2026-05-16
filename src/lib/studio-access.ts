/**
 * Studio Access Control
 *
 * Independent from Clerk subscription plans (free/basic/premium/polyglot).
 * Clerk handles "who are you?" — this module handles "can you use Studio?"
 *
 * Roles:
 *  - admin:            Full access (owner, deploys, billing, QA, metrics, content, team)
 *  - manager:          Metrics + content creation + QA + Sanity (no team management)
 *  - content_creator:  Content creation only (journey builder, journey stories)
 *
 * Members are stored in the database (dp_studio_members table).
 * A hardcoded fallback ensures the owner always has access even if the DB is empty.
 */

import { prisma } from "@/lib/prisma";

export type StudioRole = "admin" | "manager" | "content_creator";

export type StudioMember = {
  id?: string;
  email: string;
  role: StudioRole;
  name?: string | null;
};

// ─── Hardcoded fallback (owner always has access) ───────────────
const FALLBACK_ADMIN: StudioMember = {
  email: "delcarpio321@gmail.com",
  role: "admin",
  name: "Alejandro",
};

// ─── Default permission matrix (used as fallback when no override
// is persisted in StudioConfig.role_permissions yet) ────────────
const DEFAULT_ROLE_PERMISSIONS: Record<StudioRole, readonly string[]> = {
  admin: ["*"],
  manager: [
    "studio:view",
    "studio:metrics",
    "studio:qa",
    "studio:content",
    "studio:planner",
    "studio:sanity",
    "studio:journey-stories",
    "studio:journey-builder",
    "studio:drafts",
    "studio:standalone-stories",
    "studio:catalog-books",
    "studio:validar",
  ],
  content_creator: [
    "studio:view",
    "studio:content",
    "studio:journey-stories",
    "studio:journey-builder",
    "studio:standalone-stories",
    "studio:catalog-books",
    "studio:validar",
  ],
};

// Permissions that can be toggled per role from the Studio Settings
// page. Every entry maps to a Sidebar/route. studio:view stays implicit
// for any non-admin so they can land on /studio at all.
export const TOGGLEABLE_PERMISSIONS: Array<{ id: string; label: string }> = [
  { id: "studio:metrics", label: "Métricas" },
  { id: "studio:qa", label: "QA" },
  { id: "studio:content", label: "Content Agent" },
  { id: "studio:planner", label: "Planner" },
  { id: "studio:journey-stories", label: "Journey Manager" },
  { id: "studio:journey-builder", label: "Creador de Journeys" },
  { id: "studio:standalone-stories", label: "Standalone Stories" },
  { id: "studio:catalog-books", label: "Catálogo de Libros" },
  { id: "studio:drafts", label: "Borradores" },
  { id: "studio:sanity", label: "Audio propio / Sanity" },
  { id: "studio:validar", label: "Validar" },
  { id: "studio:beta-signups", label: "Beta Signups" },
  { id: "studio:config", label: "Reglas pedagógicas" },
];

let rolePermissionsCache: Record<StudioRole, string[]> | null = null;
let rolePermissionsCacheTs = 0;
const ROLE_PERMISSIONS_TTL_MS = 60_000;

async function loadRolePermissionsConfig(): Promise<Record<StudioRole, string[]>> {
  const now = Date.now();
  if (rolePermissionsCache && now - rolePermissionsCacheTs < ROLE_PERMISSIONS_TTL_MS) {
    return rolePermissionsCache;
  }
  const defaults = {
    admin: [...DEFAULT_ROLE_PERMISSIONS.admin],
    manager: [...DEFAULT_ROLE_PERMISSIONS.manager],
    content_creator: [...DEFAULT_ROLE_PERMISSIONS.content_creator],
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = await (prisma as any).studioConfig.findUnique({
      where: { key: "role_permissions" },
    });
    if (!row?.value || typeof row.value !== "object") {
      rolePermissionsCache = defaults;
      rolePermissionsCacheTs = now;
      return defaults;
    }
    const value = row.value as Partial<Record<StudioRole, string[]>>;
    rolePermissionsCache = {
      admin: ["*"],
      manager: Array.isArray(value.manager) ? value.manager : defaults.manager,
      content_creator: Array.isArray(value.content_creator)
        ? value.content_creator
        : defaults.content_creator,
    };
    rolePermissionsCacheTs = now;
    return rolePermissionsCache;
  } catch {
    rolePermissionsCache = defaults;
    rolePermissionsCacheTs = now;
    return defaults;
  }
}

export function invalidateRolePermissionsCache(): void {
  rolePermissionsCache = null;
  rolePermissionsCacheTs = 0;
}

export async function getRolePermissions(): Promise<Record<StudioRole, string[]>> {
  return loadRolePermissionsConfig();
}

export async function saveRolePermissions(input: {
  manager: string[];
  content_creator: string[];
}): Promise<void> {
  const allowed = new Set(TOGGLEABLE_PERMISSIONS.map((p) => p.id));
  const sanitized = {
    manager: input.manager.filter((p) => allowed.has(p)),
    content_creator: input.content_creator.filter((p) => allowed.has(p)),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).studioConfig.upsert({
    where: { key: "role_permissions" },
    create: { key: "role_permissions", value: sanitized },
    update: { value: sanitized },
  });
  invalidateRolePermissionsCache();
}

// ─── Path → permission mapping ─────────────────────────────────
const PATH_PERMISSIONS: Array<{ pattern: RegExp; permission: string }> = [
  { pattern: /^\/studio\/settings/, permission: "studio:settings" },
  { pattern: /^\/studio\/config/, permission: "studio:config" },
  { pattern: /^\/studio\/team/, permission: "studio:team" },
  { pattern: /^\/studio\/beta-signups/, permission: "studio:beta-signups" },
  { pattern: /^\/studio\/metrics/, permission: "studio:metrics" },
  { pattern: /^\/studio\/qa/, permission: "studio:qa" },
  { pattern: /^\/studio\/content/, permission: "studio:content" },
  { pattern: /^\/studio\/planner/, permission: "studio:planner" },
  { pattern: /^\/studio\/journey-stories/, permission: "studio:journey-stories" },
  { pattern: /^\/studio\/standalone-stories/, permission: "studio:standalone-stories" },
  { pattern: /^\/studio\/catalog-books/, permission: "studio:catalog-books" },
  { pattern: /^\/studio\/journey-builder/, permission: "studio:journey-builder" },
  { pattern: /^\/studio\/sanity/, permission: "studio:sanity" },
  { pattern: /^\/studio\/drafts/, permission: "studio:drafts" },
  { pattern: /^\/studio\/validar/, permission: "studio:validar" },
  { pattern: /^\/studio/, permission: "studio:view" },
];

// ─── In-memory cache (refreshed every 60s) ─────────────────────
let membersCache: StudioMember[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

async function loadMembers(): Promise<StudioMember[]> {
  const now = Date.now();
  if (membersCache && now - cacheTimestamp < CACHE_TTL_MS) {
    return membersCache;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- available after prisma generate
    const rows = await (prisma as any).studioMember.findMany();
    membersCache = rows.map((r: { id: string; email: string; role: string; name: string | null }) => ({
      id: r.id,
      email: r.email,
      role: r.role as StudioRole,
      name: r.name,
    }));
    cacheTimestamp = now;
  } catch {
    // Table might not exist yet — use fallback
    if (!membersCache) {
      membersCache = [FALLBACK_ADMIN];
      cacheTimestamp = now;
    }
  }

  return membersCache ?? [FALLBACK_ADMIN];
}

/** Force-refresh the cache (call after mutations). */
export function invalidateStudioCache(): void {
  membersCache = null;
  cacheTimestamp = 0;
}

// ─── Public API ─────────────────────────────────────────────────

/** Find a studio member by their email (case-insensitive). */
export async function getStudioMember(email: string): Promise<StudioMember | null> {
  const normalized = email.toLowerCase().trim();
  const members = await loadMembers();
  return members.find((m) => m.email.toLowerCase() === normalized) ?? null;
}

/** Check if an email has any studio role at all. */
export async function isStudioMember(email: string): Promise<boolean> {
  return (await getStudioMember(email)) !== null;
}

/** Get all studio members. */
export async function getStudioMembers(): Promise<StudioMember[]> {
  return loadMembers();
}

/** Check if a role has a specific permission (sync, uses static defaults).
 *  Used by code paths that can't await; the editable matrix is queried
 *  separately via getEffectivePermissionsForRole. */
export function hasPermission(role: StudioRole, permission: string): boolean {
  const perms = DEFAULT_ROLE_PERMISSIONS[role];
  return perms.includes("*") || perms.includes(permission);
}

/** Async: returns the live (DB-backed, editable) permission list for a role. */
export async function getEffectivePermissionsForRole(
  role: StudioRole,
): Promise<string[]> {
  const matrix = await loadRolePermissionsConfig();
  return matrix[role] ?? [];
}

/** Async: check using the live matrix (admin always allowed). */
export async function hasPermissionLive(
  role: StudioRole,
  permission: string,
): Promise<boolean> {
  if (role === "admin") return true;
  const perms = await getEffectivePermissionsForRole(role);
  return perms.includes(permission) || permission === "studio:view";
}

/** Get the required permission for a given studio path. */
export function getRequiredPermission(pathname: string): string {
  for (const { pattern, permission } of PATH_PERMISSIONS) {
    if (pattern.test(pathname)) return permission;
  }
  return "studio:view";
}

/** Check if a role can access a given studio path. */
export function canAccessPath(role: StudioRole, pathname: string): boolean {
  return hasPermission(role, getRequiredPermission(pathname));
}
