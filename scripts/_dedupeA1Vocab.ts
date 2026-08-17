import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const J = "cmqp6hal8000032cb4ywfs0gc"; // ES LATAM A1

type Entry = { type: string; word: string; surface?: string; definition: string };
const PLAN: { slug: string; remove: string[]; add: Entry[] }[] = [
  { slug: "nadie-quiere-dormir-todavia", remove: ["despacio", "guardar", "silencio", "distinto"], add: [
    { type: "noun", word: "ciudad", definition: "City; a big town with many people and buildings." },
    { type: "noun", word: "mundo", definition: "World; everything and everyone on Earth." },
    { type: "adjective", word: "rico", definition: "Delicious; very nice to eat or drink." },
    { type: "verb", word: "acercarse", surface: "se acercan", definition: "To come closer; to move near someone or something." },
  ]},
  { slug: "la-luz-en-el-cerro", remove: ["despacio", "brillar"], add: [
    { type: "verb", word: "ayudar", surface: "ayuda", definition: "To help; to do something so another person has it easier." },
    { type: "adverb", word: "arriba", definition: "Up; toward a higher place." },
  ]},
  { slug: "el-animal-de-madera-se-mueve", remove: ["apagar", "silencio"], add: [
    { type: "verb", word: "mirar", surface: "mira", definition: "To look; to turn your eyes toward something." },
    { type: "adjective", word: "sola", definition: "Alone; with nobody else." },
  ]},
  { slug: "alguien-toca-el-porton", remove: ["apagar"], add: [
    { type: "noun", word: "música", definition: "Music; the sounds of songs and instruments." },
  ]},
  { slug: "cuando-llega-la-tormenta", remove: ["brillar"], add: [
    { type: "noun", word: "charco", surface: "charcos", definition: "Puddle; a small pool of water on the ground after rain." },
  ]},
  { slug: "el-barrio-se-prepara", remove: ["distinto"], add: [
    { type: "noun", word: "vecina", definition: "Neighbor; a woman who lives near you." },
  ]},
];

(async () => {
  const p = new PrismaClient();
  const stories = await p.journeyStory.findMany({ where: { journeyId: J }, select: { id: true, slug: true, text: true, vocab: true } });
  const bySlug = new Map(stories.map(s => [s.slug ?? "", s]));
  let err = 0;
  for (const { slug, remove, add } of PLAN) {
    const s = bySlug.get(slug);
    if (!s) { console.log(`!! ${slug} no existe`); err++; continue; }
    const body = (s.text ?? "").toLowerCase();
    const vocab: Entry[] = Array.isArray(s.vocab) ? (s.vocab as any[]) : [];
    // sanity: removed words actually present as pills
    for (const r of remove) if (!vocab.some(v => String(v.word).toLowerCase() === r)) { console.log(`!! ${slug}: "${r}" no era pill`); err++; }
    // sanity: added surfaces present in body
    for (const a of add) { const surf = (a.surface ?? a.word).toLowerCase(); if (!body.includes(surf)) { console.log(`!! ${slug}: superficie "${surf}" no está en el cuerpo`); err++; } }
    const removeSet = new Set(remove.map(r => r.toLowerCase()));
    const kept = vocab.filter(v => !removeSet.has(String(v.word).toLowerCase()));
    const next = [...kept, ...add];
    await p.journeyStory.update({ where: { id: s.id }, data: { vocab: next as any, vocabCount: next.length } });
    console.log(`ok ${slug}: ${vocab.length} -> ${next.length} (−${remove.join(",")} +${add.map(a => a.word).join(",")})`);
  }
  console.log(`\n${err ? `ERRORES: ${err}` : "Sin errores"}`);
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
