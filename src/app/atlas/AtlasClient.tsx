"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Compass, Languages, MapPinned, Sparkles } from "lucide-react";
import BookHorizontalCard from "@/components/BookHorizontalCard";
import StoryVerticalCard from "@/components/StoryVerticalCard";

export type AtlasStoryCard = {
  id: string;
  title: string;
  href: string;
  coverUrl?: string;
  subtitle?: string;
  excerpt?: string;
  level?: string;
  language?: string;
  region?: string;
  meta?: string;
  metaSecondary?: string;
};

export type AtlasCollectionCard = {
  title: string;
  href: string;
  cover?: string;
  language?: string;
  region?: string;
  level?: string;
  description?: string;
  meta?: string;
  statsLine?: string;
  topicsLine?: string;
};

export type AtlasZone = {
  id: string;
  label: string;
  country: string;
  language: string;
  region: string;
  register: string;
  focus: string;
  description: string;
  x: number;
  y: number;
  accents: string[];
  contexts: string[];
  collection: AtlasCollectionCard;
  stories: AtlasStoryCard[];
};

type AtlasClientProps = {
  zones: AtlasZone[];
};

function AtlasMap({
  zones,
  selectedZoneId,
  onSelect,
}: {
  zones: AtlasZone[];
  selectedZoneId: string;
  onSelect: (id: string) => void;
}) {
  const mapWidth = 1000;
  const mapHeight = 520;
  const defaultFocus = { x: mapWidth / 2, y: mapHeight / 2 };
  const [zoom, setZoom] = useState(1);
  const [focus, setFocus] = useState(defaultFocus);

  const selectedZone = useMemo(
    () => zones.find((zone) => zone.id === selectedZoneId) ?? zones[0],
    [selectedZoneId, zones]
  );

  const centerOnZone = (zone: AtlasZone, nextZoom = 1.8) => {
    setFocus({ x: (zone.x / 100) * mapWidth, y: (zone.y / 100) * mapHeight });
    setZoom(nextZoom);
  };

  const resetView = () => {
    setFocus(defaultFocus);
    setZoom(1);
  };

  const storyPins = useMemo(() => {
    if (!selectedZone || zoom < 1.4) return [];

    const centerX = (selectedZone.x / 100) * mapWidth;
    const centerY = (selectedZone.y / 100) * mapHeight;

    return selectedZone.stories.map((story, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(selectedZone.stories.length, 1) - Math.PI / 2;
      const radius = 26 + index * 8;

      return {
        ...story,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      };
    });
  }, [selectedZone, zoom]);

  const transform = `translate(${mapWidth / 2 - focus.x * zoom} ${mapHeight / 2 - focus.y * zoom}) scale(${zoom})`;

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_18%_18%,rgba(61,124,211,0.28),transparent_24%),radial-gradient(circle_at_72%_20%,rgba(62,92,181,0.18),transparent_18%),linear-gradient(180deg,rgba(5,22,46,0.98),rgba(4,17,36,0.95))] p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-blue-200/75">World view</p>
          <p className="mt-1 text-sm text-slate-300">
            Click a country pin. Zoom in to expand and inspect individual stories.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((current) => Math.max(1, Number((current - 0.35).toFixed(2))))}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            -
          </button>
          <button
            type="button"
            onClick={() => setZoom((current) => Math.min(3, Number((current + 0.35).toFixed(2))))}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            +
          </button>
          <button
            type="button"
            onClick={resetView}
            className="rounded-full border border-blue-300/20 bg-blue-500/10 px-3 py-2 text-sm font-semibold text-blue-100 transition hover:bg-blue-500/15"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(4,19,39,0.98),rgba(3,13,29,0.98))]">
        <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} className="h-auto w-full">
          <defs>
            <linearGradient id="atlasOcean" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#0a2b55" />
              <stop offset="48%" stopColor="#071d3d" />
              <stop offset="100%" stopColor="#041427" />
            </linearGradient>
            <linearGradient id="atlasLand" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(86,120,173,0.58)" />
              <stop offset="100%" stopColor="rgba(33,60,104,0.48)" />
            </linearGradient>
          </defs>

          <rect width={mapWidth} height={mapHeight} fill="url(#atlasOcean)" />

          <g opacity="0.16">
            <path d="M0 110h1000" stroke="white" strokeWidth="1" strokeDasharray="6 14" />
            <path d="M0 220h1000" stroke="white" strokeWidth="1" strokeDasharray="6 14" />
            <path d="M0 330h1000" stroke="white" strokeWidth="1" strokeDasharray="6 14" />
            <path d="M0 440h1000" stroke="white" strokeWidth="1" strokeDasharray="6 14" />
            <path d="M170 0v520" stroke="white" strokeWidth="1" strokeDasharray="6 14" />
            <path d="M500 0v520" stroke="white" strokeWidth="1" strokeDasharray="6 14" />
            <path d="M830 0v520" stroke="white" strokeWidth="1" strokeDasharray="6 14" />
          </g>

          <g transform={transform}>
            <path
              d="M107 89c28-13 62-20 99-19 30 1 57 8 80 23 10 6 22 7 33 5 17-3 35-4 53 1 15 4 29 13 41 24 11 11 23 16 38 22 30 12 59 33 72 61 12 26 8 61-12 82-21 23-58 34-77 60-20 28-31 60-58 77-24 14-55 18-84 16-34-3-70-15-92-38-19-19-28-47-48-66-17-17-40-27-58-44-25-23-42-58-40-92 2-41 27-84 71-112 24-15 53-20 82-28z"
              fill="url(#atlasLand)"
              stroke="rgba(215,233,255,0.18)"
              strokeWidth="2"
            />
            <path
              d="M278 313c18-7 42-9 61-1 24 9 44 29 57 51 15 25 24 55 17 82-8 28-35 47-64 54-38 9-83 0-113-23-28-21-41-56-36-88 5-31 28-61 62-75 5-2 11-2 16 0z"
              fill="url(#atlasLand)"
              stroke="rgba(215,233,255,0.18)"
              strokeWidth="2"
            />
            <path
              d="M668 92c29-11 61-16 93-12 25 3 47 12 66 25 11 8 21 10 35 9 18-1 36 2 53 10 18 9 32 23 42 40 9 14 22 24 36 33 28 18 51 48 57 79 7 34-6 73-33 96-27 24-67 33-95 54-22 16-37 40-59 57-26 20-61 31-95 33-44 2-91-11-124-37-37-28-58-73-58-118 0-57 33-114 86-146 31-20 68-28 96-48z"
              fill="url(#atlasLand)"
              stroke="rgba(215,233,255,0.18)"
              strokeWidth="2"
            />
            <path
              d="M791 383c17-6 38-7 55 2 18 10 30 29 31 49 1 21-12 40-30 52-21 14-50 18-74 13-28-6-51-27-54-52-4-30 17-56 48-64 7-2 15-2 24 0z"
              fill="url(#atlasLand)"
              stroke="rgba(215,233,255,0.18)"
              strokeWidth="2"
            />

            <text x="172" y="72" fill="rgba(214,232,255,0.4)" fontSize="22" letterSpacing="10">
              NORTH AMERICA
            </text>
            <text x="286" y="463" fill="rgba(214,232,255,0.32)" fontSize="18" letterSpacing="8">
              SOUTH AMERICA
            </text>
            <text x="740" y="72" fill="rgba(214,232,255,0.4)" fontSize="22" letterSpacing="10">
              EUROPE
            </text>

            {zones.map((zone) => {
              const active = zone.id === selectedZoneId;
              const markerX = (zone.x / 100) * mapWidth;
              const markerY = (zone.y / 100) * mapHeight;

              return (
                <g key={zone.id}>
                  <circle
                    cx={markerX}
                    cy={markerY}
                    r={active ? 24 : 18}
                    fill={active ? "rgba(59,130,246,0.25)" : "rgba(96,165,250,0.12)"}
                  />
                  <circle
                    cx={markerX}
                    cy={markerY}
                    r={active ? 9 : 7}
                    fill={active ? "#4ea1ff" : "#dbeafe"}
                    stroke="white"
                    strokeWidth="3"
                    className="cursor-pointer"
                    onClick={() => {
                      onSelect(zone.id);
                      centerOnZone(zone);
                    }}
                  />
                  <g transform={`translate(${markerX + 14} ${markerY - 12})`}>
                    <rect
                      rx="14"
                      ry="14"
                      width={Math.max(88, zone.country.length * 10 + 24)}
                      height="28"
                      fill={active ? "rgba(16,43,80,0.96)" : "rgba(11,35,69,0.86)"}
                      stroke={active ? "rgba(147,197,253,0.5)" : "rgba(255,255,255,0.12)"}
                    />
                    <text
                      x="14"
                      y="18"
                      fill={active ? "white" : "rgba(255,255,255,0.82)"}
                      fontSize="14"
                      fontWeight="600"
                    >
                      {zone.country}
                    </text>
                  </g>
                </g>
              );
            })}

            {storyPins.map((story) => (
              <a key={story.id} href={story.href}>
                <g className="cursor-pointer">
                  <circle
                    cx={story.x}
                    cy={story.y}
                    r="6"
                    fill="#f8fafc"
                    stroke="#60a5fa"
                    strokeWidth="3"
                  />
                  <g transform={`translate(${story.x + 10} ${story.y - 10})`}>
                    <rect
                      rx="10"
                      ry="10"
                      width={Math.min(180, Math.max(96, story.title.length * 6.6 + 18))}
                      height="24"
                      fill="rgba(9,30,57,0.94)"
                      stroke="rgba(255,255,255,0.14)"
                    />
                    <text x="10" y="16" fill="white" fontSize="11" fontWeight="600">
                      {story.title.length > 24 ? `${story.title.slice(0, 24)}...` : story.title}
                    </text>
                  </g>
                </g>
              </a>
            ))}
          </g>
        </svg>
      </div>

      <div className="relative mt-4 flex flex-wrap gap-2">
        {zones.map((zone) => {
          const active = zone.id === selectedZoneId;
          return (
            <button
              key={`${zone.id}-legend`}
              type="button"
              onClick={() => {
                onSelect(zone.id);
                centerOnZone(zone);
              }}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                active
                  ? "border-blue-300/35 bg-blue-500/15 text-white"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  active ? "bg-blue-400" : "bg-white/45"
                }`}
              />
              {zone.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AtlasClient({ zones }: AtlasClientProps) {
  const [selectedZoneId, setSelectedZoneId] = useState(zones[0]?.id ?? "");

  const selectedZone = useMemo(
    () => zones.find((zone) => zone.id === selectedZoneId) ?? zones[0],
    [selectedZoneId, zones]
  );

  if (!selectedZone) {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-20 pt-6 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(31,73,139,0.28),rgba(9,27,53,0.92))] p-5 sm:p-8 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.35em] text-blue-200/80">Language Atlas</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Explore how a language lives across regions, voices, and contexts.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
              This atlas treats each story as a real entry point into the language. You are not
              just practicing Spanish or German in the abstract. You are learning where it lives,
              how it sounds, and what it carries culturally.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={selectedZone.collection.href}
                className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-400"
              >
                <Compass className="h-4 w-4" />
                Enter this zone
              </Link>
              <Link
                href={selectedZone.stories[0]?.href ?? "/explore/stories"}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
              >
                <MapPinned className="h-4 w-4" />
                Start with a story
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-[#0c2241]/80 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-blue-200/70">Regions</p>
              <p className="mt-3 text-3xl font-semibold text-white">{zones.length}</p>
              <p className="mt-2 text-sm text-slate-300">
                Distinct entry points anchored in real collections and regional voice.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-[#0c2241]/80 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-blue-200/70">Languages</p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {new Set(zones.map((zone) => zone.language)).size}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Multiple centers, not a single flat neutral version of the language.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-[#0c2241]/80 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-blue-200/70">Contexts</p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {new Set(zones.flatMap((zone) => zone.contexts)).size}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Food, transport, community, history, work, and everyday social life.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[1.12fr_0.88fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-blue-200/80">Atlas map</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Choose a regional focus</h2>
            </div>
          </div>
          <AtlasMap zones={zones} selectedZoneId={selectedZone.id} onSelect={setSelectedZoneId} />
        </div>

        <aside className="rounded-[32px] border border-white/10 bg-[#0b2345]/75 p-5 sm:p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-blue-200/80">{selectedZone.country}</p>
          <h3 className="mt-3 text-3xl font-semibold text-white">{selectedZone.label}</h3>
          <p className="mt-2 text-sm text-blue-200/90">{selectedZone.focus}</p>
          <p className="mt-4 text-sm leading-7 text-slate-300">{selectedZone.description}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-blue-200/70">Language</p>
              <p className="mt-2 text-lg font-semibold text-white">{selectedZone.language}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-blue-200/70">Register</p>
              <p className="mt-2 text-lg font-semibold text-white">{selectedZone.register}</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <Languages className="h-4 w-4 text-blue-300" />
                Regional markers
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedZone.accents.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <Sparkles className="h-4 w-4 text-blue-300" />
                Typical contexts
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedZone.contexts.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-blue-300/15 bg-blue-400/10 px-3 py-1 text-xs text-blue-100"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-blue-200/80">Collection anchor</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Start with the collection</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">
            Each atlas zone is grounded in a specific collection. This keeps the concept real:
            the region, register, and cultural tone all connect back to content you can actually
            read right now.
          </p>
          <div className="mt-5">
            <BookHorizontalCard
              title={selectedZone.collection.title}
              href={selectedZone.collection.href}
              cover={selectedZone.collection.cover}
              language={selectedZone.collection.language}
              region={selectedZone.collection.region}
              level={selectedZone.collection.level}
              meta={selectedZone.collection.meta}
              statsLine={selectedZone.collection.statsLine}
              topicsLine={selectedZone.collection.topicsLine}
              description={selectedZone.collection.description}
            />
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-blue-200/80">Stories in this zone</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Read voices from this part of the atlas</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {selectedZone.stories.map((story) => (
              <StoryVerticalCard
                key={story.id}
                href={story.href}
                title={story.title}
                coverUrl={story.coverUrl}
                subtitle={story.subtitle}
                excerpt={story.excerpt}
                meta={story.meta}
                metaSecondary={story.metaSecondary}
                level={story.level}
                language={story.language}
                region={story.region}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-white/10 bg-[#0b2345]/70 p-5 sm:p-7">
        <p className="text-xs uppercase tracking-[0.3em] text-blue-200/80">How to read the atlas</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-lg font-semibold text-white">Choose a center</p>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Start from a regional focus instead of treating the language like a single neutral voice.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-lg font-semibold text-white">Read real contexts</p>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Stories map language to work, family, transport, food, travel, and place-based culture.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-lg font-semibold text-white">Expand your atlas</p>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Progress here means understanding more voices and moving through the language with more confidence.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
