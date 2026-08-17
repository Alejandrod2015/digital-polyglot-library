import { config } from "dotenv";
config({ path: process.argv[2] });
import { getPlayBetaState, isPlayBetaConfigured } from "../src/lib/googlePlayBeta";
(async () => {
  console.log("isPlayBetaConfigured():", isPlayBetaConfigured());
  const s = await getPlayBetaState().catch((e) => ({ error: String(e).slice(0, 300) }));
  console.log(JSON.stringify(s, null, 1));
})();
