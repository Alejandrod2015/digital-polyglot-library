import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  getJourneyVariantPlanForStudio,
  saveJourneyVariantPlanForStudio,
} from "@/lib/journeyCurriculumSource";
import type { JourneyVariantPlan } from "@/app/journey/journeyCurriculum";
import { listStudioJourneyStoriesForVariant } from "@/lib/studioJourneyStories";

type RouteContext = {
  params: Promise<{ language: string; variantId: string }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { language, variantId } = await context.params;
  const plan = await getJourneyVariantPlanForStudio(language, variantId);
  if (!plan) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const stories = await listStudioJourneyStoriesForVariant(language, variantId);
  return NextResponse.json({ plan, stories });
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { language, variantId } = await context.params;
  try {
    const body = (await req.json()) as { plan: JourneyVariantPlan };
    const plan: JourneyVariantPlan = {
      ...body.plan,
      language,
      variantId,
    };
    await saveJourneyVariantPlanForStudio(plan);
    revalidatePath("/studio/journey-builder");
    revalidatePath(`/studio/journey-builder/${encodeURIComponent(language)}/${encodeURIComponent(variantId)}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[studio/journey-builder] failed to save plan", error);
    return NextResponse.json({ error: "Failed to save plan" }, { status: 500 });
  }
}
