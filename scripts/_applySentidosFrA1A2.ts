import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";

const prisma = new PrismaClient();
const SCR = "/private/tmp/claude-501/-Users-alejandrodelcarpio-digital-polyglot-library/812c0bfa-b136-4a48-bec8-e56a77065401/scratchpad";

async function main() {
  const corrections = JSON.parse(fs.readFileSync(`${SCR}/corrections.json`, "utf8"));
  let writes = 0;
  let skippedNoc = 0;
  let skippedSame = 0;
  const writeLog: string[] = [];

  for (const bundle of Object.keys(corrections)) {
    for (const slug of Object.keys(corrections[bundle])) {
      const entries = corrections[bundle][slug];
      // figure out which keys actually need writing
      const toWrite: Record<string, { g: string; t: string }> = {};
      for (const [key, v] of Object.entries(entries) as [string, any][]) {
        if (v.new_g === "NOC" || v.new_g === "UNHANDLED") {
          skippedNoc++;
          continue;
        }
        if (v.old_g === v.new_g && v.old_t === v.new_t) {
          skippedSame++;
          continue;
        }
        toWrite[key] = { g: v.new_g, t: v.new_t };
      }
      if (Object.keys(toWrite).length === 0) continue;

      const row = await prisma.tapGlossSet.findUnique({
        where: { bundle_slug: { bundle, slug } },
      });
      if (!row) {
        writeLog.push(`MISSING ROW: ${bundle}/${slug}`);
        continue;
      }
      const glosses = row.glosses as Record<string, any>;
      for (const [key, upd] of Object.entries(toWrite)) {
        if (!glosses[key]) {
          writeLog.push(`WARN key not found in current row (skipped): ${bundle}/${slug}/${key}`);
          continue;
        }
        glosses[key] = { ...glosses[key], g: upd.g, t: upd.t };
      }
      // validate JSON round-trips
      JSON.parse(JSON.stringify(glosses));
      await prisma.tapGlossSet.update({
        where: { bundle_slug: { bundle, slug } },
        data: { glosses },
      });
      writes++;
      writeLog.push(`OK ${bundle}/${slug}: ${Object.keys(toWrite).join(", ")}`);
    }
  }

  console.log("writes (rows updated):", writes);
  console.log("skipped NOC/UNHANDLED entries:", skippedNoc);
  console.log("skipped already-correct entries:", skippedSame);
  fs.writeFileSync(`${SCR}/write_log.txt`, writeLog.join("\n"));
}

main().finally(() => prisma.$disconnect());
