import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async()=>{ try { const n = await p.journeyStory.count(); console.log("DB OK, journeyStory count =", n); } catch(e:any){ console.log("DB ERROR:", e.message?.slice(0,200)); } finally { await p.$disconnect(); } })();
