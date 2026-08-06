import { canAccessTalkingPoints } from "@/lib/talkingPoints";
type Case = { plan: any; env: string; key: string | undefined; expect: boolean; why: string };
const cases: Case[] = [
  { plan: "polyglot", env: "production",  key: "pk_live_x", expect: true,  why: "polyglot en prod           " },
  { plan: "owner",    env: "production",  key: "pk_live_x", expect: true,  why: "owner en prod              " },
  { plan: "free",     env: "production",  key: "pk_live_x", expect: false, why: "free en prod               " },
  { plan: "basic",    env: "production",  key: "pk_live_x", expect: false, why: "basic en prod              " },
  { plan: "premium",  env: "production",  key: "pk_live_x", expect: false, why: "premium en prod            " },
  { plan: undefined,  env: "production",  key: "pk_live_x", expect: false, why: "sin plan en prod           " },
  { plan: "free",     env: "development", key: "pk_test_x", expect: false, why: "dev CON clave (puerta off) " },
  { plan: "free",     env: "development", key: undefined,   expect: true,  why: "dev SIN clave (puerta on)  " },
  { plan: "free",     env: "production",  key: undefined,   expect: false, why: "prod sin clave             " },
];
let bad = 0;
for (const c of cases) {
  (process.env as Record<string, string>).NODE_ENV = c.env;
  if (c.key === undefined) delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  else process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = c.key;
  const got = canAccessTalkingPoints(c.plan);
  const ok = got === c.expect;
  if (!ok) bad++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.why}  -> ${got}`);
}
console.log(bad === 0 ? "\nTODOS OK (9/9)" : `\n${bad} FALLOS`);
process.exit(bad === 0 ? 0 : 1);
