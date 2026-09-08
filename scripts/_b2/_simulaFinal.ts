/** Estado FINAL del journey: historias de la base con el vocab de los 7 JSON. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
import { validateJourneyStories } from "../../src/lib/validateJourneyStories";
const p = new PrismaClient();
(async () => {
  const rows = await p.journeyStory.findMany({
    where: { journeyId: "cmtpls1l20007j8epwgcs6e1h" },
    select: { slug: true, title: true, text: true, vocab: true, arcType: true, synopsis: true, topic: true, slotIndex: true },
  });
  const nuevas = new Map<string, any>();
  for (const t of ["t1","t2","t3","t4","t5","t6","t7"]) {
    const arr = JSON.parse(fs.readFileSync(`scripts/_b2/${t}.json`, "utf8")) as any[];
    for (const s of arr) nuevas.set(`${s.topic}#${s.slotIndex}`, s);
  }
  const todas = rows.map((r) => {
    const n = nuevas.get(`${r.topic}#${r.slotIndex}`);
    return { slug: n?.slug ?? r.slug, title: n?.title ?? r.title, text: n?.text ?? r.text,
      language: "spanish", level: "b2", vocab: (n?.vocab ?? r.vocab) as any,
      arcType: n?.arcType ?? r.arcType, synopsis: n?.synopsis ?? r.synopsis, topic: r.topic, slotIndex: r.slotIndex } as any;
  });
  const jc = validateJourneyStories(todas, { language: "ES", level: "b2", conjuntoCompleto: true, journeyType: "traveler" });
  for (const c of jc) console.log(`${c.status === "pass" ? "ok  " : c.status.toUpperCase()} [${c.id}] ${c.status === "pass" ? "" : (c.detail ?? "")}`);
  await p.$disconnect();
})();
