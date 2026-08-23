import { prisma } from "@/lib/prisma";
async function main() {
  const rows = await prisma.outboundClick.findMany({ orderBy: { createdAt: "desc" }, take: 10 });
  console.log(rows.length ? JSON.stringify(rows, null, 1) : "sin filas");
}
main().finally(() => process.exit(0));
