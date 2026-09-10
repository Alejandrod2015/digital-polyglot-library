/** Preterito medido con limites Unicode (la sonda canonica usa \b sin /u y no ve ninguna forma en -ó). */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { readFileSync } from "fs";
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const PRET = /(?<![\p{L}])[\p{L}]+(ó|aron|ieron)(?![\p{L}])|(?<![\p{L}])(fue|fueron|tuvo|hizo|dijo|vino|dio|puso|quiso)(?![\p{L}])/giu;
const NO = new Set(["no", "yo", "como", "solo", "algo", "cuando", "donde", "mismo", "todo", "otro", "poco", "mucho", "nuevo", "claro", "cierto", "este", "ese", "aquello", "dinero", "lado", "rato", "trabajo", "sitio", "ahí", "adió", "ó"]);
const med = (t: string) => {
  const fr = t.replace(/\n+/g, " ").split(/(?<=[.!?”"])\s+/).filter((x) => x.trim().length > 1).length;
  const n = (t.match(PRET) ?? []).filter((w) => !NO.has(w.toLowerCase()) && !/^(allí|aquí|así|está|será)$/i.test(w)).length;
  return `${Math.round((100 * n) / fr)} por 100 (${fr} or.)`;
};
(async () => {
  for (const f of ["scripts/_b2s/retit/b2-t1-locals-and-outsiders.json", "scripts/_b2s/piloto/t1.json"])
    console.log(f.split("/").pop(), "->", med(JSON.parse(readFileSync(f, "utf8")).map((s: any) => s.text).join("\n")));
  for (const [id, n] of [["cmrdqk484000032r4rt2vw4ej", "C1 Friends latam live"], ["cmrpm0tra000032vgxcs33wrb", "C1 Friends colombia live"], ["cmt70xfyt000l3283gxd70wck", "A2 Traveler spain live"]]) {
    const st = await p.journeyStory.findMany({ where: { journeyId: id }, select: { text: true } });
    console.log(n, "->", med(st.map((s) => s.text ?? "").join("\n")));
  }
  await p.$disconnect();
})();
