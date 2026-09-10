/** Estado del journey antes de narrar: status, historias, audioUrl y voces asignadas. Solo lee. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const J = process.argv[2];
  const j = await p.journey.findUnique({ where: { id: J } });
  const { ...cab } = j as any;
  console.log("journey:", JSON.stringify(Object.fromEntries(Object.entries(cab).filter(([k, v]) => !/cover|image/i.test(k) && (typeof v !== "object" || v === null)))));
  const rows = await p.journeyStory.findMany({ where: { journeyId: J } });
  const campos = Object.keys(rows[0] ?? {});
  console.log("historias:", rows.length, "· campos:", campos.join(","));
  const voz = campos.filter((c) => /voice|voz|narrat|audio|cast/i.test(c));
  for (const r of rows as any[]) console.log(r.slug, r.status, voz.map((c) => `${c}=${JSON.stringify(r[c])?.slice(0, 90)}`).join(" · "));
  await p.$disconnect();
})();
