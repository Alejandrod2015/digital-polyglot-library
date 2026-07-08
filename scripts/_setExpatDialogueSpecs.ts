/**
 * Asigna dialogueSpec + voiceId a las historias del journey Expat C1 que NO
 * tienen audio todavía (audioStatus != ready). NO genera audio.
 *
 * Parser "known-speaker": una línea es turno de personaje SOLO si el nombre
 * antes de ": " está en VOICE_MAP; si no (p.ej. "Im Wohnzimmer: ...",
 * "Abends: ...") se trata como narrador y la línea completa se preserva.
 *
 * Usage: tsx scripts/_setExpatDialogueSpecs.ts --dry-run | --apply
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const JOURNEY_ID = "cmr92f0qz000032ff1dfd4fgx";
const V = {
  moritz: "Ww7Sq9tx9CCOiNOwWgsx", ela_warm: "SJJe86Va82zRzg6zi2dX", marius: "JDXBO1etYlVlJZRMoYzH",
  ela_calm: "e3bIMyLemdwvh75g9Vpt", enniah: "WHaUUVTDq47Yqc9aDbkH", daien: "9iYBWBbTzTDIt6imiMxp",
  ela_cheer: "NE7AIW5DoJ7lUosXV2KR", ben_de: "MMwckqU477oQxnAk1SgA", charlie: "vmVmHDKBkkCgbLVIOJRb",
};
// displayName (lowercase) → voiceId. Cast fijo + one-offs del pool, elegidos
// para que NO se repita una voz entre dos personajes de la misma historia.
const VOICE_MAP: Record<string, string> = {
  narrator: V.moritz,
  nadia: V.ela_warm, timo: V.marius, katja: V.enniah, brandt: V.ela_calm,
  ronja: V.daien, mira: V.ela_cheer,
  // one-offs masculinos
  lindner: V.ben_de, menzel: V.ben_de, jonas: V.ben_de, wollny: V.ben_de,
  paul: V.ben_de, petzold: V.ben_de, pohl: V.ben_de, kaminski: V.charlie,
  // one-offs femeninas / oficiales
  lea: V.daien, beamtin: V.daien, neumann: V.ela_calm, siebert: V.ela_calm,
  kern: V.ela_cheer, apothekerin: V.ela_calm,
};
const SPEAKER_RE = /^\s*([\p{Lu}][\p{L}\p{M}.'-]*(?:\s+[\p{Lu}][\p{L}\p{M}.'-]*){0,3})\s*:\s+(.*\S)\s*$/u;

function parse(text: string) {
  const lines = text.replace(/<[^>]+>/g, " ").split(/\r?\n/).map((l) => l.trim());
  const segs: { speaker: string; text: string; voice: string }[] = [];
  let buf: string[] = [];
  const flush = () => { const t = buf.join(" ").replace(/\s+/g, " ").trim(); if (t) segs.push({ speaker: "narrator", text: t, voice: V.moritz }); buf = []; };
  for (const line of lines) {
    if (!line) continue;
    const m = line.match(SPEAKER_RE);
    const name = m ? m[1].trim().toLowerCase() : null;
    if (m && name && VOICE_MAP[name]) { flush(); segs.push({ speaker: m[1].trim(), text: m[2].trim(), voice: VOICE_MAP[name] }); }
    else buf.push(line); // narrador (incluye falsos positivos "Im Wohnzimmer:")
  }
  flush();
  return segs;
}

(async () => {
  const apply = process.argv.includes("--apply");
  if (!apply && !process.argv.includes("--dry-run")) { console.error("pass --dry-run or --apply"); process.exit(1); }
  const prisma = new PrismaClient();
  const rows = await prisma.journeyStory.findMany({ where: { journeyId: JOURNEY_ID, status: "published" },
    select: { id: true, slug: true, text: true, audioStatus: true } }) as any[];
  const nameToVoice = Object.entries(V).reduce((a, [k, v]) => (a[v] = k, a), {} as Record<string, string>);
  let n = 0;
  for (const r of rows) {
    if (r.audioStatus === "ready") { console.log(`  SKIP ${r.slug} (audio ready)`); continue; }
    const spec = parse(r.text || "");
    const cast = [...new Set(spec.filter((s) => s.speaker !== "narrator").map((s) => `${s.speaker}=${nameToVoice[s.voice]}`))];
    console.log(`  ${apply ? "SET " : "DRY "} ${r.slug}: ${spec.length} segs | ${cast.join(", ")}`);
    if (apply) await prisma.journeyStory.update({ where: { id: r.id }, data: { dialogueSpec: spec as any, voiceId: V.moritz } });
    n++;
  }
  console.log(`\n${apply ? "" : "[dry] "}${n} historias`);
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
