export const runtime = "nodejs";

import { createClerkClient } from "@clerk/backend";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { serializeEntitlement } from "@/lib/billing";
import { getMobileSessionFromRequest, type MobileSessionPayload } from "@/lib/mobileSession";
import { getIsoLanguageTag } from "@/lib/languageFlags";
import { chatCompletion, extractJSON } from "@/agents/config/llmProvider";
import { prisma } from "@/lib/prisma";
import type { Plan } from "@domain/access";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Cap the uploaded clip so a malformed/oversized payload can't blow up
// memory or the Whisper bill. ~10s of m4a is well under 1 MB; 6 MB is a
// generous ceiling that still rejects accidental large uploads.
const MAX_AUDIO_BYTES = 6 * 1024 * 1024;

function isPlan(value: unknown): value is Exclude<Plan, undefined> {
  return (
    value === "free" ||
    value === "basic" ||
    value === "premium" ||
    value === "polyglot" ||
    value === "owner"
  );
}

// Resolve the live plan (not the possibly-stale token plan) so a mid-week
// upgrade unlocks immediately and a downgrade locks immediately. Mirrors
// the resolution in /api/mobile/billing/entitlement.
async function resolveEffectivePlan(session: MobileSessionPayload): Promise<Plan> {
  const [entitlement, user] = await Promise.all([
    prisma.billingEntitlement.findUnique({ where: { userId: session.sub } }),
    clerkClient.users.getUser(session.sub).catch(() => null),
  ]);
  const serialized = serializeEntitlement(entitlement);
  const metadataPlan = user?.publicMetadata?.plan;
  return isPlan(metadataPlan) ? metadataPlan : serialized.plan;
}

function whisperLanguageHint(language: string): string | undefined {
  const iso = getIsoLanguageTag(language).toLowerCase();
  return iso === "??" ? undefined : iso;
}

type PromptBody = {
  action: "prompt";
  language?: string;
  level?: string;
};

type ReplyBody = {
  action: "reply";
  language?: string;
  level?: string;
  question?: string;
  audioBase64?: string;
  mimeType?: string;
};

function buildQuestionMessages(language: string, level: string) {
  return [
    {
      role: "system" as const,
      content:
        `You are a warm, encouraging conversation partner for someone learning ${language} ` +
        `at roughly a ${level} level. Ask ONE short, open-ended question entirely in ${language}, ` +
        `about everyday life (routines, food, weekend plans, hobbies, family, travel). ` +
        `Keep it to a single sentence the learner can answer out loud in a few seconds. ` +
        `Output ONLY the question in ${language}: no translation, no greeting, no quotation marks, no extra text.`,
    },
    { role: "user" as const, content: "Give me one question to start." },
  ];
}

function buildReplyMessages(
  language: string,
  level: string,
  question: string,
  transcript: string
) {
  return [
    {
      role: "system" as const,
      content:
        `You are a warm conversation partner helping someone practice spoken ${language} at a ${level} level. ` +
        `They were asked: "${question}". This is their spoken answer, transcribed: "${transcript}". ` +
        `Reply with a strict JSON object (no markdown fences) of shape ` +
        `{"reply": string, "feedback": string}. ` +
        `"reply" is ONE short, friendly follow-up sentence in ${language} that reacts to what they said and keeps the chat going. ` +
        `"feedback" is ONE short, kind tip written in ENGLISH about their ${language} (a grammar slip, a more natural word, or genuine praise if it was good). ` +
        `Keep both under 20 words. Do not mention that the answer was transcribed.`,
    },
    { role: "user" as const, content: "Respond now." },
  ];
}

export async function POST(req: NextRequest): Promise<Response> {
  const session = getMobileSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!openai) {
    return NextResponse.json({ error: "Speaking practice is not available." }, { status: 503 });
  }

  const plan = await resolveEffectivePlan(session);
  if (plan !== "polyglot" && plan !== "owner") {
    return NextResponse.json({ error: "Speaking practice is a Polyglot feature." }, { status: 403 });
  }

  let body: PromptBody | ReplyBody;
  try {
    body = (await req.json()) as PromptBody | ReplyBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const language = (body.language || "Spanish").trim() || "Spanish";
  const level = (body.level || "Intermediate").trim() || "Intermediate";

  try {
    if (body.action === "prompt") {
      const question = await chatCompletion(buildQuestionMessages(language, level), {
        temperature: 0.8,
        maxTokens: 80,
      });
      const cleaned = question.replace(/^["'\s]+|["'\s]+$/g, "");
      return NextResponse.json({ question: cleaned });
    }

    if (body.action === "reply") {
      const question = (body.question || "").trim();
      if (!question) {
        return NextResponse.json({ error: "Missing question." }, { status: 400 });
      }
      if (!body.audioBase64) {
        return NextResponse.json({ error: "Missing audio." }, { status: 400 });
      }

      const audioBuffer = Buffer.from(body.audioBase64, "base64");
      if (audioBuffer.length === 0) {
        return NextResponse.json({ error: "Empty audio." }, { status: 400 });
      }
      if (audioBuffer.length > MAX_AUDIO_BYTES) {
        return NextResponse.json({ error: "Audio clip too large." }, { status: 413 });
      }

      const mime = body.mimeType || "audio/m4a";
      const ext = mime.includes("wav") ? "wav" : mime.includes("mp") ? "mp3" : "m4a";
      const file = new File([new Uint8Array(audioBuffer)], `answer.${ext}`, { type: mime });

      const transcription = await openai.audio.transcriptions.create({
        file,
        model: "whisper-1",
        language: whisperLanguageHint(language),
      });
      const transcript = (typeof transcription.text === "string" ? transcription.text : "").trim();

      if (!transcript) {
        return NextResponse.json({
          transcript: "",
          reply: "",
          feedback: "I couldn't hear that clearly. Try speaking a little closer to the mic.",
        });
      }

      const raw = await chatCompletion(buildReplyMessages(language, level, question, transcript), {
        temperature: 0.7,
        maxTokens: 200,
      });

      let reply = "";
      let feedback = "";
      try {
        const parsed = extractJSON<{ reply?: string; feedback?: string }>(raw);
        reply = (parsed.reply || "").trim();
        feedback = (parsed.feedback || "").trim();
      } catch {
        // Model didn't return clean JSON; surface its text as the reply
        // so the turn still completes rather than erroring out.
        reply = raw.trim();
      }

      return NextResponse.json({ transcript, reply, feedback });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error("❌ Error en POST /api/mobile/speaking:", err);
    return NextResponse.json({ error: "Speaking practice failed." }, { status: 500 });
  }
}
