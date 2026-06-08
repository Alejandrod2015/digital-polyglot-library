import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { isStudioMember } from "@/lib/studio-access";

export const dynamic = "force-dynamic";

/**
 * GET /api/studio/audio-editor/audio?id=<storyId>&v=master|preview
 *
 * Same-origin proxy for a story's R2 audio. WaveSurfer downloads the file
 * with `fetch()` to decode it for the waveform, and that fetch is CORS-gated.
 * The R2 bucket's allowlist only covers the apex host, not the `www.` host the
 * Studio runs on, so a direct cross-origin fetch fails silently (empty
 * waveform, 0:00). Streaming through this route keeps the request same-origin.
 *
 * The target URL is resolved from the DB by story id, never taken from the
 * query string, so this cannot be turned into an open proxy / SSRF. The `f`
 * query param (if present) is an ignored client-side cache-buster.
 *
 * `Range` is forwarded so the audio element can seek (206 partial content).
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const variant = url.searchParams.get("v") === "preview" ? "preview" : "master";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const story = await prisma.journeyStory.findUnique({
    where: { id },
    select: { audioUrl: true, audioUrlPreview: true },
  });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

  const target = variant === "preview" ? story.audioUrlPreview : story.audioUrl;
  if (!target) {
    return NextResponse.json({ error: "Story has no audio" }, { status: 404 });
  }

  const range = request.headers.get("range");
  const upstream = await fetch(target, {
    headers: range ? { Range: range } : {},
    cache: "no-store",
  });

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { error: `Upstream audio fetch failed (${upstream.status})` },
      { status: 502 },
    );
  }

  const headers = new Headers();
  for (const h of [
    "content-type",
    "content-length",
    "accept-ranges",
    "content-range",
    "etag",
    "last-modified",
  ]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has("content-type")) headers.set("content-type", "audio/mpeg");
  if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "private, max-age=300");

  return new Response(upstream.body, { status: upstream.status, headers });
}
