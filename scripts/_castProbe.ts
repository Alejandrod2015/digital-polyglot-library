import { PrismaClient } from "../src/generated/prisma";
import { castOf, hablaPorHistoria } from "../src/lib/validateJourneyStories";
import NAMES from "./_castNames.json";
const p = new PrismaClient();
const LANG: Record<string, string> = { german: "DE", spanish: "ES", portuguese: "PT", french: "FR", italian: "IT" };

async function main() {
  const js = await p.journey.findMany({ where: { status: { in: ["active", "draft"] } },
    orderBy: [{ language: "asc" }, { levels: "asc" }],
    select: { id: true, name: true, language: true, variant: true, levels: true, status: true,
      stories: { orderBy: [{ topic: "asc" }, { slotIndex: "asc" }], select: { slug: true, text: true, topic: true } } } });
  const out: any[] = [];
  for (const j of js) {
    const lang = LANG[j.language]; if (!lang) continue;
    const names: string[] = (NAMES as any)[lang];
    const stories = j.stories.filter((s) => (s.text ?? "").length > 200)
      .map((s) => ({ slug: s.slug ?? "", title: "", text: s.text ?? "", language: j.language, level: j.levels[0] ?? "", topic: s.topic }));
    if (stories.length < 3) continue;
    const detected = castOf(stories as any, lang);
    const { hablan } = hablaPorHistoria(stories as any, lang);
    const pres = new Map<string, number>();
    for (const s of stories) for (const n of names)
      if (new RegExp(`(?<!\\p{L})${n}(?!\\p{L})`, "u").test(s.text)) pres.set(n, (pres.get(n) ?? 0) + 1);
    const real = [...pres].filter(([, v]) => v >= 3).sort((a, b) => b[1] - a[1]).map(([n]) => n);
    const faltan = real.filter((n) => !detected.includes(n));
    const sobran = detected.filter((n) => !names.includes(n));
    out.push({ id: j.id, lang, j: `${j.name} ${j.language}/${j.variant} ${j.levels.join("/")} ${j.status}`,
      n: stories.length, detected, real: real.map((n) => `${n}:${pres.get(n)}`),
      faltan: faltan.map((n) => `${n}(hist=${pres.get(n)},habla=${hablan.get(n)?.size ?? 0})`), sobran });
  }
  console.log(JSON.stringify(out, null, 1));
}
main().finally(() => p.$disconnect());
