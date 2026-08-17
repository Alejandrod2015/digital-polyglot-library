import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import fs from "fs";
import path from "path";

const OUT = "/private/tmp/claude-501/-Users-alejandrodelcarpio-digital-polyglot-library/9863ed55-f2a4-4547-bfbb-dd5b615ec0d3/scratchpad/voices";
const KEY = process.env.ELEVENLABS_API_KEY;

type Shared = {
  voice_id: string;
  name: string;
  accent?: string;
  gender?: string;
  age?: string;
  descriptive?: string;
  use_case?: string;
  language?: string;
  preview_url?: string;
  cloned_by_count?: number;
  free_users_allowed?: boolean;
};

async function fetchPage(params: Record<string, string>): Promise<Shared[]> {
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`https://api.elevenlabs.io/v1/shared-voices?${qs}`, {
    headers: { "xi-api-key": KEY! },
  });
  if (!r.ok) {
    console.error("HTTP", r.status, (await r.text()).slice(0, 200));
    return [];
  }
  const j = (await r.json()) as { voices?: Shared[] };
  return j.voices ?? [];
}

async function main() {
  if (!KEY) { console.error("falta ELEVENLABS_API_KEY"); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });

  // Varias consultas: la metadata de acento es poco fiable, así que barremos
  // por búsqueda libre y por filtro de acento, y deduplicamos.
  const queries: Record<string, string>[] = [
    { page_size: "100", language: "es", search: "mexican" },
    { page_size: "100", language: "es", search: "mexicano" },
    { page_size: "100", language: "es", accent: "mexican" },
    { page_size: "100", language: "es", search: "méxico" },
  ];

  const seen = new Map<string, Shared>();
  for (const q of queries) {
    const list = await fetchPage(q);
    for (const v of list) if (!seen.has(v.voice_id)) seen.set(v.voice_id, v);
    console.log(`consulta ${JSON.stringify(q.search ?? q.accent)} -> ${list.length}`);
  }

  const all = [...seen.values()].filter((v) => v.preview_url);
  console.log(`\nvoces únicas con preview: ${all.length}`);
  fs.writeFileSync(path.join(OUT, "voices.json"), JSON.stringify(all, null, 1));

  // Descargar los previews (gratis, no es síntesis)
  let ok = 0;
  for (const v of all) {
    const f = path.join(OUT, `${v.voice_id}.mp3`);
    if (fs.existsSync(f)) { ok++; continue; }
    try {
      const r = await fetch(v.preview_url!);
      if (!r.ok) continue;
      fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
      ok++;
    } catch { /* ignorar */ }
  }
  console.log(`previews descargados: ${ok}/${all.length}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
