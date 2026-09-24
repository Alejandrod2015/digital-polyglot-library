import { PrismaClient } from "../src/generated/prisma";
import { castOf } from "./_castExtract";
import NAMES from "./_castNames.json";
const p = new PrismaClient();
const LANG: Record<string, string> = { german: "DE", spanish: "ES", portuguese: "PT", french: "FR", italian: "IT" };
const Q = "«";
type S = { slug: string; text: string; topic: string | null };

function gates(stories: S[], cast: string[]) {
  const r: Record<string, string> = {};
  // closing-alone
  const hero = cast[0] ?? "";
  const solos = stories.filter((s) => {
    const u = s.text.trim().split(/\n{2,}/).pop() ?? "";
    if (u.includes(Q)) return false;
    return !cast.slice(1).some((n) => u.includes(n));
  });
  r["closing-alone"] = `${solos.length <= Math.ceil(stories.length / 2) ? "verde" : "ROJO"} ${solos.length}/${stories.length} hero=${hero || "?"}`;
  const nombres = cast;
  const saleEn = (n: string) => stories.filter((s) => new RegExp(`(?<!\\p{L})${n}(?!\\p{L})`, "u").test(s.text));
  const total = stories.length;
  const temasDe = (n: string) => new Set(saleEn(n).map((s) => s.topic ?? "")).size;
  const fijos = nombres.filter((n) => temasDe(n) >= 2);
  r["fixed-max-two"] = `${fijos.length <= 2 ? "verde" : "ROJO"} (${fijos.length}: ${fijos.join(",")})`;
  const enTodas = nombres.filter((n) => saleEn(n).length === total);
  if (!nombres.length) r["protagonist-in-all"] = "NO MIDE";
  else {
    const porTema = new Map<string, S[]>();
    for (const st of stories) { const t = st.topic ?? ""; porTema.set(t, [...(porTema.get(t) ?? []), st]); }
    const huer = enTodas.length >= 1 ? [] : [...porTema].filter(([, ss]) => !nombres.some((n) => ss.every((st) => st.text.includes(n))));
    r["protagonist-in-all"] = `${huer.length === 0 ? "verde" : "ROJO"} (${huer.length} temas sin hilo)`;
  }
  const temas = stories.map((s) => s.topic ?? null);
  const orden: string[] = []; for (const t of temas as string[]) if (!orden.includes(t)) orden.push(t);
  const primeraDe = new Map(orden.map((t) => [t, temas.indexOf(t)]));
  const nuevos = new Map<string, string[]>(orden.map((t) => [t, []]));
  const tarde: string[] = [];
  for (const n of nombres) {
    if (fijos.includes(n)) continue;
    const i0 = stories.findIndex((s) => new RegExp(`(?<!\\p{L})${n}(?!\\p{L})`, "u").test(s.text));
    if (i0 < 0) continue;
    const t = temas[i0] as string; nuevos.get(t)!.push(n);
    if (i0 !== primeraDe.get(t)) tarde.push(n);
  }
  const recorre = nombres.some((n) => orden.every((t) => stories.some((st) => (st.topic ?? "") === t && st.text.includes(n))));
  const tope = recorre ? 1 : 2;
  const conDeMas = orden.filter((t) => nuevos.get(t)!.length > tope);
  r["one-new-per-topic"] = `${conDeMas.length === 0 && tarde.length === 0 ? "verde" : "ROJO"} (tope ${tope}; ${conDeMas.length} temas con de mas, ${tarde.length} tarde)`;
  const enPrimera = nombres.filter((n) => new RegExp(`(?<!\\p{L})${n}(?!\\p{L})`, "u").test(stories[0].text));
  r["first-story-only-fixed"] = `${enPrimera.length <= 2 ? "verde" : "ROJO"} (${enPrimera.length})`;
  return r;
}

async function main() {
  const js = await p.journey.findMany({ where: { status: { in: ["active", "draft"] } },
    orderBy: [{ language: "asc" }, { levels: "asc" }],
    select: { id: true, name: true, language: true, variant: true, levels: true, status: true,
      stories: { orderBy: [{ topic: "asc" }, { slotIndex: "asc" }], select: { slug: true, text: true, topic: true } } } });
  const out: any[] = [];
  for (const j of js) {
    const lang = LANG[j.language]; if (!lang) continue;
    const names: string[] = (NAMES as any)[lang];
    const stories: S[] = j.stories.filter((s) => (s.text ?? "").length > 200).map((s) => ({ slug: s.slug ?? "", text: s.text ?? "", topic: s.topic }));
    if (stories.length < 3) continue;
    const det = castOf(stories.map((s) => ({ ...s, title: "", language: j.language, level: "" })) as any, lang);
    const pres = new Map<string, number>();
    for (const s of stories) for (const n of names) if (new RegExp(`(?<!\\p{L})${n}(?!\\p{L})`, "u").test(s.text)) pres.set(n, (pres.get(n) ?? 0) + 1);
    const real = [...pres].filter(([, v]) => v >= 3).sort((a, b) => b[1] - a[1]).map(([n]) => n);
    const A = gates(stories, det), B = gates(stories, real);
    const difs = Object.keys(A).filter((k) => A[k].split(" ")[0] !== B[k].split(" ")[0]);
    out.push({ id: j.id, lang, j: `${j.name} ${j.language}/${j.variant} ${j.levels.join("/")} ${j.status}`,
      n: stories.length, det, real, difs: difs.map((k) => `${k}: detectado=${A[k]} | real=${B[k]}`) });
  }
  console.log(JSON.stringify(out, null, 1));
}
main().finally(() => p.$disconnect());
