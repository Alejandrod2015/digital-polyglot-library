/** Las palabras tocables SIN ningun trozo (lo que canta `gloss-context`) son,
 *  en este journey de dialogo, oraciones de UNA palabra dentro de un turno de
 *  varias: "Si." en "Si. Y sin mayuscula.". El trozo es el TURNO entero, que
 *  si tiene contexto. Medido el 2026-09-23: 36 de 36, ni una era un turno de
 *  una sola palabra.
 *
 *    plantilla <fichero>   saca {slug:{palabra:{es,en}}} con el turno por traducir
 *    (para escribir: glossContextChunks.ts palabras <bundle> <fichero>)
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
import { extractStoryPlainText } from "../../src/lib/storyPlainText";
import { glossOccurrences } from "../../src/lib/tapGlossChunk";

const B = "spanish-conversations-latam-a0";
const prisma = new PrismaClient();

/** La linea donde cae `at`, sin la etiqueta del hablante. */
function turno(texto: string, at: number): string {
  const ini = texto.lastIndexOf("\n", at) + 1;
  const fin = texto.indexOf("\n", at);
  const linea = texto.slice(ini, fin < 0 ? undefined : fin);
  return linea.replace(/^\s*[\p{Lu}][\p{L}]*\s*:\s*/u, "").trim();
}

(async () => {
  const fichero = process.argv[3];
  if (process.argv[2] !== "plantilla" || !fichero) throw new Error("uso: cierraSueltas.ts plantilla <fichero>");
  const rows = await prisma.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, glosses: true } });
  const global = rows.find((r) => r.slug === "")!.glosses as Record<string, unknown>;
  const st = await prisma.journeyStory.findMany({
    where: { slug: { in: rows.filter((r) => r.slug).map((r) => r.slug) } },
    select: { slug: true, title: true, text: true },
  });
  const T = new Map(st.map((s) => [s.slug, `${s.title ?? ""}\n${extractStoryPlainText(s.text ?? "")}`]));
  const previo: Record<string, Record<string, { es: string; en: string }>> =
    fs.existsSync(fichero) ? JSON.parse(fs.readFileSync(fichero, "utf8")) : {};
  const out: Record<string, Record<string, { es: string; en: string }>> = {};
  let n = 0;
  for (const r of rows) {
    if (!r.slug) continue;
    const t = T.get(r.slug);
    if (!t) continue;
    const capa = (r.glosses ?? {}) as Record<string, { c?: { es?: string } }>;
    for (const w of Object.keys(global)) {
      const ocs = glossOccurrences(w, t);
      if (!ocs.length) continue;
      if (capa[w]?.c?.es) continue;
      const es = turno(t, ocs[0].at);
      out[r.slug] ??= {};
      out[r.slug][w] = { es, en: previo[r.slug]?.[w]?.en ?? "" };
      n++;
    }
  }
  fs.writeFileSync(fichero, JSON.stringify(out, null, 1) + "\n");
  const faltan = Object.values(out).flatMap((o) => Object.values(o)).filter((v) => !v.en).length;
  console.log(`${n} palabra(s) sin trozo en ${Object.keys(out).length} historia(s) · sin traducir: ${faltan}`);
})().catch((e) => { console.error("FALLO:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
