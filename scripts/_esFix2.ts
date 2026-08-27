/** Arregla SOLO las dos clases de tabla equivocada, y no toca nada más.
 *
 *  (a) LEMA INVENTADO. Cortar `decidió` por la `ó` daba `decidiar`, que no
 *      existe: esa i es de la terminación -ió, no de la raíz. La tarjeta
 *      enseñaba un verbo que nadie ha dicho nunca.
 *  (b) PRIMERA PERSONA MAL. `conoco`, `apareco`, `cao`, `salo`. Solo se ve
 *      leyendo la fila de yo, que es justo la que el chequeo de `here` no mira.
 *
 *  Lo demás se queda como está: los bloques de plural, de pronombre y de
 *  contracción son de otra mano y una regeneración entera se los comería.
 *
 *  npx tsx scripts/_esFix2.ts <bundle> [--dry]
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

/** Infinitivos que el motor SÍ conjuga; si el lema no está aquí ni es una
 *  palabra que el motor reconozca, es inventado. */
const REALES = new Set<string>();

async function main() {
  const bundle = process.argv[2];
  const dry = process.argv.includes("--dry");
  const filas = await p.tapGlossSet.findMany({ where: { bundle } });
  const global = filas.find((f) => f.slug === "")!;
  const g = global.glosses as Record<string, { t: string; g: string }>;

  const hist = await p.journeyStory.findMany({ where: { slug: { in: global.slugs } }, select: { slug: true, title: true, text: true } });
  const textos: Record<string, string> = {};
  for (const h of hist) textos[h.slug!] = `${h.title}. ${h.text}`;
  fs.writeFileSync("/tmp/_esfix.json", JSON.stringify(textos));

  const fantasma = `${bundle}--refresh`;
  await p.tapGlossSet.deleteMany({ where: { bundle: fantasma } });
  await p.tapGlossSet.create({ data: { bundle: fantasma, slug: "", language: global.language, variant: global.variant, slugs: global.slugs, glosses: global.glosses as never } });
  execFileSync("npx", ["tsx", "scripts/buildGlossForms.ts", fantasma, "/tmp/_esfix.json"], { stdio: "pipe" });
  const nf = await p.tapGlossSet.findMany({ where: { bundle: fantasma } });
  const buenas = new Map(nf.filter((x) => x.slug !== "").map((x) => [x.slug, x.glosses as Record<string, any>]));
  for (const x of nf) for (const e of Object.values(x.glosses as Record<string, any>)) if (e.f?.lemma) REALES.add(String(e.f.lemma).replace(/ \(.*\)$/, ""));

  const informe: string[] = [];
  let arregladas = 0, quitadas = 0;
  for (const f of filas.filter((x) => x.slug !== "")) {
    const capa = f.glosses as Record<string, any>;
    let toco = false;
    for (const [w, e] of Object.entries(capa)) {
      if (!e.f?.lemma || g[w]?.t !== "verb") continue;
      const lema = String(e.f.lemma);
      const inf = lema.replace(/ \(.*\)$/, "");
      const yo = String(e.f.rows?.[0]?.[1] ?? "");
      const presente = !/\(/.test(lema);
      // -iar de verdad que el motor ya no alcanza desde el texto: la forma
      // `sentenció` no dice si viene de sentenciar, sentencer o sentencir, asi
      // que el generador renuncia. La tabla vieja SI era correcta.
      const IAR_REALES = new Set(["sentenciar", "cambiar", "odiar", "aliar", "estudiar", "limpiar", "copiar", "enviar", "guiar", "vaciar", "anunciar", "apreciar", "iniciar", "negociar", "pronunciar", "asociar", "despreciar", "acariciar", "ansiar", "confiar", "criar", "desafiar", "enfriar", "espiar", "fiar", "liar", "variar", "actuar", "continuar", "graduar", "situar", "evaluar", "acentuar", "insinuar"]);
      // El lema inventado tiene UNA forma reconocible: acaba en -iar y sale de
      // haber cortado un `-ió` por la `ó` (prometiar, sintiar, comiar). Solo
      // eso se toca. Un lema escrito a mano ("seguir + gerundio", "acordarse
      // de") es mejor que cualquier cosa que genere el motor, y se queda.
      const inventado = /iar$/.test(inf) && !IAR_REALES.has(inf) && !REALES.has(inf);
      // La primera solo se toca cuando es LA MALA de verdad: la que sale de
      // pegarle una -o a la raiz (conoco, apareco, cao, salo). Una tabla vieja
      // de preterito o de subjuntivo puede llevar el lema sin marca de tiempo
      // ("oír" para `oyera`), y ahi la fila de yo no es un presente: mirarla
      // como si lo fuera se llevaba por delante tablas correctas.
      const ingenua = `${inf.replace(/(ír|ir|er)$/, "")}o`;
      const primeraMal = presente && yo === ingenua && (
        (/[aeiouáéíóú]c(er|ir)$/.test(inf) && !["hacer", "decir"].includes(inf)) ||
        ["salir", "caer", "traer", "poner", "valer", "oír", "oir"].includes(inf)
      );
      if (!inventado && !primeraMal) continue;
      const nueva = buenas.get(f.slug)?.[w]?.f;
      if (nueva) { e.f = nueva; arregladas++; informe.push(`  ${f.slug.slice(0,24).padEnd(25)} ${w.padEnd(12)} ${lema} -> ${nueva.lemma}`); }
      else if (primeraMal) {
        // El resto de la tabla esta bien; lo unico falso es la fila de yo. Se
        // corrige la celda y se deja el bloque, que borrarlo entero seria
        // tirar cinco formas buenas por una mala.
        const buena = /[aeiouáéíóú]c(er|ir)$/.test(inf) ? `${inf.slice(0, -3)}zco` : `${inf.replace(/(ír|ir|er)$/, "")}go`;
        e.f.rows[0][1] = buena; arregladas++;
        informe.push(`  ${f.slug.slice(0,24).padEnd(25)} ${w.padEnd(12)} ${lema}: yo ${yo} -> ${buena}`);
      }
      else { delete e.f; quitadas++; informe.push(`  ${f.slug.slice(0,24).padEnd(25)} ${w.padEnd(12)} ${lema} -> SIN TABLA`); }
      toco = true;
    }
    if (toco && !dry) await p.tapGlossSet.update({ where: { bundle_slug: { bundle, slug: f.slug } }, data: { glosses: capa as never } });
  }
  await p.tapGlossSet.deleteMany({ where: { bundle: fantasma } });
  console.log(informe.join("\n"));
  console.log(`${bundle}: ${arregladas} rehechas, ${quitadas} quitadas${dry ? " (--dry)" : ""}`);
  await p.$disconnect();
}
main();
