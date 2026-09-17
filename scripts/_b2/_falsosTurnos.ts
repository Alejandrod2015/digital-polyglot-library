import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const hs = await p.journeyStory.findMany({ where: { journeyId: "cmtpls1l20007j8epwgcs6e1h" }, select: { slug: true, text: true } });
  let n = 0;
  for (const s of hs) {
    const m = s.text.match(/^\s*[A-ZÁÉÍÓÚÑÜ][\wáéíóúñçüö' ]{1,20}:\s/gm) ?? [];
    if (m.length) { console.log(s.slug, m); n++; }
  }
  console.log(n ? `${n} historia(s) con turno falso` : "0 turnos falsos en las 21");
  await p.$disconnect();
})();
