import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { preflightF0Gate } from "./_f0gateClient";
preflightF0Gate().then(()=>console.log("F0 gate OK")).catch(e=>{console.log("F0 gate FALLA:", e.message); process.exit(1);});
