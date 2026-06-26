import * as React from "react";

/**
 * Inline-SVG country flags.
 *
 * WHY: the journey pills (and language switcher / practice / favorites) used
 * flag EMOJI (🇨🇴, 🇪🇸, …). Regional-indicator emoji do NOT render on many
 * platforms (Windows, several browsers), where they fall back to the two
 * letters of the code; so users saw "CO" / "ES" instead of a flag. Inline
 * SVG renders identically everywhere, no font/emoji support needed and no
 * external CDN dependency.
 *
 * Flags are simplified (no coats of arms / fine detail) but unmistakable at
 * pill size. `code` is an ISO-3166 alpha-2 country code (uppercase). Unknown
 * codes render the code text as a graceful fallback.
 */

type FlagProps = {
  /** ISO 3166-1 alpha-2 country code, e.g. "CO", "ES", "DE". */
  code: string;
  /** Rendered width in px (height keeps the 3:2 ratio). Default 18. */
  size?: number;
  className?: string;
  title?: string;
};

// viewBox is 0 0 3 2 (3:2 ratio) for every flag below.
const FLAGS: Record<string, React.ReactNode> = {
  CO: (
    <>
      <rect width="3" height="1" y="0" fill="#FCD116" />
      <rect width="3" height="0.5" y="1" fill="#003893" />
      <rect width="3" height="0.5" y="1.5" fill="#CE1126" />
    </>
  ),
  ES: (
    <>
      <rect width="3" height="2" fill="#AA151B" />
      <rect width="3" height="1" y="0.5" fill="#F1BF00" />
    </>
  ),
  DE: (
    <>
      <rect width="3" height="0.667" y="0" fill="#000000" />
      <rect width="3" height="0.667" y="0.667" fill="#DD0000" />
      <rect width="3" height="0.666" y="1.333" fill="#FFCE00" />
    </>
  ),
  MX: (
    <>
      <rect width="1" height="2" x="0" fill="#006847" />
      <rect width="1" height="2" x="1" fill="#FFFFFF" />
      <rect width="1" height="2" x="2" fill="#CE1126" />
    </>
  ),
  FR: (
    <>
      <rect width="1" height="2" x="0" fill="#0055A4" />
      <rect width="1" height="2" x="1" fill="#FFFFFF" />
      <rect width="1" height="2" x="2" fill="#EF4135" />
    </>
  ),
  IT: (
    <>
      <rect width="1" height="2" x="0" fill="#009246" />
      <rect width="1" height="2" x="1" fill="#FFFFFF" />
      <rect width="1" height="2" x="2" fill="#CE2B37" />
    </>
  ),
  PT: (
    <>
      <rect width="1.2" height="2" x="0" fill="#006600" />
      <rect width="1.8" height="2" x="1.2" fill="#FF0000" />
      <circle cx="1.2" cy="1" r="0.34" fill="#FFCC4D" stroke="#FFFFFF" strokeWidth="0.06" />
    </>
  ),
  BR: (
    <>
      <rect width="3" height="2" fill="#009C3B" />
      <polygon points="1.5,0.2 2.75,1 1.5,1.8 0.25,1" fill="#FFDF00" />
      <circle cx="1.5" cy="1" r="0.4" fill="#002776" />
    </>
  ),
  JP: (
    <>
      <rect width="3" height="2" fill="#FFFFFF" />
      <circle cx="1.5" cy="1" r="0.6" fill="#BC002D" />
    </>
  ),
  KR: (
    <>
      <rect width="3" height="2" fill="#FFFFFF" />
      <path d="M1.5 0.6 a0.4 0.4 0 0 1 0 0.8 a0.2 0.2 0 0 0 0 -0.4 a0.2 0.2 0 0 1 0 -0.4" fill="#CD2E3A" />
      <path d="M1.5 0.6 a0.4 0.4 0 0 0 0 0.8 a0.2 0.2 0 0 1 0 -0.4 a0.2 0.2 0 0 0 0 -0.4" fill="#0047A0" />
    </>
  ),
  GB: (
    <>
      <rect width="3" height="2" fill="#012169" />
      <path d="M0 0 L3 2 M3 0 L0 2" stroke="#FFFFFF" strokeWidth="0.4" />
      <path d="M1.5 0 V2 M0 1 H3" stroke="#FFFFFF" strokeWidth="0.5" />
      <path d="M1.5 0 V2 M0 1 H3" stroke="#C8102E" strokeWidth="0.3" />
    </>
  ),
  US: (
    <>
      <rect width="3" height="2" fill="#FFFFFF" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <rect key={i} width="3" height="0.1538" y={i * 0.1538} fill="#B22234" />
      ))}
      <rect width="1.2" height="1.0769" fill="#3C3B6E" />
    </>
  ),
};

export default function Flag({ code, size = 18, className, title }: FlagProps) {
  const key = (code ?? "").trim().toUpperCase();
  const flag = FLAGS[key];
  if (!flag) {
    // Graceful fallback: show the code (what emoji degraded to anyway).
    return (
      <span className={className} title={title}>
        {key}
      </span>
    );
  }
  return (
    <svg
      viewBox="0 0 3 2"
      width={size}
      height={(size * 2) / 3}
      className={className}
      role="img"
      aria-label={title ?? key}
      style={{ borderRadius: 2, display: "inline-block", verticalAlign: "middle", overflow: "hidden" }}
    >
      {flag}
    </svg>
  );
}
