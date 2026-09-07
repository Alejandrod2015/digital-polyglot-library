/** Repara las entradas de vocabulario que mi borrado dejo sin glosa.
 *
 *  Borre 161 huerfanas con la autorizacion puesta, y 57 de ellas eran claves
 *  del VOCABULARIO de su historia. Eso no era peso muerto: VocabPanel busca la
 *  entrada por superficie Y POR LEMA, asi que una clave que el lector de tap
 *  no alcanza nunca ("pedir silencio", "caer en la cuenta") si la alcanzaba el
 *  panel al pulsar esa palabra del vocabulario.
 *
 *  El daño real es MENOR que 57, porque el panel prueba la superficie primero:
 *  si "clavos" (que si sale en el texto) tiene entrada, la perdida de "clavo"
 *  no se nota. Duele en las de varias palabras, donde el lema era la unica
 *  llave.
 *
 *  La definicion se restaura del propio item de vocabulario, que es la fuente
 *  autoritativa para esa palabra en esa historia; el `c`, si lo tenian, no se
 *  puede reconstruir y se reporta como perdido.
 *
 *  --escribe para reparar; sin bandera, solo mide. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";

const p = new PrismaClient();
type Item = { word?: string; surface?: string; type?: string; definition?: string };

const AFECTADOS: Record<string, string[]> = {
  "spanish-traveler-spain-b2": [
    "quedar por", "cara a", "ir por", "hacer una excepción", "deber una", "moverse",
    "tanda", "forrar", "cruzado", "envolver", "volver a", "agacharse", "manuscrito",
    "negar", "cruzar", "añadir", "callado", "invitar", "perderse", "tender la mano",
    "aburrirse", "caer en la cuenta", "calentarse la cara", "salirse con la suya",
    "picarse", "cortar por el mismo patrón", "lanzarse", "dejarse querer", "ponerse a",
    "curar", "temer", "oírse", "sudado", "mudarse", "contento", "informar", "recordar",
    "hacer falta", "quedarse atrás", "abrazarse", "funcionar", "desconocido",
    "dar las gracias", "dar por sabido", "darse por aludido", "sonar a", "dejar de",
    "llevarse", "clavo", "ganarse", "subirse", "estrenar", "retratar", "desdoblar",
    "pedir silencio",
  ],
  "spanish-traveler-latam-a2": ["subir", "contestar"],
};

(async () => {
  const escribe = process.argv.includes("--escribe");
  let rotas = 0, tapadas = 0, restauradas = 0;

  for (const [bundle, claves] of Object.entries(AFECTADOS)) {
    const filas = await p.tapGlossSet.findMany({ where: { bundle }, select: { slug: true, slugs: true, glosses: true } });
    const slugs = (filas.find((f) => !f.slug)?.slugs ?? []) as string[];
    const hs = await p.journeyStory.findMany({ where: { slug: { in: slugs } }, select: { slug: true, vocab: true } });

    for (const h of hs) {
      const fila = filas.find((f) => f.slug === h.slug);
      if (!fila) continue;
      const g = fila.glosses as Record<string, { g?: string; t?: string; c?: unknown }>;
      let tocada = false;
      for (const v of (h.vocab ?? []) as Item[]) {
        const lema = v.word?.trim().toLowerCase();
        if (!lema || !claves.includes(lema)) continue;
        const sup = v.surface?.trim().toLowerCase();
        // ¿Queda alguna llave que el panel pueda usar, con su frase?
        const tapa = [sup, lema].filter(Boolean).some((k) => (g[k as string] as { c?: unknown } | undefined)?.c);
        if (tapa) { tapadas++; continue; }
        rotas++;
        console.log(`${g[lema] ? "YA ESTA" : "ROTA   "}  ${bundle} · ${h.slug} · ${lema}  (superficie: ${sup ?? "-"})`);
        if (g[lema] || !v.definition) continue;
        g[lema] = { g: v.definition, t: v.type ?? "noun" };
        tocada = true; restauradas++;
      }
      if (tocada && escribe) {
        await p.tapGlossSet.update({
          where: { bundle_slug: { bundle, slug: h.slug } }, data: { glosses: g as never },
        });
      }
    }
  }
  console.log(`\n${tapadas} las tapa la superficie (el panel las sigue encontrando con su frase)`);
  console.log(`${rotas} se quedaron sin ninguna llave · ${restauradas} restauradas desde su propio item de vocabulario`);
  console.log(escribe ? "ESCRITO (definicion recuperada; el contexto `c`, si lo tenian, no)" : "solo medido; usa --escribe");
  await p.$disconnect();
})();
