/** Corrige las glosas COPIADAS de bundles hermanos que traian el sentido de
 *  OTRO journey. Leidas una a una contra la frase de ESTE journey el
 *  2026-09-23 (530 copias, 72 malas). Tres clases, las de la memoria
 *  feedback_gloss_in_context: el sentido de otro journey ("caja" como tambor,
 *  "marca" como mancha), la forma conjugada glosada como sustantivo o
 *  infinitivo ("riego" como irrigation, "sonrie" como to smile), y el sentido
 *  regional o de argot pegado detras ("seco: ace, great", "mano: bro, dude").
 *  Idempotente: solo escribe lo que difiere.
 *  Uso: npx tsx scripts/_esLatamA0Conversations/corrigeCopias.ts [--dry] */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";

const B = "spanish-conversations-latam-a0";
const FIX: Record<string, { g: string; t?: string }> = {
  buenos: { g: "good, in buenos dias", t: "adjective" },
  cargo: { g: "I carry her (cargar)", t: "verb" },
  cerrada: { g: "closed (cerrar)", t: "adjective" },
  corta: { g: "cuts (cortar)", t: "verb" },
  pasar: { g: "to come in (pasar)", t: "verb" },
  poco: { g: "a little (un poco)", t: "adverb" },
  subo: { g: "I come up (subir)", t: "verb" },
  tranquila: { g: "quiet, calm (feminine)", t: "adjective" },
  abre: { g: "opens (abrir)", t: "verb" },
  apunta: { g: "points at (apuntar)", t: "verb" },
  cabe: { g: "fits (caber)", t: "verb" },
  caja: { g: "box", t: "noun" },
  cambio: { g: "I change it (cambiar)", t: "verb" },
  clave: { g: "password", t: "noun" },
  cinta: { g: "packing tape", t: "noun" },
  cola: { g: "tail", t: "noun" },
  alta: { g: "en voz alta, out loud", t: "adjective" },
  camino: { g: "I walk (caminar)", t: "verb" },
  ayuda: { g: "it helps (ayudar)", t: "verb" },
  cena: { g: "has dinner (cenar)", t: "verb" },
  aviso: { g: "a notice, a short message", t: "noun" },
  cuarto: { g: "room; fourth", t: "noun" },
  cuenta: { g: "counts (contar)", t: "verb" },
  da: { g: "gives (dar); me da verguenza, it embarrasses me", t: "verb" },
  dejo: { g: "I leave (dejar)", t: "verb" },
  despierto: { g: "awake", t: "adjective" },
  extraño: { g: "I miss it (extrañar)", t: "verb" },
  firma: { g: "signs for (firmar)", t: "verb" },
  gana: { g: "wins, gains (ganar)", t: "verb" },
  hoja: { g: "sheet of paper", t: "noun" },
  cuerda: { g: "clothesline", t: "noun" },
  cuello: { g: "neck", t: "noun" },
  escribe: { g: "writes (escribir)", t: "verb" },
  largo: { g: "long", t: "adjective" },
  mando: { g: "I send (mandar)", t: "verb" },
  mano: { g: "hand", t: "noun" },
  marca: { g: "brand", t: "noun" },
  pata: { g: "paw", t: "noun" },
  paso: { g: "I go by (pasar)", t: "verb" },
  pregunta: { g: "asks (preguntar)", t: "verb" },
  prueba: { g: "tries (probar)", t: "verb" },
  mete: { g: "puts in (meter)", t: "verb" },
  lista: { g: "list", t: "noun" },
  pongo: { g: "I put (poner)", t: "verb" },
  recuerdo: { g: "I remember (recordar)", t: "verb" },
  regalo: { g: "I give them away (regalar)", t: "verb" },
  riego: { g: "I water (regar)", t: "verb" },
  seco: { g: "dry", t: "adjective" },
  seguro: { g: "for sure, surely", t: "adverb" },
  salto: { g: "I jump (saltar)", t: "verb" },
  saludo: { g: "I say hello (saludar)", t: "verb" },
  sonríe: { g: "smiles (sonreir)", t: "verb" },
  suena: { g: "rings (sonar)", t: "verb" },
  toma: { g: "takes, picks up (tomar)", t: "verb" },
  trae: { g: "brings (traer)", t: "verb" },
  traes: { g: "you bring (traer)", t: "verb" },
  tubo: { g: "pipe", t: "noun" },
  van: { g: "they go together (ir)", t: "verb" },
  vivo: { g: "I live (vivir)", t: "verb" },
  vive: { g: "lives (vivir)", t: "verb" },
  vuelven: { g: "they come back (volver)", t: "verb" },
  sigue: { g: "keeps on, is still (seguir)", t: "verb" },
  toca: { g: "touches (tocar)", t: "verb" },
  sale: { g: "goes out (salir)", t: "verb" },
  salgo: { g: "I go out (salir)", t: "verb" },
  tercero: { g: "the third floor", t: "noun" },
  uno: { g: "one of them", t: "pronoun" },
  sirve: { g: "is no use (servir)", t: "verb" },
  ellas: { g: "they (feminine)", t: "pronoun" },
  este: { g: "this (one)", t: "pronoun" },
  mío: { g: "mine", t: "pronoun" },
};
/** Numeral que se habia colado con glosa de argot ("once: top-notch"). Va a
 *  articles/numerals de tap-gloss-exempt.json, asi que aqui se BORRA: el lint
 *  de variantes falla si una exenta tiene glosa. */
const BORRA = ["once"];

async function main() {
  const dry = process.argv.includes("--dry");
  const prisma = new PrismaClient();
  const row = await prisma.tapGlossSet.findFirst({ where: { bundle: B, slug: "" } });
  if (!row) throw new Error(`no hay bundle ${B}`);
  const gl = row.glosses as Record<string, { g: string; t?: string }>;
  let cambios = 0;
  const faltan: string[] = [];
  for (const [w, v] of Object.entries(FIX)) {
    if (!gl[w]) { faltan.push(w); continue; }
    if (gl[w].g === v.g && gl[w].t === v.t) continue;
    console.log(`  ${w}: "${gl[w].g}" (${gl[w].t}) -> "${v.g}" (${v.t})`);
    gl[w] = { ...gl[w], ...v };
    cambios++;
  }
  let borradas = 0;
  for (const w of BORRA) if (gl[w]) { console.log(`  BORRA ${w}: "${gl[w].g}"`); delete gl[w]; borradas++; }
  if (faltan.length) console.log(`OJO, no estaban en el bundle: ${faltan.join(" ")}`);
  console.log(`${dry ? "[dry] " : ""}${cambios} corregidas, ${borradas} borradas, de ${Object.keys(gl).length + borradas} en el bundle`);
  if (!dry && (cambios || borradas)) {
    await prisma.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: "" } }, data: { glosses: gl as never } });
  }
  await prisma.$disconnect();
}
main();
