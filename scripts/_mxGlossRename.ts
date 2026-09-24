/**
 * REPARACION: el MX A0 renombro Itzel->Karla y Citlali->Renata en el TEXTO
 * (commit 3b6bf4c2) pero no en la capa de glosas. Los trozos de contexto
 * siguen citando frases con el nombre viejo, que ya no existen en el texto:
 * 82 entradas con contexto falso y 109 palabras con apariciones sin trozo,
 * TODAS con un nombre viejo en algun trozo.
 *
 * Esto NO reescribe trozos: solo cambia el nombre dentro de `es`/`en`, que es
 * exactamente lo que cambio en el texto. No toca historias ni audio.
 *
 * Run: npx tsx scripts/_mxGlossRename.ts [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const BUNDLE = "spanish-friends-mexico-a0";
const MAPA: [RegExp, string][] = [
  [/\bItzel\b/g, "Karla"],
  [/\bitzel\b/g, "karla"],
  [/\bCitlali\b/g, "Renata"],
  [/\bcitlali\b/g, "renata"],
];
const dry = process.argv.includes("--dry");
const p = new PrismaClient();

function ren(s: unknown): { v: any; hit: boolean } {
  if (typeof s !== "string") return { v: s, hit: false };
  let out = s;
  for (const [re, to] of MAPA) out = out.replace(re, to);
  return { v: out, hit: out !== s };
}

(async () => {
  const rows = await p.tapGlossSet.findMany({ where: { bundle: BUNDLE }, select: { id: true, slug: true, glosses: true } });
  let campos = 0, entradas = 0, filas = 0;
  const muestra: string[] = [];

  for (const row of rows) {
    const gl: any = JSON.parse(JSON.stringify(row.glosses ?? {}));
    let filaTocada = false;
    for (const [palabra, e] of Object.entries<any>(gl)) {
      if (!e || typeof e !== "object") continue;
      let entradaTocada = false;
      const trozos = [e.c, ...(Array.isArray(e.cs) ? e.cs : [])].filter(Boolean);
      for (const c of trozos) {
        for (const k of ["es", "en"]) {
          const r = ren(c[k]);
          if (r.hit) {
            if (muestra.length < 6) muestra.push(`  ${row.slug}|${palabra}.${k}: "${c[k]}" -> "${r.v}"`);
            c[k] = r.v; campos++; entradaTocada = true;
          }
        }
      }
      const rg = ren(e.g);
      if (rg.hit) { e.g = rg.v; campos++; entradaTocada = true; }
      if (entradaTocada) { entradas++; filaTocada = true; }
    }
    if (filaTocada) {
      filas++;
      if (!dry) await p.tapGlossSet.update({ where: { id: row.id }, data: { glosses: gl } });
    }
  }
  for (const m of muestra) console.log(m);
  console.log(`\n${dry ? "[DRY] " : ""}${BUNDLE}: ${campos} campo(s) en ${entradas} entrada(s) de ${filas} fila(s).`);
  await p.$disconnect();
})();
