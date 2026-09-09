// La senal que dejan los testers de la beta, en una sola pasada y en Markdown.
//
//   npx tsx scripts/ratingsTable.ts
//
// Cuatro cosas, y las cuatro partidas entre lo de casa y lo de fuera:
//   1. Pulgares (StoryRating), por superficie y plataforma.
//   2. Comentarios escritos junto al pulgar.
//   3. Impresiones de la fila de valorar (UserMetric "rating_prompt_shown"),
//      que son el DENOMINADOR: sin ellas un cero de votos no se puede leer.
//   4. Feedback escrito (BetaFeedback), por canal.
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
const oNada = (s: string | null | undefined) => (s && s.trim() ? s.trim() : "-");
const primeraLinea = (s: string, max = 90) => {
  const l = s.split("\n").map((x) => x.trim()).find((x) => x.length > 0) ?? "";
  return l.length > max ? `${l.slice(0, max - 1)}...` : l;
};
/** Una barra vertical sin escapar parte una celda de Markdown en dos. */
const celda = (s: string) => s.replace(/\|/g, "\\|");

/** Agrupa por clave conservando el orden de aparicion. */
function porClave<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const prev = out.get(k);
    if (prev) prev.push(r);
    else out.set(k, [r]);
  }
  return out;
}

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
  const feedback = await prisma.betaFeedback.findMany({ orderBy: { createdAt: "asc" } });

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
  const correoDe = new Map<string, string>();
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

  // ---------------------------------------------------------------- feedback
  const { external: fbFuera, internal: fbCasa } = await splitInternal(feedback, (r) => r.email);
  // El formulario al que llevan los correos escribe `platform: "web"`; la hoja
  // in-app escribe el sistema real del telefono. Ese es el canal.
  const canalDe = (r: (typeof feedback)[number]) =>
    r.platform === "web" ? "formulario web" : "hoja in-app";

  // ------------------------------------------------------------------ salida
  const out: string[] = [];
  const p = (s = "") => out.push(s);

  p(`# Senal de la beta  (${fecha(new Date())} UTC)`);
  p();
  p("Todo partido entre **testers** y **equipo** con `splitInternal`, que excluye");
  p("a los de `StudioMember` y a todo `@digitalpolyglot.com`.");
  p();

  p("## 1. Pulgares (`StoryRating`)");
  p();
  p(
    tabla(
      ["", "filas", "arriba", "abajo"],
      (
        [
          ["**testers**", votosFuera],
          ["equipo (excluido)", votosCasa],
          ["total en la tabla", ratings],
        ] as [string, typeof ratings][]
      ).map(([etiqueta, rows]) => [
        etiqueta,
        `${rows.length}`,
        `${rows.filter((r) => r.liked).length}`,
        `${rows.filter((r) => !r.liked).length}`,
      ]),
    ),
  );
  p();
  p("Pulgares de testers por superficie y plataforma:");
  p();
  p(
    tabla(
      ["superficie", "plataforma", "arriba", "abajo", "total"],
      [...porClave(votosFuera, (r) => `${r.surface ?? "story"}\t${r.platform ?? "?"}`)].map(
        ([k, rows]) => {
          const [surface, platform] = k.split("\t");
          return [
            surface,
            platform,
            `${rows.filter((r) => r.liked).length}`,
            `${rows.filter((r) => !r.liked).length}`,
            `${rows.length}`,
          ];
        },
      ),
    ),
  );
  p();
  p("Uno por uno, los de testers:");
  p();
  p(
    tabla(
      ["fecha", "voto", "superficie", "historia", "plataforma", "quien"],
      votosFuera.map((r) => [
        fecha(r.createdAt),
        r.liked ? "arriba" : "abajo",
        r.surface ?? "story",
        r.storySlug,
        oNada(r.platform),
        oNada(r.email),
      ]),
    ),
  );
  p();

  const comentariosFuera = votosFuera.filter((r) => r.comment && r.comment.trim());
  const comentariosCasa = votosCasa.filter((r) => r.comment && r.comment.trim());
  p("## 2. Comentarios junto al pulgar");
  p();
  p(
    `De testers: **${comentariosFuera.length}** sobre ${votosFuera.length} ` +
      `${votosFuera.length === 1 ? "pulgar" : "pulgares"}. ` +
      `Del equipo (excluidos): ${comentariosCasa.length}.`,
  );
  p();
  p(
    tabla(
      ["fecha", "voto", "superficie", "historia", "quien", "comentario"],
      comentariosFuera.map((r) => [
        fecha(r.createdAt),
        r.liked ? "arriba" : "abajo",
        r.surface ?? "story",
        r.storySlug,
        oNada(r.email),
        (r.comment ?? "").replace(/\s+/g, " ").trim(),
      ]),
    ),
  );
  p();

  p("## 3. Impresiones de la fila de valorar (`rating_prompt_shown`)");
  p();
  p(
    tabla(
      ["", "impresiones", "personas"],
      (
        [
          ["**testers**", impFuera],
          ["equipo (excluido)", impCasa],
          ["total en la tabla", impresionesRaw],
        ] as [string, typeof impresionesRaw][]
      ).map(([etiqueta, rows]) => [
        etiqueta,
        `${rows.length}`,
        `${new Set(rows.map((r) => r.userId)).size}`,
      ]),
    ),
  );
  p();
  p("Impresiones de testers por superficie y plataforma:");
  p();
  p(
    tabla(
      ["superficie", "plataforma", "impresiones", "personas"],
      [...porClave(impFuera, (r) => `${superficieDe(meta(r))}\t${plataformaDe(meta(r))}`)].map(
        ([k, rows]) => {
          const [surface, platform] = k.split("\t");
          return [surface, platform, `${rows.length}`, `${new Set(rows.map((r) => r.userId)).size}`];
        },
      ),
    ),
  );
  p();
  p("**Conversion impresion a voto**, por superficie. Una oportunidad es");
  p("`(persona, cosa, superficie)`, la misma clave unica que tiene el voto:");
  p();
  const porSuperficie = new Map<string, { total: number; votadas: number }>();
  for (const o of frias) {
    const acc = porSuperficie.get(o.surface) ?? { total: 0, votadas: 0 };
    acc.total += 1;
    if (o.votada) acc.votadas += 1;
    porSuperficie.set(o.surface, acc);
  }
  p(
    tabla(
      ["superficie", "oportunidades", "votadas", "conversion"],
      [
        ...[...porSuperficie].map(([s, a]) => [
          s,
          `${a.total}`,
          `${a.votadas}`,
          pct(a.votadas, a.total),
        ]),
        ["**todas**", `${frias.length}`, `${convertidas}`, pct(convertidas, frias.length)],
      ],
    ),
  );
  p();
  p(`- Ven la pregunta y pasan: **${frias.length - convertidas}** de ${frias.length}.`);
  p(`- Impresiones repetidas de la misma oportunidad: ${impFuera.length - oportunidades.size}.`);
  p(
    `- Impresiones sobre algo ya votado, fuera del denominador: ${oportunidades.size - frias.length}.`,
  );
  p(`- Votos de testers sin impresion registrada: ${votosSinImpresion}.`);
  p();

  p("## 4. Feedback escrito (`BetaFeedback`)");
  p();
  p(
    tabla(
      ["canal", "de testers", "del equipo"],
      [...new Set(feedback.map(canalDe))].map((canal) => [
        canal,
        `${fbFuera.filter((r) => canalDe(r) === canal).length}`,
        `${fbCasa.filter((r) => canalDe(r) === canal).length}`,
      ]),
    ),
  );
  p();
  p(
    tabla(
      ["fecha", "canal", "sistema", "tipo", "nota", "pantalla", "build", "quien", "primera linea"],
      fbFuera.map((r) => [
        fecha(r.createdAt),
        canalDe(r),
        r.platform,
        r.kind,
        r.rating === null || r.rating === undefined ? "-" : `${r.rating}`,
        oNada(r.screen),
        oNada(r.buildNumber),
        r.email,
        primeraLinea(r.message),
      ]),
    ),
  );

  console.log(out.join("\n"));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
