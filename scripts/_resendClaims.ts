// Scratch: reenvía el correo de claim OFICIAL a los 2 compradores digitales
// cuyos tokens siguen sin redimir. Reusa sendClaimEmail (@/lib/email) pero
// FUERZA APP_BASE_URL a producción (el .env.local local lo tiene en
// http://localhost:3000, que metería un link roto en el correo).
//
// Uso:
//   npx tsx scripts/_resendClaims.ts          # DRY: muestra qué se enviaría
//   npx tsx scripts/_resendClaims.ts --send   # envía de verdad (irreversible)

import { readFileSync } from "node:fs";

function loadEnv(path: string, keys: string[]) {
  let txt = "";
  try {
    txt = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const k of keys) {
    const m = txt.match(new RegExp(`^${k}=(.*)$`, "m"));
    if (m && process.env[k] === undefined) {
      process.env[k] = m[1].trim().replace(/^["']|["']$/g, "");
    }
  }
}

// DATABASE_URL desde .env; RESEND_API_KEY + EMAIL_FROM desde .env.local.
loadEnv("/Users/alejandrodelcarpio/digital-polyglot-library/.env", ["DATABASE_URL"]);
loadEnv("/Users/alejandrodelcarpio/digital-polyglot-library/.env.local", [
  "RESEND_API_KEY",
  "EMAIL_FROM",
]);
// FORZAR producción SIEMPRE (ignora el APP_BASE_URL local = localhost).
process.env.APP_BASE_URL = "https://reader.digitalpolyglot.com";

const PROD_BASE = "https://reader.digitalpolyglot.com";

const RECIPIENTS = [
  {
    to: "basvhoorn1985@hotmail.com",
    token: "cQk8nEX4dZ7dGs28BSTGX5SBclmEijOp",
    books: ["short-stories-in-colombian-spanish"],
  },
  {
    to: "lifefollowsawobblyline@hotmail.com",
    token: "N_ajKWa-TqK3Rqjo3HK8TkdrIw0ujaRs",
    books: ["short-stories-in-argentinian-spanish"],
  },
];

async function main() {
  const send = process.argv.includes("--send");
  const { getBookTitle } = await import("@/lib/books");
  const { prisma } = await import("@/lib/prisma");
  const { sendClaimEmail } = await import("@/lib/email");

  console.log(`MODE: ${send ? "SEND (real)" : "DRY (preview only)"}`);
  console.log(`FROM: ${process.env.EMAIL_FROM}`);
  console.log(`RESEND_API_KEY present: ${Boolean(process.env.RESEND_API_KEY)}`);
  console.log(`APP_BASE_URL: ${process.env.APP_BASE_URL}\n`);

  for (const r of RECIPIENTS) {
    const claim = await prisma.claimToken.findUnique({ where: { token: r.token } });
    const titles = await Promise.all(r.books.map((s) => getBookTitle(s)));
    const url = `${PROD_BASE}/claim/${r.token}`;
    console.log(`; ${r.to}`);
    console.log(`   title:  ${JSON.stringify(titles)}`);
    console.log(`   link:   ${url}`);
    console.log(
      `   token:  exists=${Boolean(claim)} redeemedAt=${claim?.redeemedAt ?? null} redeemedBy=${claim?.redeemedBy ?? null}`
    );

    if (!claim) {
      console.log(`   SKIP: token no existe\n`);
      continue;
    }
    if (claim.redeemedAt || claim.redeemedBy) {
      console.log(`   SKIP: ya redimido, NO reenviar\n`);
      continue;
    }
    if (url.includes("localhost")) {
      console.log(`   ABORT: link apunta a localhost\n`);
      continue;
    }

    if (send) {
      const res = await sendClaimEmail({ to: r.to, token: r.token, books: r.books });
      console.log(`   RESULT: ${res}\n`);
    } else {
      console.log(`   (dry) listo para enviar\n`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("ERR:", e?.message ?? e);
  process.exit(1);
});
