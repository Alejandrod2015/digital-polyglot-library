/**
 * Aplica las glosas redactadas por tema (out_<tema>.json) al bundle PT B1.
 *
 *   npx tsx scripts/_pt/aplicaGlosas.ts <dir> [--apply]
 *
 * 1. VALIDA cada entrada contra su oracion (in_<tema>.json): el trozo `es` es
 *    subcadena literal de la oracion y contiene la forma, tiene 8 palabras como
 *    mucho, `t` es un tipo conocido y ni `g` ni `en` llevan "=" ni guiones
 *    largos. Si algo falla, lo lista y NO escribe nada.
 * 2. Glosa GLOBAL: las formas que hoy no tienen fila global entran en
 *    scripts/_newGlosses.json (clave del bundle) con la glosa de su primera
 *    aparicion, para que rebuildTapGlosses las escriba como manuales (el manual
 *    gana a la copia de un bundle hermano, que traeria el sentido de otro journey).
 * 3. CAPA de cada historia: se REEMPLAZA entera por las formas del texto actual,
 *    cada una con g, t y c {es, en}. De la capa vieja solo se conserva la tabla
 *    de formas (`f`) y el genero (`gm`) de la misma forma, que dependen de la
 *    palabra y no de la frase. Los trozos del texto viejo se van porque ya no
 *    son subcadena de ninguna oracion (lint:gloss-variants los marcaria).
 *
 * Sin --apply solo valida y cuenta.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";

const B = "portuguese-traveler-brazil-b1";
const TIPOS = new Set(["noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "expression"]);
// "=" y los dos guiones largos (U+2014 y U+2013). Se construye en tiempo de
// ejecucion para que el fichero no lleve el caracter.
const PROHIBIDO = new RegExp("[=" + String.fromCharCode(0x2014) + String.fromCharCode(0x2013) + "]");
type Ent = { g: string; t: string; es: string; en: string };
type In = { slug: string; formas: Record<string, { forma: string; oracion: string; global: string | null }> };

const p = new PrismaClient();
(async () => {
  const dir = process.argv[2];
  const apply = process.argv.includes("--apply");
  const temas = fs.readdirSync(dir).filter((f) => f.startsWith("in_")).map((f) => f.slice(3, -5));
  const malos: string[] = [];
  const porHistoria = new Map<string, Record<string, Ent>>();
  const nuevasGlobales: Record<string, { g: string; t: string }> = {};
  for (const t of temas) {
    const fin = `${dir}/in_${t}.json`, fout = `${dir}/out_${t}.json`;
    if (!fs.existsSync(fout)) { malos.push(`${t}: falta out_${t}.json`); continue; }
    const I = JSON.parse(fs.readFileSync(fin, "utf8")) as In[];
    const O = new Map((JSON.parse(fs.readFileSync(fout, "utf8")) as Array<{ slug: string; formas: Record<string, Ent> }>).map((x) => [x.slug, x.formas]));
    for (const s of I) {
      const o = O.get(s.slug) ?? {};
      for (const k of Object.keys(s.formas)) if (!o[k]) malos.push(`${s.slug}: falta "${k}"`);
      for (const [k, e] of Object.entries(o)) {
        const v = s.formas[k];
        if (!v) { malos.push(`${s.slug}: sobra "${k}"`); continue; }
        if (!e.es || !v.oracion.includes(e.es)) malos.push(`${s.slug} "${k}": el trozo no es subcadena`);
        if (!e.es.includes(v.forma)) malos.push(`${s.slug} "${k}": el trozo no contiene la forma`);
        if (e.es.split(/\s+/).length > 8) malos.push(`${s.slug} "${k}": trozo de mas de 8 palabras`);
        if (!TIPOS.has(e.t)) malos.push(`${s.slug} "${k}": tipo ${e.t}`);
        if (PROHIBIDO.test(`${e.g}${e.en}`)) malos.push(`${s.slug} "${k}": signo prohibido`);
        if (!v.global && !nuevasGlobales[k]) nuevasGlobales[k] = { g: e.g, t: e.t };
      }
      porHistoria.set(s.slug, o);
    }
  }
  console.log(`historias con glosas: ${porHistoria.size} · entradas: ${[...porHistoria.values()].reduce((a, o) => a + Object.keys(o).length, 0)} · globales nuevas: ${Object.keys(nuevasGlobales).length}`);
  if (malos.length) { console.log(`✗ ${malos.length} problemas; no se escribe nada:\n  ` + malos.slice(0, 40).join("\n  ")); process.exit(1); }
  if (!apply) { console.log("(sin --apply: validado, nada escrito)"); return; }

  const MAN = "scripts/_newGlosses.json";
  const man = JSON.parse(fs.readFileSync(MAN, "utf8"));
  man[B] = { ...(man[B] ?? {}), ...nuevasGlobales };
  fs.writeFileSync(MAN, JSON.stringify(man, null, 2) + "\n");
  console.log(`_newGlosses.json: ${Object.keys(nuevasGlobales).length} glosas nuevas en ${B}`);

  const glob = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: "" } }, select: { language: true, variant: true } });
  let escritas = 0;
  for (const [slug, o] of porHistoria) {
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } }, select: { glosses: true } });
    const vieja = (fila?.glosses ?? {}) as Record<string, { f?: unknown; gm?: unknown; t?: string }>;
    const capa: Record<string, Record<string, unknown>> = {};
    for (const [k, e] of Object.entries(o)) {
      const ent: Record<string, unknown> = { g: e.g, t: e.t, c: { es: e.es, en: e.en } };
      if (vieja[k]?.f && vieja[k]?.t === e.t) ent.f = vieja[k].f;
      if (vieja[k]?.gm && e.t === "noun") ent.gm = vieja[k].gm;
      capa[k] = ent;
    }
    await p.tapGlossSet.upsert({
      where: { bundle_slug: { bundle: B, slug } },
      create: { bundle: B, slug, language: glob!.language, variant: glob!.variant, slugs: [], glosses: capa as never },
      update: { glosses: capa as never },
    });
    escritas++;
  }
  console.log(`capas reemplazadas: ${escritas}`);
})().finally(() => p.$disconnect());
