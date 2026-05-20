import { prisma } from "@/lib/prisma";

const SKUS = [
  "DP-COLOMBIAN-SPANISH-STORIES--COF",
  "DP-PUERTO-RICAN-SPANISH-BY-THE-CO",
  "DP-SHORT-STORIES-IN-PUERTO-RICAN-",
];

function matchCatalogByLegacySku(
  bookId: string,
  catalog: Array<{ slug: string; title: string }>
): string | null {
  const lower = bookId.toLowerCase().replace(/^dp-/, "");
  const beforeVariant = lower.split("--")[0];
  const cleaned = beforeVariant.replace(/-+$/, "");
  if (!cleaned) return null;
  const tokens = cleaned.split("-").filter(Boolean);
  for (let take = tokens.length; take >= 3; take -= 1) {
    const droppedTail = tokens.slice(take);
    const hasDistinctiveDropped = droppedTail.some((t) => t.length >= 6);
    if (hasDistinctiveDropped) break;
    const prefix = tokens.slice(0, take).join("-");
    const match = catalog.find((c) =>
      c.slug.toLowerCase().startsWith(prefix)
    );
    if (match) return match.title;
  }
  return null;
}

function humaniseSku(value: string): string {
  return value
    .replace(/^DP-/i, "")
    .replace(/-+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function main() {
  const catalog = await prisma.catalogBook.findMany({
    select: { slug: true, title: true },
  });
  console.log("\n== CatalogBook slugs disponibles ==");
  for (const c of catalog) console.log("  " + c.slug);

  console.log("\n== Resolución ==");
  for (const sku of SKUS) {
    const fuzzy = matchCatalogByLegacySku(sku, catalog);
    const fallback = humaniseSku(sku);
    const final = fuzzy ?? fallback;
    console.log(`  ${sku.padEnd(40)} -> ${final}  ${fuzzy ? "[catalog]" : "[humanise]"}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
