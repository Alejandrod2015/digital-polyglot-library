import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
(async () => {
  const asc = await import("../src/lib/appStoreConnect");
  const b = await asc.listBuildsForGroup("1db0e67c-bf4d-4333-ac2a-705ffa67b1ee", 8 as any).catch((e:any)=>({err:e.message}));
  console.log('builds del grupo EXTERNO "Beta testers":', JSON.stringify(b));
})();
