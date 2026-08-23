import { prisma } from "../src/lib/prisma";
import { readFileSync } from "node:fs";
(async () => {
  const J = "cmt0a8vb1000m32p1x7r5ba28";
  const bundle = JSON.parse(readFileSync("/Users/alejandrodelcarpio/digital-polyglot-library/src/data/tapGlosses/german-traveler-a0.json", "utf-8"));
  const glossed = new Set(Object.keys(bundle.glosses));
  const j = await prisma.journey.findUnique({ where: { id: J }, select: { topics: true } });
  const orden: string[] = (j?.topics as string[]) ?? [];
  const ss = await prisma.journeyStory.findMany({ where: { journeyId: J },
    select: { slug: true, title: true, topic: true, slotIndex: true, text: true, vocab: true,
      coverUrl: true, audioUrl: true, audioWordTimings: true, status: true,
      practiceSet: { select: { exercises: true, locked: true } } } });
  ss.sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  const porTema = new Map<string, typeof ss>();
  for (const s of ss) { const a = porTema.get(s.topic) ?? []; a.push(s); porTema.set(s.topic, a as never); }
  for (const [topic, arr] of porTema) {
    let muertas = 0, palabras = 0, ejercicios = 0, clips = 0, vocab = 0;
    for (const s of arr) {
      const toks = (s.text ?? "").toLowerCase().match(/[a-zà-ÿäöüß]+/g) ?? [];
      for (const t of new Set(toks)) { palabras++; if (!glossed.has(t)) muertas++; }
      const v: any = s.vocab; vocab += Array.isArray(v) ? v.length : 0;
      const e: any = s.practiceSet?.exercises;
      if (Array.isArray(e)) for (const it of e) { ejercicios++; if (/clipUrl/.test(JSON.stringify(it))) clips++; }
    }
    console.log([topic, arr.length, `${arr.length}/3`, vocab, `${muertas}/${palabras}`,
      ejercicios, clips, arr.filter(s => s.coverUrl).length, arr.filter(s => s.audioUrl).length,
      arr.filter(s => s.audioWordTimings).length, arr.filter(s => s.status === "published").length,
      arr.map(s => s.slug).join(",")].join("|"));
  }
  await prisma.$disconnect();
})();
