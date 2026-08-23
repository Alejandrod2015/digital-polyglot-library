// Casos de borde del calculo de retencion, con `now` inyectado.
import { buildRetention } from "../src/lib/metricsRetention";
const D = 864e5;
const day = (iso: string) => new Date(iso + "T12:00:00Z");

// Cohorte de una sola persona que se dio de alta el lunes 2026-06-01.
const s = [{ userId: "u1", createdAt: day("2026-06-01") }];

function cell(nowIso: string, n: number) {
  const r = buildRetention({ signups: s, activity: [], now: day(nowIso), weeks: n + 1 });
  return r.cohorts[0].weeks[n];
}
// Semana 0 = offsets 0..6. El ultimo posible de la cohorte se dio de alta el
// domingo 06-07, asi que la semana 0 cierra el 06-14.
console.log("W0 el 06-13 (abierta):", cell("2026-06-13", 0).partial === true ? "OK" : "FALLA");
console.log("W0 el 06-14 (cerrada):", cell("2026-06-14", 0).partial === false ? "OK" : "FALLA");
console.log("W1 el 06-20 (abierta):", cell("2026-06-20", 1).partial === true ? "OK" : "FALLA");
console.log("W1 el 06-21 (cerrada):", cell("2026-06-21", 1).partial === false ? "OK" : "FALLA");

// Un evento el dia 9 cae en la semana 1, no en la 0 ni en la 2.
const act = [{ userId: "u1", createdAt: new Date(day("2026-06-01").getTime() + 9 * D) }];
const r = buildRetention({ signups: s, activity: act, now: day("2026-08-01"), weeks: 4 });
const w = r.cohorts[0].weeks.map((x) => x.retained);
console.log("evento en dia 9 -> [0,1,0,0]:", JSON.stringify(w) === "[0,1,0,0]" ? "OK" : "FALLA " + JSON.stringify(w));

// Hitos sin techo: activo el dia 9 cuenta para D1 y D7, no para D30.
const m = Object.fromEntries(r.overall.milestones.map((x) => [x.day, `${x.retained}/${x.eligible}`]));
console.log("hitos D7/D30 -> 1/1, 0/1:", JSON.stringify(m) === '{"7":"1/1","30":"0/1"}' ? "OK" : "FALLA " + JSON.stringify(m));

// Elegibilidad: a los 3 dias del alta, D7 y D30 no son medibles todavia.
const early = buildRetention({ signups: s, activity: [], now: day("2026-06-04"), weeks: 2 });
const em = early.overall.milestones.map((x) => `${x.day}:${x.eligible}:${x.pct}`);
console.log("a 3 dias -> D7 y D30 sin elegibles:", JSON.stringify(em) === '["7:0:null","30:0:null"]' ? "OK" : "FALLA " + JSON.stringify(em));

// Un evento ANTERIOR al alta no regala retencion.
const before = buildRetention({
  signups: s,
  activity: [{ userId: "u1", createdAt: day("2026-05-20") }],
  now: day("2026-08-01"),
  weeks: 2,
});
console.log("evento previo al alta ignorado:", before.overall.returned === 0 ? "OK" : "FALLA");
