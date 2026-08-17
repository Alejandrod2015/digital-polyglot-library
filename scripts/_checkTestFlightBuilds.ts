// Read-only: what an invited tester actually finds in TestFlight.
// Sends nothing. npx tsx scripts/_checkTestFlightBuilds.ts
import Module from "node:module";
import { existsSync, readFileSync } from "node:fs";

const load = (Module as unknown as { _load: (r: string, ...a: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = function (request: string, ...args: unknown[]) {
  if (request === "server-only") return {};
  return load.call(this, request, ...args);
};

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    if (process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const asc = await import("../src/lib/appStoreConnect");

  console.log("configured:", asc.isAscConfigured());

  const groups = await asc.listBetaGroups();
  console.log("\nbeta groups:");
  for (const g of groups) console.log(`  ${g.id}  ${g.name}  internal=${g.internal}`);

  console.log("\nrecent builds on the app:");
  for (const b of await asc.listRecentBuilds(8)) {
    console.log(`  v${b.version.padEnd(8)} expired=${String(b.expired).padEnd(5)} processing=${b.processingState}`);
  }

  for (const g of groups.filter((x) => !x.internal)) {
    console.log(`\nbuilds the group "${g.name}" can install:`);
    const builds = await asc.listBuildsForGroup(g.id, 10);
    if (builds.length === 0) {
      console.log("  NONE. An invited tester opens TestFlight and finds an empty screen.");
      continue;
    }
    for (const b of builds) console.log(`  v${b.version.padEnd(8)} expired=${b.expired}`);
    const usable = builds.filter((b) => !b.expired);
    console.log(`  -> ${usable.length} installable, ${builds.length - usable.length} expired`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
