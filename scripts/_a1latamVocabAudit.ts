/** Audita TODO el vocab de uno o varios ficheros de historias del A1 latam:
 *  nivel A1, ban duro (mismo tipo), ban blando (otros tipos) y repetidos
 *  dentro del propio lote. Solo lectura. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { createRequire } from "module";
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const __req = createRequire(__filename);
try { const sp = __req.resolve("server-only"); (__req as any).cache[sp] = { id: sp, filename: sp, loaded: true, exports: {} }; } catch {}
const p = new PrismaClient();
const norm = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
(async () => {
  const { filterSpanishWordsAtOrBelow } = await import("../src/lib/cefr/spanishLevelJudge");
  const files = process.argv.slice(2);
  const stories = files.flatMap((f) => JSON.parse(fs.readFileSync(f, "utf8")));
  const js = await p.journey.findMany({ where: { language: "spanish", status: { not: "archived" } } });
  const dura = new Set<string>(); const blanda = new Set<string>();
  for (const j of js) {
    const st = await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { vocab: true } });
    const dest = j.typeSlug === "traveler" ? dura : blanda;
    for (const s of st) for (const v of ((s.vocab as any[]) ?? [])) if (v?.word) dest.add(norm(String(v.word)));
  }
  const todas = stories.flatMap((s: any) => s.vocab.map((v: any) => v.word));
  const vistas = new Map<string, string[]>();
  for (const s of stories as any[]) for (const v of s.vocab) {
    const k = norm(v.word);
    vistas.set(k, [...(vistas.get(k) ?? []), `${s.topic}#${s.slotIndex}`]);
  }
  const noExpr = stories.flatMap((s: any) => s.vocab.filter((v: any) => (v.type ?? "") !== "expression" && !["slang","colloquial","vulgar","coloquial","argot","jerga","cultural","realia"].includes(String(v.register ?? "").toLowerCase())).map((v: any) => v.word));
  const { aboveLevel } = await filterSpanishWordsAtOrBelow(noExpr, "a1");
  const bad = new Map(aboveLevel.map((a) => [a.word, a.judgedLevel]));
  for (const s of stories as any[]) {
    const probl: string[] = [];
    let softs = 0;
    for (const v of s.vocab) {
      const k = norm(v.word);
      const f: string[] = [];
      if (dura.has(k)) f.push("BAN-DURO");
      else if (blanda.has(k)) { f.push("blando"); softs++; }
      if (bad.has(v.word)) f.push(`NIVEL-${String(bad.get(v.word)).toUpperCase()}`);
      if ((vistas.get(k)?.length ?? 0) > 1) f.push(`REPE:${vistas.get(k)!.join(",")}`);
      if (f.length) probl.push(`${v.word} [${f.join(" ")}]`);
    }
    const raiz = new Map<string, string[]>();
    for (const v of s.vocab) { const r = norm(v.word).slice(0,5); raiz.set(r, [...(raiz.get(r) ?? []), v.word]); }
    const dup = [...raiz].filter(([,w]) => w.length > 1);
    console.log(`\n### ${s.topic}#${s.slotIndex} ${s.title}  (blandos ${softs}/2)`);
    if (probl.length) probl.forEach((x) => console.log("   " + x));
    if (dup.length) console.log("   MISMA RAIZ: " + dup.map(([,w]) => w.join("+")).join("; "));
    if (!probl.length && !dup.length) console.log("   limpio");
  }
  await p.$disconnect();
})();
