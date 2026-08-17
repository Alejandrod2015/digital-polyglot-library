import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();

function wc(s: string | null) {
  return (s ?? "").replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
}
function vc(v: unknown) {
  return Array.isArray(v) ? v.length : 0;
}

async function main() {
  // ---- BOOKS (published only) ----
  const books = await p.catalogBook.findMany({ where: { published: true }, include: { stories: true } });
  let bW = 0,
    bV = 0,
    bN = 0;
  const bPer: number[] = [];
  for (const b of books)
    for (const s of b.stories) {
      const w = wc(s.text);
      if (!w) continue;
      bW += w;
      bV += vc(s.vocab);
      bN += 1;
      bPer.push((vc(s.vocab) / w) * 100);
    }

  // ---- JOURNEYS (live + draft only; archived excluded by rule) ----
  const journeys = await p.journey.findMany({
    where: { status: { in: ["active", "draft"] } },
    include: { stories: true },
  });
  let jW = 0,
    jV = 0,
    jN = 0;
  const jPer: number[] = [];
  const byJourney: { name: string; status: string; n: number; d: number; avgV: number; avgW: number }[] = [];
  for (const j of journeys) {
    let w0 = 0,
      v0 = 0,
      n0 = 0;
    for (const s of j.stories) {
      const w = wc(s.text);
      if (!w) continue;
      w0 += w;
      v0 += vc(s.vocab);
      n0 += 1;
      jPer.push((vc(s.vocab) / w) * 100);
    }
    if (!n0) continue;
    jW += w0;
    jV += v0;
    jN += n0;
    byJourney.push({
      name: j.name,
      status: j.status,
      n: n0,
      d: (v0 / w0) * 100,
      avgV: v0 / n0,
      avgW: w0 / n0,
    });
  }

  const med = (a: number[]) => {
    const s = [...a].sort((x, y) => x - y);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
  };

  console.log("=== LIBROS PUBLICADOS ===");
  console.log(`historias=${bN}  palabras/hist=${Math.round(bW / bN)}  vocab/hist=${(bV / bN).toFixed(1)}  densidad global=${((bV / bW) * 100).toFixed(2)}%  mediana por historia=${med(bPer).toFixed(2)}%`);

  console.log("\n=== JOURNEYS (live + draft) ===");
  console.log(`historias=${jN}  palabras/hist=${Math.round(jW / jN)}  vocab/hist=${(jV / jN).toFixed(1)}  densidad global=${((jV / jW) * 100).toFixed(2)}%  mediana por historia=${med(jPer).toFixed(2)}%`);

  console.log(`\nRATIO journeys/libros = ${(((jV / jW) * 100) / ((bV / bW) * 100)).toFixed(2)}x`);

  console.log("\n=== POR JOURNEY ===");
  byJourney
    .sort((a, b) => b.d - a.d)
    .forEach((r) =>
      console.log(
        `${(r.status === "active" ? "live " : "draft").padEnd(6)} ${r.name.slice(0, 42).padEnd(44)} n=${String(r.n).padStart(2)} ${Math.round(r.avgW)}w ${r.avgV.toFixed(1)}voc  ${r.d.toFixed(2)}%`
      )
    );

  console.log("\n=== POR LIBRO ===");
  for (const b of books) {
    let w0 = 0,
      v0 = 0,
      n0 = 0;
    for (const s of b.stories) {
      const w = wc(s.text);
      if (!w) continue;
      w0 += w;
      v0 += vc(s.vocab);
      n0 += 1;
    }
    console.log(`       ${b.slug.slice(0, 42).padEnd(44)} n=${String(n0).padStart(2)} ${Math.round(w0 / n0)}w ${(v0 / n0).toFixed(1)}voc  ${((v0 / w0) * 100).toFixed(2)}%`);
  }

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
