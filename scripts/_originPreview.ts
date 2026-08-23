// Vista previa de la pestana Origin, con los mismos datos que verá Studio.
import { PrismaClient } from "../src/generated/prisma";
import { classifyBetaSource, EXPECTED_BETA_SOURCES, betaSourceGroupLabel } from "../src/lib/betaSource";

const TEST_ROW = /betatest|postmigration|example\.com/i;
const p = new PrismaClient();

(async () => {
  const all = await p.betaSignup.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  const rows = all.filter((a) => !TEST_ROW.test(a.email));
  const acc = new Map<string, any>();
  for (const a of rows) {
    const s = classifyBetaSource(a.attribution as any);
    const r = acc.get(s.key) ?? { label: s.label, group: s.group, total: 0, testers: 0, active: 0, det: new Map() };
    r.total++;
    if (a.status === "invited" || a.status === "accepted") r.testers++;
    if (a.lastActiveAt) r.active++;
    if (s.detail) r.det.set(s.detail, (r.det.get(s.detail) ?? 0) + 1);
    acc.set(s.key, r);
  }
  for (const e of EXPECTED_BETA_SOURCES) if (!acc.has(e.key)) acc.set(e.key, { label: e.label, group: e.group, total: 0, testers: 0, active: 0, det: new Map(), hint: e.hint });
  const list = [...acc.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  console.log(`${rows.length} altas (${all.length - rows.length} filas de prueba ocultas)\n`);
  console.log("ORIGEN".padEnd(38), "CANAL".padEnd(12), "ALTAS TESTERS ACTIVOS");
  for (const r of list) {
    console.log(
      String(r.label).padEnd(38),
      betaSourceGroupLabel(r.group).padEnd(12),
      String(r.total).padStart(5),
      String(r.testers).padStart(7),
      String(r.active).padStart(7),
      r.det.size ? " · " + [...r.det].map(([d, n]) => `${d} (${n})`).join(", ") : "",
      r.hint ? ` · ${r.hint}` : "",
    );
  }
  await p.$disconnect();
})();
