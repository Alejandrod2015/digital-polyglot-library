/** Aplica la capa de un tema reescrito: trozo nuevo sobre (global + entrada existente), para toda clave
 *  del fichero; despues poda lo que ya no es tocable ni clave del vocab. No se niega por las claves de
 *  lema que no estan en la global (writeGlossLayer tumba el fichero entero por eso). */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { readFileSync } from "fs";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2", J = "cmtplpfum0007j8c6piegwt31";
const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
(async () => {
  const [temaJson, capaJson] = process.argv.slice(2);
  const capa = JSON.parse(readFileSync(capaJson, "utf8")) as Record<string, Record<string, { es: string; en: string }>>;
  const glob = (await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: "" } } }))!.glosses as Record<string, any>;
  for (const s of JSON.parse(readFileSync(temaJson, "utf8"))) {
    const slug = slugify(s.title);
    const h = await p.journeyStory.findFirst({ where: { slug, journeyId: J }, select: { title: true, text: true, vocab: true } });
    if (!h || h.text !== s.text) throw new Error(`${slug}: la base no tiene el texto del fichero; guarda antes de aplicar la capa`);
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } });
    const g = { ...(fila!.glosses as Record<string, any>) };
    const vocab = ((h.vocab as any[]) ?? []);
    let sinG = 0;
    for (const [k, c] of Object.entries(capa[slug] ?? {})) {
      const e = { ...(glob[k] ?? {}), ...(g[k] ?? {}), c };
      if (!e.g) { const v = vocab.find((x) => String(x.word).toLowerCase() === k); if (v) { e.g = String(v.definition).split(";")[0]; e.t = v.type; sinG++; } }
      if (!e.g) throw new Error(`${slug}/${k}: sin glosa en ningun sitio`);
      g[k] = e;
    }
    const tokens = new Set((`${h.title} ${h.text}`.match(/\p{L}[\p{L}\p{M}'-]*/gu) ?? []).map((w) => w.toLowerCase()));
    const claves = new Set(vocab.flatMap((v) => [String(v.word).toLowerCase(), String(v.surface ?? "").toLowerCase()]).filter(Boolean));
    const fuera = Object.keys(g).filter((k) => !tokens.has(k) && !claves.has(k));
    for (const k of fuera) delete g[k];
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: g } });
    console.log(`${slug}: ${Object.keys(capa[slug] ?? {}).length} trozos · ${sinG} glosas de lema tomadas de la definicion · podadas ${fuera.length}: ${fuera.join(", ")}`);
  }
  await p.$disconnect();
})();
