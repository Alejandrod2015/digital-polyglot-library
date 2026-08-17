/**
 * Pasa un journey al estilo de comillas de la casa: INGLESAS “ ” (U+201C/201D).
 *
 *   npx tsx scripts/unifyQuoteStyle.ts --journey <id> --out <data.json>
 *   npx tsx scripts/unifyQuoteStyle.ts --all --outdir <dir>
 *
 * NO escribe en la base de datos. Solo lee las historias, aplica el cambio y
 * deja un data.json con el formato que espera scripts/saveStory.ts, que es el
 * único camino sancionado para que el contenido llegue a la DB.
 *
 * El swap es 1:1 en caracteres (los cinco ocupan una unidad), así que el
 * cuerpo conserva su longitud EXACTA y los offsets charStart/charEnd del
 * karaoke siguen siendo válidos. El script verifica esa invariante por
 * historia y aborta si alguna cambia de largo.
 *
 * Orden de sustitución (importa): angulares, invertidas, bajas alemanas y al
 * final las rectas. Las bajas alemanas CIERRAN con la recta ASCII, así que si
 * las rectas fueran primero partirían cada „…" por la mitad.
 */
import { config } from "dotenv"; config({ path: ".env", quiet: true }); config({ path: ".env.local", quiet: true });
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();
const LQ = "“"; // “
const RQ = "”"; // ”

export function toCurly(s: string): { out: string; changed: number; odd: boolean } {
  let changed = 0;
  // --no-swap: vuelca el texto TAL CUAL, para poder validar el original y el
  // convertido con el mismo validador y comparar los checks uno a uno.
  if (process.argv.includes("--no-swap")) return { out: s, changed: 0, odd: false };
  let out = s
    .replace(/«([^»«]*)»/g, (_m, inner) => { changed++; return LQ + inner + RQ; })
    .replace(/»([^«»]*)«/g, (_m, inner) => { changed++; return LQ + inner + RQ; })
    .replace(/„([^"„]*)"/g, (_m, inner) => { changed++; return LQ + inner + RQ; });

  // Comillas SIMPLES usadas como cita ('Estamos en el horno'). Solo cuentan
  // como comillas cuando forman par y la apertura no va pegada a una letra;
  // pegada a letra es una elisión, no una comilla, y hay que respetarla:
  // pa' qué, un po' tristi, Campo de' Fiori, Max' Gruppe.
  out = out.replace(/(^|[^\p{L}\p{N}])'([^'\n]{2,70})'/gu, (_m, pre, inner) => { changed++; return `${pre}${LQ}${inner}${RQ}`; });

  // Rectas: mismo carácter abre y cierra, se alternan por posición.
  const straight = (out.match(/"/g) || []).length;
  const odd = straight % 2 === 1;
  if (!odd && straight > 0) {
    let open = true;
    out = out.replace(/"/g, () => { const c = open ? LQ : RQ; if (open) changed++; open = !open; return c; });
  }
  return { out, changed, odd };
}

/** Mismo swap, aplicado solo a los valores string de un JSON (p. ej. vocab). */
function swapInJson(v: any): any {
  if (typeof v === "string") return toCurly(v).out;
  if (Array.isArray(v)) return v.map(swapInJson);
  if (v && typeof v === "object") {
    const o: Record<string, any> = {};
    for (const [k, val] of Object.entries(v)) o[k] = swapInJson(val);
    return o;
  }
  return v;
}

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };

(async () => {
  const journeyId = arg("journey");
  const all = process.argv.includes("--all");
  if (!journeyId && !all) { console.error("usage: --journey <id> --out <file> | --all --outdir <dir>"); process.exit(2); }

  const journeys = await p.journey.findMany({
    where: all ? { status: { in: ["active", "draft"] } } : { id: journeyId },
    select: {
      id: true, name: true, language: true, variant: true, status: true,
      stories: {
        where: { text: { not: null } },
        orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
        select: { id: true, topic: true, slotIndex: true, level: true, title: true, slug: true, synopsis: true, text: true, vocab: true, arcType: true },
      },
    },
  });

  let bad = 0;
  const manifest: { file: string; id: string; label: string }[] = [];
  for (const j of journeys) {
    const rows: any[] = [];
    let touched = 0, swaps = 0;
    for (const s of j.stories) {
      const body = toCurly(s.text!);
      const syn = toCurly(s.synopsis ?? "");
      const title = toCurly(s.title ?? "");
      if (body.odd || syn.odd || title.odd) {
        console.error(`  ! ${s.slug}: comilla recta impar, no se puede emparejar. Se deja fuera.`);
        bad++; continue;
      }
      if (body.out.length !== s.text!.length) {
        console.error(`  ! ${s.slug}: el cuerpo cambió de longitud (${s.text!.length} -> ${body.out.length}). ABORTA.`);
        process.exit(1);
      }
      const n = body.changed + syn.changed + title.changed;
      if (n) { touched++; swaps += n; }
      rows.push({
        topic: s.topic, slotIndex: s.slotIndex, title: title.out || s.title,
        slug: s.slug, synopsis: syn.out || s.synopsis, text: body.out,
        vocab: swapInJson(s.vocab ?? []), arcType: s.arcType,
      });
    }
    const level = [...new Set(j.stories.map((s) => s.level))].join("/");
    const outFile = all
      ? path.join(arg("outdir") || ".", `${j.language}-${j.variant}-${j.name}-${level}.json`.replace(/\s+/g, "_"))
      : (arg("out") || "quotes.json");
    fs.writeFileSync(outFile, JSON.stringify(rows, null, 2), "utf8");
    manifest.push({ file: outFile, id: j.id, label: `${j.language}/${j.variant} ${level} ${j.name}` });
    console.log(`${j.language}/${j.variant} ${level} ${j.name} [${j.status}] · ${rows.length} historias · ${touched} tocadas · ${swaps} citas convertidas · id=${j.id}`);
    console.log(`   -> ${outFile}`);
  }
  if (all) {
    const mf = path.join(arg("outdir") || ".", "_manifest.json");
    fs.writeFileSync(mf, JSON.stringify(manifest, null, 2), "utf8");
    console.log(`\nmanifiesto -> ${mf}`);
  }
  if (bad) console.error(`\n${bad} historias con comillas impares quedaron fuera.`);
})().finally(() => p.$disconnect());
