/**
 * Capturas antes/despues de la tarjeta del lookup, para el correo "we heard
 * you" (src/lib/emails/beta.ts, kind `heard_you`). Salen a public/email/glosses,
 * que es de donde las sirve el correo.
 *
 *   npm run dev            # el harness necesita el server en :3000
 *   npx tsx scripts/_glossShots.ts
 *
 * El "antes" no es una reconstruccion: monta el componente y el bundle tal como
 * estaban en 5d0ca237^, el commit anterior a la capa de contexto, sacados con
 * `git show`. El "despues" es el lector de hoy.
 *
 * La ruta /dev-glossshot se escribe al vuelo (el dev server la recoge por HMR)
 * y se borra al terminar, para no dejar una pagina muerta en el arbol.
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = "public/email/glosses";
const HARNESS = "src/app/dev-glossshot";
/** El commit anterior a la capa de contexto: el lector que vieron los testers. */
const BEFORE_REF = "5d0ca237^";

const HARNESS_PAGE = String.raw`// GENERADO por scripts/_glossShots.ts. Se borra al terminar la captura.
// Renderiza el
// lector real (TapGlossReader + TapGlossLayer) con las glosas de una historia,
// saltando el paywall porque en local no hay sesion. Se borra tras capturar.
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

function show(path: string): string {
  return execFileSync("git", ["show", `${BEFORE_REF}:${path}`], { encoding: "utf-8", maxBuffer: 64e6 });
}

/** Escribe la ruta de captura con el lector de hoy y el de antes, lado a lado. */
function writeHarness(): void {
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

type Shot = { file: string; slug: string; word: string; mode: "before" | "after"; expand?: boolean };

const SHOTS: Shot[] = [
  { file: "baja-before", slug: "marta-ensena-el-retiro", word: "baja", mode: "before" },
  { file: "baja-after", slug: "marta-ensena-el-retiro", word: "baja", mode: "after", expand: true },
  { file: "punto-before", slug: "le-toca-a-mateo", word: "punto", mode: "before" },
  { file: "punto-after", slug: "le-toca-a-mateo", word: "punto", mode: "after", expand: true },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  writeHarness();
  // El dev server tiene que compilar la ruta recien escrita.
  await new Promise((r) => setTimeout(r, 1500));
  // Usa el Chrome ya instalado: playwright no tiene su binario descargado.
  const browser = await chromium.launch({ channel: "chrome" });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    // 2x basta: en el correo la captura se pinta a 256 px de ancho.
    deviceScaleFactor: 2,
    // La app se lee en oscuro y el correo es oscuro: una captura clara
    // dentro del correo parece de otro producto.
    colorScheme: "dark",
  });
  // El banner de cookies tapa la tarjeta. Se responde antes de cargar (la
  // opcion que menos rastrea) para que no llegue a montarse.
  await context.addInitScript(() => {
    window.localStorage.setItem("dp_cookie_consent_v1", "rejected");
  });
  const page = await context.newPage();

  for (const shot of SHOTS) {
    await page.goto(`${BASE}/dev-glossshot?slug=${shot.slug}&mode=${shot.mode}`, {
      waitUntil: "networkidle",
    });
    // Fuera todo lo que no es la app: el banner de cookies, el de instalar, el
    // globo de soporte y el indicador de dev de Next.
    await page.addStyleTag({
      content: "nextjs-portal{display:none!important}[data-nextjs-toast]{display:none!important}",
    });

    const word = page.locator(`[data-token="${shot.word}"]`).first();
    await word.scrollIntoViewIfNeeded();
    await word.click();
    const card = page.locator("text=QUICK LOOKUP").locator("xpath=ancestor::div[3]").first();
    await card.waitFor({ state: "visible" });

    if (shot.expand) {
      const link = page.getByRole("button", { name: /See conjugation|See all|See \d+ more/ }).first();
      if (await link.count()) {
        await link.click();
        await page.waitForTimeout(150);
      }
    }
    // Se limpia DESPUES de abrir la tarjeta: los banners se remontan al
    // hidratar y volverian a asomar por debajo del popup. Sin funciones
    // nombradas aqui dentro: esbuild las reescribe con `__name` y la pagina
    // no tiene ese helper.
    await page.evaluate(() => {
      document.querySelectorAll("body *").forEach((node) => {
        const el = node as HTMLElement;
        const text = (el.textContent ?? "").trim();
        if (text.includes("QUICK LOOKUP")) return;
        const fixed = getComputedStyle(el).position === "fixed";
        if (
          text.startsWith("COOKIE CHOICES") ||
          text.startsWith("Install Digital Polyglot") ||
          (fixed && el.clientHeight < 120 && el.clientWidth < 120)
        ) {
          el.style.display = "none";
        }
      });
    });
    await page.waitForTimeout(250);
    // La pantalla entera, no la tarjeta recortada: en el correo va dentro de
    // un telefono, y un recorte suelto dentro del marco no se lee como la app.
    await page.screenshot({ path: `${OUT}/${shot.file}.png` });
    console.log(`${shot.file}.png`);
  }

  await browser.close();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    rmSync(HARNESS, { recursive: true, force: true });
  });
