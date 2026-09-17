/**
 * Plantillas de correo de Clerk con el estilo de Digital Polyglot.
 *
 *   npx tsx scripts/_clerkEmails.ts
 *
 * Clerk no guarda estas plantillas en el repo: viven en su dashboard
 * (Customization > Emails) y se rellenan con Handlebars. Este script las
 * construye con el kit de correo del proyecto (src/lib/emails/kit.ts) y deja
 * dos copias de cada una en qa/clerk/:
 *
 *   <slug>.html          el HTML con las {{variables}} de Clerk, para pegar
 *   preview/<slug>.html  el mismo con valores de ejemplo, para mirarlo
 *
 * Las variables NO son inventadas: salen de `available_variables` de la API
 * de Clerk (GET /v1/templates/email), comprobadas el 2026-09-06.
 *
 * Estos correos son transaccionales, asi que el pie NO lleva "Unsubscribe":
 * por eso montan su propio shell en vez del `shell()` del kit.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { DPE, logoImg, eyebrow, head, gold, lead, cta, EMAIL_ASSET_BASE } from "../src/lib/emails/kit";

const OUT = "qa/clerk";
const ASSETS = process.env.CHECK_ASSETS ?? EMAIL_ASSET_BASE;
const SITE = "https://digitalpolyglot.com";

const navyBg = `radial-gradient(120% 62% at 50% 0%, ${DPE.navyTop} 0%, #06203f 42%, ${DPE.navy} 74%)`;

/* ── shell transaccional (sin baja, sin preferencias) ─────── */

function transactionalShell({
  preheader,
  blocks,
  footerNote,
}: {
  preheader: string;
  blocks: string[];
  footerNote: string;
}): string {
  const body = blocks.map((b) => `<tr><td style="padding:0;">${b}</td></tr>`).join("");
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="dark"/>
<meta name="supported-color-schemes" content="dark"/>
<style>
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap');
body{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
@media only screen and (max-width:620px){
  .wrap{width:100%!important;max-width:100%!important;}
  .pad{padding-left:20px!important;padding-right:20px!important;}
  .code{font-size:38px!important;letter-spacing:0.10em!important;}
}
</style>
</head>
<body style="margin:0;padding:0;background:${DPE.navy};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${DPE.navy}" style="width:100%;background:${DPE.navy};">
  <tr><td align="center" style="padding:0;">
    <!--[if mso]><table role="presentation" width="560" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
    <table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" bgcolor="${DPE.navy}" class="wrap" style="width:100%;max-width:560px;margin:0 auto;background:${navyBg};background-color:${DPE.navy};font-family:${DPE.font};">
      <tr><td class="pad" style="padding:34px 44px 0;text-align:center;">${logoImg(ASSETS, 30)}</td></tr>
      ${body}
      <tr><td class="pad" style="padding:30px 44px 36px;text-align:center;">
        <div style="height:1px;background:${DPE.hair};margin-bottom:20px;"></div>
        <div style="font-family:${DPE.font};font-weight:600;font-size:13px;line-height:1.7;color:${DPE.faint};">
          ${footerNote}<br/>
          <a href="${SITE}" style="color:${DPE.muted};text-decoration:underline;">digitalpolyglot.com</a>
        </div>
      </td></tr>
    </table>
    <!--[if mso]></td></tr></table><![endif]-->
  </td></tr>
</table>
</body></html>`;
}

function pad(inner: string, padding: string, center = true): string {
  return `<div class="pad" style="padding:${padding};${center ? "text-align:center;" : ""}">${inner}</div>`;
}

/* ── piezas propias de un correo de seguridad ─────────────── */

/** La caja del codigo. El codigo va como TEXTO, no como imagen ni con espacios
 * entre digitos: asi lo autocompleta iOS y se puede copiar de una pieza. */
function codeCard(label: string, codeVar: string, note: string): string {
  return `<div style="background:${DPE.screen};border:1px solid ${DPE.cardLine};border-radius:18px;padding:24px 20px 22px;text-align:center;box-shadow:0 20px 44px -22px rgba(0,0,0,0.7);">
    <div style="font-family:${DPE.font};font-weight:800;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${DPE.faint};margin-bottom:12px;">${label}</div>
    <div class="code" style="font-family:${DPE.font};font-weight:900;font-size:44px;line-height:1.1;letter-spacing:0.14em;color:${DPE.gold};text-indent:0.14em;">${codeVar}</div>
    <div style="margin-top:14px;font-family:${DPE.font};font-weight:700;font-size:13px;line-height:1.5;color:${DPE.muted};">${note}</div>
  </div>`;
}

/** El bloque "Didn't request this?". La IP completa del solicitante NO se
 * imprime ({{requested_from}}): a quien recibe el correo no le dice nada, no
 * la puede comprobar, y mete la direccion de otra persona en su bandeja. La
 * hora ({{requested_at}}) responde a la misma pregunta y no expone a nadie. */
function securityNote(title: string, lines: string[]): string {
  const text = lines
    .map(
      (l) =>
        `<p style="margin:0 0 8px;font-family:${DPE.font};font-weight:600;font-size:13.5px;line-height:1.6;color:${DPE.muted};">${l}</p>`
    )
    .join("");
  return `<div style="border:1px solid ${DPE.hair};border-radius:14px;padding:18px 20px 12px;text-align:left;">
    <div style="font-family:${DPE.font};font-weight:800;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${DPE.sky};margin-bottom:10px;">${title}</div>
    ${text}
  </div>`;
}

/* ── las plantillas ───────────────────────────────────────── */

type Tpl = { slug: string; subject: string; html: string };

const templates: Tpl[] = [];

/* 1 · Verification code (la que mas se manda) */
templates.push({
  slug: "verification_code",
  subject: "{{otp_code}} is your Digital Polyglot code",
  html: transactionalShell({
    preheader: "Your sign in code. It expires shortly and works only once.",
    footerNote:
      "We sent this because someone asked for a sign in code for this address.<br/>Nobody at Digital Polyglot will ever ask you to share it.",
    blocks: [
      pad(
        `${eyebrow("Verification code")}${head(`One code,<br/>and you're ${gold("in")}.`, 38)}${lead(
          "Enter it where you started signing in, and your stories are waiting on the other side."
        )}`,
        "30px 44px 0"
      ),
      pad(codeCard("Your code", "{{otp_code}}", "Do not share this code with anyone."), "26px 44px 0", false),
      pad(
        securityNote("Didn't request this?", [
          "Someone asked for this code at <b style=\"color:#c2d2e8;\">{{requested_at}}</b>.",
          "If that wasn't you, ignore this email. The code only works in this inbox, and it stops working once it is used or once it expires.",
        ]),
        "24px 44px 0",
        false
      ),
    ],
  }),
});

/* 2 · Reset password code */
templates.push({
  slug: "reset_password_code",
  subject: "{{otp_code}} is your password reset code",
  html: transactionalShell({
    preheader: "Your password reset code.",
    footerNote:
      "We sent this because someone asked to reset the password for this address.<br/>Your current password still works until you change it.",
    blocks: [
      pad(
        `${eyebrow("Password reset")}${head(`Let's get you a<br/>${gold("new password")}.`, 38)}${lead(
          "Enter this code on the reset screen, then pick the new one."
        )}`,
        "30px 44px 0"
      ),
      pad(codeCard("Your reset code", "{{otp_code}}", "Do not share this code with anyone."), "26px 44px 0", false),
      pad(
        securityNote("Didn't request this?", [
          "Someone asked to reset this password at <b style=\"color:#c2d2e8;\">{{requested_at}}</b>.",
          "If that wasn't you, ignore this email and nothing changes. Your password stays as it is.",
        ]),
        "24px 44px 0",
        false
      ),
    ],
  }),
});

/* 3 · Email link, sign in (magic link) */
templates.push({
  slug: "magic_link_sign_in",
  subject: "Your Digital Polyglot sign in link",
  html: transactionalShell({
    preheader: "One tap and you are back in your stories.",
    footerNote:
      "We sent this because someone asked for a sign in link for this address.<br/>Nobody at Digital Polyglot will ever ask you to forward it.",
    blocks: [
      pad(
        `${eyebrow("Sign in link")}${head(`Your stories are<br/>one ${gold("tap")} away.`, 38)}${lead(
          "This link signs you in on the device where you asked for it."
        )}`,
        "30px 44px 0"
      ),
      pad(cta("Sign in to Digital Polyglot", "{{magic_link}}"), "28px 44px 0"),
      pad(
        `<div style="font-family:${DPE.font};font-weight:700;font-size:12.5px;color:${DPE.muted};">The link works for {{ttl_minutes}} minutes, then it expires.</div>`,
        "14px 44px 0"
      ),
      pad(
        securityNote("Didn't request this?", [
          "Someone asked for this link at <b style=\"color:#c2d2e8;\">{{requested_at}}</b>.",
          "If that wasn't you, ignore this email. Nothing happens until the link is opened, and it expires on its own.",
        ]),
        "24px 44px 0",
        false
      ),
    ],
  }),
});

/* 4 · Invitation */
templates.push({
  slug: "invitation",
  subject: "You're invited to Digital Polyglot",
  html: transactionalShell({
    preheader: "Your invitation to Digital Polyglot is ready.",
    footerNote: "You are receiving this because your email address was invited to Digital Polyglot.",
    blocks: [
      pad(
        `${eyebrow("Invitation")}${head(`The real language,<br/>from ${gold("word one")}.`, 38)}${lead(
          "Your invitation is ready. Set up your account, pick a language, and start on a short story tonight."
        )}`,
        "30px 44px 0"
      ),
      pad(cta("Accept your invitation", "{{action_url}}"), "28px 44px 0"),
      pad(
        `<div style="font-family:${DPE.font};font-weight:700;font-size:12.5px;color:${DPE.muted};">Stories with audio, and any word explained in one tap.</div>`,
        "14px 44px 0"
      ),
      pad(
        securityNote("Not expecting this?", [
          "If you were not expecting this invitation, you can ignore this email. No account is created until you open the link.",
        ]),
        "26px 44px 0",
        false
      ),
    ],
  }),
});

/* ── salida ───────────────────────────────────────────────── */

const SAMPLE: Record<string, string> = {
  "{{otp_code}}": "389027",
  "{{requested_at}}": "Sep 6, 2026 at 18:42 UTC",
  "{{requested_from}}": "2a02:9b0:400f:8f00:4c1b:9e2a:7f31:1c3d (Madrid, ES)",
  "{{ttl_minutes}}": "10",
  "{{magic_link}}": `${SITE}/sign-in#sample`,
  "{{action_url}}": `${SITE}/sign-up#sample`,
  "{{app.name}}": "Digital Polyglot",
  "{{app.url}}": SITE,
  "{{app.domain_name}}": "digitalpolyglot.com",
  "{{app.logo_image_url}}": `${ASSETS}/digital-polyglot-logo.png`,
  "{{user.email_address}}": "marta@example.com",
  "{{current_year}}": "2026",
};

export function fillSample(html: string): string {
  let out = html;
  for (const [k, v] of Object.entries(SAMPLE)) out = out.split(k).join(v);
  return out;
}

mkdirSync(`${OUT}/preview`, { recursive: true });
const index: string[] = [];
for (const t of templates) {
  writeFileSync(`${OUT}/${t.slug}.html`, t.html);
  writeFileSync(`${OUT}/preview/${t.slug}.html`, fillSample(t.html));
  index.push(`${t.slug}\t${t.subject}`);
  console.log(`${t.slug.padEnd(22)} ${String(t.html.length).padStart(6)} bytes   subject: ${t.subject}`);
}
writeFileSync(`${OUT}/subjects.txt`, index.join("\n") + "\n");

/* Una sola pagina con el antes y el despues, lado a lado. El "antes" es el
 * body REAL que Clerk envia hoy (GET /v1/templates/email), guardado en
 * qa/clerk/before/ por si hace falta volver a mirarlo. */
const panes = templates
  .map((t) => {
    const before = existsSync(`${OUT}/before/${t.slug}.html`)
      ? fillSample(readFileSync(`${OUT}/before/${t.slug}.html`, "utf8"))
      : "<p style='font-family:sans-serif;padding:24px'>sin copia del original</p>";
    const after = fillSample(t.html);
    const frame = (html: string) =>
      `<iframe srcdoc="${html.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" style="width:100%;height:940px;border:0;border-radius:14px;background:#fff;"></iframe>`;
    return `<section style="margin:0 0 46px;">
      <h2 style="font:800 15px/1.2 ui-sans-serif,system-ui;letter-spacing:0.14em;text-transform:uppercase;color:#8aa0be;margin:0 0 14px;">${t.slug}</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start;">
        <div><div style="font:700 12px/1 ui-sans-serif,system-ui;color:#e06c6c;margin:0 0 8px;letter-spacing:0.1em;">ANTES (Clerk por defecto)</div>${frame(before)}</div>
        <div><div style="font:700 12px/1 ui-sans-serif,system-ui;color:#5fd0a3;margin:0 0 8px;letter-spacing:0.1em;">DESPUES (Digital Polyglot)</div>${frame(after)}</div>
      </div>
    </section>`;
  })
  .join("\n");
writeFileSync(
  `${OUT}/comparativa.html`,
  `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>Correos de Clerk: antes y despues</title></head>
<body style="margin:0;padding:28px;background:#0b0f16;">
<h1 style="font:900 24px/1.2 ui-sans-serif,system-ui;color:#eef4fc;margin:0 0 6px;">Correos de Clerk: antes y despues</h1>
<p style="font:600 14px/1.5 ui-sans-serif,system-ui;color:#8aa0be;margin:0 0 30px;">Valores de ejemplo. El codigo real llega en {{otp_code}}.</p>
${panes}
</body></html>`
);
console.log(`comparativa: ${OUT}/comparativa.html`);
console.log(`\n${templates.length} plantillas en ${OUT}/ (y sus previsualizaciones en ${OUT}/preview/)`);
