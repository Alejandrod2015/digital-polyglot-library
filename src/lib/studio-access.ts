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

// ─── Permission matrix ─────────────────────────────────────────
const ROLE_PERMISSIONS: Record<StudioRole, readonly string[]> = {
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
  ],
  content_creator: [
    "studio:view",
    "studio:content",
    "studio:journey-stories",
    "studio:journey-builder",
  ],
};

// ─── Path → permission mapping ─────────────────────────────────
const PATH_PERMISSIONS: Array<{ pattern: RegExp; permission: string }> = [
  { pattern: /^\/studio\/config/, permission: "studio:config" },
  { pattern: /^\/studio\/team/, permission: "studio:team" },
  { pattern: /^\/studio\/metrics/, permission: "studio:metrics" },
  { pattern: /^\/studio\/qa/, permission: "studio:qa" },
  { pattern: /^\/studio\/content/, permission: "studio:content" },
  { pattern: /^\/studio\/planner/, permission: "studio:planner" },
  { pattern: /^\/studio\/journey-stories/, permission: "studio:journey-stories" },
  { pattern: /^\/studio\/journey-builder/, permission: "studio:journey-builder" },
  { pattern: /^\/studio\/sanity/, permission: "studio:sanity" },
  { pattern: /^\/studio\/drafts/, permission: "studio:drafts" },
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

/** Check if a role has a specific permission. */
export function hasPermission(role: StudioRole, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role];
  return perms.includes("*") || perms.includes(permission);
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
