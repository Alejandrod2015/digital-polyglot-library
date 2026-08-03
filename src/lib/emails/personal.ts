// A personal note from one person to another. Deliberately NOT part of the
// design system in src/lib/emails/kit.ts.
//
// Everything else the beta program sends is a system email and looks like one:
// navy canvas, cards, a gold button, a branded footer. That is correct for
// "here is your TestFlight invite". It is wrong for "your application stayed
// with me": a heartfelt paragraph inside a marketing shell reads as automation
// imitating warmth, which is worse than sending nothing personal at all.
//
// So this renders what a person actually sends: left-aligned text at a normal
// size, a system font stack, no logo, no button, no card, no coloured canvas.
// The only markup is what an email client needs to keep paragraphs apart.

export type PersonalEmail = { subject: string; html: string; text: string };

export type PersonalEmailArgs = {
  /** Recipient's first name. Omitted entirely if absent, never "Hi there". */
  firstName?: string | null;
  subject: string;
  /** One paragraph per entry. Written by a human, sent verbatim. */
  paragraphs: string[];
  /**
   * Who it is from, one array entry per line ("Alejandro", "Founder, ..."). A
   * plain sign-off, not a brand lockup. Multiple lines are rendered inside one
   * block so they sit tight together the way a real signature does, rather
   * than spaced out like separate paragraphs.
   */
  signOff?: string | string[];
};

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// A stack that resolves to whatever the reader's mail client uses for its own
// interface. Anything branded here would undo the point.
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function buildPersonalEmail(args: PersonalEmailArgs): PersonalEmail {
  const { firstName, subject, paragraphs, signOff = "Alejandro" } = args;
  const greeting = firstName?.trim() ? `Hi ${firstName.trim()},` : null;
  const signOffLines = Array.isArray(signOff) ? signOff : signOff.split("\n");

  const body = [...(greeting ? [greeting] : []), ...paragraphs];

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body style="margin:0;padding:24px 16px;background:#ffffff;">
<div style="max-width:560px;margin:0 auto;font-family:${FONT};font-size:16px;line-height:1.6;color:#1a1a1a;">
${body.map((p) => `<p style="margin:0 0 16px;">${esc(p)}</p>`).join("\n")}
<p style="margin:0;">${signOffLines.map(esc).join("<br/>")}</p>
</div>
</body></html>`;

  return { subject, html, text: [...body, signOffLines.join("\n")].join("\n\n") };
}
