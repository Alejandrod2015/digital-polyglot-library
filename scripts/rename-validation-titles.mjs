// Renombra títulos de validaciones (AgentRun.agentKind=validar) que
// siguen el patrón monótono "[Objeto plural] en [Lugar]".
//
// 11 títulos detectados, todos siguiendo "[plural] en [place]":
//   Peceras en Miraflores · Faroles en Tepoztlán · Patines en
//   Providencia · Velas en Oaxaca · Murales en San Telmo · Faroles
//   en Valparaíso · Pozole en La Boca · Hamaca en Mérida · Cometas
//   en Barranco · Tamales en Coyoacán · Test validation
//
// Para cada uno propongo un título estructuralmente distinto que
// match el contenido temático sugerido por el lugar + objeto. El
// AgentRun no es audit externo (es la cola de trabajo de la
// trabajadora) — está bien rebautizarlo. Se actualiza:
//   - input.raw (string JSON; reemplazo del campo "title")
//   - input.payload.title (si existe)
//   - output.parsed.title (si existe)

import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Nuevos títulos con variedad estructural: cláusulas temporales,
// referencias internas, sustantivos solos, preguntas.
//
// Segunda pasada (2026-05-22): la primera ronda hizo renames sin leer
// los payloads, terminé con varios mismatches (Faroles → "velas",
// Tamales → "tía Lupe" cuando no hay tía Lupe, "La cera lentamente"
// agramatical). Re-mapeo desde los títulos ACTUALES (post-primera
// pasada) a títulos que reflejan el contenido leído de los AgentRun.
const TITLE_MAP = {
  // ── Quedan como están (reflejan el contenido) ──
  // "El pez que faltaba" (Vera/Lucas limpian pecera, pez desaparece)
  // "Hilos sobre Barranco" (Abril/Simón cometa con varilla rota)
  // ── Correcciones segunda pasada ──
  "Cuando se encienden las velas": "Faroles para la noche",
  "Vuelta a la pista de Providencia": "La caja debajo de la cama",
  "La cera lentamente": "La noche sin luz",
  "Una pared cuenta historias": "El mural del abuelo",
  "Subiendo el cerro al anochecer": "La caminata con faroles",
  "Domingo de pozole": "La caja del armario",
  "Tarde sin reloj": "Antes de que llegue el tío",
  "Sábado con tía Lupe": "La caja que nadie abre",
};

function rewriteRawTitle(raw, newTitle) {
  if (typeof raw !== "string") return raw;
  return raw.replace(
    /("title"\s*:\s*")([^"\\]+)(")/,
    (_, p1, _old, p3) => `${p1}${newTitle.replace(/"/g, '\\"')}${p3}`,
  );
}

async function main() {
  console.log(`${APPLY ? "APPLY" : "DRY RUN"}\n`);

  const runs = await prisma.agentRun.findMany({
    where: { agentKind: "validar" },
    select: { id: true, input: true, output: true },
  });

  let updated = 0;
  for (const r of runs) {
    const input = (r.input ?? {});
    const output = (r.output ?? null);
    const currentTitle =
      input.payload?.title?.trim() ||
      output?.parsed?.title?.trim() ||
      (typeof input.raw === "string"
        ? input.raw.match(/"title"\s*:\s*"([^"]+)"/)?.[1]?.trim()
        : null);
    if (!currentTitle) continue;
    const newTitle = TITLE_MAP[currentTitle];
    if (!newTitle) continue;

    const nextInput = { ...input };
    if (input.payload && typeof input.payload === "object") {
      nextInput.payload = { ...input.payload, title: newTitle };
    }
    if (typeof input.raw === "string") {
      nextInput.raw = rewriteRawTitle(input.raw, newTitle);
    }
    let nextOutput = output;
    if (output?.parsed && typeof output.parsed === "object") {
      nextOutput = {
        ...output,
        parsed: { ...output.parsed, title: newTitle },
      };
    }

    console.log(`  ${currentTitle.padEnd(30)} → ${newTitle}  (${r.id})`);
    if (APPLY) {
      await prisma.agentRun.update({
        where: { id: r.id },
        data: { input: nextInput, output: nextOutput ?? undefined },
      });
    }
    updated += 1;
  }

  console.log(`\n${updated} AgentRun ${APPLY ? "actualizados" : "se actualizarían"}.`);
  if (!APPLY) console.log("[DRY RUN] Pass --apply.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
