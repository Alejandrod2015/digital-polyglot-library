/** Cambia plazas de vocab en el volcado de un tema: saca la palabra de paisaje
 *  y mete la transferible, dejando el resto de la plaza intacto.
 *
 *  El texto NO se toca. La palabra que sale sigue escrita en el cuerpo y sigue
 *  siendo tocable con su glosa; lo que pierde es la plaza (panel, ejercicios,
 *  clips), que es lo que dice la regla afinada del ancla.
 *
 *  La plaza nueva deja de ser anclada: una palabra transferible no es un ancla
 *  de escena, y marcarla como tal falsearia la cuota de la escalera.
 *
 *  Uso: _cambia.ts <fichero> <slug> <sale>=<entra>:<superficie>:<tipo>:<def> ... */
import * as fs from "fs";

const [fichero, slug, ...pares] = process.argv.slice(2);
const hs = JSON.parse(fs.readFileSync(fichero, "utf8")) as Array<{
  slug: string; vocab: Array<Record<string, unknown>>;
}>;
const h = hs.find((x) => x.slug === slug);
if (!h) { console.error(`sin historia ${slug} en ${fichero}`); process.exit(1); }

let n = 0;
for (const par of pares) {
  const [sale, resto] = par.split("=");
  const [entra, superficie, tipo, ...def] = resto.split(":");
  const i = h.vocab.findIndex((v) => String(v.word).toLowerCase() === sale.toLowerCase());
  if (i < 0) { console.error(`MAL: ${slug} no tiene plaza para "${sale}"`); process.exit(1); }
  const plaza: Record<string, unknown> = { type: tipo, word: entra, definition: def.join(":") };
  if (superficie && superficie !== "-") plaza.surface = superficie;
  h.vocab[i] = plaza;
  console.log(`  ${slug}: ${sale} -> ${entra}${superficie && superficie !== "-" ? ` (${superficie})` : ""}`);
  n++;
}
fs.writeFileSync(fichero, `${JSON.stringify(hs, null, 2)}\n`);
console.log(`${n} plazas cambiadas en ${fichero}`);
