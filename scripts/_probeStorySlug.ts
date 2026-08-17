import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const SLUG = process.argv[2] ?? "el-museo-guggenheim";
const JID = process.argv[3] ?? "cmrr5hp4f000c32k15lrvs0e1";
async function run() {
  console.log("journeyStory by id:", await prisma.journeyStory.findUnique({ where: { id: JID } }).then((r) => r && { id: r.id, slug: r.slug, title: r.title, status: r.status, journeyId: r.journeyId, topicSlug: (r as unknown as Record<string, unknown>).topicSlug }).catch((e) => String(e)));
  console.log("journey by id:", await prisma.journey.findUnique({ where: { id: JID } }).then((r) => r && { id: r.id, slug: (r as unknown as Record<string, unknown>).slug, status: r.status }).catch((e) => String(e)));
  console.log("standalone:", await prisma.standaloneStory.findMany({ where: { slug: SLUG }, select: { slug: true, language: true, variant: true, cefrLevel: true, level: true, published: true } }));
  console.log("catalogStory:", await prisma.catalogStory.findMany({ where: { slug: SLUG }, select: { slug: true } }).catch((e) => String(e)));
  console.log("libraryStory:", await prisma.libraryStory.findMany({ where: { slug: SLUG } }).catch((e) => String(e)));
  console.log("journeyStory by slug:", await prisma.journeyStory.findMany({ where: { slug: SLUG }, select: { slug: true, journeyId: true, status: true } }));
  await prisma.$disconnect();
}
run().catch(async (e) => { console.error(e); await prisma.$disconnect(); });
