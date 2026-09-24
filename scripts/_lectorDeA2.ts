/** Comprueba que la pagina del lector de una historia REALMENTE la pinta.
 *
 *  WHY: /stories/<slug> responde 200 para cualquier slug, exista o no; el
 *  cuerpo trae una pagina vacia. Un `curl -o /dev/null -w %{http_code}` da 200
 *  para un enlace muerto, asi que no prueba nada. Esto busca en el HTML una
 *  frase literal del texto de la historia.
 *
 *  Uso: npx tsx scripts/_lectorDeA2.ts [--base http://localhost:3012] [slug ...]
 *  Sin slugs, todas las del journey que tengan texto. */
import "./_loadEnv";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const J = "cmubidgaf0007j8np6g7n89iu";
const arg = (f: string, d: string) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };
(async () => {
  const base = arg("--base", "http://localhost:3012");
  const slugs = process.argv.slice(2).filter((a, n, all) => !a.startsWith("--") && all[n - 1] !== "--base");
  const ss = await p.journeyStory.findMany({
    where: { journeyId: J, ...(slugs.length ? { slug: { in: slugs } } : {}) },
    select: { slug: true, text: true, audioUrl: true },
  });
  let malas = 0;
  let caidas = 0;
  for (const s of ss) {
    // una frase del medio del texto, poco probable en cualquier otra pagina
    const frase = (s.text ?? "").split(/[.!?]\s+/).map((x) => x.trim()).filter((x) => x.length > 40)[1] ?? "";
    let html: string | null = null;
    try { html = await fetch(`${base}/stories/${s.slug}`).then((r) => r.text()); } catch { html = null; }
    // Un fetch que ni siquiera conecta es el servidor caido, no una pagina
    // rota. Distinguirlo importa: el 2026-09-23 el dev server se habia parado
    // y el informe daba FALLA en historias que estaban perfectas.
    if (html === null) { caidas++; console.log(`SIN SERVIDOR ${s.slug}`); continue; }
    const ok = frase.length > 0 && html.includes(frase.slice(0, 40));
    if (!ok) malas++;
    console.log(`${ok ? "OK  " : "FALLA"} ${s.slug}${s.audioUrl ? " (narrada)" : ""}`);
  }
  if (caidas) {
    console.log(`\nel servidor de ${base} no responde: ${caidas} sin comprobar. Arrancalo y repite.`);
    await p.$disconnect();
    process.exit(2);
  }
  console.log(`\n${ss.length - malas}/${ss.length} paginas del lector pintan su historia`);
  await p.$disconnect();
  if (malas) process.exit(1);
})();
