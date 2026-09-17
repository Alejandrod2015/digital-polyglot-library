/** Diagnostico SOLO LECTURA de las 151 huerfanas de spanish-traveler-latam-b2.
 *
 *  La pregunta no es cuantas hay sino de que son sintoma. Tres hipotesis, y
 *  cada una deja una huella distinta:
 *
 *   a) SLUG RENOMBRADO o fila pegada a la historia equivocada. Huella: las
 *      huerfanas de una historia salen casi todas en el texto de OTRA del
 *      mismo bundle. Se mide: para cada fila, que historia del bundle explica
 *      mas claves suyas, y con que porcentaje.
 *   b) TEXTO REESCRITO. Huella: las claves no salen en ninguna historia del
 *      bundle, ni en la suya ni en otra. Son restos de una version anterior.
 *   c) CLAVE INALCANZABLE POR DISEÑO. Huella: la clave lleva espacio o es un
 *      infinitivo pronominal. Esas no las alcanza el lector ni aunque el texto
 *      las contenga, porque la busqueda es por token unico.
 *
 *  No escribe nada. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";

const B = "spanish-traveler-latam-b2";
const p = new PrismaClient();
const TOCABLE = /\p{L}[\p{L}\p{M}'-]*/gu;
const saleLiteral = (t: string, w: string) =>
  new RegExp(`(?<![\\p{L}\\p{M}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{M}])`, "u").test(t);

(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, slugs: true, glosses: true } });
  const slugs = (filas.find((f) => !f.slug)?.slugs ?? []) as string[];
  const hs = await p.journeyStory.findMany({
    where: { slug: { in: slugs } }, select: { slug: true, title: true, text: true, updatedAt: true },
  });
  const texto = new Map(hs.map((h) => [h.slug, `${h.title}. ${h.text}`.toLowerCase()]));

  console.log(`${hs.length} historias en el bundle\n`);
  let total = 0, otraGana = 0, enNinguna = 0, inalcanzables = 0;

  for (const f of filas) {
    if (!f.slug) continue;
    const t = texto.get(f.slug);
    if (!t) { console.log(`SIN TEXTO: ${f.slug} (fila pegada a un slug que no existe)`); continue; }
    const enTexto = new Set([...t.matchAll(TOCABLE)].map((m) => m[0]));
    const fuera = Object.keys(f.glosses as object).filter((w) => !enTexto.has(w) && !saleLiteral(t, w));
    if (!fuera.length) continue;
    total += fuera.length;

    // ¿Alguna OTRA historia del bundle explica estas claves mejor que la suya?
    let mejor = { slug: "", n: 0 };
    for (const h of hs) {
      if (h.slug === f.slug) continue;
      const tt = texto.get(h.slug)!;
      const n = fuera.filter((w) => saleLiteral(tt, w)).length;
      if (n > mejor.n) mejor = { slug: h.slug, n };
    }
    const enNingunaAqui = fuera.filter((w) => !hs.some((h) => saleLiteral(texto.get(h.slug)!, w))).length;
    const inal = fuera.filter((w) => /\s/.test(w) || /(?:se|me|te|nos|os)$/.test(w)).length;
    enNinguna += enNingunaAqui; inalcanzables += inal;
    if (mejor.n > fuera.length / 2) otraGana++;

    const pct = Math.round((mejor.n / fuera.length) * 100);
    console.log(
      `${String(fuera.length).padStart(3)}  ${f.slug}` +
      `\n     en ninguna historia: ${enNingunaAqui} · con espacio o pronominal: ${inal}` +
      `\n     la que mas explica: ${mejor.slug || "(ninguna)"} ${mejor.n}/${fuera.length} (${pct}%)` +
      `\n     ${fuera.slice(0, 8).join(", ")}`
    );
  }

  console.log(`\nTOTAL ${total}`);
  console.log(`  ${enNinguna} no salen en NINGUNA historia del bundle  (texto reescrito)`);
  console.log(`  ${total - enNinguna} salen en otra historia del bundle`);
  console.log(`  ${inalcanzables} son clave con espacio o infinitivo pronominal (inalcanzables por diseño)`);
  console.log(`  ${otraGana} filas donde OTRA historia explica mas de la mitad (candidatas a slug cambiado)`);

  // Cuarta hipotesis, y la que explica la FORMA de estas palabras: no son
  // restos de texto sino entradas de la LISTA DE VOCABULARIO. "adjudicar",
  // "dictar", "rendir", "medialuna" son items de vocabulario de esa historia,
  // no palabras que uno toca al leer. Si el bundle se construyo desde el
  // vocab en vez de desde el texto, cada palabra que el texto final no usa
  // queda huerfana.
  const conVocab = await p.journeyStory.findMany({
    where: { slug: { in: slugs } }, select: { slug: true, vocab: true },
  });
  const vocabDe = new Map(
    conVocab.map((h) => [
      h.slug,
      new Set(
        JSON.stringify(h.vocab ?? [])
          .toLowerCase()
          .match(/\p{L}[\p{L}\p{M}'-]*/gu) ?? []
      ),
    ])
  );
  let enVocab = 0, sueltas = 0;
  for (const f of filas) {
    if (!f.slug) continue;
    const t = texto.get(f.slug);
    if (!t) continue;
    const enTexto = new Set([...t.matchAll(TOCABLE)].map((m) => m[0]));
    const fuera = Object.keys(f.glosses as object).filter((w) => !enTexto.has(w) && !saleLiteral(t, w));
    const v = vocabDe.get(f.slug) ?? new Set<string>();
    for (const w of fuera) {
      const piezas = w.toLowerCase().split(/\s+/);
      if (piezas.every((x) => v.has(x))) enVocab++; else sueltas++;
    }
  }
  console.log(`\n  ${enVocab} de las ${total} son entradas del VOCABULARIO de su propia historia`);
  console.log(`  ${sueltas} no estan ni en el texto ni en el vocabulario`);

  const fechas = [...hs].sort((a, b) => +b.updatedAt - +a.updatedAt).slice(0, 6);
  console.log("\ntextos tocados mas recientemente:");
  for (const h of fechas) console.log(`  ${h.updatedAt.toISOString().slice(0, 10)}  ${h.slug}`);
  await p.$disconnect();
})();
