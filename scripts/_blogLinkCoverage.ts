// Que porcentaje de las LECTURAS cae en un post que enlaza a la tienda.
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

async function main() {
  const dir = path.join(process.cwd(), "content/blog");
  const linked = new Set<string>();
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".mdx"))) {
    if (fs.readFileSync(path.join(dir, f), "utf8").includes("shop.digitalpolyglot.com")) {
      linked.add(f.replace(/\.mdx$/, ""));
    }
  }
  const rows = await prisma.pageVisit.findMany({
    where: { createdAt: { gte: new Date("2026-05-17T00:00:00Z") }, path: { startsWith: "/blog/" } },
    select: { path: true },
  });
  let withLink = 0, without = 0;
  const orphans = new Map<string, number>();
  for (const r of rows) {
    const slug = r.path.replace(/^\/blog\/?/, "").split("?")[0].replace(/\/$/, "");
    if (!slug) continue;
    if (linked.has(slug)) withLink++;
    else { without++; orphans.set(slug, (orphans.get(slug) ?? 0) + 1); }
  }
  console.log(JSON.stringify({
    posts_con_enlace: linked.size,
    lecturas_en_post_con_enlace: withLink,
    lecturas_en_post_sin_enlace: without,
    cobertura: ((100 * withLink) / (withLink + without)).toFixed(1) + "%",
    top_sin_enlace: [...orphans.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
  }, null, 1));
}
main().finally(() => process.exit(0));
