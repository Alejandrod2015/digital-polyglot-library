/**
 * Prepara el paquete de lookup del Traveler ES/spain A2.
 *
 *   --plan     : cuantos tokens hay, cuantos se pueden copiar de un paquete
 *                hermano de espanol y cuantos hay que escribir.
 *   --faltan N : vuelca los que NO existen en ningun paquete, con su frase.
 *   --copias N : vuelca los COPIADOS con la frase de ESTA historia al lado,
 *                que es lo que pide `feedback_gloss_in_context`.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const TAPPABLE = /\p{L}+(?:-\p{L}+)*/gu;
const HERMANOS = [
  "spanish-friends-spain-a0", "spanish-traveler-latam", "spanish-friends",
  "spanish-friends-colombia", "spanish-friends-argentina", "spanish-traveler-mexico-a0",
  "spanish-friends-mexico", "talking-points-es",
];

(async () => {
  const st = await p.journeyStory.findMany({
    where: { journeyId: "cmt70xfyt000l3283gxd70wck" },
    select: { slug: true, title: true, text: true, topic: true, slotIndex: true },
  });
  const frases: Array<[string, string]> = [];
  const orden: string[] = [];
  const vistos = new Set<string>();
  for (const s of st) {
    for (const f of `${s.title}. ${s.text}`.split(/(?<=[.!?”])\s+/).map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean)) {
      frases.push([s.slug!, f]);
      for (const m of f.matchAll(TAPPABLE)) {
        const k = m[0].toLowerCase();
        if (!vistos.has(k)) { vistos.add(k); orden.push(k); }
      }
    }
  }
  const banco = new Map<string, { g: string; t: string; de: string }>();
  for (const h of HERMANOS) {
    const raw = JSON.parse(fs.readFileSync(`src/data/tapGlosses/${h}.json`, "utf8"));
    const g: Record<string, any> = raw.glosses ?? raw;
    for (const [k, v] of Object.entries(g)) {
      if (banco.has(k)) continue;
      banco.set(k, { g: typeof v === "string" ? v : v.g, t: typeof v === "string" ? "other" : (v.t ?? "other"), de: h });
    }
  }
  const frase = (k: string) => {
    const re = new RegExp(`(?<!\\p{L})${k.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}(?!\\p{L})`, "iu");
    return frases.find(([, f]) => re.test(f))?.[1] ?? "(?)";
  };
  const copiables = orden.filter((k) => banco.has(k));
  const faltan = orden.filter((k) => !banco.has(k));
  const arg = (n: string, d: number) => { const i = process.argv.indexOf(n); return i > 0 ? Number(process.argv[i + 1]) : d; };
  if (process.argv.includes("--plan") || process.argv.length <= 2) {
    console.log(`${orden.length} tokens distintos en 21 historias`);
    console.log(`  copiables de un paquete hermano: ${copiables.length}`);
    console.log(`  hay que escribirlos:             ${faltan.length}`);
  }
  if (process.argv.includes("--faltan")) {
    const from = arg("--from", 0), n = arg("--faltan", 60);
    for (const k of faltan.slice(from, from + n)) console.log(`${k}\t${frase(k).slice(0, 100)}`);
    console.log(`[${from}-${Math.min(from + n, faltan.length)} de ${faltan.length}]`);
  }
  if (process.argv.includes("--copias")) {
    const from = arg("--from", 0), n = arg("--copias", 60);
    for (const k of copiables.slice(from, from + n)) {
      const b = banco.get(k)!;
      console.log(`${k}\t${b.g}\t${b.t}\t${frase(k).slice(0, 90)}`);
    }
    console.log(`[${from}-${Math.min(from + n, copiables.length)} de ${copiables.length}]`);
  }
})().finally(() => p.$disconnect());
