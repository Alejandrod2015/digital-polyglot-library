// Reenvia la invitacion de TestFlight de UNA persona, por su ascTesterId.
// Preview por defecto; envia solo con --send.
import Module from "node:module";
import { existsSync, readFileSync } from "node:fs";
const load = (Module as unknown as { _load: (r: string, ...a: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = function (request: string, ...args: unknown[]) {
  if (request === "server-only") return {};
  return load.call(this, request, ...args);
};
for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const l of readFileSync(f, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
const email = process.argv[2];
const send = process.argv.includes("--send");
(async () => {
  const { PrismaClient } = await import("../src/generated/prisma");
  const { getTesterState, sendTesterInvitation } = await import("../src/lib/appStoreConnect");
  const prisma = new PrismaClient();
  const s = await prisma.betaSignup.findFirst({ where: { email } });
  if (!s?.ascTesterId) { console.log("sin ascTesterId"); await prisma.$disconnect(); return; }
  const antes = await getTesterState(s.ascTesterId);
  console.log(`${s.email}  appleId=${s.appleIdEmail}  estado=${antes}`);
  if (!send) { console.log("\n(preview, nada enviado. add --send)"); await prisma.$disconnect(); return; }
  const r = await sendTesterInvitation(s.ascTesterId);
  console.log(`reenvio: ${r.ok ? "ok" : `FALLO: ${r.error}`}`);
  await prisma.$disconnect();
})();
