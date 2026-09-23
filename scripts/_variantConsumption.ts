/**
 * Cuantos usuarios consumen cada variante de espanol (spain vs latam y sus
 * paises), medido en UserMetric por storySlug -> JourneyStory -> Journey.
 * Excluye internos por metadata.internal (sellado al escribir, definicion 1 de
 * project_metrics_internal_definitions) mas METRICS_EXCLUDE_USER_IDS.
 * Scratch (2026-09-18), no es gate.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();

async function main() {
  const internos = new Set((process.env.METRICS_EXCLUDE_USER_IDS ?? "").split(",").map((x) => x.trim()).filter(Boolean));
  const stories = await p.journeyStory.findMany({
    where: { journey: { language: "spanish" } },
    select: { slug: true, journey: { select: { variant: true, name: true, levels: true, status: true } } },
  });
  const bySlug = new Map<string, { variant: string; journey: string }>();
  for (const s of stories) {
    if (!s.slug) continue;
    // un slug puede repetirse entre journeys; nos quedamos con el primero live
    if (!bySlug.has(s.slug) || s.journey.status === "active")
      bySlug.set(s.slug, { variant: s.journey.variant, journey: `${s.journey.name} ${s.journey.variant} ${s.journey.levels.join("/")}` });
  }
  const desde30 = new Date(Date.now() - 30 * 864e5);
  const rows = await p.userMetric.findMany({
    where: { storySlug: { in: [...bySlug.keys()] } },
    select: { userId: true, storySlug: true, createdAt: true, metadata: true },
  });
  type Acc = { users: Set<string>; users30: Set<string>; eventos: number };
  const porVariante = new Map<string, Acc>();
  const porJourney = new Map<string, Acc>();
  const usuariosTotales = new Set<string>();
  const usuariosPorVariante = new Map<string, Set<string>>();
  let internosFuera = 0;
  for (const r of rows) {
    const meta = r.metadata as { internal?: boolean } | null;
    if (internos.has(r.userId) || meta?.internal === true) { internosFuera++; continue; }
    const s = bySlug.get(r.storySlug)!;
    usuariosTotales.add(r.userId);
    for (const [k, m] of [[s.variant, porVariante], [s.journey, porJourney]] as const) {
      const a = m.get(k) ?? { users: new Set(), users30: new Set(), eventos: 0 };
      a.users.add(r.userId); a.eventos++;
      if (r.createdAt >= desde30) a.users30.add(r.userId);
      m.set(k, a);
    }
    if (!usuariosPorVariante.has(s.variant)) usuariosPorVariante.set(s.variant, new Set());
    usuariosPorVariante.get(s.variant)!.add(r.userId);
  }
  const grupo = (v: string) => (v === "spain" ? "ES España" : "ES LATAM (latam+latam-multi+mexico+colombia+argentina)");
  const g = new Map<string, Acc>();
  for (const [v, a] of porVariante) {
    const k = grupo(v);
    const b = g.get(k) ?? { users: new Set(), users30: new Set(), eventos: 0 };
    a.users.forEach((u) => b.users.add(u)); a.users30.forEach((u) => b.users30.add(u)); b.eventos += a.eventos;
    g.set(k, b);
  }
  // 2026-09-19: "latam-multi" es el codigo nuevo de los 6 journeys tour
  // pan-regional (TAXONOMIA_variantes_latam). Sin esta entrada, sus usuarios
  // dejarian de contarse en el solape con España en cuanto Journey.variant
  // pase de "latam" a "latam-multi".
  const ambos = [...(usuariosPorVariante.get("spain") ?? [])].filter((u) =>
    ["latam", "latam-multi", "mexico", "colombia", "argentina"].some((v) => usuariosPorVariante.get(v)?.has(u))
  ).length;
  console.log(`Fuente: UserMetric (dp_user_metrics_v1) por storySlug de JourneyStory spanish; internos excluidos por metadata.internal y METRICS_EXCLUDE_USER_IDS (${internosFuera} eventos fuera). Usuarios externos con algun evento en journeys ES: ${usuariosTotales.size}. Con eventos en AMBOS grupos: ${ambos}.\n`);
  console.log("| Grupo | Usuarios (total) | Usuarios (30 dias) | Eventos |\n|---|---|---|---|");
  for (const [k, a] of [...g].sort((x, y) => y[1].users.size - x[1].users.size))
    console.log(`| ${k} | ${a.users.size} | ${a.users30.size} | ${a.eventos} |`);
  console.log("\n| Variante | Usuarios (total) | Usuarios (30 dias) | Eventos |\n|---|---|---|---|");
  for (const [k, a] of [...porVariante].sort((x, y) => y[1].users.size - x[1].users.size))
    console.log(`| ${k} | ${a.users.size} | ${a.users30.size} | ${a.eventos} |`);
  console.log("\n| Journey | Usuarios (total) | Usuarios (30 dias) | Eventos |\n|---|---|---|---|");
  for (const [k, a] of [...porJourney].sort((x, y) => y[1].users.size - x[1].users.size))
    console.log(`| ${k} | ${a.users.size} | ${a.users30.size} | ${a.eventos} |`);
  await p.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
