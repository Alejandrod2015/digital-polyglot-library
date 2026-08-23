import { prisma } from "@/lib/prisma";

async function main() {
  const total = await prisma.pageVisit.count();
  const first = await prisma.pageVisit.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } });
  const last = await prisma.pageVisit.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  const blog = await prisma.pageVisit.count({ where: { path: { startsWith: "/blog" } } });
  console.log({ total, blog, first: first?.createdAt, last: last?.createdAt });
}
main().finally(() => process.exit(0));
