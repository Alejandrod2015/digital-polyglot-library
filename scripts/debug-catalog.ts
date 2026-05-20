import { prisma } from "@/lib/prisma";

async function main() {
  // Probar resolver bookIds raros contra CatalogBook (por id, por slug)
  const ids = [
    "DP-COLOMBIAN-SPANISH-STORIES--COF",
    "DP-PUERTO-RICAN-SPANISH-BY-THE-CO",
    "DP-SHORT-STORIES-IN-PUERTO-RICAN-",
  ];

  const byId = await prisma.catalogBook.findMany({
    where: { id: { in: ids } },
    select: { id: true, slug: true, title: true, language: true },
  });
  console.log("\n== CatalogBook by id ==", byId);

  // También mostremos primeras 20 entradas de CatalogBook para entender formato
  const sample = await prisma.catalogBook.findMany({
    take: 10,
    select: { id: true, slug: true, title: true },
  });
  console.log("\n== CatalogBook sample (first 10) ==");
  for (const b of sample) {
    console.log(`  id=${b.id.padEnd(45)}  slug=${b.slug.padEnd(35)}  title=${b.title}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
