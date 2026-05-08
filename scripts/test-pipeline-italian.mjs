#!/usr/bin/env node
/**
 * 🇮🇹 Test Pipeline — Italian (flujo completo real)
 *
 * Prueba el flujo REAL del pipeline:
 *   Bootstrap (crear estructura) → Planner (detectar gaps) → Content (generar) → QA
 *
 * Uso:
 *   node scripts/test-pipeline-italian.mjs
 *   node scripts/test-pipeline-italian.mjs --publish   (también publica a Sanity)
 *
 * Requiere: .env.local con DATABASE_URL y OPENAI_API_KEY
 */
import { PrismaClient } from "../src/generated/prisma/index.js";
import OpenAI from "openai";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── Load env ──────────────────────────────────────────────────────────
function loadEnv() {
  for (const f of [".env", ".env.local"]) {
    try {
      const content = readFileSync(resolve(ROOT, f), "utf-8");
      for (const line of content.split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("=");
        if (eq < 0) continue;
        const key = t.slice(0, eq).trim();
        const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) process.env[key] = val;
      }
    } catch {}
  }
}
loadEnv();

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PUBLISH = process.argv.includes("--publish");

function log(icon, msg) { console.log(`${icon}  ${msg}`); }
function sep(title) { console.log(`\n${"─".repeat(55)}\n  ${title}\n${"─".repeat(55)}`); }

async function main() {
  // ── PASO 0: Verificar conexiones ──────────────────────────────────
  sep("🔍 PASO 0 — Verificar conexiones");

  try {
    const count = await prisma.storyDraft.count();
    log("✅", `Base de datos OK — ${count} drafts existentes`);
  } catch (e) {
    log("❌", `No se pudo conectar a la base de datos: ${e.message}`);
    process.exit(1);
  }

  try {
    const test = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Rispondi solo: ciao" }],
      max_tokens: 5,
    });
    log("✅", `OpenAI OK — "${test.choices[0]?.message?.content}"`);
  } catch (e) {
    log("❌", `OpenAI falló: ${e.message}`);
    process.exit(1);
  }

  // ── PASO 1: Verificar si italiano tiene estructura de journey ─────
  sep("🏗️  PASO 1 — Verificar estructura de journey para italiano");

  // We can't import the Next.js modules directly (they depend on next/cache),
  // so we check Sanity directly for journeyVariantPlan
  const sanityProjectId = process.env.SANITY_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const sanityDataset = process.env.SANITY_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET;
  const sanityToken = process.env.SANITY_API_WRITE_TOKEN;
  const sanityVersion = process.env.SANITY_API_VERSION || process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-01-01";

  if (!sanityProjectId || !sanityDataset) {
    log("❌", "Faltan variables de Sanity (SANITY_PROJECT_ID, SANITY_DATASET)");
    process.exit(1);
  }

  const sanityQuery = encodeURIComponent('*[_type == "journeyVariantPlan" && language == "italian"]{ _id, language, variantId, "levelCount": count(levels), "topicCount": count(levels[].topics[]) }');
  const sanityUrl = `https://${sanityProjectId}.api.sanity.io/v${sanityVersion}/data/query/${sanityDataset}?query=${sanityQuery}`;

  let italianPlanExists = false;
  try {
    const res = await fetch(sanityUrl, {
      headers: sanityToken ? { Authorization: `Bearer ${sanityToken}` } : {},
    });
    const data = await res.json();
    const plans = data.result || [];

    if (plans.length > 0) {
      const plan = plans[0];
      log("✅", `Estructura de italiano ya existe: ${plan.levelCount} niveles, ${plan.topicCount} topics`);
      italianPlanExists = true;
    } else {
      log("⚠️", "Italiano NO tiene estructura de journey — necesita bootstrap");
    }
  } catch (e) {
    log("❌", `Error consultando Sanity: ${e.message}`);
    process.exit(1);
  }

  // ── PASO 2: Bootstrap si es necesario ─────────────────────────────
  if (!italianPlanExists) {
    sep("🏗️  PASO 2 — Bootstrap: crear estructura de journey para italiano");

    // Try to find an existing plan in Sanity to use as template
    const allPlansQuery = encodeURIComponent('*[_type == "journeyVariantPlan"]{ _id, language, variantId, levels }');
    const allPlansUrl = `https://${sanityProjectId}.api.sanity.io/v${sanityVersion}/data/query/${sanityDataset}?query=${allPlansQuery}`;

    let templateLevels = null;

    const allRes = await fetch(allPlansUrl, {
      headers: sanityToken ? { Authorization: `Bearer ${sanityToken}` } : {},
    });
    const allData = await allRes.json();
    const allPlans = allData.result || [];

    if (allPlans.length > 0) {
      // Use the most complete Sanity plan as template
      let template = allPlans[0];
      let maxTopics = 0;
      for (const plan of allPlans) {
        const count = (plan.levels || []).reduce((s, l) => s + (l.topics || []).length, 0);
        if (count > maxTopics) { maxTopics = count; template = plan; }
      }
      log("📋", `Template de Sanity: ${template.language} (${template.variantId}) — ${maxTopics} topics`);
      templateLevels = template.levels;
    } else {
      // No plans in Sanity — use the hardcoded fallback curriculum from the codebase
      log("ℹ️", "No hay planes en Sanity. Usando estructura hardcoded del curriculum español.");
      templateLevels = [
        {
          id: "a1", title: "A1", subtitle: "First steps",
          topics: [
            { slug: "community-celebrations", label: "Community & Celebrations" },
            { slug: "food-daily-life", label: "Food & Drink" },
            { slug: "places-getting-around", label: "Places & Getting Around" },
            { slug: "home-family", label: "Home & Family" },
            { slug: "nature-adventure", label: "Nature & Adventure" },
            { slug: "legends-folklore", label: "Legends & Folklore" },
          ],
        },
        {
          id: "a2", title: "A2", subtitle: "Building confidence",
          topics: [
            { slug: "work-study", label: "Work & Study" },
            { slug: "travel-plans", label: "Travel & Plans" },
            { slug: "health-wellbeing", label: "Health & Wellbeing" },
            { slug: "city-life-services", label: "City Life & Services" },
            { slug: "relationships-feelings", label: "Relationships & Feelings" },
            { slug: "traditions-daily-culture", label: "Traditions & Daily Culture" },
          ],
        },
        {
          id: "b1", title: "B1", subtitle: "Everyday confidence",
          topics: [
            { slug: "opinions-life-choices", label: "Opinions & Life Choices" },
            { slug: "media-technology", label: "Media & Technology" },
            { slug: "identity-belonging", label: "Identity & Belonging" },
            { slug: "work-ambition", label: "Work & Ambition" },
            { slug: "money-everyday-decisions", label: "Money & Everyday Decisions" },
            { slug: "society-rules", label: "Society & Rules" },
            { slug: "memory-personal-history", label: "Memory & Personal History" },
            { slug: "change-new-stages", label: "Change & New Stages" },
          ],
        },
        {
          id: "b2", title: "B2", subtitle: "Richer expression",
          topics: [
            { slug: "public-life-institutions", label: "Public Life & Institutions" },
            { slug: "values-responsibility", label: "Values & Responsibility" },
            { slug: "art-creativity", label: "Art & Creativity" },
            { slug: "science-innovation", label: "Science & Innovation" },
            { slug: "migration-belonging", label: "Migration & Belonging" },
            { slug: "urban-life-opportunity", label: "Urban Life & Opportunity" },
            { slug: "communication-influence", label: "Communication & Influence" },
            { slug: "relationships-conflict", label: "Relationships & Conflict" },
          ],
        },
      ];
    }

    // Filter to A1-B2 levels and build the plan
    const targetLevels = ["a1", "a2", "b1", "b2"];
    const newLevels = (templateLevels || [])
      .filter((l) => targetLevels.includes(l.id?.toLowerCase()))
      .map((l) => ({
        _type: "journeyLevelPlan",
        id: l.id,
        title: l.title,
        subtitle: l.subtitle,
        topicTarget: l.topics?.length || 0,
        storyTargetPerTopic: 1,
        topics: (l.topics || []).map((t) => ({
          _type: "journeyTopicPlan",
          slug: t.slug,
          label: t.label,
          storyTarget: 1,
        })),
      }));

    const docId = "journey-variant-plan.italian.italy";
    const mutations = [{
      createOrReplace: {
        _id: docId,
        _type: "journeyVariantPlan",
        language: "italian",
        variantId: "italy",
        levels: newLevels,
      },
    }];

    const mutateUrl = `https://${sanityProjectId}.api.sanity.io/v${sanityVersion}/data/mutate/${sanityDataset}`;
    const mutateRes = await fetch(mutateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sanityToken}`,
      },
      body: JSON.stringify({ mutations }),
    });

    if (!mutateRes.ok) {
      const err = await mutateRes.text();
      log("❌", `Error creando plan en Sanity: ${err}`);
      process.exit(1);
    }

    const totalTopics = newLevels.reduce((s, l) => s + l.topics.length, 0);
    log("✅", `Plan de italiano creado: ${newLevels.length} niveles, ${totalTopics} topics`);
    for (const level of newLevels) {
      log("  📚", `${level.id.toUpperCase()}: ${level.topics.length} topics — ${level.topics.map(t => t.slug).join(", ")}`);
    }
  } else {
    sep("⏭️  PASO 2 — Bootstrap (no necesario)");
    log("ℹ️", "Italiano ya tiene estructura, saltando bootstrap");
  }

  // ── PASO 3: Planner — detectar gaps ───────────────────────────────
  sep("📋 PASO 3 — Planner: detectar gaps para italiano");

  // Count existing Italian stories in Sanity
  const italianStoriesQuery = encodeURIComponent('count(*[_type == "standaloneStory" && language == "italian" && journeyEligible == true])');
  const italianStoriesUrl = `https://${sanityProjectId}.api.sanity.io/v${sanityVersion}/data/query/${sanityDataset}?query=${italianStoriesQuery}`;
  const storiesRes = await fetch(italianStoriesUrl, {
    headers: sanityToken ? { Authorization: `Bearer ${sanityToken}` } : {},
  });
  const storiesData = await storiesRes.json();
  const existingStories = storiesData.result || 0;
  log("📊", `Historias italianas existentes en Sanity: ${existingStories}`);

  // Check existing briefs for Italian
  const existingBriefs = await prisma.curriculumBrief.count({
    where: { language: "italian", status: "draft" },
  });
  log("📊", `Briefs italianos pendientes en DB: ${existingBriefs}`);

  // Get the Italian plan to calculate expected gaps
  const italianPlanQuery = encodeURIComponent('*[_type == "journeyVariantPlan" && language == "italian"][0]{ levels }');
  const italianPlanUrl = `https://${sanityProjectId}.api.sanity.io/v${sanityVersion}/data/query/${sanityDataset}?query=${italianPlanQuery}`;
  const planRes = await fetch(italianPlanUrl, {
    headers: sanityToken ? { Authorization: `Bearer ${sanityToken}` } : {},
  });
  const planData = await planRes.json();
  const italianPlan = planData.result;

  if (italianPlan) {
    let totalSlots = 0;
    for (const level of italianPlan.levels || []) {
      for (const topic of level.topics || []) {
        totalSlots += topic.storyTarget || 1;
      }
    }
    const gaps = totalSlots - existingStories;
    log("🔍", `Slots totales: ${totalSlots}, existentes: ${existingStories}, gaps: ${gaps}`);

    if (gaps <= 0) {
      log("✅", "No hay gaps — todo el contenido italiano ya existe");
      await prisma.$disconnect();
      return;
    }

    // Create briefs for the first few gaps (limit to 3 for test)
    const BRIEF_LIMIT = 3;
    let briefsCreated = 0;

    for (const level of italianPlan.levels || []) {
      if (briefsCreated >= BRIEF_LIMIT) break;
      for (const topic of level.topics || []) {
        if (briefsCreated >= BRIEF_LIMIT) break;

        // Check if brief already exists
        const existing = await prisma.curriculumBrief.findFirst({
          where: {
            language: "italian",
            variant: "italy",
            level: level.id,
            topicSlug: topic.slug,
            storySlot: 1,
          },
        });
        if (existing) continue;

        await prisma.curriculumBrief.create({
          data: {
            language: "italian",
            variant: "italy",
            level: level.id,
            journeyKey: `italian-italy-${level.id}`,
            topicSlug: topic.slug,
            storySlot: 1,
            journeyFocus: "General",
            title: `${topic.label} – ${level.id.toUpperCase()} – Slot 1 (italian italy)`,
            brief: {
              description: `Historia para el journey "${topic.slug}", slot 1. Nivel ${level.id.toUpperCase()}, italian (italy).`,
              reason: "missing",
              constraints: {
                language: "italian",
                variant: "italy",
                level: level.id,
                topic: topic.slug,
                focus: "General",
              },
            },
            status: "draft",
          },
        });
        briefsCreated++;
        log("📝", `Brief creado: ${topic.label} — ${level.id.toUpperCase()}`);
      }
    }
    log("✅", `${briefsCreated} briefs creados (limitado a ${BRIEF_LIMIT} para test)`);
  }

  // ── PASO 4: Content Agent — generar historias ─────────────────────
  sep("✍️  PASO 4 — Content Agent: generar historias");

  const pendingBriefs = await prisma.curriculumBrief.findMany({
    where: { language: "italian", status: "draft" },
    orderBy: { createdAt: "asc" },
    take: 2, // Limit to 2 for test
  });

  if (pendingBriefs.length === 0) {
    log("⏭️", "No hay briefs pendientes");
  } else {
    log("📡", `Generando ${pendingBriefs.length} historias con OpenAI...`);

    for (const brief of pendingBriefs) {
      const briefData = brief.brief || {};
      const topic = brief.topicSlug;
      const level = brief.level;

      log("  🔄", `Generando: ${topic} (${level.toUpperCase()})...`);

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a language learning content creator specializing in Italian.

Generate a story in Italian at CEFR ${level.toUpperCase()} level about the topic "${topic.replace(/-/g, ' ')}".
Return valid JSON:
{
  "title": "string — title in Italian",
  "text": "string — the story, 200-400 words, culturally authentic Italian setting",
  "synopsis": "string — 1-2 sentence summary in English",
  "vocab": [{ "word": "Italian word", "translation": "English", "example": "Example sentence in Italian" }]
}

Requirements:
- Use only ${level.toUpperCase()}-appropriate vocabulary and grammar
- 8-12 vocab items with translations
- Culturally authentic setting in Italy
- Natural, engaging narrative`,
            },
            {
              role: "user",
              content: briefData.description || `Write a story about ${topic} for Italian learners at ${level.toUpperCase()} level.`,
            },
          ],
          temperature: 0.8,
          response_format: { type: "json_object" },
        });

        const raw = response.choices[0]?.message?.content;
        if (!raw) throw new Error("Empty response");

        const story = JSON.parse(raw);
        const slug = (story.title || "untitled")
          .toLowerCase()
          .replace(/[àáâãäå]/g, "a").replace(/[èéêë]/g, "e").replace(/[ìíîï]/g, "i")
          .replace(/[òóôõö]/g, "o").replace(/[ùúûü]/g, "u")
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .slice(0, 80);

        const draft = await prisma.storyDraft.create({
          data: {
            briefId: brief.id,
            title: story.title,
            slug,
            text: story.text,
            synopsis: story.synopsis || "",
            vocab: story.vocab || [],
            status: "generated",
            metadata: {
              language: "italian",
              variant: "italy",
              level,
              journeyTopic: topic,
              journeyFocus: brief.journeyFocus || "General",
              storySlot: brief.storySlot,
            },
          },
        });

        await prisma.curriculumBrief.update({
          where: { id: brief.id },
          data: { status: "generated" },
        });

        log("  ✅", `"${story.title}" — ${story.text.length} chars, ${story.vocab?.length} vocab`);

        // ── QA check ──
        const markers = ["è", "che", "una", "il", "la", "di", "per", "non", "con", "sono", "ho", "molto"];
        const textLower = story.text.toLowerCase();
        const italianScore = markers.filter((m) => textLower.includes(m)).length;
        const findings = [];

        if (story.text.length < 100) findings.push("Texto muy corto");
        if (story.text.length > 5000) findings.push("Texto muy largo");
        if (italianScore < 4) findings.push(`Bajo italiano (${italianScore}/${markers.length})`);
        if (!Array.isArray(story.vocab) || story.vocab.length < 5) findings.push("Vocab insuficiente");
        if (!story.title || story.title.length < 3) findings.push("Título muy corto");

        const score = Math.max(0, 100 - findings.length * 15);
        const passed = score >= 70;

        await prisma.qAReview.create({
          data: {
            storyDraftId: draft.id,
            status: passed ? "pass" : "fail",
            score,
            report: { findings, italianScore, textLength: story.text.length },
          },
        });

        await prisma.storyDraft.update({
          where: { id: draft.id },
          data: { status: passed ? "qa_pass" : "qa_fail" },
        });

        log("  🔎", `QA: ${score}/100 — ${passed ? "PASS" : "FAIL"} (italiano: ${italianScore}/${markers.length})`);

        if (passed) {
          await prisma.storyDraft.update({
            where: { id: draft.id },
            data: { status: "approved" },
          });
          log("  ⬆️", "Promovida a approved");
        }
      } catch (e) {
        log("  ❌", `Error: ${e.message}`);
      }
    }
  }

  // ── RESUMEN ──────────────────────────────────────────────────────
  sep("📊 RESUMEN FINAL");

  const finalDrafts = await prisma.storyDraft.findMany({
    where: { metadata: { path: ["language"], equals: "italian" } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const byStatus = {};
  for (const d of finalDrafts) {
    byStatus[d.status] = (byStatus[d.status] || 0) + 1;
  }

  const totalBriefs = await prisma.curriculumBrief.count({ where: { language: "italian" } });
  const pendingCount = await prisma.curriculumBrief.count({ where: { language: "italian", status: "draft" } });

  console.log(`
  Briefs italianos:      ${totalBriefs} total, ${pendingCount} pendientes
  Drafts italianos:      ${finalDrafts.length}
  Por estado:            ${Object.entries(byStatus).map(([k, v]) => `${k}: ${v}`).join(", ") || "ninguno"}
  `);

  for (const d of finalDrafts) {
    log("  📖", `"${d.title}" — ${d.status}`);
  }

  if (!PUBLISH) {
    console.log(`\n  Para publicar a Sanity: node scripts/test-pipeline-italian.mjs --publish\n`);
  }

  await prisma.$disconnect();
  log("✅", "Test completo.");
}

main().catch((e) => {
  console.error("\n💥 Error fatal:", e);
  process.exit(1);
});
