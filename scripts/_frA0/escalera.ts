// Escalera de recirculacion del journey entero, SOLO LECTURA: llama al checker
// de conjunto sobre las historias escritas (JSON locales) sin tocar el registro.
//   npx tsx scripts/_frA0/escalera.ts
import fs from "fs";
import { validateJourneyStories } from "@/lib/validateJourneyStories";
const temas = ["t1", "t2", "t3", "t4", "t5", "t6"];
const stories = temas.flatMap((t) => JSON.parse(fs.readFileSync(`scripts/_frA0/${t}.json`, "utf8")))
  .map((s: any) => ({ slug: `${s.topic}#${s.slotIndex}`, title: s.title, text: s.text, vocab: s.vocab, language: "FR", level: "a0", topic: s.topic }));
const jc = validateJourneyStories(stories as never, { language: "FR", level: "a0", conjuntoCompleto: true });
for (const c of jc.filter((c: any) => /recirculation|introduction-form|closing|cast-/.test(c.id)))
  console.log(`${c.status.padEnd(8)} [${c.id}] ${c.detail ?? ""}`);
// Por plaza portable: en cuantas OTRAS historias aparece su superficie.
const low = stories.map((s: any) => s.text.toLowerCase());
const solos: string[] = []; let n = 0, suma = 0;
stories.forEach((s: any, i: number) => {
  for (const v of s.vocab ?? []) {
    if (v.anchor) continue;
    n++;
    const sf = String(v.surface).toLowerCase();
    const re = new RegExp(`(?<!\\p{L})${sf.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\p{L})`, "u");
    const otras = low.filter((t, j) => j !== i && re.test(t)).length;
    suma += otras;
    if (otras === 0) solos.push(sf);
  }
});
console.log(`\nmi medida (superficie literal): ${n} portables · media ${(suma / n).toFixed(2)} encuentros en otras historias · ${solos.length} (${Math.round(100 * solos.length / n)}%) sin ningun reencuentro`);
