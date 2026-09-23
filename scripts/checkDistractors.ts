/**
 * LINT: ningun ejercicio de practica se puede acertar sin saber la palabra.
 *
 * WHY: el 2026-09-21 una muestra al azar de 216 ejercicios de los 27 journeys
 * live dio tres journeys espanoles (A1 latam, A2 Spain, B1 Spain Traveler,
 * 1.737 ejercicios) donde la respuesta era la UNICA opcion con mayuscula y
 * punto entre glosas sueltas de otras historias ("To defend; to argue..." vs
 * "a perfume", "crunchy"), un FR A1 con glosas rellenadas ("today today today")
 * y, en los curados, la mas larga era la buena en 678 tarjetas y un par de
 * antonimos dejaba al alumno a 50% sin leer. `_validateSets.ts` solo miraba
 * estructura (4 opciones, sin duplicados). Las reglas viven en
 * scripts/distractorGate.ts; este lint las pasa por lo que YA esta en la base.
 *
 * TRINQUETE. La deuda vieja no bloquea (seria un lint rojo desde el minuto
 * cero, que se ignora); lo que bloquea es que un journey EMPEORE. La linea base
 * por journey vive en scripts/distractors-baseline.json; se baja con --apretar
 * cuando un journey se arregla, y nunca se sube a mano.
 *
 *   npm run lint:distractors                      (live + draft)
 *   npm run lint:distractors -- --journey=<id>    (uno; imprime cada fallo)
 *   npm run lint:distractors -- --apretar         (reescribe la linea base a lo de hoy)
 *
 * Exit: 0 limpio o dentro de la linea base, 1 si algun journey supera la suya
 * o no tiene linea base.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../src/generated/prisma";
import { distractorIssues } from "./distractorGate";

const prisma = new PrismaClient();
const BASELINE = path.join(__dirname, "distractors-baseline.json");

type Base = Record<string, { label: string; failing: number }>;

function leerBase(): Base {
  try { return JSON.parse(fs.readFileSync(BASELINE, "utf8")); } catch { return {}; }
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.find((a) => a.startsWith("--journey="))?.split("=")[1];
  const apretar = args.includes("--apretar");
  const verbose = !!only || args.includes("--verbose");

  const journeys = await prisma.journey.findMany({
    where: only ? { id: only } : { status: { in: ["active", "draft"] } },
    select: { id: true, name: true, language: true, levels: true, variant: true, status: true,
      stories: { select: { id: true, text: true, practiceSet: { select: { exercises: {
        select: { id: true, type: true, word: true, sentence: true, payload: true },
        orderBy: { orderIndex: "asc" } } } } } } },
    orderBy: [{ language: "asc" }, { variant: "asc" }],
  });

  const base = leerBase();
  const nueva: Base = {};
  const rows: string[] = [];
  let peor: string[] = [];
  let totalEx = 0, totalFail = 0;

  for (const j of journeys) {
    const level = Array.isArray(j.levels) ? String((j.levels as any[])[0] ?? "") : "";
    const label = `${j.language} ${level} ${j.variant} ${j.name} (${j.status})`;
    const corpus = j.stories.map((s) => s.text ?? "").join("\n");
    const porRegla: Record<string, number> = {};
    let n = 0, failing = 0, warn = 0;
    for (const s of j.stories) {
      for (const e of s.practiceSet?.exercises ?? []) {
        n++;
        const r = distractorIssues(e, { language: j.language, corpus });
        if (r.issues.length) {
          failing++;
          for (const i of r.issues) { const k = i.match(/\b(D\d)\b/)?.[1] ?? "?"; porRegla[k] = (porRegla[k] ?? 0) + 1; }
          if (verbose) console.log(`  ${e.type} ${e.word}\n    ${r.issues.join("\n    ")}`);
        }
        if (r.warnings.length) { warn++; if (verbose) console.log(`  ${e.type} ${e.word}\n    ! ${r.warnings.join("\n    ! ")}`); }
      }
    }
    totalEx += n; totalFail += failing;
    nueva[j.id] = { label, failing };
    const b = base[j.id];
    const estado = !b ? "SIN LINEA BASE" : failing > b.failing ? `PEOR (base ${b.failing})` : failing < b.failing ? `mejor (base ${b.failing})` : "=";
    if ((!b || failing > b.failing) && !apretar) peor.push(`${label}: ${failing} fallan${b ? `, base ${b.failing}` : ""}`);
    const reglas = Object.entries(porRegla).sort((a, b2) => b2[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(" ");
    rows.push(`| ${label} | ${n} | ${failing} (${n ? Math.round((100 * failing) / n) : 0}%) | ${reglas} | ${warn} | ${estado} |`);
  }

  console.log("| journey | ejercicios | fallan | por regla | avisos | vs linea base |");
  console.log("|---|---|---|---|---|---|");
  for (const r of rows) console.log(r);
  console.log(`\n${journeys.length} journeys, ${totalEx} ejercicios, ${totalFail} fallan el gate.`);

  if (apretar) {
    const merged: Base = { ...base };
    for (const [id, v] of Object.entries(nueva)) {
      // Solo baja. Subir la linea base es lo que el trinquete impide.
      if (!merged[id] || v.failing <= merged[id].failing) merged[id] = v;
    }
    fs.writeFileSync(BASELINE, JSON.stringify(merged, null, 2) + "\n");
    console.log(`Linea base escrita en ${path.relative(process.cwd(), BASELINE)}.`);
    return;
  }

  if (peor.length) {
    console.error(`\nLINT distractors: ${peor.length} journey(s) fuera de la linea base:\n  ${peor.join("\n  ")}`);
    console.error("\nArregla los ejercicios (npm run lint:distractors -- --journey=<id> los lista) o, si es un journey nuevo con deuda heredada, registralo con --apretar en un commit visible.");
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
