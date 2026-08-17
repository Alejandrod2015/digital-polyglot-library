// Llama al endpoint REAL /api/mobile/journey con un token de sesión firmado,
// contra el servidor local (misma base que producción). Así se ve la respuesta
// que recibe la app, en vez de suponer. Solo lee.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import Module from "module";
const orig = (Module as unknown as { _load: (...a: unknown[]) => unknown })._load;
(Module as unknown as { _load: (...a: unknown[]) => unknown })._load = function (r: string, ...rest: unknown[]) {
  if (r === "server-only") return {};
  return orig.call(this, r, ...rest);
} as typeof orig;

const BASE = process.env.DPL_PROBE_URL ?? "http://localhost:3001";

async function main() {
  const { createMobileSessionToken } = await import("../src/lib/mobileSession");
  // Un usuario cualquiera: el endpoint no filtra por plan, y pasamos el idioma
  // por query igual que hace el picker de la app.
  const token = createMobileSessionToken({
    userId: "probe_user_diagnostico",
    email: null,
    targetLanguages: ["Spanish"],
  });

  for (const lang of ["Portuguese", "Spanish"]) {
    const url = `${BASE}/api/mobile/journey?language=${encodeURIComponent(lang)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const body = await res.text();
    console.log(`\n── ${lang} → HTTP ${res.status}`);
    if (!res.ok) {
      console.log("   ", body.slice(0, 200));
      continue;
    }
    const data = JSON.parse(body) as {
      language?: string;
      tracks?: Array<{ id: string; name?: string; variant: string | null; levels: Array<{ topics: Array<{ stories: unknown[] }> }> }>;
    };
    console.log(`   language devuelto: ${data.language}`);
    console.log(`   tracks: ${data.tracks?.length ?? 0}`);
    for (const t of data.tracks ?? []) {
      const historias = t.levels.reduce((n, l) => n + l.topics.reduce((m, tp) => m + tp.stories.length, 0), 0);
      console.log(`     · ${t.name ?? "(sin name)"} variant=${JSON.stringify(t.variant)} historias=${historias}`);
    }
  }
}
main().catch((e) => {
  console.error("FALLÓ:", e instanceof Error ? e.message : e);
  process.exit(1);
});
