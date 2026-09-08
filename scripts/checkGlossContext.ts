/**
 * LINT: toda palabra glosada que se pueda TOCAR en una historia tiene que
 * tener su contexto EN ESA historia.
 *
 * WHY: la tarjeta del lector muestra dos lineas, el sentido y la frase donde
 * cae. Si la palabra solo vive en la fila global del bundle, sin `c`, la
 * tarjeta repite la definicion dos veces: el 2026-09-02 el usuario toco
 * `carga` y leyo "load, cargo" arriba y "load, cargo" abajo.
 *
 * El barrido anterior no lo veia porque comprobaba las entradas que YA tenian
 * contexto, y estas no tienen ninguno.
 *
 * ALCANCE (2026-09-07): sin argumento barre TODOS los bundles. La version
 * anterior comprobaba UNO clavado (spanish-traveler-latam-a2) y su "limpio"
 * se citaba como si cubriera el catalogo: el chat del PT A2 midio 1526
 * tocables sin contexto en el B1 de portugues mientras este lint decia
 * limpio. Misma clase de fallo-en-abierto que checkGlossMoods antes del
 * manifiesto. La deuda anterior queda CONGELADA por bundle en
 * scripts/gloss-context-baseline.json, trinquete que solo baja (igual que
 * los trozos largos de gloss-variants): un hueco NUEVO bloquea, la deuda
 * vieja se ve en cada corrida y se quema por encargos.
 *
 * Run:  npm run lint:gloss-context            (todos, contra la linea base)
 *       npx tsx scripts/checkGlossContext.ts <bundle>   (uno, a cero)
 *       npm run lint:gloss-context -- --apretar         (baja la linea base)
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();
const TAPPABLE = /\p{L}[\p{L}\p{M}'-]*/gu;
const BASELINE = path.join(__dirname, "gloss-context-baseline.json");

async function medirBundle(bundle: string): Promise<{ huecos: number; historias: number; detalle: string[] }> {
  const rows = await prisma.tapGlossSet.findMany({
    where: { bundle }, select: { slug: true, glosses: true },
  });
  const global = (rows.find((r) => !r.slug)?.glosses ?? {}) as Record<string, { g?: string }>;
  const porHistoria = new Map(
    rows.filter((r) => r.slug).map((r) => [r.slug, (r.glosses ?? {}) as Record<string, { c?: unknown }>])
  );
  const stories = await prisma.journeyStory.findMany({
    where: { slug: { in: [...porHistoria.keys()] } },
    select: { slug: true, title: true, text: true },
  });
  let huecos = 0;
  const detalle: string[] = [];
  for (const s of stories) {
    const propias = porHistoria.get(s.slug)!;
    const faltan = new Set<string>();
    for (const m of `${s.title}. ${s.text}`.matchAll(TAPPABLE)) {
      const k = m[0].toLowerCase();
      if (!global[k]) continue; // no es glosable
      const v = propias[k] as { c?: unknown } | undefined;
      if (!v || !(v as any).c) faltan.add(k);
    }
    if (faltan.size) {
      huecos += faltan.size;
      detalle.push(`  ${s.slug}: ${faltan.size} sin contexto (${[...faltan].slice(0, 10).join(", ")})`);
    }
  }
  return { huecos, historias: stories.length, detalle };
}

(async () => {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const apretar = process.argv.includes("--apretar");

  // Un bundle a mano: a cero, sin linea base (para trabajar una capa).
  if (args[0]) {
    const { huecos, historias, detalle } = await medirBundle(args[0]);
    if (huecos === 0) {
      console.log(`gloss-context: limpio (${args[0]}: ${historias} historias, ninguna palabra tocable sin su frase)`);
      return;
    }
    for (const d of detalle) console.error(d);
    console.error(`\ngloss-context: ${huecos} palabra(s) tocables sin contexto en ${args[0]}`);
    console.error("La tarjeta les repite la definicion dos veces. Escribe su frase en la fila de la historia.");
    process.exitCode = 1;
    return;
  }

  // Sin argumento: TODOS los bundles, contra la linea base.
  const bundles = (await prisma.tapGlossSet.findMany({
    select: { bundle: true }, distinct: ["bundle"],
  })).map((b) => b.bundle).sort();
  const base: Record<string, number> = fs.existsSync(BASELINE)
    ? JSON.parse(fs.readFileSync(BASELINE, "utf8"))
    : {};
  const medido: Record<string, number> = {};
  let nuevos = 0;
  let deudaVieja = 0;
  for (const b of bundles) {
    const { huecos, detalle } = await medirBundle(b);
    medido[b] = huecos;
    const tope = base[b] ?? 0;
    if (huecos > tope) {
      nuevos += huecos - tope;
      console.error(`${b}: ${huecos} sin contexto (linea base ${tope}) <-- HUECOS NUEVOS`);
      for (const d of detalle.slice(0, 6)) console.error(d);
    } else if (huecos > 0) {
      deudaVieja += huecos;
      console.log(`${b}: ${huecos} sin contexto (deuda vieja, tope ${tope})`);
    }
  }

  if (apretar) {
    const apretada: Record<string, number> = {};
    for (const [b, n] of Object.entries(medido)) if (n > 0) apretada[b] = n;
    fs.writeFileSync(BASELINE, JSON.stringify(apretada, null, 2) + "\n");
    console.log(`gloss-context: linea base apretada (${Object.keys(apretada).length} bundles con deuda).`);
    return;
  }

  if (nuevos > 0) {
    console.error(`\ngloss-context: ${nuevos} hueco(s) NUEVOS por encima de la linea base.`);
    console.error("La tarjeta les repite la definicion dos veces. Escribe su frase en la fila de la historia.");
    process.exitCode = 1;
    return;
  }
  console.log(
    `gloss-context: limpio (${bundles.length} bundles, sin huecos nuevos)` +
    (deudaVieja ? ` · deuda vieja ${deudaVieja} en ${Object.entries(medido).filter(([, n]) => n > 0).length} bundle(s), solo puede bajar` : "")
  );
})().finally(() => prisma.$disconnect());
