// Solo lectura: de donde vienen las visitas a pt-traveler-brazil-a0.
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const w = `where coalesce(path,'')||coalesce("landingUrl",'')||coalesce(referrer,'') ilike '%pt-traveler-brazil-a0%'`;
  console.log(JSON.stringify(await p.$queryRawUnsafe(`select count(distinct "ipHashed")::int ips, count(distinct "sessionId")::int sesiones, count(*)::int n from dp_page_visits_v1 ${w}`)));
  const r = await p.$queryRawUnsafe<any[]>(`select country, split_part(split_part(coalesce(referrer,''),'//',2),'/',1) ref, "deviceCategory" dev, count(*)::int n, count(distinct "ipHashed")::int ips, max("createdAt") ult
    from dp_page_visits_v1 ${w} group by 1,2,3 order by 4 desc limit 15`);
  for (const x of r) console.log(JSON.stringify(x));
}
main().finally(() => p.$disconnect());
