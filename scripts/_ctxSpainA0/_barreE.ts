/** ¿"e" pegada a historias que no la contienen sale en más bundles?
 *
 *  En spanish-friends-spain-a0 aparecía en trece historias de veintiuna, y eso
 *  no es un descuido suelto. Esto lo mide en TODOS los bundles, y de paso
 *  cuenta las demás huérfanas, con la frontera de letra ya arreglada. Solo
 *  lee; no borra nada. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";

const p = new PrismaClient();
const TOCABLE = /\p{L}[\p{L}\p{M}'-]*/gu;

const saleLiteral = (texto: string, clave: string) =>
  new RegExp(`(?<![\\p{L}\\p{M}])${clave.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{M}])`, "u").test(texto);

(async () => {
  const filas = await p.tapGlossSet.findMany({ select: { bundle: true, slug: true, glosses: true } });
  const hs = await p.journeyStory.findMany({ select: { slug: true, title: true, text: true, vocab: true } });
  const texto = new Map(hs.map((h) => [h.slug, `${h.title}. ${h.text}`.toLowerCase()]));
  // La segunda puerta: VocabPanel busca por superficie Y POR LEMA, asi que una
  // clave que no sale en el texto puede estar viva en el panel.
  const vocabDe = new Map(hs.map((h) => [
    h.slug,
    new Set(((h.vocab ?? []) as Array<{ word?: string; surface?: string }>)
      .flatMap((v) => [v.word, v.surface])
      .filter((x): x is string => Boolean(x))
      .map((x) => x.trim().toLowerCase())),
  ]));

  const porBundle = new Map<string, { total: number; conteo: Map<string, number>; porHistoria: Map<string, number> }>();
  for (const f of filas) {
    if (!f.slug) continue;
    const t = texto.get(f.slug);
    if (!t) continue;
    const enTexto = new Set([...t.matchAll(TOCABLE)].map((m) => m[0]));
    const enVocab = vocabDe.get(f.slug) ?? new Set<string>();
    for (const w of Object.keys(f.glosses as object)) {
      if (enTexto.has(w) || saleLiteral(t, w) || enVocab.has(w)) continue;
      const b = porBundle.get(f.bundle) ?? { total: 0, conteo: new Map(), porHistoria: new Map() };
      b.total++; b.conteo.set(w, (b.conteo.get(w) ?? 0) + 1);
      b.porHistoria.set(f.slug, (b.porHistoria.get(f.slug) ?? 0) + 1);
      porBundle.set(f.bundle, b);
    }
  }

  // No todo lo que no sale tal cual esta muerto. Una glosa puede estar
  // guardada en FORMA DE CITA: el infinitivo pronominal ("girarse") cuando el
  // texto dice "se gira", o una expresion cuyas piezas van separadas ("sonar
  // a", "hacer una excepcion"). Esas siguen vivas y borrarlas seria el mismo
  // error que el detector viejo cometia con "em voz alta". Se separan aqui
  // para que nadie las meta en un borrado masivo.
  const esCita = (w: string) => /\s/.test(w) || /(?:se|me|te|nos|os)$/.test(w);

  let total = 0, citas = 0;
  const orden = [...porBundle.entries()].sort((a, b) => b[1].total - a[1].total);
  for (const [bundle, b] of orden) {
    total += b.total;
    const nCitas = [...b.conteo.entries()].filter(([w]) => esCita(w)).reduce((a, [, n]) => a + n, 0);
    citas += nCitas;
    const top = [...b.conteo.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6)
      .map(([w, n]) => `${w} x${n}`).join(", ");
    console.log(`${String(b.total).padStart(4)}  ${bundle}   (${b.total - nCitas} muertas, ${nCitas} en forma de cita)\n      ${top}`);
    // Repartidas o concentradas: no es lo mismo deuda de edicion esparcida que
    // una historia glosada contra un texto que ya no existe.
    const hist = [...b.porHistoria.entries()].sort((x, y) => y[1] - x[1]);
    if (b.total >= 10) {
      console.log(`      en ${hist.length} historias · ${hist.slice(0, 5).map(([s, n]) => `${s} x${n}`).join(", ")}`);
    }
  }
  console.log(`\nhuerfanas en el catalogo: ${total} en ${porBundle.size} bundles`);
  console.log(`  ${total - citas} no salen de ninguna forma · ${citas} estan en forma de cita y NO se borran`);
  await p.$disconnect();
})();
