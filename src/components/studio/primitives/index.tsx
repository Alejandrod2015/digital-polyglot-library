/**
 * Shared Studio primitives. Thin wrappers over the `.jm-*` classes in
 * globals.css so screens (Covers, Journey Manager, Catalog) render the
 * same chips/badges from one place.
 *
 * Why these live here, not inline in each screen:
 *   - Every Studio screen renders these the same way (language tags,
 *     level codes, lifecycle status). Inlined, they drift apart over
 *     time and the look fragments.
 *   - The handoff classes (`.lang-tag`, `.level-code`, `.sb`) map 1:1
 *     onto the existing `.jm-lang-tag`, `.jm-level-code`,
 *     `.jm-status-badge`. Hide the class names behind a typed API so
 *     callers don't have to remember the namespace prefix.
 */

import type { ReactNode } from "react";

export type LangCode = "es" | "it" | "de" | "fr" | "pt" | "en" | string;
export type LevelCode = "a1" | "a2" | "b1" | "b2" | "c1" | "c2" | string;
export type CoverStatus = "published" | "review" | "missing" | "stale";

export function LangTag({
  lang,
  children,
}: {
  lang: LangCode;
  children?: ReactNode;
}) {
  const upper = lang.toUpperCase();
  return (
    <span className="jm-lang-tag" data-lang={lang.toLowerCase()}>
      {children ?? upper}
    </span>
  );
}

export function LevelCode({
  level,
  children,
}: {
  level: LevelCode;
  children?: ReactNode;
}) {
  const upper = level.toUpperCase();
  return (
    <span className="jm-level-code" data-level={level.toLowerCase()}>
      {children ?? upper}
    </span>
  );
}

const STATUS_LABEL: Record<CoverStatus, string> = {
  published: "Lista",
  review: "Revisar",
  missing: "Sin cover",
  stale: "Stale",
};

export function StatusBadge({
  status,
  compact = false,
  children,
}: {
  status: CoverStatus;
  compact?: boolean;
  children?: ReactNode;
}) {
  return (
    <span
      className={
        "jm-status-badge jm-status-badge--" + status +
        (compact ? " jm-status-badge--compact" : "")
      }
    >
      {children ?? STATUS_LABEL[status]}
    </span>
  );
}
