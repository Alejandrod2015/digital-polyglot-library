/**
 * El harness /dev-glossshot: una ruta que renderiza el lector real (el de hoy
 * y el de antes de la capa de contexto) sin el paywall, para poder capturarlo.
 * Se escribe al vuelo, el dev server la recoge por HMR, y se borra al acabar.
 * La usan `_glossShots.ts` (capturas) y `_glossGif.ts` (animacion).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";

export const HARNESS = "src/app/dev-glossshot";
/** El commit anterior a la capa de contexto: el lector que vieron los testers. */
export const BEFORE_REF = "5d0ca237^";

const HARNESS_PAGE = String.raw`// GENERADO por scripts/_glossHarness.ts, y borrado al terminar la captura.
// Renderiza el lector real (TapGlossReader + TapGlossLayer) con las glosas de
// una historia, saltando el paywall porque en local no hay sesion.
import { notFound } from "next/navigation";
import TapGlossReader from "@/components/TapGlossReader";
import TapGlossReaderLegacy from "./legacy/TapGlossReaderLegacy";
// Los bundles tal como estaban antes de la capa de contexto (5d0ca237^), para
// que el "antes" sea lo que el tester vio y no una reconstruccion.
import spainA0Before from "./legacy/spain-a0.before.json";
import friendsLatamBefore from "./legacy/friends-latam.before.json";
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
  searchParams: Promise<{ slug?: string; mode?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { slug = "marta-ensena-el-retiro", mode = "after" } = await searchParams;

  const story = await prisma.journeyStory.findFirst({
    where: { slug },
    select: { slug: true, title: true, text: true, vocab: true },
  });
  if (!story) notFound();

  const full = getTapGlossesForSlug(slug) ?? {};
  // "before" = el lector tal como estaba antes de la capa de contexto: el
  // componente de 5d0ca237^ y la glosa plana del diccionario global.
  const before = mode === "before";
  const legacyBundle = [spainA0Before, friendsLatamBefore].find((b) =>
    (b.slugs as string[]).includes(slug),
  );
  const glosses = before
    ? ((legacyBundle?.glosses ?? {}) as typeof full)
    : full;
  const Reader = before ? TapGlossReaderLegacy : TapGlossReader;

  const text = (story.text ?? "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n\n");

  return (
    <div className="min-h-screen bg-[var(--background)] px-5 py-7">
      <h1 className="text-3xl font-extrabold text-center mb-6 text-[var(--foreground)]">
        {story.title}
      </h1>
      <div className="max-w-[65ch] mx-auto text-xl leading-relaxed text-[var(--foreground)] space-y-6">
        <Reader
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

export function show(path: string): string {
  return execFileSync("git", ["show", `${BEFORE_REF}:${path}`], { encoding: "utf-8", maxBuffer: 64e6 });
}

/** Escribe la ruta de captura con el lector de hoy y el de antes, lado a lado. */
export function writeHarness(): void {
  mkdirSync(`${HARNESS}/legacy`, { recursive: true });
  writeFileSync(
    `${HARNESS}/legacy/TapGlossLayerLegacy.tsx`,
    show("src/components/TapGlossLayer.tsx"),
  );
  writeFileSync(
    `${HARNESS}/legacy/TapGlossReaderLegacy.tsx`,
    show("src/components/TapGlossReader.tsx").replace(
      '@/components/TapGlossLayer',
      "./TapGlossLayerLegacy",
    ),
  );
  writeFileSync(
    `${HARNESS}/legacy/spain-a0.before.json`,
    show("src/data/tapGlosses/spanish-friends-spain-a0.json"),
  );
  writeFileSync(
    `${HARNESS}/legacy/friends-latam.before.json`,
    show("src/data/tapGlosses/spanish-friends.json"),
  );
  writeFileSync(`${HARNESS}/page.tsx`, HARNESS_PAGE);
}


export function removeHarness(): void {
  rmSync(HARNESS, { recursive: true, force: true });
}
