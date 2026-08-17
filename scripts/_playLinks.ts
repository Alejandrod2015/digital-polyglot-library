import { config } from "dotenv";
config({ path: process.argv[2] });
import { playOptInUrl, playGroupJoinUrl } from "../src/lib/googlePlayBeta";
console.log("optIn :", playOptInUrl());
console.log("group :", playGroupJoinUrl());
