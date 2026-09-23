/**
 * Prints the level test as the app receives it (one table per language:
 * rung, station, formats, words) and fails if a rung has no full station.
 * The bank itself is linted by `scripts/checkLevelTestBank.ts`; this one
 * checks the assembly (`buildLevelTest`).
 *
 *   npx tsx scripts/checkLevelTestStations.ts
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { buildLevelTest } from "../src/lib/levelTest/buildLevelTest";

async function main() {
  let failed = false;
  for (const language of ["Spanish"]) {
    const built = await buildLevelTest(language, null);
    if (!built) throw new Error(`${language} has no level test`);
    console.log(`\n## ${language}: ladder ${built.payload.ladder.join(" > ")}`);
    console.log("| rung | station | exercises |");
    console.log("| --- | --- | --- |");
    for (const s of built.payload.stations) {
      const items = s.exercises.map((e) => {
        const ex = e as { type: string; word?: string; speechText?: string; answer?: string; pairs?: Array<{ word: string }> };
        if (ex.type === "listen_choose") return `listen:${ex.speechText}`;
        if (ex.type === "meaning_in_context") return `meaning:${ex.word}`;
        if (ex.type === "fill_blank") return `fill:${ex.answer}`;
        return `match:${(ex.pairs ?? []).map((p) => p.word).join("/")}`;
      });
      console.log(`| ${s.level} | ${s.id} | ${items.join(", ")} |`);
    }
    for (const p of built.problems) {
      console.log(`PROBLEM ${language}/${p.level}: ${p.reason}`);
      failed = true;
    }
  }
  if (failed) {
    console.log("\nlevel-test stations: PROBLEMS FOUND");
    process.exit(1);
  }
  console.log("\nlevel-test stations: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
