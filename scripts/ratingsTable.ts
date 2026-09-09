// La senal que dejan los testers de la beta, en una sola pasada y en Markdown.
//
//   npx tsx scripts/ratingsTable.ts
//
// Tres cosas, y las tres partidas entre lo de casa y lo de fuera:
//   1. Pulgares (StoryRating), por superficie y plataforma.
//   2. Comentarios escritos junto al pulgar.
//   3. Impresiones de la fila de valorar (UserMetric "rating_prompt_shown"),
//      que son el DENOMINADOR: sin ellas un cero de votos no se puede leer.
//
// Existe porque el 2026-08-21 se reportaron "6 pulgares" como senal de testers
// y los seis eran del equipo; y porque el 2026-09-05 los dos unicos "de
// testers" eran de review@digitalpolyglot.com, la cuenta con la que se revisa
// la app en la tienda. Un total sin partir no vale nada. Y existe UNO SOLO:
// cada numero de este informe salia de una consulta suelta escrita en un chat.

import Module from "node:module";
import { existsSync, readFileSync } from "node:fs";

const load = (Module as unknown as { _load: (r: string, ...a: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = function (request: string, ...args: unknown[]) {
  if (request === "server-only") return {};
  return load.call(this, request, ...args);
};

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const fecha = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ");
/** Una barra vertical sin escapar parte una celda de Markdown en dos. */
const celda = (s: string) => s.replace(/\|/g, "\\|");

function tabla(cabeceras: string[], filas: string[][]): string {
  const cuerpo = filas.length > 0 ? filas : [cabeceras.map(() => "-")];
  return [
    `| ${cabeceras.join(" | ")} |`,
    `| ${cabeceras.map(() => "---").join(" | ")} |`,
    ...cuerpo.map((f) => `| ${f.map(celda).join(" | ")} |`),
  ].join("\n");
}

const pct = (a: number, b: number) => (b === 0 ? "-" : `${Math.round((a / b) * 100)}%`);

type Metadata = { surface?: unknown; internal?: unknown; platform?: unknown; alreadyRated?: unknown };

async function main() {
  const { PrismaClient } = await import("../src/generated/prisma");
  const { splitInternal } = await import("../src/lib/internalAccounts");
  const prisma = new PrismaClient();

  const ratings = await prisma.storyRating.findMany({ orderBy: { createdAt: "asc" } });
  const impresionesRaw = await prisma.userMetric.findMany({
    where: { eventType: "rating_prompt_shown" },
    orderBy: { createdAt: "asc" },
  });

  // ---------------------------------------------------------------- pulgares
  //
  // El sello lo pone el endpoint al escribir (columna `internal`). El reparto
  // por correo se queda como red: una fila anterior a la columna, o de alguien
  // dado de alta en el Studio despues de votar, sigue cayendo del lado bueno.
  const sinSello = ratings.filter((r) => !r.internal);
  const { external: votosFuera, internal: internosPorCorreo } = await splitInternal(
    sinSello,
    (r) => r.email,
  );
  const votosCasa = [...ratings.filter((r) => r.internal), ...internosPorCorreo];

  // ------------------------------------------------------------- impresiones
  //
  // UserMetric no guarda correo, solo `userId`, asi que la red por correo de
  // los pulgares no vale tal cual: primero hay que ponerle un correo a cada
  // userId. Lo dan las dos tablas que guardan las dos cosas juntas.
  const signups = await prisma.betaSignup.findMany({
    where: { clerkUserId: { not: null } },
    select: { clerkUserId: true, email: true },
  });
  const prefs = await prisma.emailPreference.findMany({
    where: { userId: { not: null } },
    select: { userId: true, email: true },
  });
  const correoDe = new Map<string, string>();
  for (const e of prefs) if (e.userId) correoDe.set(e.userId, e.email);
  for (const s of signups) if (s.clerkUserId) correoDe.set(s.clerkUserId, s.email);
  for (const r of ratings) if (r.email) correoDe.set(r.userId, r.email);

  const meta = (r: (typeof impresionesRaw)[number]): Metadata =>
    (r.metadata && typeof r.metadata === "object" ? r.metadata : {}) as Metadata;
  const superficieDe = (m: Metadata) => (typeof m.surface === "string" ? m.surface : "story");
  const plataformaDe = (m: Metadata) => (typeof m.platform === "string" ? m.platform : "?");

  const impSinSello = impresionesRaw.filter((r) => meta(r).internal !== true);
  const { external: impFuera, internal: impInternasPorCorreo } = await splitInternal(
    impSinSello,
    (r) => correoDe.get(r.userId) ?? null,
  );
  const impCasa = [
    ...impresionesRaw.filter((r) => meta(r).internal === true),
    ...impInternasPorCorreo,
  ];

  // La oportunidad de votar es (persona, cosa, superficie), la misma clave
  // unica que tiene el voto. Cinco impresiones de la misma pantalla no son
  // cinco preguntas distintas; contarlas como denominador hunde la conversion.
  const claveOportunidad = (userId: string, slug: string, surface: string) =>
    `${userId}::${slug}::${surface}`;
  const oportunidades = new Map<
    string,
    { surface: string; votada: boolean; impresiones: number; yaVotada: boolean }
  >();
  for (const r of impFuera) {
    const m = meta(r);
    const surface = superficieDe(m);
    const k = claveOportunidad(r.userId, r.storySlug, surface);
    const prev = oportunidades.get(k);
    if (prev) {
      prev.impresiones += 1;
      prev.yaVotada = prev.yaVotada || m.alreadyRated === true;
    } else {
      oportunidades.set(k, {
        surface,
        votada: false,
        impresiones: 1,
        yaVotada: m.alreadyRated === true,
      });
    }
  }
  for (const v of votosFuera) {
    const o = oportunidades.get(claveOportunidad(v.userId, v.storySlug, v.surface ?? "story"));
    if (o) o.votada = true;
  }
  // Una impresion que ya llega con el pulgar dado no es una pregunta: sale del
  // denominador o la conversion se lee al reves.
  const frias = [...oportunidades.values()].filter((o) => !o.yaVotada);
  const convertidas = frias.filter((o) => o.votada).length;
  // Un voto puede no tener impresion: el evento solo existe en movil y solo
  // desde que se anadio. Se dice, no se esconde.
  const votosSinImpresion = votosFuera.filter(
    (v) => !oportunidades.has(claveOportunidad(v.userId, v.storySlug, v.surface ?? "story")),
  ).length;

  // ------------------------------------------------------------------ salida
  //
  // UNA tabla, una fila por tester. La pregunta que hay que poder contestar de
  // un vistazo es "de los que ven la fila, cuantos la contestan", y eso se lee
  // por persona: cinco cuadros de totales por superficie la escondian.
  const out: string[] = [];
  const p = (s = "") => out.push(s);

  const personas = [...new Set([...impFuera.map((r) => r.userId), ...votosFuera.map((r) => r.userId)])];
  // Un userId sin correo en ninguna de nuestras tablas (solo lo sabe Clerk) cae
  // del lado de fuera por defecto, que es exactamente como el 2026-09-05
  // review@ paso por tester. Se marca en la fila en vez de darlo por bueno.
  const quien = (userId: string) => correoDe.get(userId) ?? `sin correo (${userId.slice(-6)}) [?]`;

  /** "vistas -> votos" de una persona en una superficie. */
  const celdaSuperficie = (userId: string, surface: string) => {
    const vistas = [...oportunidades].filter(
      ([k, o]) => k.startsWith(`${userId}::`) && o.surface === surface && !o.yaVotada,
    );
    const votos = votosFuera.filter((v) => v.userId === userId && (v.surface ?? "story") === surface);
    return `${vistas.length} -> ${votos.length}`;
  };

  const sistemasDe = (userId: string) =>
    [
      ...new Set([
        ...impFuera.filter((r) => r.userId === userId).map((r) => plataformaDe(meta(r))),
        ...votosFuera.filter((r) => r.userId === userId).map((r) => r.platform ?? "?"),
      ]),
    ].join(", ");

  const totalVistas = (surface: string) =>
    frias.filter((o) => o.surface === surface).length;
  const totalVotos = (surface: string) =>
    votosFuera.filter((v) => (v.surface ?? "story") === surface).length;

  const comentariosFuera = votosFuera.filter((r) => r.comment && r.comment.trim());

  p(`# Los testers y la fila de valorar  (${fecha(new Date())} UTC)`);
  p();
  p(
    "`vistas -> votos`: cuantas veces se le pinto la pregunta y cuantas la contesto. " +
      "Una vista es `(persona, cosa, superficie)`, no una impresion suelta: " +
      "cinco veces el mismo panel es una sola pregunta.",
  );
  p();
  p(
    tabla(
      ["tester", "sistema", "historia", "practica", "arriba", "abajo", "comentarios"],
      [
        ...personas.map((u) => [
          quien(u),
          sistemasDe(u),
          celdaSuperficie(u, "story"),
          celdaSuperficie(u, "practice"),
          `${votosFuera.filter((v) => v.userId === u && v.liked).length}`,
          `${votosFuera.filter((v) => v.userId === u && !v.liked).length}`,
          `${comentariosFuera.filter((v) => v.userId === u).length}`,
        ]),
        [
          `**${personas.length} testers**`,
          "",
          `**${totalVistas("story")} -> ${totalVotos("story")}**`,
          `**${totalVistas("practice")} -> ${totalVotos("practice")}**`,
          `**${votosFuera.filter((v) => v.liked).length}**`,
          `**${votosFuera.filter((v) => !v.liked).length}**`,
          `**${comentariosFuera.length}**`,
        ],
      ],
    ),
  );
  p();
  p(
    `**${frias.length - convertidas} de ${frias.length}** preguntas se quedan sin contestar ` +
      `(conversion ${pct(convertidas, frias.length)}).`,
  );
  p();

  if (comentariosFuera.length === 0) {
    p("Ningun tester ha escrito un comentario todavia.");
  } else {
    p("Lo que han escrito:");
    p();
    p(
      tabla(
        ["fecha", "quien", "voto", "historia", "comentario"],
        comentariosFuera.map((r) => [
          fecha(r.createdAt),
          quien(r.userId),
          r.liked ? "arriba" : "abajo",
          r.storySlug,
          (r.comment ?? "").replace(/\s+/g, " ").trim(),
        ]),
      ),
    );
  }
  p();
  const sinCorreo = personas.filter((u) => !correoDe.has(u));
  if (sinCorreo.length > 0) {
    p(
      `**[?]**: ${sinCorreo.length} cuenta(s) sin correo en nuestras tablas, solo en Clerk. ` +
        "`splitInternal` las da por testers por defecto, que es como el 2026-09-05 " +
        "review@digitalpolyglot.com se conto como tester. Sin confirmar.",
    );
    p();
  }
  p(
    "Excluido por `splitInternal` (`StudioMember` y `@digitalpolyglot.com`): " +
      `${votosCasa.length} pulgares y ${impCasa.length} impresiones, de ` +
      `${new Set(impCasa.map((r) => r.userId)).size} cuentas de casa. ` +
      `Votos de testers sin impresion registrada: ${votosSinImpresion}.`,
  );

  console.log(out.join("\n"));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
