import { NextResponse } from "next/server";
import { readEmailToken, unsubscribeAll } from "@/lib/emailPreferences";

/**
 * One-click unsubscribe.
 *
 * POST  → RFC 8058 (List-Unsubscribe-Post). Gmail/Yahoo call this directly when
 *         the user clicks the native "Unsubscribe" button. Must succeed without
 *         interaction and return 200.
 * GET   → the footer "Unsubscribe" link. Processes the opt-out and returns a
 *         branded confirmation page with a path to manage granular preferences.
 *
 * Both identify the address from a signed token, so no login is required.
 */

const APP_BASE = process.env.APP_BASE_URL ?? "https://digitalpolyglot.com";

function tokenFromRequest(req: Request): string | null {
  const url = new URL(req.url);
  return url.searchParams.get("token");
}

export async function POST(req: Request): Promise<Response> {
  let token = tokenFromRequest(req);
  if (!token) {
    // RFC 8058 bodies are form-encoded; the token may also ride in the body.
    try {
      const form = await req.formData();
      token = (form.get("token") as string) || null;
    } catch {
      /* ignore */
    }
  }
  const email = token ? readEmailToken(token) : null;
  if (!email) return NextResponse.json({ ok: false, error: "invalid token" }, { status: 400 });

  await unsubscribeAll(email);
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request): Promise<Response> {
  const token = tokenFromRequest(req);
  const email = token ? readEmailToken(token) : null;

  if (!email) {
    return htmlResponse(
      "Link expired",
      "This unsubscribe link is invalid or has expired. You can manage your email preferences from your account.",
      `${APP_BASE}/account/emails`,
      "Manage email preferences",
      400
    );
  }

  await unsubscribeAll(email);

  const manageUrl = `${APP_BASE}/account/emails?token=${encodeURIComponent(token!)}`;
  return htmlResponse(
    "You're unsubscribed",
    `We've stopped sending lifecycle emails to <strong>${escapeHtml(
      email
    )}</strong>. You'll still get important account emails. Changed your mind, or want only some emails? You can fine-tune below.`,
    manageUrl,
    "Choose what I get instead"
  );
}

/* ── tiny branded HTML page (no React; this is hit straight from an inbox) ── */

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function htmlResponse(
  title: string,
  body: string,
  ctaHref: string,
  ctaLabel: string,
  status = 200
): Response {
  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(title)} · Digital Polyglot</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
body{background:#051834;color:#eef4fc;font-family:'Nunito',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}
.card{max-width:460px;width:100%;text-align:center;background:#07203f;border:1px solid rgba(125,211,252,0.16);border-radius:20px;padding:40px 32px;box-shadow:0 24px 60px -24px rgba(0,0,0,0.8);}
h1{font-size:26px;font-weight:900;letter-spacing:-0.02em;margin-bottom:14px;}
h1 .g{color:#fcd34d;}
p{font-size:16px;font-weight:600;line-height:1.6;color:#c2d2e8;margin-bottom:26px;}
a.cta{display:inline-block;background:#fcd34d;color:#000;font-weight:900;font-size:16px;text-decoration:none;padding:15px 28px;border-radius:14px;}
.foot{margin-top:24px;font-size:13px;color:#54708f;font-weight:700;}
</style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title).replace("unsubscribed", '<span class="g">unsubscribed</span>')}</h1>
    <p>${body}</p>
    <a class="cta" href="${ctaHref}">${escapeHtml(ctaLabel)}</a>
    <div class="foot">Digital Polyglot</div>
  </div>
</body></html>`;
  return new NextResponse(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
