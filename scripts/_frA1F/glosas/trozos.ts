// SOLO LECTURA. Trocea las 21 historias (titulo + cuerpo, texto de la base) en
// trozos de contexto: la frase partida por comillas y puntuacion fuerte, de modo
// que todas las palabras de un trozo compartan su traduccion.
//   npx tsx scripts/_frA1F/glosas/trozos.ts > scripts/_frA0/glosas/trozos.json
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../../src/generated/prisma";
import { extractStoryPlainText } from "../../../src/lib/storyPlainText";
const p = new PrismaClient();
(async () => {
  const b = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: "french-friends-france-a1", slug: "" } } });
  const st = await p.journeyStory.findMany({ where: { slug: { in: b!.slugs } }, select: { slug: true, title: true, text: true } });
  st.sort((x, y) => b!.slugs.indexOf(x.slug!) - b!.slugs.indexOf(y.slug!));
  const out: Record<string, string[]> = {};
  for (const s of st) {
    const txt = `${s.title}\n${extractStoryPlainText(s.text ?? "")}`;
    const trozos = txt.split(/[“”\n]|(?<=[.!?:;])\s+/).map((t) => t.replace(/^[\s,.;:!?]+|[\s,]+$/g, "").trim()).filter((t) => /\p{L}/u.test(t));
    out[s.slug!] = [...new Set(trozos)];
  }
  const n = Object.values(out).reduce((a, x) => a + x.length, 0);
  console.error(`${st.length} historias · ${n} trozos`);
  console.log(JSON.stringify(out, null, 1));
  await p.$disconnect();
})();
