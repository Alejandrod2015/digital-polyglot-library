/** QA del set de práctica del A1 latam: qué ejercicios caen fuera del vocab y
 *  si los distractores de fill_blank regalan la respuesta por la forma. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const A1 = "cmt5vxwgd0007324oesy195k8";
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: A1 },
    select: { slug: true, vocab: true, practiceSet: { select: { exercises: {
      select: { type: true, word: true, sentence: true, payload: true }, orderBy: { orderIndex: "asc" } } } } } });
  const fuera: string[] = []; const regalan: string[] = []; let fb = 0;
  const tipos = new Map<string, number>();
  for (const s of st) {
    const voc = new Set(((s.vocab as Array<Record<string, unknown>>) ?? []).map((v) => norm(String(v.word ?? ""))));
    for (const e of s.practiceSet?.exercises ?? []) {
      tipos.set(e.type, (tipos.get(e.type) ?? 0) + 1);
      if (!voc.has(norm(e.word))) fuera.push(`${e.word} (${s.slug})`);
      const pay = e.payload as { options?: string[]; answer?: string } | null;
      if (e.type === "fill_blank" && pay?.options && pay.answer) {
        fb++;
        const fin = (w: string) => norm(w).slice(-2);
        const iguales = pay.options.filter((o) => fin(o) === fin(pay.answer!));
        // Si SOLO la respuesta acaba asi, la forma la delata sin leer la frase.
        if (iguales.length === 1) regalan.push(`${pay.answer} <- ${pay.options.join(" / ")}`);
      }
    }
  }
  console.log("tipos:", [...tipos].map(([k, v]) => `${k}=${v}`).join(" · "));
  console.log(`\nfuera del vocab: ${fuera.length} · ejemplos: ${fuera.slice(0, 12).join(", ")}`);
  console.log(`\nfill_blank: ${fb} · con la respuesta delatada por la terminacion: ${regalan.length}`);
  regalan.slice(0, 8).forEach((r) => console.log("   " + r));
  await p.$disconnect();
})();
