// Los que tocan practica, duran mas? (span = dias entre 1a y ultima senal)
import { PrismaClient } from "../src/generated/prisma";
import { SERVER_WRITTEN_METRIC_EVENTS } from "../src/lib/metricsRetention";
const prisma = new PrismaClient();
const DAY = 86400000;
const di = (d: Date) => Math.floor(d.getTime() / DAY);
async function main() {
  const internal = (process.env.METRICS_EXCLUDE_USER_IDS ?? "").split(",").map(s=>s.trim()).filter(Boolean);
  const rows = await prisma.userMetric.findMany({
    where: { eventType: { notIn: SERVER_WRITTEN_METRIC_EVENTS }, userId: { notIn: internal.length ? internal : ["__none__"] } },
    select: { userId: true, createdAt: true, eventType: true },
    orderBy: { createdAt: "asc" }, take: 200000,
  });
  const byUser = new Map<string, {d:number,t:string}[]>();
  for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), {d:di(r.createdAt), t:r.eventType}]);
  const nowDay = di(new Date());
  const g: Record<string, {n:number, dias:number[], span:number[], d7:number, elig7:number}> = {
    practica: {n:0,dias:[],span:[],d7:0,elig7:0}, sin: {n:0,dias:[],span:[],d7:0,elig7:0},
  };
  for (const [,evs] of byUser) {
    const first = evs[0].d;
    if (nowDay - first > 40) continue;
    const k = evs.some(e => e.t.startsWith("practice_")) ? "practica" : "sin";
    const days = [...new Set(evs.map(e=>e.d))];
    g[k].n++; g[k].dias.push(days.length); g[k].span.push(Math.max(...days)-first);
    if (nowDay - first >= 7) { g[k].elig7++; if (days.some(d => d-first >= 7)) g[k].d7++; }
  }
  const med = (a:number[]) => { const s=[...a].sort((x,y)=>x-y); return s.length? s[Math.floor(s.length/2)] : 0; };
  for (const [k,v] of Object.entries(g))
    console.log(`${k.padEnd(9)} n=${v.n}  dias activos med=${med(v.dias)} max=${Math.max(...v.dias)}  span med=${med(v.span)}d max=${Math.max(...v.span)}d  vivos d7+: ${v.d7}/${v.elig7}`);
}
main().finally(() => prisma.$disconnect());
