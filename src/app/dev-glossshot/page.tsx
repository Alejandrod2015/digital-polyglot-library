// GENERADO por scripts/_glossHarness.ts, y borrado al terminar la captura.
// Renderiza el lector real (TapGlossReader + TapGlossLayer) con las glosas de
// una historia, saltando el paywall porque en local no hay sesion.
import { notFound } from "next/navigation";
import TapGlossReader from "@/components/TapGlossReader";
import Player from "@/components/Player";
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
    select: { slug: true, title: true, text: true, vocab: true, audioUrl: true },
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
    // El padding inferior deja sitio al player anclado, como en el lector real.
    <div className="min-h-screen bg-[var(--background)] px-5 pt-7 pb-40">
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
      {story.audioUrl ? (
        <div id="story-player-dock" className="fixed bottom-0 left-0 right-0 z-50 bg-transparent">
          <Player src={story.audioUrl} bookSlug="polyglot" storySlug={story.slug} canPlay />
        </div>
      ) : null}
    </div>
  );
}
