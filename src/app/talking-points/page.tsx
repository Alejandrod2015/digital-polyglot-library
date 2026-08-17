// /src/app/talking-points/page.tsx
//
// Talking Points browses; it does not walk.
//
// WHY (corrected 2026-08-05, third pass): the first two builds rendered this
// with the journey path; topic banners and the zigzag of story cards. That
// path is a metaphor for PROGRESSION: in a journey, story 2 follows story 1
// because they share characters, vocabulary and an arc, which is why the
// continuity gates exist at all. Non-fiction has none of that. No piece here
// depends on another, so a path would be a lie about the content.
//
// What stays journey-shaped is the READER: audio, karaoke, tap-any-word,
// vocabulary, practice. What replaces the path is the pattern this app
// already uses for content you browse without an order: SectionHead plus
// StoryCarousel, exactly like Home and Explore.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import type { Plan } from "@domain/access";
import { canAccessTalkingPoints, getEntries } from "@/lib/talkingPoints";
import BrowseClient from "./BrowseClient";

export const metadata: Metadata = {
  title: "Talking Points",
  description: "Short non-fiction about what people are actually arguing about.",
};

export default async function TalkingPointsPage() {
  // Polyglot only. Hiding the nav link is not a gate; the route checks too.
  const user = await currentUser();
  const plan = (user?.publicMetadata?.plan as Plan | undefined) ?? "free";
  if (!canAccessTalkingPoints(plan)) notFound();

  // Only published pieces. A title with no prose behind it is an editorial
  // state, not something to show a reader: the dashed "Not written yet" cards
  // made the section look broken rather than growing. The titles stay in the
  // catalogue as the writing queue.
  //
  // The FILTERS stay regardless of how few pieces are showing. They are the
  // structure that carries the section once it has inventory; removing them
  // now would just mean adding them back in a month.
  const entries = getEntries().filter((e) => e.piece.body.length > 0);
  return <BrowseClient entries={entries} />;
}
