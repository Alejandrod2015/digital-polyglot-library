/**
 * Repara la capa de contexto de las seis historias retituladas del Friends DE A2.
 *
 * Dos danos, los dos del retitulado (el titulo es una oracion mas de la capa):
 *   a) trozos que citan el titulo VIEJO y ya no son subcadena del texto;
 *   b) apariciones en el titulo NUEVO que se quedaron sin trozo.
 *
 * (a) se arregla promoviendo el primer trozo bueno de `cs` a `c`, o borrando la
 * entrada si la palabra ya no esta en la historia. (b) anadiendo el trozo del
 * titulo en primera posicion, que es la primera aparicion.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const BUNDLE = "german-friends-a2";
const TITULOS: Record<string, string> = {
  "bettruhe-in-der-probezeit": "Bed rest during the trial period",
  "ein-platz-mit-ihrem-namen": "A seat with her name on it",
  "zwei-strophen-im-stadion": "Two verses in the stadium",
  "brot-und-salz-fur-die-neue": "Bread and salt for the newcomer",
  "die-lampe-vom-sperrmull": "The lamp from the bulky waste",
  "heiser-nach-dem-derby": "Hoarse after the derby",
};
const norm = (s: string) => s.toLowerCase().normalize("NFC");
const aplica = process.argv.includes("--apply");

(async () => {
  const st = await p.journeyStory.findMany({ where: { slug: { in: Object.keys(TITULOS) } }, select: { slug: true, title: true, text: true } });
  const rows = await p.tapGlossSet.findMany({ where: { bundle: BUNDLE }, select: { id: true, slug: true, glosses: true } });
  const globalRow = rows.find((r) => !r.slug)!;
  const G = { ...(globalRow.glosses as Record<string, any>) };
  const borradasDelGlobal: string[] = [];
  let quitados = 0, promovidos = 0, borrados = 0, anadidos = 0;

  for (const s of st) {
    const fila = rows.find((r) => r.slug === s.slug)!;
    const gl = JSON.parse(JSON.stringify(fila.glosses)) as Record<string, any>;
    const texto = `${s.title}. ${s.text}`;
    const tNorm = norm(texto);
    const tituloNorm = norm(s.title);

    for (const [pal, e] of Object.entries(gl)) {
      // (a) fuera los trozos que ya no son subcadena del texto
      const trozos = [e.c, ...(e.cs ?? [])].filter(Boolean);
      const buenos = trozos.filter((c: any) => c?.es && tNorm.includes(norm(c.es)));
      quitados += trozos.length - buenos.length;
      const sigueEnTexto = new RegExp(`(?<!\\p{L})${pal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\p{L})`, "iu").test(texto);
      if (!buenos.length && !sigueEnTexto) { delete gl[pal]; borrados++; continue; }
      if (!buenos.length) {
        // La palabra solo sale en el titulo nuevo: su unico trozo es el titulo.
        const soloTitulo = new RegExp(`(?<!\\p{L})${pal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\p{L})`, "iu").test(s.title);
        if (soloTitulo) { e.c = { es: s.title, en: TITULOS[s.slug!] }; delete e.cs; anadidos++; }
        continue;
      }
      if (buenos[0] !== e.c) promovidos++;
      // (b) si la palabra sale en el titulo y ningun trozo lo cubre, va delante
      const enTitulo = new RegExp(`(?<!\\p{L})${pal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\p{L})`, "iu").test(s.title);
      const cubreTitulo = buenos.some((c: any) => tituloNorm.includes(norm(c.es)));
      const finales = enTitulo && !cubreTitulo
        ? (anadidos++, [{ es: s.title, en: TITULOS[s.slug!] }, ...buenos])
        : buenos;
      e.c = finales[0];
      if (finales.length > 1) e.cs = finales.slice(1); else delete e.cs;
    }
    if (aplica) await p.tapGlossSet.update({ where: { id: fila.id }, data: { glosses: gl } });
  }

  // La global solo pierde la palabra que no usa ninguna historia del bundle.
  const vivas = new Set<string>();
  for (const r of rows) if (r.slug) for (const k of Object.keys(r.glosses as any)) vivas.add(k);
  const tras = await (async () => {
    if (!aplica) return null;
    const otra = await p.tapGlossSet.findMany({ where: { bundle: BUNDLE }, select: { slug: true, glosses: true } });
    const v = new Set<string>();
    for (const r of otra) if (r.slug) for (const k of Object.keys(r.glosses as any)) v.add(k);
    return v;
  })();
  for (const k of Object.keys(G)) if (!(tras ?? vivas).has(k)) { delete G[k]; borradasDelGlobal.push(k); }
  if (aplica && borradasDelGlobal.length) await p.tapGlossSet.update({ where: { id: globalRow.id }, data: { glosses: G } });

  console.log(`trozos caducados quitados: ${quitados} · promovidos a c: ${promovidos} · entradas borradas: ${borrados} · trozos de titulo anadidos: ${anadidos}`);
  console.log(`global: ${borradasDelGlobal.length ? borradasDelGlobal.join(", ") : "sin cambios"}`);
  if (!aplica) console.log("[seco] nada escrito. --apply para escribir.");
  await p.$disconnect();
})();
