// /src/app/talking-points/piece/[slug]/page.tsx

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import type { Plan } from "@domain/access";
import { canAccessTalkingPoints, getPiece, getTopics } from "@/lib/talkingPoints";
import PieceClient from "./PieceClient";

// Plan-gated, so it reads the session and cannot be prerendered. Same stance
// as the story route.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  // Metadata runs before the page body, so it needs the same gate: without it
  // the piece's question leaks to anyone who hits the URL, in the browser tab
  // and in any link preview, even though the body correctly 404s.
  const user = await currentUser();
  const plan = (user?.publicMetadata?.plan as Plan | undefined) ?? "free";
  if (!canAccessTalkingPoints(plan)) return { title: "Not found" };

  const { slug } = await params;
  const found = getPiece(slug);
  if (!found) return { title: "Talking Points" };
  return { title: found.piece.title, description: found.piece.hook };
}

export default async function PiecePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // Same gate as the browse route: a deep link must not bypass the plan.
  const user = await currentUser();
  const plan = (user?.publicMetadata?.plan as Plan | undefined) ?? "free";
  if (!canAccessTalkingPoints(plan)) notFound();

  const { slug } = await params;
  const found = getPiece(slug);
  if (!found) notFound();

  // Related pieces live on browse, not stapled under the prose, so the reader
  // no longer takes siblings.
  return <PieceClient topic={found.topic} piece={found.piece} />;
}
