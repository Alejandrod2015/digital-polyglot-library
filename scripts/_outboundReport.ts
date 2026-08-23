// Lee lo que registra /api/log/outbound: cuanta gente pulsa el enlace a la
// tienda, desde que post, desde que posicion y con que reclamo.
//
//   npx tsx --require ./scripts/_serverOnlyShim.cjs scripts/_outboundReport.ts [dias]
//
// La cifra que importa es la ULTIMA columna de la primera tabla: lecturas del
// post frente a clics de salida. Es lo que separa "nadie hace clic" de "hacen
// clic y no compran", que hasta ahora no se podia distinguir porque la tienda
// vive en otro dominio y nadie veia el salto.
import { prisma } from "@/lib/prisma";

const DAYS = Number(process.argv[2] || 30);
const SINCE = new Date(Date.now() - DAYS * 864e5);

function pad(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n);
}
function rpad(s: string, n: number) {
  return s.padStart(n);
}

async function main() {
  const clicks = await prisma.outboundClick.findMany({
    where: { createdAt: { gte: SINCE } },
    select: { fromPath: true, product: true, linkIndex: true, label: true, sessionId: true },
  });

  if (!clicks.length) {
    console.log(`Sin clics de salida en los ultimos ${DAYS} dias.`);
    console.log("Si el registro lleva poco desplegado, esto es lo esperado, no un fallo.");
  }

  const reads = await prisma.pageVisit.groupBy({
    by: ["path"],
    where: { createdAt: { gte: SINCE }, path: { startsWith: "/blog/" } },
    _count: { _all: true },
  });
  const readsByPath = new Map(reads.map((r) => [r.path, r._count._all]));

  const byPath = new Map<string, { clicks: number; sessions: Set<string> }>();
  for (const c of clicks) {
    const e = byPath.get(c.fromPath) ?? { clicks: 0, sessions: new Set<string>() };
    e.clicks++;
    if (c.sessionId) e.sessions.add(c.sessionId);
    byPath.set(c.fromPath, e);
  }

  console.log(`\nVentana: ultimos ${DAYS} dias. ${clicks.length} clics de salida.\n`);
  console.log(pad("Pagina", 56) + rpad("Lecturas", 10) + rpad("Clics", 8) + rpad("Sesiones", 10) + rpad("Ratio", 9));
  console.log("-".repeat(93));
  const rows = [...byPath.entries()].sort((a, b) => b[1].clicks - a[1].clicks);
  for (const [path, e] of rows) {
    const r = readsByPath.get(path) ?? 0;
    const ratio = r ? ((100 * e.sessions.size) / r).toFixed(2) + "%" : "s/d";
    console.log(pad(path, 56) + rpad(String(r), 10) + rpad(String(e.clicks), 8) + rpad(String(e.sessions.size), 10) + rpad(ratio, 9));
  }

  // Posicion del enlace. 0 suele ser el "Shop" de la barra de navegacion; los
  // siguientes son los del cuerpo del articulo, en orden de aparicion.
  const byIndex = new Map<number, number>();
  for (const c of clicks) if (c.linkIndex !== null) byIndex.set(c.linkIndex, (byIndex.get(c.linkIndex) ?? 0) + 1);
  if (byIndex.size) {
    console.log("\nPor posicion del enlace en la pagina (0 = barra de navegacion)");
    for (const [i, n] of [...byIndex.entries()].sort((a, b) => a[0] - b[0])) {
      console.log(`  ${rpad(String(i), 3)}  ${n}`);
    }
  }

  const byProduct = new Map<string, number>();
  for (const c of clicks) if (c.product) byProduct.set(c.product, (byProduct.get(c.product) ?? 0) + 1);
  if (byProduct.size) {
    console.log("\nPor producto");
    for (const [p, n] of [...byProduct.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${pad(p, 50)} ${n}`);
    }
  }

  const byLabel = new Map<string, number>();
  for (const c of clicks) if (c.label) byLabel.set(c.label, (byLabel.get(c.label) ?? 0) + 1);
  if (byLabel.size) {
    console.log("\nPor texto del enlace");
    for (const [l, n] of [...byLabel.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
      console.log(`  ${pad(l, 50)} ${n}`);
    }
  }

  const totalReads = reads.reduce((a, r) => a + r._count._all, 0);
  const clickSessions = new Set(clicks.map((c) => c.sessionId).filter(Boolean)).size;
  console.log(`\nTotal: ${totalReads} lecturas de blog, ${clickSessions} sesiones con clic a la tienda.`);
  console.log("Para el otro lado del embudo (si esos clics compran), cruza `utmCampaign`");
  console.log("con el landing_site de los pedidos: scripts/_blogSalesReport.mjs\n");
}

main().finally(() => process.exit(0));
