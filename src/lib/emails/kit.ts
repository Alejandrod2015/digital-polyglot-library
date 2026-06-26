// Digital Polyglot lifecycle email design system (email-safe HTML builders).
// Ported from design/design_handoff_lifecycle_emails (email-kit.jsx).
// App-native look: warm navy + top radial lift, Nunito 900 headlines with one
// gold word, rounded yellow CTA, real product modules. 560px. No em dashes.
//
// These are string builders (not React). Outer layout + multi-column rows use
// tables for client support; decorative inner pieces use inline-styled divs,
// matching the repo's existing email approach (src/lib/email.ts).

export const DPE = {
  navy: "#051834",
  navyTop: "#0c2c54",
  screen: "#07203f",
  card: "#0c2950",
  cardLine: "rgba(125,211,252,0.16)",
  hair: "rgba(255,255,255,0.08)",
  fg: "#eef4fc",
  fgSoft: "#c2d2e8",
  muted: "#8aa0be",
  faint: "#54708f",
  gold: "#fcd34d",
  goldInk: "#2a1a02",
  sky: "#7dd3fc",
  green: "#5fd0a3",
  blue: "#2f6df6",
  font: "'Nunito',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
} as const;

const navyBg = `radial-gradient(120% 62% at 50% 0%, ${DPE.navyTop} 0%, #06203f 42%, ${DPE.navy} 74%)`;

/** Minimal HTML escape for interpolated dynamic text. */
export function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ── inline atoms ─────────────────────────────────────────── */

/** Default public host that reliably serves /covers and /digital-polyglot-logo.png
 * as static assets (the apex domain 307-redirects, which breaks email images). */
export const EMAIL_ASSET_BASE =
  process.env.EMAIL_ASSET_BASE ?? "https://reader.digitalpolyglot.com";

/** White Digital Polyglot wordmark (public/digital-polyglot-logo.png). */
export function logoImg(assetBase: string = EMAIL_ASSET_BASE, height = 24): string {
  return `<img src="${assetBase}/digital-polyglot-logo.png" alt="Digital Polyglot" height="${height}" style="display:block;height:${height}px;width:auto;margin:0 auto;border:0;outline:none;text-decoration:none;" />`;
}

export function cta(label: string, href: string, block = false): string {
  // Table-based button, centered via align="center" + margin auto (text-align
  // on the parent does NOT center a block-level table).
  return `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 auto;">
    <tr>
      <td align="center" style="background:#fcd34d !important;background-color:#fcd34d !important;border-radius:16px;padding:18px 32px;text-align:center;">
        <a href="${href}" style="color:#000 !important;font-family:${DPE.font};font-weight:900;font-size:18px;letter-spacing:-0.01em;text-decoration:none;display:block;white-space:nowrap;">${label}</a>
      </td>
    </tr>
  </table>`;
}

/** Secondary button: a filled sky-tinted pill, lower weight than the gold
 * primary cta() but with real presence. Border-radius + border live on the <a>
 * (Gmail drops border-radius on a <td> that has a border). */
export function ctaSecondary(label: string, href: string): string {
  return `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:0 auto;">
    <tr>
      <td align="center" style="border-radius:999px;">
        <a href="${href}" style="display:inline-block;background:#103a5c !important;background-color:#103a5c !important;border:1.5px solid ${DPE.sky};border-radius:999px;padding:15px 32px;color:${DPE.sky} !important;font-family:${DPE.font};font-weight:800;font-size:16px;letter-spacing:-0.01em;text-decoration:none;white-space:nowrap;">${label}</a>
      </td>
    </tr>
  </table>`;
}

export function eyebrow(text: string, color: string = DPE.gold, mb = 14): string {
  return `<div style="font-family:${DPE.font};font-weight:800;font-size:12.5px;letter-spacing:0.2em;text-transform:uppercase;color:${color};margin-bottom:${mb}px;">${esc(text)}</div>`;
}

export function hi(text: string, tone: "sky" | "gold" = "sky"): string {
  const bg = tone === "gold" ? "rgba(252,211,77,0.92)" : "rgba(125,211,252,0.92)";
  return `<span style="background:${bg};color:${DPE.navy};border-radius:5px;padding:1px 5px;font-weight:800;">${esc(text)}</span>`;
}

export function badge(text: string, tone: "sky" | "gold" | "green" = "sky"): string {
  const map: Record<string, [string, string]> = {
    sky: ["rgba(125,211,252,0.14)", DPE.sky],
    gold: ["rgba(252,211,77,0.16)", DPE.gold],
    green: ["rgba(95,208,163,0.16)", DPE.green],
  };
  const [bg, col] = map[tone];
  return `<span style="display:inline-block;font-family:${DPE.font};font-weight:800;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${col};background:${bg};padding:3px 8px;border-radius:5px;white-space:nowrap;">${esc(text)}</span>`;
}

/* ── headline + lead ──────────────────────────────────────── */

/** Headline html may contain <br> and gold(...) spans. */
export function head(html: string, size = 42): string {
  return `<h1 style="margin:0;font-family:${DPE.font};font-weight:900;font-size:${size}px;line-height:1.04;letter-spacing:-0.032em;color:${DPE.fg};">${html}</h1>`;
}

export function gold(text: string): string {
  return `<span style="color:${DPE.gold};">${esc(text)}</span>`;
}

export function lead(text: string): string {
  return `<p style="margin:16px auto 0;max-width:420px;font-family:${DPE.font};font-weight:600;font-size:19px;line-height:1.55;color:${DPE.fgSoft};">${text}</p>`;
}

/* ── metric modules ───────────────────────────────────────── */

export function statTile({
  n,
  unit,
  label,
  tone = "gold",
}: {
  n: string;
  unit?: string;
  label: string;
  tone?: "gold" | "sky" | "green";
}): string {
  const col = tone === "sky" ? DPE.sky : tone === "green" ? DPE.green : DPE.gold;
  const unitHtml = unit ? `<span style="font-size:18px;margin-left:2px;">${esc(unit)}</span>` : "";
  return `<div style="background:${DPE.screen};border:1px solid ${DPE.cardLine};border-radius:16px;padding:20px 14px;text-align:center;margin:0 auto;">
    <div style="font-family:${DPE.font};font-weight:900;font-size:38px;line-height:1;letter-spacing:-0.03em;color:${col};">${esc(n)}${unitHtml}</div>
    <div style="margin-top:9px;font-family:${DPE.font};font-weight:800;font-size:11.5px;letter-spacing:0.08em;text-transform:uppercase;color:${DPE.muted};">${esc(label)}</div>
  </div>`;
}

export function statChip({ n, label }: { n: string; label: string }): string {
  return `<div style="background:${DPE.screen};border:1px solid ${DPE.cardLine};border-radius:12px;padding:12px 16px;margin:0 auto;display:inline-block;">
    <span style="font-family:${DPE.font};font-weight:900;font-size:22px;color:${DPE.gold};letter-spacing:-0.02em;">${esc(n)}</span>
    <span style="font-family:${DPE.font};font-weight:700;font-size:13px;color:${DPE.fgSoft};margin-left:10px;">${esc(label)}</span>
  </div>`;
}

/** A wrapping cloud of word pills: gives a big "words learned" number a tangible
 * face. Words only (no meanings); the point is volume, not teaching. */
export function vocabChips(words: string[]): string {
  const pills = words
    .map(
      (w) =>
        `<span style="display:inline-block;background:rgba(125,211,252,0.10);border:1px solid rgba(125,211,252,0.22);color:${DPE.fg};font-family:${DPE.font};font-weight:800;font-size:14px;padding:7px 13px;border-radius:999px;margin:0 7px 9px 0;">${esc(
          w
        )}</span>`
    )
    .join("");
  return `<div style="text-align:left;">${pills}</div>`;
}

export function progressBar(pct: number): string {
  return `<div style="height:7px;border-radius:4px;background:rgba(125,211,252,0.16);">
    <div style="width:${pct}%;height:7px;border-radius:4px;background:linear-gradient(90deg,#fcd34d,#f4c430);background-color:#fcd34d;"></div>
  </div>`;
}

/* ── story cards ──────────────────────────────────────────── */

/** Story preview: simulates reading experience in app (text + highlight + progress) */
export function storyPreview({
  title,
  level,
  meta,
  teaser,
  pct,
  pctLabel,
}: {
  title: string;
  level?: string;
  meta?: string;
  teaser?: string;
  pct?: number;
  pctLabel?: string;
}): string {
  const metaRow = [
    level ? badge(level) : "",
    meta ? `<span style="font-family:${DPE.font};font-weight:700;font-size:11.5px;color:${DPE.faint};white-space:nowrap;margin-left:8px;">${esc(meta)}</span>` : "",
  ].join("");
  const progressHtml =
    typeof pct === "number"
      ? `<div style="margin-top:14px;">${progressBar(pct)}<div style="margin-top:7px;font-family:${DPE.font};font-weight:800;font-size:11.5px;color:${DPE.gold};">${esc(pctLabel || "")}</div></div>`
      : "";

  return `<div style="background:${DPE.screen};border:1px solid ${DPE.cardLine};border-radius:16px;padding:18px;box-shadow:0 18px 40px -22px rgba(0,0,0,0.7);">
    <div style="margin-bottom:12px;">${metaRow}</div>
    <div style="font-family:${DPE.font};font-weight:900;font-size:16px;color:${DPE.fg};letter-spacing:-0.015em;margin-bottom:12px;">${esc(title)}</div>
    <div style="font-family:${DPE.font};font-weight:700;font-size:14px;line-height:1.6;color:${DPE.fgSoft};margin-bottom:14px;">
      ${teaser ? `<p style="margin:0;">${esc(teaser)}</p>` : ""}
      <p style="margin:8px 0 0;opacity:0.7;">Read the full story for ${pct ? Math.ceil(100 - pct) + '%' : 'more'}…</p>
    </div>
    ${progressHtml}
  </div>`;
}

/** Words learned: a clean word→meaning glossary (in English so an A1 learner
 * gets clear proof of what they picked up). The word sits in a gold pill, the
 * meaning beside it. */
export function vocabGlossary({
  glossary,
  more,
}: {
  glossary: { word: string; meaning: string }[];
  more?: number;
}): string {
  const rows = glossary
    .map(
      (g, i) => `<tr>
        <td style="padding:${i === 0 ? "0" : "12px"} 14px 12px 0;text-align:left;vertical-align:top;white-space:nowrap;">
          <span style="display:inline-block;font-family:${DPE.font};font-weight:900;font-size:15px;color:${DPE.goldInk};background:${DPE.gold};padding:4px 11px;border-radius:7px;">${esc(g.word)}</span>
        </td>
        <td style="padding:${i === 0 ? "0" : "12px"} 0 12px 0;text-align:left;vertical-align:middle;">
          <span style="font-family:${DPE.font};font-weight:600;font-size:14px;line-height:1.45;color:${DPE.fgSoft};">${esc(g.meaning)}</span>
        </td>
      </tr>`
    )
    .join("");

  const moreLine =
    more && more > 0
      ? `<div style="margin-top:16px;padding-top:14px;border-top:1px solid ${DPE.hair};font-family:${DPE.font};font-weight:700;font-size:12.5px;color:${DPE.muted};">and ${more} more, saved to your words.</div>`
      : "";

  return `<div style="background:${DPE.screen};border:1px solid ${DPE.cardLine};border-radius:16px;padding:22px 22px 20px;text-align:left;box-shadow:0 18px 40px -22px rgba(0,0,0,0.7);">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;">${rows}</table>
    ${moreLine}
  </div>`;
}


export function storyCardH({
  cover,
  title,
  level,
  meta,
  teaser,
  pct,
  pctLabel,
}: {
  cover: string;
  title: string;
  level?: string;
  meta?: string;
  teaser?: string;
  pct?: number;
  pctLabel?: string;
}): string {
  const metaRow = [
    level ? badge(level) : "",
    meta ? `<span style="font-family:${DPE.font};font-weight:700;font-size:11.5px;color:${DPE.faint};white-space:nowrap;margin-left:8px;">${esc(meta)}</span>` : "",
  ].join("");
  const teaserHtml = teaser
    ? `<p style="margin:7px 0 0;font-family:${DPE.font};font-weight:700;font-size:13.5px;line-height:1.5;color:${DPE.fgSoft};">${esc(teaser)}</p>`
    : "";
  const progressHtml =
    typeof pct === "number"
      ? `<div style="margin-top:12px;">${progressBar(pct)}<div style="margin-top:7px;font-family:${DPE.font};font-weight:800;font-size:11.5px;color:${DPE.gold};">${esc(pctLabel || "")}</div></div>`
      : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:${DPE.screen};border:1px solid ${DPE.cardLine};border-radius:16px;box-shadow:0 18px 40px -22px rgba(0,0,0,0.7);">
    <tr>
      <td width="100" valign="top" style="padding:16px 0 16px 16px;">
        <img src="${cover}" width="84" height="116" alt="" style="width:84px;height:116px;object-fit:cover;border-radius:11px;display:block;box-shadow:0 10px 22px -10px rgba(0,0,0,0.7);" />
      </td>
      <td valign="top" style="padding:16px;text-align:left;">
        <div style="margin-bottom:8px;">${metaRow}</div>
        <div style="font-family:${DPE.font};font-weight:900;font-size:18px;color:${DPE.fg};letter-spacing:-0.015em;">${esc(title)}</div>
        ${teaserHtml}
        ${progressHtml}
      </td>
    </tr>
  </table>`;
}

export function storyCardV({
  cover,
  title,
  level,
  meta,
  badgeText,
}: {
  cover: string;
  title: string;
  level?: string;
  meta?: string;
  badgeText?: string;
}): string {
  const overlay = badgeText
    ? `<div style="position:absolute;top:8px;left:8px;"><span style="display:inline-block;font-family:${DPE.font};font-weight:900;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:${DPE.goldInk};background:${DPE.gold};padding:3px 8px;border-radius:5px;border:1.5px solid ${DPE.navy};box-shadow:0 0 0 2px rgba(5,24,52,0.45),0 4px 10px -3px rgba(0,0,0,0.6);">${esc(badgeText)}</span></div>`
    : "";
  const metaRow = [
    level ? badge(level) : "",
    meta ? `<span style="font-family:${DPE.font};font-weight:700;font-size:10.5px;color:${DPE.faint};white-space:nowrap;margin-left:6px;">${esc(meta)}</span>` : "",
  ].join("");
  return `<div style="background:${DPE.screen};border:1px solid ${DPE.cardLine};border-radius:14px;padding:12px;text-align:left;">
    <div style="position:relative;">
      <img src="${cover}" alt="" width="100%" height="132" style="width:100%;height:132px;object-fit:cover;border-radius:9px;display:block;box-shadow:0 8px 18px -10px rgba(0,0,0,0.7);" />
      ${overlay}
    </div>
    <div style="margin:11px 0 6px;">${metaRow}</div>
    <div style="font-family:${DPE.font};font-weight:900;font-size:14.5px;color:${DPE.fg};letter-spacing:-0.01em;line-height:1.2;">${esc(title)}</div>
  </div>`;
}

/* ── tap-a-word proof ─────────────────────────────────────── */

export function vocabCard(scale = 1): string {
  const s = (n: number) => Math.round(n * scale * 10) / 10;
  return `<div style="background:${DPE.card};border:1px solid rgba(125,211,252,0.30);border-radius:${s(15)}px;padding:${s(18)}px ${s(18)}px ${s(20)}px;text-align:center;">
    <div style="font-family:${DPE.font};font-weight:900;font-size:${s(22)}px;color:${DPE.fg};">fonda</div>
    <div style="display:inline-block;margin-top:${s(9)}px;background:rgba(125,211,252,0.18);color:${DPE.sky};font-family:${DPE.font};font-weight:800;font-size:${s(12)}px;letter-spacing:0.12em;text-transform:uppercase;padding:${s(4)}px ${s(10)}px;border-radius:${s(5)}px;">Noun</div>
    <div style="margin-top:${s(10)}px;font-family:${DPE.font};font-weight:600;font-size:${s(16)}px;color:${DPE.fgSoft};line-height:1.4;">Small, home-style Mexican eatery</div>
    <div style="display:inline-block;margin-top:${s(14)}px;border:1.5px solid rgba(125,211,252,0.55);color:${DPE.sky};font-family:${DPE.font};font-weight:800;font-size:${s(15)}px;padding:${s(9)}px ${s(20)}px;border-radius:999px;white-space:nowrap;">&#9825; Save word</div>
  </div>`;
}

export function audioBar(scale = 1, play = false): string {
  const s = (n: number) => Math.round(n * scale * 10) / 10;
  const playBtn = play
    ? `<td width="${s(52)}" valign="middle" style="vertical-align:middle;"><span style="display:inline-block;width:${s(40)}px;height:${s(40)}px;border-radius:50%;background:${DPE.blue};text-align:center;line-height:${s(40)}px;box-shadow:0 8px 20px -6px rgba(47,109,246,0.7);"><span style="color:#fff;font-size:${s(13)}px;">&#10074;&#10074;</span></span></td>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;"><tr>
    ${playBtn}
    <td width="${s(40)}" valign="middle" style="vertical-align:middle;font-family:${DPE.font};font-weight:800;font-size:${s(12)}px;color:${DPE.muted};">0:31</td>
    <td valign="middle" style="vertical-align:middle;padding:0 ${s(10)}px;">
      <div style="height:${s(5)}px;border-radius:3px;background:rgba(125,211,252,0.18);">
        <div style="width:44%;height:${s(5)}px;border-radius:3px;background:linear-gradient(90deg,#7dd3fc,#2f6df6);background-color:#2f6df6;"></div>
      </div>
    </td>
    <td width="${s(40)}" valign="middle" align="right" style="vertical-align:middle;text-align:right;font-family:${DPE.font};font-weight:800;font-size:${s(12)}px;color:${DPE.muted};">1:10</td>
  </tr></table>`;
}

export function coverArt(height = 116, radius = 13): string {
  return `<div style="height:${height}px;border-radius:${radius}px;background:linear-gradient(135deg,#f1e4c6 0%,#e7b27a 45%,#c96b4a 100%);box-shadow:inset 0 0 0 1px rgba(0,0,0,0.06);"></div>`;
}

/* ── phone frame (welcome hero) ───────────────────────────── */

export function phoneFrame(width: number, inner: string): string {
  // Email-safe device: solid colors + real border + drawn notch (no gradients,
  // shadows or position:absolute, which Gmail strips).
  return `<div style="width:${width}px;max-width:${width}px;margin:0 auto;background:#05080f;background-color:#05080f;border:1px solid rgba(125,211,252,0.16);border-radius:48px;padding:7px;">
    <div style="background:${DPE.screen};background-color:${DPE.screen};border-radius:42px;">
      <div style="text-align:center;padding:12px 0 2px;line-height:0;"><span style="display:inline-block;width:98px;height:26px;border-radius:999px;background:#05080f;background-color:#05080f;"></span></div>
      ${inner}
    </div>
  </div>`;
}

/* ── multi-column row helper (equal columns + gap spacers) ── */

export function cols(cells: string[], gap = 12): string {
  const w = Math.floor(100 / cells.length);
  let tds = "";
  cells.forEach((c, i) => {
    if (i > 0) tds += `<td width="${gap}" style="width:${gap}px;font-size:0;line-height:0;">&nbsp;</td>`;
    tds += `<td width="${w}%" valign="top" style="vertical-align:top;width:${w}%;text-align:center;">${c}</td>`;
  });
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:0 auto;"><tr>${tds}</tr></table>`;
}

/* ── footer + shell ───────────────────────────────────────── */

function footer(
  align: "center" | "left",
  note: string | undefined,
  baseUrl: string,
  assetBase: string,
  unsubscribeToken?: string
): string {
  const justify = align === "center" ? "center" : "left";
  // Token-bearing links work without a logged-in session (clicked from inbox).
  const tokenQs = unsubscribeToken ? `?token=${encodeURIComponent(unsubscribeToken)}` : "";
  const manageUrl = `${baseUrl}/account/emails${tokenQs}`;
  const unsubUrl = unsubscribeToken
    ? `${baseUrl}/api/email/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`
    : `${baseUrl}/account/emails?unsubscribe=1`;
  const noteText = note || "You're receiving this as part of your Digital Polyglot account.";
  return `<tr><td style="padding:28px 44px 34px;text-align:${justify};">
    <div style="height:1px;background:${DPE.hair};margin-bottom:22px;"></div>
    <div style="margin-bottom:14px;text-align:${justify};">
      ${logoImg(assetBase, 46)}
    </div>
    <div style="font-family:${DPE.font};font-weight:600;font-size:14px;color:${DPE.faint};line-height:1.7;">
      ${esc(noteText)}<br/>
      <a href="${manageUrl}" style="color:${DPE.muted};text-decoration:underline;">Manage emails</a>
      &nbsp;&middot;&nbsp;
      <a href="${unsubUrl}" style="color:${DPE.muted};text-decoration:underline;">Unsubscribe</a>
    </div>
  </td></tr>`;
}

export type ShellOpts = {
  preheader: string;
  blocks: string[];
  footerNote?: string;
  footerAlign?: "center" | "left";
  baseUrl: string;
  assetBase?: string;
  unsubscribeToken?: string;
};

/** Full email document: navy canvas, 560 centered, blocks + footer. */
export function shell({
  preheader,
  blocks,
  footerNote,
  footerAlign = "center",
  baseUrl,
  assetBase = EMAIL_ASSET_BASE,
  unsubscribeToken,
}: ShellOpts): string {
  const body = blocks.map((b) => `<tr><td style="padding:0;">${b}</td></tr>`).join("");
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="dark"/>
<style>
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap');
body,-webkit-text-size-adjust{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
@media only screen and (max-width:620px){
  .wrap{width:100%!important;max-width:100%!important;}
  .pad{padding-left:20px!important;padding-right:20px!important;}
  .phone-wrap{padding-left:10px!important;padding-right:10px!important;}
}
</style>
</head>
<body style="margin:0;padding:0;background:${DPE.navy};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${DPE.navy}" style="width:100%;background:${DPE.navy};">
  <tr><td align="center" style="padding:0;">
    <!--[if mso]><table role="presentation" width="560" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
    <table role="presentation" align="center" width="560" cellpadding="0" cellspacing="0" bgcolor="${DPE.navy}" class="wrap" style="width:560px;max-width:560px;margin:0 auto;background:${navyBg};background-color:${DPE.navy};font-family:${DPE.font};">
      ${body}
      ${footer(footerAlign, footerNote, baseUrl, assetBase, unsubscribeToken)}
    </table>
    <!--[if mso]></td></tr></table><![endif]-->
  </td></tr>
</table>
</body></html>`;
}

/** Convenience: a padded content block (one <td> section inside the shell). */
export function block(inner: string, padding: string, center = true): string {
  return `<div style="padding:${padding};${center ? "text-align:center;" : ""}">${inner}</div>`;
}
