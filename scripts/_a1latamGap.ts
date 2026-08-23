/** Que superficies enseñadas del journey NO estan en cada cuerpo, para
 *  poder recircularlas a mano. Solo lectura. */
import * as fs from "fs";
const stories = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as any[];
const tok = (t: string) => new Set(t.toLowerCase().match(/\p{L}+/gu) ?? []);
const sup = [...new Set(stories.flatMap((s) => s.vocab.map((v: any) => String(v.surface ?? v.word).toLowerCase())).filter((k: string) => !/\s/.test(k)))] as string[];
for (const s of stories) {
  const c = tok(s.text);
  const hay = sup.filter((k) => c.has(k));
  const no = sup.filter((k) => !c.has(k));
  console.log(`\n### ${s.topic}#${s.slotIndex}  presentes ${hay.length}`);
  console.log("   AUSENTES: " + no.join(" "));
}
