import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
import { validateSet } from "./_validateSets";
const prisma = new PrismaClient();
function genId(p: string, i: number): string {
  return `${p}${Date.now().toString(36)}${i.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
(async () => {
  const apply = process.argv.includes("--apply");
  // Journey-agnostic: stories are resolved by slug alone (slugs are unique
  // across the catalog); the A2-anchored journeyId filter blocked A0/A1 seeds.
  const only = process.argv.find(a => a.startsWith("--only="))?.split("=")[1];
  const journeyArg = process.argv.find(a => a.startsWith("--journey="))?.split("=")[1];
  const force = process.argv.includes("--force");
  // CANDADO (2026-09-18, tras el incidente de las 11:50-12:10 UTC que
  // reescribio 3.280 ejercicios de 28 journeys de un solo --apply sin filtro):
  // sin --only=<slug> NI --journey=<id>, el script se niega a ESCRIBIR. Un
  // --apply corrido "a pelo" desde un worktree resiembra TODO el catalogo
  // desde los JSON de ESE arbol, y para los journeys cuyos clips se
  // generaron en ramas sin fundir, esos JSON no llevan audioClip.clipUrl:
  // el resembrado los borro sin avisar (ver commit). Dry-run sin filtro
  // sigue permitido (sirve para auditar el catalogo entero).
  if (apply && !only && !journeyArg) {
    console.log("✗ REFUSED: --apply sin --only=<slug> ni --journey=<id>. Este script resiembra TODO scripts/_sets/ de una sola pasada; sin filtro, un --apply reescribe el catalogo entero. Pasa --only=<slug> o --journey=<id>, o usa --dry para auditar sin escribir.");
    process.exit(1);
  }
  // Vocab per story (for full-coverage enforcement) from the authoring snapshot.
  const authoring: any[] = fs.existsSync("scripts/_authoring.json")
    ? JSON.parse(fs.readFileSync("scripts/_authoring.json", "utf8")) : [];
  const vocabBySlug = new Map<string, string[]>(
    authoring.map((s: any) => [s.slug, (s.vocab ?? []).map((v: any) => (v.surface ? `${v.word}||${v.surface}` : v.word)).filter(Boolean)])
  );
  // Coverage fallback for non-A2 journeys: _authoring.json only covers A2;
  // pull vocab from the story row so the seed gate enforces coverage everywhere.
  {
    const slugsToSeed = fs.readdirSync("scripts/_sets").filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", ""))
      .filter((s) => !only || s === only).filter((s) => !vocabBySlug.has(s));
    if (slugsToSeed.length) {
      const rows = await prisma.journeyStory.findMany({ where: { slug: { in: slugsToSeed } }, select: { slug: true, vocab: true } });
      for (const r of rows) vocabBySlug.set(r.slug!, ((r.vocab as any[]) ?? []).map((v: any) => (v.surface ? `${v.word}||${v.surface}` : v.word)).filter(Boolean));
    }
  }

  // --journey=<id> filtra por slugs de ESE journey (consulta unica a la BD;
  // --only sigue siendo el filtro por slug de siempre, y ambos se pueden
  // combinar aunque en la practica basta uno).
  let journeySlugs: Set<string> | null = null;
  if (journeyArg) {
    const rows = await prisma.journeyStory.findMany({ where: { journeyId: journeyArg }, select: { slug: true } });
    journeySlugs = new Set(rows.map(r => r.slug).filter((s): s is string => !!s));
    if (journeySlugs.size === 0) { console.log(`✗ REFUSED: --journey=${journeyArg} no tiene historias con slug.`); process.exit(1); }
  }
  const files = fs.readdirSync("scripts/_sets")
    .filter(f => f.endsWith(".json"))
    .filter(f => !only || f === `${only}.json`)
    .filter(f => !journeySlugs || journeySlugs.has(f.replace(".json", "")))
    .sort();
  let ok = 0;
  for (const f of files) {
    const slug = f.replace(".json", "");
    const exs = JSON.parse(fs.readFileSync(`scripts/_sets/${f}`, "utf8"));
    // GATE: never seed a set that fails the template validator (mix, featured/
    // pool split, translations, audioClip specs, full vocab coverage, …).
    const issues = validateSet(exs, vocabBySlug.get(slug));
    if (issues.length && !force) {
      console.log(`✗ ${slug}: BLOCKED by validator (${issues.length} issue${issues.length === 1 ? "" : "s"}):\n    ` + issues.join("\n    "));
      continue;
    }
    if (issues.length && force) console.log(`! ${slug}: ${issues.length} validator issue(s) overridden by --force`);
    // Resolve by slug REGARDLESS of status (2026-07-09). This used to require
    // status:"published", which had a perverse effect: to seed practice for a
    // journey still in construction you had to publish its stories; and the
    // reader does NOT filter by Journey.status, so a "published" story of an
    // archived/in-progress journey is reachable by direct URL IN PRODUCTION.
    // That is exactly why Friends and Hanseat ended up exposed. Practice sets
    // are inert until the story is readable, so seeding a draft is harmless;
    // forcing a publish to seed was the actual hazard.
    const story = await prisma.journeyStory.findFirst({
      where: { slug },
      select: { id: true, status: true, journey: { select: { language: true } } },
    });
    if (!story) { console.log(`✗ ${slug}: story not found`); continue; }
    // El idioma sale del journey, no de una constante. Estaba escrito
    // `'spanish'` a fuego en el INSERT, asi que un set curado de cualquier otro
    // idioma entraba etiquetado como espanol y la pestana Practice, que filtra
    // por idioma, no lo encontraba nunca. Se vio al sembrar el Traveler DE A0
    // (2026-08-23); el constructor automatico ya usaba `journey.language`.
    const language = story.journey?.language ?? "spanish";
    if (story.status !== "published") console.log(`  (${slug} is ${story.status}; seeding anyway, no publish needed)`);
    if (!apply) { console.log(`[dry] ${slug}: ${exs.length} ex`); ok++; continue; }
    const setIds = await prisma.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM dp_story_practice_sets_v1 WHERE "storyId" = $1`, story.id);
    // Preserve EVERY audioClip pointer before wiping: _genWordClips.ts y
    // _genPracticeClips.ts/_genFillBlankClips.ts escriben wordClipUrl/clipUrl
    // DIRECTO en el payload de la fila, y NUNCA tocan este JSON. Un
    // delete-and-reinsert desde el JSON borraba silenciosamente esos
    // punteros cuando el JSON no los traia: primero wordClipUrl (273 en DE A0
    // / ES A2, 2026-09-18, fix 43a568b3), y el mismo dia clipUrl en 4
    // journeys mas (911 ejercicios; DE A1, FR A0, FR A1, B2 latam) porque
    // aquel fix solo cubria wordClipUrl. wordClipUrl es del WORD (la misma
    // palabra suena igual en cualquier frase que la use), asi que se
    // conserva por palabra sola; clipUrl es de la FRASE completa, asi que se
    // conserva por (tipo, palabra, frase) para no pegarle a un ejercicio el
    // clip de otro que comparte palabra con una frase distinta (featured vs
    // pool del mismo lema).
    const existingWordClips = new Map<string, { wordClipUrl?: string; wordVoiceId?: string }>();
    const existingSentenceClips = new Map<string, { clipUrl?: string; rev?: number }>();
    for (const s of setIds) {
      const rows = await prisma.$queryRawUnsafe<{ type: string; word: string | null; sentence: string | null; payload: any }[]>(
        `SELECT type, word, sentence, payload FROM dp_story_practice_exercises_v1 WHERE "setId" = $1`, s.id);
      for (const r of rows) {
        const ac = r.payload?.audioClip;
        if (!ac) continue;
        if (r.type === "meaning_in_context" && r.word && ac.wordClipUrl)
          existingWordClips.set(r.word, { wordClipUrl: ac.wordClipUrl, wordVoiceId: ac.wordVoiceId });
        if (r.word && r.sentence && ac.clipUrl)
          existingSentenceClips.set(`${r.type}::${r.word}::${r.sentence}`, { clipUrl: ac.clipUrl, rev: ac.rev });
      }
    }
    for (const s of setIds) await prisma.$executeRawUnsafe(`DELETE FROM dp_story_practice_exercises_v1 WHERE "setId" = $1`, s.id);
    await prisma.$executeRawUnsafe(`DELETE FROM dp_story_practice_sets_v1 WHERE "storyId" = $1`, story.id);
    const setId = genId("sps_", 0);
    await prisma.$executeRawUnsafe(`INSERT INTO dp_story_practice_sets_v1 (id, "storyId", locked, "createdAt", "updatedAt") VALUES ($1,$2,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, setId, story.id);
    let carriedWord = 0, carriedSentence = 0;
    for (let i = 0; i < exs.length; i++) {
      const e = exs[i];
      const featured = e.featured !== false; // default featured unless explicitly false
      let payload = e.payload;
      if (e.type === "meaning_in_context" && e.word && !payload?.audioClip?.wordClipUrl) {
        const prev = existingWordClips.get(e.word);
        if (prev?.wordClipUrl) { payload = { ...payload, audioClip: { ...payload?.audioClip, ...prev } }; carriedWord++; }
      }
      if (e.word && e.sentence && !payload?.audioClip?.clipUrl) {
        const prev = existingSentenceClips.get(`${e.type}::${e.word}::${e.sentence}`);
        if (prev?.clipUrl) { payload = { ...payload, audioClip: { ...payload?.audioClip, ...prev } }; carriedSentence++; }
      }
      await prisma.$executeRawUnsafe(
        `INSERT INTO dp_story_practice_exercises_v1 (id,"setId","orderIndex",type,word,sentence,payload,"audioUrl",featured,language,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,NULL,$8,$9,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
        genId("spe_", i), setId, i, e.type, e.word, e.sentence, JSON.stringify(payload), featured, language);
    }
    if (carriedWord || carriedSentence)
      console.log(`  (${slug}: carried forward ${carriedWord} wordClipUrl + ${carriedSentence} clipUrl not present in the JSON)`);
    const featCount = exs.filter((e: any) => e.featured !== false).length;
    console.log(`✓ ${slug}: ${exs.length} ex (${featCount} featured) (set ${setId})`);
    ok++;
  }
  console.log(`\n${ok}/${files.length} ${apply ? "seeded" : "dry"}`);
  await prisma.$disconnect();
})().catch(e => { console.log("FATAL", e.message); process.exit(1); });
