/**
 * Pide /api/mobile/journey a PRODUCCION tal cual lo pide el telefono, y dice en
 * que track aterriza la app del usuario. Solo LEE.
 *   npx tsx scripts/_prodJourneyCheck.ts <clerkUserId> [idioma]
 */
import { createHmac } from "crypto";

const BASE = "https://reader.digitalpolyglot.com";
const SECRET = (process.env.MOBILE_AUTH_SECRET || process.env.CLERK_SECRET_KEY || "").trim();

function token(userId: string, targetLanguages: string[]): string {
  const iat = Math.floor(Date.now() / 1000);
  const payload = {
    aud: "digital-polyglot-mobile", sub: userId, email: null, name: null, plan: null,
    targetLanguages, booksCount: 0, storiesCount: 0, iat, exp: iat + 300,
  };
  const b = (v: string) => Buffer.from(v, "utf8").toString("base64url");
  const unsigned = `${b(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b(JSON.stringify(payload))}`;
  return `${unsigned}.${createHmac("sha256", SECRET).update(unsigned).digest("base64url")}`;
}

async function main() {
  const userId = process.argv[2];
  const language = process.argv[3] ?? "Spanish";
  if (!userId || !SECRET) throw new Error("faltan userId o secreto");

  const res = await fetch(`${BASE}/api/mobile/journey?language=${encodeURIComponent(language)}`, {
    headers: { Authorization: `Bearer ${token(userId, [language])}` },
  });
  console.log("HTTP", res.status, res.statusText);
  const data = (await res.json()) as {
    language?: string; variant?: string | null;
    tracks?: Array<{ id: string; label: string; variant: string | null; levels?: Array<{ id: string; topics?: Array<{ stories?: Array<{ title?: string }> }> }> }>;
  };
  if (!res.ok) { console.log(JSON.stringify(data).slice(0, 400)); return; }

  console.log("idioma:", data.language, "| filtrado por variante:", data.variant ?? "(no)");
  console.log("tracks devueltos:", data.tracks?.length ?? 0);
  (data.tracks ?? []).forEach((t, i) => {
    console.log(`  ${i}. ${t.label} / ${t.variant} / ${(t.levels ?? []).map((l) => l.id).join("+").toUpperCase()}`);
  });
  const primero = data.tracks?.[0];
  console.log("\n>>> tracks[0], que es lo que coge su app:",
    primero ? `${primero.label} / ${primero.variant} / ${(primero.levels ?? []).map((l) => l.id).join("+").toUpperCase()}` : "NINGUNO");
  const historia = primero?.levels?.[0]?.topics?.[0]?.stories?.[0];
  console.log(">>> primera historia:", historia?.title ?? "?");
}
main();
