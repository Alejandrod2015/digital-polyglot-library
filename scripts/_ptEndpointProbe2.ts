import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import Module from "module";
const orig = (Module as unknown as { _load: (...a: unknown[]) => unknown })._load;
(Module as unknown as { _load: (...a: unknown[]) => unknown })._load = function (r: string, ...rest: unknown[]) {
  if (r === "server-only") return {};
  return orig.call(this, r, ...rest);
} as typeof orig;
import { createClerkClient } from "@clerk/backend";

const BASE = process.env.DPL_PROBE_URL ?? "http://localhost:3001";

async function main() {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY ?? "" });
  const list = await clerk.users.getUserList({ limit: 3 });
  const u = list.data[0];
  if (!u) throw new Error("no hay usuarios en esta instancia de Clerk");
  console.log(`usando userId real de la instancia local: ${u.id} (${u.primaryEmailAddress?.emailAddress ?? "sin email"})`);

  const { createMobileSessionToken } = await import("../src/lib/mobileSession");
  const token = createMobileSessionToken({ userId: u.id, targetLanguages: ["Spanish"] });

  for (const lang of ["Portuguese", "Spanish"]) {
    const res = await fetch(`${BASE}/api/mobile/journey?language=${encodeURIComponent(lang)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.text();
    console.log(`\n── ${lang} → HTTP ${res.status}`);
    if (!res.ok) { console.log("   ", body.slice(0, 300)); continue; }
    const data = JSON.parse(body) as { language?: string; tracks?: Array<{ id: string; label?: string; variant: string | null; levels: Array<{ topics: Array<{ stories: unknown[] }> }> }> };
    console.log(`   language: ${data.language} · tracks: ${data.tracks?.length ?? 0}`);
    for (const t of data.tracks ?? []) {
      const h = t.levels.reduce((n, l) => n + l.topics.reduce((m, tp) => m + tp.stories.length, 0), 0);
      console.log(`     · label=${JSON.stringify(t.label)} variant=${JSON.stringify(t.variant)} historias=${h}`);
    }
  }
}
main().catch((e) => { console.error("FALLÓ:", e instanceof Error ? e.message : e); process.exit(1); });
