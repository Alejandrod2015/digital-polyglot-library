/**
 * Portón de temas: un tema de journey no se crea sin una motivación real de
 * usuario detrás.
 *
 * WHY (2026-08-17): al montar el Friends ES/Spain A1 saqué dos de los siete
 * temas de `BetaSignup.motivation` y los otros cinco del molde de cualquier
 * curso de principiante. "Chemist & Doctor" prometía un médico que no salía en
 * ninguna historia; "Shops & Markets" repetía dos temas que el A0 del mismo
 * idioma ya cubría. El fallo solo se ve leyendo los siete juntos, y para
 * entonces ya hay 21 historias escritas.
 *
 * Hace UNA cosa: comprueba que cada tema cite, literalmente, algo que un
 * usuario escribió. Las reglas de nombre viven en la tabla de la spec y en el
 * validador; no se duplican aquí.
 */
import { PrismaClient } from "@/generated/prisma";

export type TopicProposal = {
  label: string;
  /** slug con el que se guardará; tiene que derivar del label */
  slug?: string;
  /** citas VERBATIM de BetaSignup.motivation o .applicationReason */
  evidence: string[];
};

export class TopicEvidenceError extends Error {}

export async function assertTopicsGrounded(opts: {
  language: string;
  proposals: TopicProposal[];
  /** labels que ya usan otros journeys del mismo idioma, para comparar */
  existingLabels?: string[];
  prisma?: PrismaClient;
}): Promise<void> {
  const prisma = opts.prisma ?? new PrismaClient();

  // El campo es `targetLanguage`, no `language`, y el filtro va en JS porque
  // no es una columna de texto libre.
  const all = await prisma.betaSignup.findMany({
    select: { targetLanguage: true, motivation: true, applicationReason: true },
  });
  const wanted = opts.language.toLowerCase();
  const corpus = all
    .filter((r) => String(r.targetLanguage ?? "").toLowerCase() === wanted)
    .flatMap((r) => [r.motivation, r.applicationReason].filter(Boolean) as string[])
    .map((s) => s.toLowerCase().trim());

  if (corpus.length === 0) {
    throw new TopicEvidenceError(
      `Cero motivaciones escritas de ${opts.language} en BetaSignup. Sin datos no se eligen temas.`,
    );
  }

  // Reglas de nombre comprobables desde la cadena. Las de criterio (que nombre
  // el dominio y no el sitio, el nivel de abstracción, que no sea una ciudad
  // disfrazada) no se pueden medir: para esas, la tabla que se imprime abajo.
  const nameProblems = opts.proposals.flatMap((p) => {
    const w = p.label.trim().split(/\s+/);
    const out: string[] = [];
    if (w.length < 2 || w.length > 4) out.push(`${w.length} palabras (2-4)`);
    if (/\band\b/i.test(p.label)) out.push('usa "And" en vez de "&"');
    if (/\b(spanish|mexican|colombian|argentin\w+|peruvian|chilean|german|italian|french|portuguese|brazilian|spain|mexico|colombia|argentina|peru|chile|germany|italy|france|portugal|brazil)\b/i.test(p.label))
      out.push("lleva el país o el gentilicio");
    if (/^(the|a|an|el|la|los|las|un|una)\b/i.test(p.label)) out.push("empieza por artículo");
    const badCase = w.filter((x) => x !== "&" && !/^(of|for|in|on|at|to)$/i.test(x) && !/^[A-ZÁÉÍÓÚÑ]/.test(x));
    if (badCase.length) out.push(`sin Title Case: ${badCase.join(", ")}`);
    if (p.slug) {
      const derived = p.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      if (p.slug !== derived) out.push(`el slug "${p.slug}" no deriva del nombre (sería "${derived}")`);
    }
    return out.length ? [`"${p.label}": ${out.join("; ")}`] : [];
  });

  const bad = nameProblems.concat(opts.proposals.flatMap((p) => {
    if (!p.evidence?.length) return [`"${p.label}": ninguna cita de usuario`];
    const fake = p.evidence.filter((q) => !corpus.some((c) => c.includes(q.toLowerCase().trim())));
    return fake.length ? [`"${p.label}": citas que no están en BetaSignup: ${fake.join(" / ")}`] : [];
  }));

  // La tabla que faltaba: cada tema con cuánta gente hay detrás de su cita, y
  // al lado lo que YA cubren los otros journeys del idioma. Los fallos de
  // criterio ("Chemist" junto a "Health & Emergencies", con un solo
  // solicitante detrás) solo se ven comparando; sin esto se eligen a ciegas.
  console.log(`\nTEMAS PROPUESTOS · ${corpus.length} motivaciones escritas de ${opts.language}`);
  for (const p of opts.proposals) {
    const n = p.evidence.reduce(
      (acc, q) => acc + corpus.filter((c) => c.includes(q.toLowerCase().trim())).length, 0);
    console.log(`  ${p.label.padEnd(30)} ${String(n).padStart(3)} solicitantes  <- ${p.evidence.join(" / ")}`);
  }
  if (opts.existingLabels?.length) {
    console.log(`\n  Ya cubierto en ${opts.language}: ${opts.existingLabels.join(" · ")}`);
  }
  console.log("");

  if (bad.length) {
    throw new TopicEvidenceError(
      `TEMAS SIN RESPALDO:\n  - ${bad.join("\n  - ")}\n\n` +
      `Corre \`npx tsx scripts/userEvidence.ts ${opts.language}\` y elige desde ahí.`,
    );
  }
}
