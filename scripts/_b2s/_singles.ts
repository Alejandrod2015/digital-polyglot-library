import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const db = await p.journeyStory.findMany({ where: { journeyId: "cmtpls1l20007j8epwgcs6e1h", text: { not: "" } }, select: { slug: true, topic: true, text: true, vocab: true } });
  const t7 = JSON.parse(fs.readFileSync("scripts/_b2/t7.json", "utf8")) as any[];
  const all = [...db.map(s => ({ slug: s.slug!, topic: s.topic, text: s.text!, vocab: (s.vocab as any[]) ?? [] })), ...t7.map((s: any) => ({ slug: s.slug, topic: s.topic, text: s.text, vocab: s.vocab }))];
  const tok = (t: string) => new Set(t.toLowerCase().match(/\p{L}+/gu) ?? []);
  const cuerpos = all.map(s => tok(s.text));
  const textos = all.map(s => s.text.toLowerCase());
  const clave = (v: any) => String(v.surface ?? v.word).toLowerCase().replace(/^(el|la)\s+/, "");
  const enc = (v: any) => {
    const k = clave(v);
    if (!k.includes(" ")) return cuerpos.filter(c => c.has(k)).length;
    const lema = String(v.word).toLowerCase();
    return textos.filter(t => t.includes(k) || t.includes(lema)).length;
  };
  const singles: string[] = [];
  for (const s of all) for (const v of s.vocab) {
    if (!v.anchor && enc(v) <= 1) singles.push(`${s.topic.slice(0,14)}\t${v.word}\t[${v.surface ?? v.word}]`);
  }
  console.log("portables con 1 encuentro:", singles.length);
  console.log(singles.join("\n"));
  await p.$disconnect();
})();
