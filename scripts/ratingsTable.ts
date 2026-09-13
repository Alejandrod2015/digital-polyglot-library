// La senal que dejan los testers de la beta, en una sola pasada y en Markdown.
//
//   npx tsx scripts/ratingsTable.ts
//
// El calculo NO vive aqui: es `computeRatingsMetrics` (`src/lib/metricsRatings.ts`),
// el mismo que pinta la pestana Engagement de /studio/metrics. Este script solo
// lo imprime. Mientras cada uno contaba a su manera, el script daba 6 votos de
// practica sobre 5 vistas y una conversion del 20% que no era la real.
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

const fecha = (iso: string) => iso.slice(0, 16).replace("T", " ");
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

async function main() {
  const { computeRatingsMetrics } = await import("../src/lib/metricsRatings");
  const { prisma } = await import("../src/lib/prisma");

  // Sin `userScope`: la lista de internos del panel sale de Clerk, que en local
  // es la instancia de desarrollo. Lo de casa lo quitan igual el sello
  // `internal` y `splitInternal`, que leen la base.
  const r = await computeRatingsMetrics({ userScope: {}, from: new Date(0), to: new Date() });

  const out: string[] = [];
  const p = (s = "") => out.push(s);
  const quien = (email: string | null, userId: string) =>
    email ?? `sin correo (${userId.slice(-6)}) [?]`;
  const sup = (s: string) => r.bySurface.find((x) => x.surface === s) ?? { asked: 0, answered: 0 };
  const asked = r.bySurface.reduce((n, s) => n + s.asked, 0);
  const answered = r.bySurface.reduce((n, s) => n + s.answered, 0);

  p(`# Los testers y la fila de valorar  (${fecha(new Date().toISOString())} UTC)`);
  p();
  p(
    "`preguntas -> contestadas`. Una pregunta es `(persona, cosa, superficie)` y cuenta si " +
      "al menos una vez se hizo sin voto previo: cinco veces el mismo panel es una sola pregunta.",
  );
  p();
  p(
    tabla(
      ["tester", "sistema", "historia", "practica", "arriba", "abajo", "comentarios"],
      [
        ...r.byPerson.map((u) => [
          quien(u.email, u.userId),
          u.platforms.join(", ") || "?",
          `${u.story.asked} -> ${u.story.answered}`,
          `${u.practice.asked} -> ${u.practice.answered}`,
          `${u.up}`,
          `${u.down}`,
          `${u.comments}`,
        ]),
        [
          `**${r.byPerson.length} testers**`,
          "",
          `**${sup("story").asked} -> ${sup("story").answered}**`,
          `**${sup("practice").asked} -> ${sup("practice").answered}**`,
          `**${r.up}**`,
          `**${r.down}**`,
          `**${r.comments}**`,
        ],
      ],
    ),
  );
  p();
  p(
    `**${asked - answered} de ${asked}** preguntas se quedan sin contestar ` +
      `(conversion ${pct(answered, asked)}).`,
  );
  p();

  if (r.commentRows.length === 0) {
    p("Ningun tester ha escrito un comentario todavia.");
  } else {
    p("Lo que han escrito:");
    p();
    p(
      tabla(
        ["fecha", "quien", "voto", "historia", "comentario"],
        r.commentRows.map((c) => [
          fecha(c.createdAt),
          c.email ?? "sin correo [?]",
          c.liked ? "arriba" : "abajo",
          `${c.storySlug} (${c.surface})`,
          c.comment.replace(/\s+/g, " "),
        ]),
      ),
    );
  }
  p();
  const sinCorreo = r.byPerson.filter((u) => !u.email).length;
  if (sinCorreo > 0) {
    p(
      `**[?]**: ${sinCorreo} cuenta(s) sin correo en nuestras tablas, y Clerk tampoco lo dio ` +
        "(en local Clerk es la instancia de desarrollo y no conoce a nadie de produccion). " +
        "`splitInternal` las da por testers por defecto, que es como el 2026-09-05 " +
        "review@digitalpolyglot.com se conto como tester. Sin confirmar.",
    );
    p();
  }
  p(
    "Excluido como de casa (sello `internal`, `StudioMember` y `@digitalpolyglot.com`): " +
      `${r.excludedInternalVotes} pulgares y ${r.excludedInternalPrompts} impresiones. ` +
      `Votos de testers sin impresion registrada: ${r.votesWithoutView}.`,
  );

  console.log(out.join("\n"));
  await prisma.$disconnect();
  // resolveUserEmails deja abierto el cliente de Clerk.
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
