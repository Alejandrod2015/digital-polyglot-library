import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const prisma = new PrismaClient();
const JID = "cmubidgaf0007j8np6g7n89iu";
(async () => {
  const j = await prisma.journey.findUnique({ where: { id: JID } });
  if (!j) { console.log("JOURNEY NO EXISTE"); return; }
  const a = j as any;
  console.log(`journey: ${a.language}/${a.country} ${a.persona ?? a.track ?? ""} ${a.level} status=${a.status} city=${a.city ?? "?"}`);
  const stories = await prisma.journeyStory.findMany({ where: { journeyId: JID }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }] as any });
  console.log(`historias=${stories.length} conTexto=${stories.filter(s=>(s.text??"").length>200).length} conAudio=${stories.filter(s=>(s as any).audioUrl).length} publicadas=${stories.filter(s=>(s as any).status==="published").length}`);
  const ids = stories.map(s=>s.id);
  const sets = await prisma.storyPracticeSet.findMany({ where: { storyId: { in: ids } }, include: { exercises: true } });
  console.log(`sets=${sets.length} ejercicios=${sets.reduce((n,s)=>n+s.exercises.length,0)}`);
  const byType: Record<string, { n:number; word:number; clip:number; feat:number }> = {};
  let needWord=0, haveWord=0, needClip=0, haveClip=0;
  const pendWord = new Set<string>(); const pendClip = new Set<string>();
  for (const s of sets) for (const e of s.exercises) {
    const clip = ((e.payload as any)?.audioClip ?? null);
    byType[e.type] ??= { n:0, word:0, clip:0, feat:0 };
    byType[e.type].n++;
    if (clip?.wordClipUrl) byType[e.type].word++;
    if (clip?.clipUrl) byType[e.type].clip++;
    if (e.featured) byType[e.type].feat++;
    if (e.type === "meaning_in_context") { needWord++; if (clip?.wordClipUrl) haveWord++; else pendWord.add(e.word); }
    if (e.type === "fill_blank") { needClip++; if (clip?.clipUrl) haveClip++; else pendClip.add(e.word); }
  }
  console.table(byType);
  console.log(`GATE publicar -> meaning_in_context con wordClipUrl: ${haveWord}/${needWord} | fill_blank con clipUrl: ${haveClip}/${needClip}`);
  // caracteres estimados
  const slugs = new Set(stories.map(s=>s.slug!));
  const files = fs.readdirSync("scripts/_sets").filter(f=>slugs.has(f.replace(".json","")));
  console.log(`JSON en scripts/_sets para este journey: ${files.length}/21`);
  let charsWord=0, charsClip=0;
  for (const s of sets) for (const e of s.exercises) {
    const clip = ((e.payload as any)?.audioClip ?? null);
    if (e.type === "meaning_in_context" && !clip?.wordClipUrl) charsWord += e.word.length + 30;
    if (e.type === "fill_blank" && !clip?.clipUrl) charsClip += (e.audioText ?? e.sentence ?? "").replace(/_+/g,"").length + 70;
  }
  console.log(`estimacion caracteres: palabras~${charsWord} frases~${charsClip} total~${charsWord+charsClip}`);
  await prisma.$disconnect();
})();
