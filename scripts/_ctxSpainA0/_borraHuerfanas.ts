/** Borra las glosas huerfanas de los bundles AUTORIZADOS: todos menos
 *  spanish-traveler-latam-b2, que se diagnostica antes de tocarlo.
 *
 *  Por que se borran tambien las "formas de cita", que yo mismo habia apartado:
 *  fui a mirar como se resuelve una glosa y la busqueda es POR TOKEN UNICO, en
 *  las dos superficies (src/lib/tapGlossKey.ts en web, ReaderScreen.lookupGloss
 *  en movil). No hay lema ni multipalabra: la clave candidata sale de
 *  /\p{L}+(?:-\p{L}+)*\/, que se para en el espacio. Asi que "sonar a" no la
 *  alcanza nadie ni aunque salga en el texto, y "girarse" solo si el texto dice
 *  literalmente "girarse". Mi reparo era bueno como reflejo y falso como
 *  conclusion.
 *
 *  Tres sitios, que es la leccion vieja: la fila de la historia, la fila global
 *  (solo si ya no la usa ninguna historia) y el fichero fuente.
 *
 *  --escribe para que borre; sin bandera solo lista. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";

const EXCLUIDO = "spanish-traveler-latam-b2";
const FUENTE = "scripts/_newGlosses.json";
const p = new PrismaClient();
const TOCABLE = /\p{L}[\p{L}\p{M}'-]*/gu;

const saleLiteral = (texto: string, clave: string) =>
  new RegExp(`(?<![\\p{L}\\p{M}])${clave.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{M}])`, "u").test(texto);

(async () => {
  const escribe = process.argv.includes("--escribe");
  const filas = await p.tapGlossSet.findMany({ select: { bundle: true, slug: true, glosses: true } });
  const hs = await p.journeyStory.findMany({ select: { slug: true, title: true, text: true } });
  const texto = new Map(hs.map((h) => [h.slug, `${h.title}. ${h.text}`.toLowerCase()]));

  const fuente = JSON.parse(fs.readFileSync(FUENTE, "utf8")) as Record<string, Record<string, unknown>>;
  const tocados = new Map<string, Set<string>>();   // bundle → claves borradas
  let n = 0;

  for (const f of filas) {
    if (!f.slug || f.bundle === EXCLUIDO) continue;
    const t = texto.get(f.slug);
    if (!t) continue;
    const enTexto = new Set([...t.matchAll(TOCABLE)].map((m) => m[0]));
    const g = f.glosses as Record<string, unknown>;
    const fuera = Object.keys(g).filter((w) => !enTexto.has(w) && !saleLiteral(t, w));
    if (!fuera.length) continue;
    console.log(`${f.bundle} · ${f.slug}: ${fuera.join(", ")}`);
    n += fuera.length;
    const s = tocados.get(f.bundle) ?? new Set();
    for (const w of fuera) { delete g[w]; s.add(w); }
    tocados.set(f.bundle, s);
    if (escribe) {
      await p.tapGlossSet.update({
        where: { bundle_slug: { bundle: f.bundle, slug: f.slug } }, data: { glosses: g as never },
      });
    }
  }

  // Fila global y fuente: solo se cae lo que ya no usa NINGUNA historia.
  let nG = 0, nF = 0;
  for (const [bundle, claves] of tocados) {
    const vivas = new Set<string>();
    for (const f of filas) {
      if (f.bundle !== bundle || !f.slug) continue;
      for (const w of Object.keys(f.glosses as object)) vivas.add(w);
    }
    const globalFila = filas.find((f) => f.bundle === bundle && !f.slug);
    const gg = (globalFila?.glosses ?? {}) as Record<string, unknown>;
    const caen = [...claves].filter((w) => !vivas.has(w) && gg[w]);
    if (caen.length) {
      console.log(`  ${bundle} · fila global: ${caen.join(", ")}`);
      nG += caen.length;
      for (const w of caen) delete gg[w];
      if (escribe) {
        await p.tapGlossSet.update({
          where: { bundle_slug: { bundle, slug: "" } }, data: { glosses: gg as never },
        });
      }
    }
    for (const w of caen) if (fuente[bundle]?.[w]) { delete fuente[bundle][w]; nF++; }
  }
  if (escribe && nF) fs.writeFileSync(FUENTE, `${JSON.stringify(fuente, null, 2)}\n`);

  console.log(`\n${n} huerfanas en ${tocados.size} bundles · fila global -${nG} · ${FUENTE} -${nF}`);
  console.log(escribe ? "ESCRITO" : "solo listado; usa --escribe");
  await p.$disconnect();
})();
