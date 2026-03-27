import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { JourneyVariantPlan } from "@/app/journey/journeyCurriculum";
import {
  getJourneyVariantPlanForStudio,
  listJourneyVariantPlansForStudio,
  saveJourneyVariantPlanForStudio,
} from "@/lib/journeyCurriculumSource";

type CreateJourneyRequest = {
  language?: string;
  variantId?: string;
  levelsIncluded?: string[];
  templateLanguage?: string | null;
  templateVariantId?: string | null;
};

const LEVEL_COPY: Record<string, string> = {
  a1: "Primeros pasos",
  a2: "Más confianza",
  b1: "Soltura cotidiana",
  b2: "Expresión más rica",
  c1: "Lenguaje matizado",
  c2: "Dominio avanzado",
};

function normalizeVariantId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plans = await listJourneyVariantPlansForStudio();
  return NextResponse.json({ plans });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as CreateJourneyRequest;
    const language = body.language?.trim() || "Spanish";
    const variantId = normalizeVariantId(body.variantId ?? "");
    const requestedLevels = Array.isArray(body.levelsIncluded)
      ? body.levelsIncluded
          .map((level) => level.trim().toLowerCase())
          .filter((level) => ["a1", "a2", "b1", "b2", "c1", "c2"].includes(level))
      : [];

    if (!variantId) {
      return NextResponse.json({ error: "Missing variantId" }, { status: 400 });
    }

    const existingPlan = await getJourneyVariantPlanForStudio(language, variantId);
    if (existingPlan) {
      return NextResponse.json({ error: "Journey already exists" }, { status: 409 });
    }

    const levelsIncluded = requestedLevels.length ? requestedLevels : ["a1"];

    let plan: JourneyVariantPlan;
    if (body.templateLanguage && body.templateVariantId) {
      const template = await getJourneyVariantPlanForStudio(body.templateLanguage, body.templateVariantId);
      if (!template) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }

      const templateLevels = template.levels.filter((level) => levelsIncluded.includes(level.id.toLowerCase()));
      plan = {
        language,
        variantId,
        levels: templateLevels.map((level) => ({
          ...level,
          topics: level.topics.map((topic) => ({ ...topic })),
        })),
      };
    } else {
      plan = {
        language,
        variantId,
        levels: levelsIncluded.map((levelId) => ({
          id: levelId,
          title: levelId.toUpperCase(),
          subtitle: LEVEL_COPY[levelId] ?? "Describe este nivel",
          topicTarget: 0,
          storyTargetPerTopic: 1,
          topics: [],
        })),
      };
    }

    await saveJourneyVariantPlanForStudio(plan);
    revalidatePath("/studio/journey-builder");
    revalidatePath(`/studio/journey-builder/${encodeURIComponent(language)}/${encodeURIComponent(variantId)}`);
    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    console.error("[studio/journey-builder] failed to create journey", error);
    return NextResponse.json({ error: "Failed to create journey" }, { status: 500 });
  }
}
