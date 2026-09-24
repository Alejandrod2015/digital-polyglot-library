/**
 * Cuantos nombres del catalogo no sabe decir la voz, y cuanto pesan.
 *
 * Corre `nombresDificiles` (el mismo del gate) sobre el TEXTO de las historias,
 * no sobre el banco: lo que importa es lo que la voz va a tener que decir. Solo
 * lee; no toca nada.
 *
 *   npx tsx scripts/_nombresRaros.ts [--journey <id>] [--narradas]
 */
import "./_loadEnv";
import { PrismaClient } from "../src/generated/prisma";
import { nombresDificiles } from "../src/lib/nameSpeakability";

const prisma = new PrismaClient();

/** Las mayusculas del texto que no abren frase: el mismo filtro del validador. */
function candidatos(texto: string): string[] {
  const out: string[] = [];
  for (const m of texto.matchAll(/\b([A-ZÁÉÍÓÚÂÊÔÃÕÑÜ][a-záéíóúâêôãõçñüö]{2,})\b/g)) {
    const i = m.index ?? 0;
    if (i === 0 || /[.!?"“”]\s*$/.test(texto.slice(Math.max(0, i - 3), i))) continue;
    out.push(m[1]);
  }
  return out;
}

(async () => {
  const soloNarradas = process.argv.includes("--narradas");
  const i = process.argv.indexOf("--journey");
  const journeyId = i >= 0 ? process.argv[i + 1] : null;

  const journeys = await prisma.journey.findMany({
    where: { ...(journeyId ? { id: journeyId } : {}), status: { not: "archived" } },
    select: { id: true, name: true, language: true, status: true },
  });

  const filas: { journey: string; status: string; nombre: string; veces: number; historias: number; narradas: number }[] = [];
  for (const j of journeys) {
    const st = await prisma.journeyStory.findMany({
      where: { journeyId: j.id, ...(soloNarradas ? { audioUrl: { not: null } } : {}) },
      select: { text: true, audioUrl: true },
    });
    const conteo = new Map<string, { veces: number; historias: number; narradas: number }>();
    for (const s of st) {
      if (!s.text) continue;
      const cand = candidatos(s.text);
      for (const d of nombresDificiles(cand, j.language)) {
        const re = new RegExp(`\\b${d.nombre}\\b`, "g");
        const veces = (s.text.match(re) ?? []).length;
        const prev = conteo.get(d.nombre) ?? { veces: 0, historias: 0, narradas: 0 };
        conteo.set(d.nombre, {
          veces: prev.veces + veces,
          historias: prev.historias + 1,
          narradas: prev.narradas + (s.audioUrl ? 1 : 0),
        });
      }
    }
    for (const [nombre, c] of conteo)
      filas.push({ journey: j.name ?? j.id, status: j.status, nombre, ...c });
  }

  filas.sort((a, b) => b.veces - a.veces);
  console.log("| journey | estado | nombre | veces | historias | de ellas narradas |");
  console.log("|---|---|---|---|---|---|");
  for (const f of filas)
    console.log(`| ${f.journey} | ${f.status} | ${f.nombre} | ${f.veces} | ${f.historias} | ${f.narradas} |`);
  const nombres = new Set(filas.map((f) => f.nombre));
  console.log(
    `\n${nombres.size} nombre(s) distinto(s) · ${filas.reduce((n, f) => n + f.veces, 0)} apariciones · ` +
    `${filas.reduce((n, f) => n + f.narradas, 0)} historias ya narradas con alguno`
  );
})().finally(() => prisma.$disconnect());
