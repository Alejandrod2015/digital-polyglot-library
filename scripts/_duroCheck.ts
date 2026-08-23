import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
const J = "cmt0a8vb1000m32p1x7r5ba28";
const SEP = ["an","auf","aus","ein","nach","vor","zu","ab","mit","bei"];
const COM = ["ge","ver","be","er","ent"];
const ART = ["der ","die ","das "];
function stripPrefix(w: string) {
  let l = w.toLowerCase();
  for (const a of ART) if (l.startsWith(a)) { l = l.slice(a.length); break; }
  for (const q of [...SEP, ...COM]) if (l.startsWith(q) && l.length > q.length + 3) return l.slice(q.length);
  return l;
}
const lema = (w: string) => stripPrefix(w).normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
(async () => {
  const mio = await p.journey.findUnique({ where: { id: J }, select: { language: true, typeSlug: true } });
  const otras = await p.journeyStory.findMany({
    where: { journey: { language: mio!.language, status: { not: "archived" } }, journeyId: { not: J } },
    select: { vocab: true, journey: { select: { typeSlug: true } } } });
  const duroExterno = new Set<string>();
  for (const r of otras) if (r.journey?.typeSlug === mio!.typeSlug)
    for (const v of ((r.vocab as any[]) ?? [])) if (v?.word) duroExterno.add(lema(String(v.word)));
  const data = JSON.parse(fs.readFileSync("/tmp/de-a0-all.json", "utf8"));
  const s21 = data[20];
  console.log("historia:", s21.title);
  const flag = s21.vocab.map((v: any) => v.word).filter((w: string) => duroExterno.has(lema(w)));
  console.log("choca con OTROS journeys del mismo tipo:", flag.length ? flag.join(", ") : "ninguna");
  console.log("el validador marcó: die Hütte, der Kreis, zählen, leise, das Fenster, draußen");
  // ¿alguna de las marcadas está en otra historia MIA?
  const mias = new Map<string, string[]>();
  for (const s of data) for (const v of (s.vocab ?? []))
    mias.set(lema(v.word), [...(mias.get(lema(v.word)) ?? []), s.title]);
  for (const w of ["die Hütte","der Kreis","zählen","leise","das Fenster","draußen"])
    console.log(`  ${w} -> lema "${lema(w)}" · externo=${duroExterno.has(lema(w))} · mias=${(mias.get(lema(w))??[]).length}`);
  await p.$disconnect();
})();
