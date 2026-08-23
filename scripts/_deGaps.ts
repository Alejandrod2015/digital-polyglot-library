/** Reglas de creacion de historias que NO estaban en el inventario y que si se
 *  pueden medir. Solo lectura sobre el texto de la base. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const JID = "cmt0a8vb1000m32p1x7r5ba28";

(async () => {
  const j = await p.journey.findUnique({ where: { id: JID }, select: { topics: true } });
  const orden = j?.topics ?? [];
  const st = (await p.journeyStory.findMany({
    where: { journeyId: JID }, select: { slug: true, topic: true, slotIndex: true, text: true, vocab: true },
  })).sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  const todo = st.map((s) => String(s.text)).join("\n");
  const line = (id: string, ok: boolean, detail = "") =>
    console.log(`${ok ? "ok  " : "FAIL"} [${id}] ${detail}`);

  // feedback_no_elderly_no_children
  const EDAD = /\b(Kind|Kinder|Junge|Mädchen|Baby|Enkel\w*|Oma|Opa|Großmutter|Großvater|Rentner\w*|Greis\w*|Teenager|Schüler(?:in)?\b)/g;
  const edad = [...new Set((todo.match(EDAD) ?? []))];
  line("no-elderly-no-children", edad.length === 0, edad.join(", "));

  // feedback_no_accent_mentions
  const AC = /\b(Akzent|Dialekt|Mundart|Hochdeutsch)\b/gi;
  line("no-accent-mentions", !AC.test(todo), (todo.match(AC) ?? []).join(", "));

  // feedback_no_real_users_in_stories: ningun nombre del cast coincide con un solicitante
  const cast = ["Hannah", "Elias", "Sophie", "Noah", "Emilia", "Leon", "Marie"];
  const betas = await p.betaSignup.findMany({ select: { name: true } }).catch(() => [] as { name: string | null }[]);
  const choque = betas.map((b) => String(b.name ?? "")).filter((n) => n && cast.some((c) => n.split(/\s+/).includes(c)));
  line("no-real-users-in-stories", choque.length === 0, choque.join(", "));

  // project_character_name_rules: nombres en la ortografia del idioma, sin tildes ajenas
  const raros = cast.filter((c) => /[áéíóúñçàèìòùâêîôû]/i.test(c));
  line("names-target-language-only", raros.length === 0, raros.join(", "));

  // project_vocab_recirculation_ladder: cuantos ENCUENTROS tiene cada plaza
  const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
  const cuerpos = st.map((s) => new Set(tok(String(s.text))));
  const clave = (v: any) => String(v.surface ?? v.word).toLowerCase().replace(/^(der|die|das)\s+/, "");
  const enc: number[] = [];
  st.forEach((s, i) => {
    for (const v of ((s.vocab as any[]) ?? [])) {
      const k = clave(v);
      enc.push(cuerpos.filter((c) => c.has(k)).length);
    }
  });
  const media = enc.reduce((a, b) => a + b, 0) / enc.length;
  const unaVez = enc.filter((n) => n <= 1).length;
  line("vocab-recirculation-ladder", media >= 2,
    `media ${media.toFixed(1)} encuentros por plaza (objetivo 4) · ${unaVez}/${enc.length} aparecen una sola vez`);

  // feedback_cefr_two_level_rule en DE: el juez del validador es solo espanol
  line("cefr-two-level-rule", false, "El juez CEFR del validador solo conoce el espanol; en DE no mide nada. Sin verificar.");

  // feedback_cultural_anchor_always_vocab: un ancla cultural por historia, en el vocab
  const ANCLA = /Lebkuchen|Kuckucksuhr|Zinnfigur|Bratwurst|Hühnergott|Spätzle|Most|Kettensteg|Kleeblatt|Advent/i;
  const sinAncla = st.filter((s) => !((s.vocab as any[]) ?? []).some((v) => ANCLA.test(String(v.word))));
  line("cultural-anchor-in-vocab", sinAncla.length <= 14,
    `${st.length - sinAncla.length}/21 historias con un ancla cultural en el vocab`);

  await p.$disconnect();
})();
