import { config } from "dotenv";
config({ path: ".env.local" });
import { getPlayBetaState } from "../src/lib/googlePlayBeta";
getPlayBetaState().then((s) => {
  console.log(JSON.stringify(s, null, 2));
});
