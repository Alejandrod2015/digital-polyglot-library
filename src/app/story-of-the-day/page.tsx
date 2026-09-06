// /src/app/story-of-the-day/page.tsx
import { auth, currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import Image from "next/image";
import { Play, Crown, Sparkles } from "lucide-react";
import { formatLanguageAndRegion, formatLevel } from "@domain/displayFormat";
import { shouldBypassImageOptimization } from "@/lib/publicMedia";
import { getDailyStories, type DailyStory } from "@/lib/dailyJourneyStory";

// La historia del dia depende de QUIEN mira (su idioma), asi que no se puede
// cachear por ruta.
export const dynamic = "force-dynamic";

/**
 * Esta pagina salia de `getFeaturedStory`, un hash sobre el catalogo congelado
 * de `src/data/books`, que solo tiene espanol e italiano y no mira el idioma de
 * nadie. Ahora sale de `getDailyStories`, que es tambien lo unico que
 * `canAccessStoryContent` abre sin plan: la pagina y el candado hablan por fin
 * de la misma historia.
 */
function pickForLanguages(stories: DailyStory[], languages: string[]): DailyStory | null {
  const wanted = new Set(languages.map((l) => l.trim().toLowerCase()).filter(Boolean));
  if (wanted.size > 0) {
    const hit = stories.find((s) => wanted.has(s.language.toLowerCase()));
    if (hit) return hit;
    // Su idioma no tiene journey vivo (frances, polaco, coreano, arabe hoy).
    // Ensenarle el de otro idioma es justo lo que se viene de arreglar.
    return null;
  }
  // Sin idioma declarado (visita sin cuenta, o alta que no paso por el
  // onboarding): el espanol es el catalogo mas grande y el resto de la home ya
  // cae ahi por defecto.
  return stories.find((s) => s.language.toLowerCase() === "spanish") ?? stories[0] ?? null;
}

function Empty({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-8 text-[var(--foreground)]">
      <p className="text-[var(--muted)]">{message}</p>
      <Link
        href="/explore"
        className="mt-6 inline-flex rounded-full bg-[var(--color-gold)] px-5 py-2.5 text-sm font-extrabold text-[#2a1a02] hover:brightness-105"
      >
        Browse stories
      </Link>
    </div>
  );
}

const chipStyles = {
  language: {
    background: "rgba(125, 211, 252, 0.12)",
    color: "#7dd3fc",
    border: "1px solid rgba(125, 211, 252, 0.3)",
  },
  level: {
    background: "rgba(252, 211, 77, 0.12)",
    color: "#fcd34d",
    border: "1px solid rgba(252, 211, 77, 0.3)",
  },
} as const;

function Chip({ label, tone }: { label: string; tone: keyof typeof chipStyles }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-extrabold"
      style={chipStyles[tone]}
    >
      {label}
    </span>
  );
}

export default async function StoryOfTheDayPage() {
  const { userId } = await auth();
  const user = userId ? await currentUser().catch(() => null) : null;
  const targetLanguages = Array.isArray(user?.publicMetadata?.targetLanguages)
    ? (user.publicMetadata.targetLanguages as unknown[]).filter(
        (v): v is string => typeof v === "string"
      )
    : [];

  const stories = await getDailyStories().catch(() => []);
  if (stories.length === 0) {
    return <Empty message="No story of the day right now." />;
  }

  const story = pickForLanguages(stories, targetLanguages);
  if (!story) {
    return (
      <Empty message="Your language does not have a journey yet, so there is no story of the day for it." />
    );
  }

  const coverUrl = story.coverUrl || "/covers/default.jpg";
  const unoptimizedCover = shouldBypassImageOptimization(coverUrl);
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="px-4 pb-24 pt-8 sm:px-8 mx-auto text-[var(--foreground)]" style={{ maxWidth: 720 }}>
      {/* ── Top tag row ── */}
      <div className="flex items-baseline justify-between mb-4">
        {/* Eyebrow: usa el token --color-gold (deep amber en light,
            bright yellow en dark). Antes era hex fijo #fcd34d que en
            light se veía lavado sobre cream. */}
        <p className="inline-flex items-center gap-1.5 text-[var(--color-gold)] text-[11px] font-extrabold uppercase tracking-[0.28em]">
          <Sparkles size={12} strokeWidth={2.6} />
          Story of the day
        </p>
        <span className="text-[12px] font-bold text-[var(--muted)]">{today}</span>
      </div>

      {/* ── Hero cover (wide, 16:9, full-bleed at top of card) ── */}
      <div
        className="relative w-full overflow-hidden rounded-[24px] border border-white/8 shadow-[0_24px_60px_rgba(0,0,0,0.45)] bg-[#0b1e36]"
        style={{ aspectRatio: "16 / 9" }}
      >
        <Image
          src={coverUrl}
          alt={story.title}
          fill
          unoptimized={unoptimizedCover}
          className="object-cover"
          sizes="(max-width: 720px) 100vw, 720px"
          priority
        />
        {/* Subtle bottom gradient so the title sits on a readable wash */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1/2"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, rgba(11,30,58,0.85) 100%)",
          }}
        />
        {/* Title overlay. Va sobre un gradiente oscuro → necesita
            texto blanco en AMBOS temas. Inline `color` fuerza blanco
            y evita el override `text-white → dark` que aplica light
            mode al resto de la página. */}
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <h1
            className="text-[26px] sm:text-[34px] font-black tracking-tight leading-tight"
            style={{ color: "#ffffff" }}
          >
            {story.title}
          </h1>
          {story.topicLabel ? (
            <p className="mt-1 text-[13px] sm:text-[14px]" style={{ color: "rgba(255,255,255,0.78)" }}>
              From{" "}
              <span className="font-extrabold" style={{ color: "rgba(255,255,255,0.95)" }}>
                {story.topicLabel}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      {/* ── Meta chips ──
          El tema no lleva chip propio: ya sale como "From ..." debajo del
          titulo, y repetirlo era lo primero que se veia. Idioma y region van
          juntos porque `formatLanguageAndRegion` se calla la region cuando el
          idioma tiene una sola variante (aleman, italiano), donde "German ·
          Germany" no dice nada. */}
      <div className="mt-5 flex flex-wrap gap-2">
        <Chip label={formatLanguageAndRegion(story.language, story.variant ?? undefined)} tone="language" />
        <Chip label={formatLevel(story.level)} tone="level" />
      </div>

      <p className="mt-5 text-[15px] leading-7 text-[var(--foreground)]">
        One full story a day per language, narration included. A new one lands
        every morning.
      </p>

      {/* ── CTAs ── */}
      <div className="mt-7 flex flex-col sm:flex-row gap-3">
        <Link
          href={`/stories/${story.slug}`}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-gold)] px-6 py-3 text-[14px] font-extrabold text-[#2a1a02] hover:brightness-105 shadow-[0_10px_24px_rgba(252,211,77,0.22)]"
        >
          <Play size={15} fill="currentColor" />
          Start today&apos;s story
        </Link>
        <Link
          href="/plans"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-6 py-3 text-[14px] font-bold text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]"
        >
          <Crown size={15} className="text-[var(--color-gold)]" />
          Unlock every story
        </Link>
      </div>

      <p className="mt-4 text-[12px] text-[var(--muted)]">
        Free today, no account needed. New story tomorrow at midnight.
      </p>
    </div>
  );
}
