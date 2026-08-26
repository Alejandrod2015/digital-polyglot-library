/**
 * El harness /dev-glossshot: una ruta que renderiza el lector real sin el
 * paywall, para poder capturarlo. Se escribe al vuelo, el dev server la recoge,
 * y se borra al acabar. La usan `_glossShots.ts` (capturas) y `_glossGif.ts`
 * (animacion).
 *
 * Desde 2b1700bb las glosas viven en la tabla `TapGlossSet`, no en los JSON de
 * `src/data/tapGlosses`, y `getTapGlossesForSlug` es asincrona.
 *
 * La pantalla es TEXTO: titulo y cuerpo, sin la portada de la historia. Lo que
 * el correo enseña es la tarjeta de una palabra, y la portada solo quita sitio.
 */
import { mkdirSync, writeFileSync, rmSync } from "node:fs";

export const HARNESS = "src/app/dev-glossshot";

const HARNESS_PAGE = String.raw`// GENERADO por scripts/_glossHarness.ts, y borrado al terminar la captura.
// Renderiza el lector real (TapGlossReader + TapGlossLayer) con las glosas de
// una historia, saltando el paywall porque en local no hay sesion.
import { notFound } from "next/navigation";
import TapGlossReader from "@/components/TapGlossReader";
import { getTapGlossesForSlug } from "@/lib/tapGlosses";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type VocabItem = { word: string; surface?: string; definition: string; type?: string; register?: string };

function vocabOf(raw: unknown): VocabItem[] {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (v): v is VocabItem =>
      !!v && typeof v === "object" && typeof v.word === "string" && typeof v.definition === "string",
  );
}

export default async function GlossShotPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { slug = "marta-ensena-el-retiro" } = await searchParams;

  const story = await prisma.journeyStory.findFirst({
    where: { slug },
    select: { slug: true, title: true, text: true, vocab: true },
  });
  if (!story) notFound();

  const glosses = (await getTapGlossesForSlug(slug)) ?? {};
  // Diagnostico visible en el DOM: si el harness no pinta palabras tocables,
  // esto dice si el problema son los datos o el render.
  const conteo = Object.keys(glosses).length;

  const text = (story.text ?? "")
    .split(/\n+/)
    .map((line: string) => line.trim())
    .filter(Boolean)
    .join("\n\n");

  return (
    <div className="min-h-screen bg-[var(--background)] px-5 py-7">
      <h1 className="text-3xl font-extrabold text-center mb-5 text-[var(--foreground)]">
        {story.title}
      </h1>
      <div data-glosses={conteo} className="max-w-[65ch] mx-auto text-xl leading-relaxed text-[var(--foreground)] space-y-6">
        <TapGlossReader
          text={text}
          vocab={vocabOf(story.vocab)}
          glosses={glosses}
          story={{ slug: story.slug ?? slug, title: story.title ?? "", language: "es" }}
        />
      </div>
    </div>
  );
}
`;

export function writeHarness(): void {
  mkdirSync(HARNESS, { recursive: true });
  writeFileSync(`${HARNESS}/page.tsx`, HARNESS_PAGE);
}

/**
 * Next tarda varios segundos en registrar una ruta recien escrita, y mientras
 * responde 404. Un sleep fijo no vale: el 2026-08-26 el generador del GIF se
 * quedo colgado porque navego al 404 y luego espero por elementos que no
 * existian.
 */
export async function waitForHarness(base: string, timeoutMs = 90_000): Promise<void> {
  const url = `${base}/dev-glossshot?slug=marta-ensena-el-retiro`;
  const deadline = Date.now() + timeoutMs;
  let last = 0;
  while (Date.now() < deadline) {
    try {
      // Con tope: un dev server que acepta la conexion y no contesta dejaba
      // el fetch (y el script entero) colgado sin llegar a reintentar.
      const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(8000) });
      last = res.status;
      if (res.ok) return;
    } catch {
      last = 0;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`El harness no respondio 200 en ${timeoutMs} ms (ultimo: ${last}).`);
}

export function removeHarness(): void {
  rmSync(HARNESS, { recursive: true, force: true });
}
