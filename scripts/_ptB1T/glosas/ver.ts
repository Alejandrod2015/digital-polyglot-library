// SOLO LECTURA. Titulo + texto actual de una historia del PT B1 Traveler.
//   npx tsx scripts/_ptB1T/glosas/ver.ts <slug> [palabra...]  (con palabras: su entrada de capa y la global)
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const [slug, ...ws] = process.argv.slice(2);
  const s = await p.journeyStory.findFirst({ where: { journeyId: "cmtrcpgso00073232h8vaf7na", slug }, select: { title: true, text: true } });
  if (!ws.length) { console.log(`# ${s!.title}\n${s!.text}`); }
  const B = "portuguese-traveler-brazil-b1";
  const g = (await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: "" } } }))!.glosses as any;
  const c = (await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } }))!.glosses as any;
  for (const w of ws) console.log(w, "\n  capa:", JSON.stringify(c[w]), "\n  global:", JSON.stringify(g[w]));
  await p.$disconnect();
})();
