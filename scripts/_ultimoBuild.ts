import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
(async () => {
  const { listRecentBuilds } = await import("../src/lib/appStoreConnect");
  const bs = await listRecentBuilds(8);
  for (const b of bs) console.log(JSON.stringify(b));
})();
