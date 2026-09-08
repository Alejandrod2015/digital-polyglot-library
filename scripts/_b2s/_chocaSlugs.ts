import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: "cmtplpfum0007j8c6piegwt31" }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }], select: { id: true, topic: true, slotIndex: true, title: true, slug: true } });
  const nuevos = st.map((s) => ({ ...s, nuevo: slugify(s.title!) }));
  const lista = nuevos.map((n) => n.nuevo);
  if (new Set(lista).size !== lista.length) console.log("DUP INTERNO:", lista);
  const js = await p.journeyStory.findMany({ where: { slug: { in: lista } }, select: { slug: true, journeyId: true } });
  const gs = await p.tapGlossSet.findMany({ where: { slug: { in: lista } }, select: { bundle: true, slug: true } });
  for (const n of nuevos) {
    const cj = js.filter((x) => x.slug === n.nuevo);
    const cg = gs.filter((x) => x.slug === n.nuevo);
    console.log(n.topic.padEnd(24), n.slug?.padEnd(28), "->", n.nuevo.padEnd(28), cj.length ? `CHOQUE journeyStory ${cj.map((c) => c.journeyId)}` : "", cg.length ? `CHOQUE tapGlossSet ${cg.map((c) => c.bundle)}` : "");
  }
  // muestras registradas con slug viejo
  await p.$disconnect();
})();
