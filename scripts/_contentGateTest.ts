/**
 * Casos del gate de contenido, con los fallos REALES del A0 portugués.
 *
 * No sintetiza nada: alimenta a `contentDivergence` con lo que el reconocedor
 * devolvió de verdad el 2026-08-17 y comprueba que el gate habría re-tirado
 * esas tomas y NO las buenas.
 *
 *   npx tsx scripts/_contentGateTest.ts
 */

// Copia local de la comparación del gate (src/lib/elevenlabs.ts). Se duplica a
// propósito: importar el módulo arrastra `server-only` y el cliente de Prisma,
// que no arrancan bajo tsx. Si una cambia, esta prueba deja de valer, así que
// cualquier ajuste al gate se copia aquí y se vuelve a correr.
const canon = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim().toLowerCase();

function aUnaLetra(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, dif = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++dif > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return dif + (a.length - i) + (b.length - j) <= 1;
}

function contentDivergence(expected: string, heard: string): string | null {
  const e = canon(expected).split(" ").filter(Boolean);
  const h = canon(heard).split(" ").filter(Boolean);
  if (!e.length || !h.length) return null;
  const conjunto = new Set(e);
  const inventadas = h.filter((w) =>
    !conjunto.has(w) && !/\d/.test(w) && w.length >= 3 && !e.some((t) => aUnaLetra(w, t)));
  if (!inventadas.length) return null;
  return `se oye ${inventadas.slice(0, 4).map((w) => `"${w}"`).join(", ")}`;
}

type Caso = { nota: string; texto: string; oido: string; debeDetectar: boolean };

const CASOS: Caso[] = [
  // ── Tomas MALAS: el gate tiene que re-tirarlas.
  { nota: "dobra a vera esquina", debeDetectar: true,
    texto: "O bar ainda está cheio e a fila da porta dobra a esquina.",
    oido: "O bar ainda está cheio e a fila da porta dobra a vera esquina." },
  { nota: "dobra near a esquina", debeDetectar: true,
    texto: "O bar ainda está cheio e a fila da porta dobra a esquina.",
    oido: "O bar ainda está cheio e a fila da porta dobra near a esquina." },
  { nota: "para sombrar a calçada", debeDetectar: true,
    texto: "Cada porta solta uma música diferente para a calçada.",
    oido: "Cada porta solta uma música diferente para sombrar a calçada." },
  { nota: "pra russir da calçada", debeDetectar: true,
    texto: "Cada porta solta uma música diferente para a calçada.",
    oido: "Cada porta solta uma música diferente pra russir da calçada." },
  { nota: "olha essa xícara", debeDetectar: true,
    texto: "Nara fica mais um pouco na mesa. Ela olha a xícara vazia e sorri sozinha.",
    oido: "Nara fica mais um pouco na mesa. Ela olha essa xícara vazia e sorri sozinha." },
  { nota: "Tim Sakuraitchamente", debeDetectar: true,
    texto: "Ele paga a conta e sai para o ar frio da rua.",
    oido: "Ele paga a Tim Sakuraitchamente e sai para o ar frio da rua." },
  { nota: "desencher", debeDetectar: true,
    texto: "Tiago passa no quiosque, senta ao lado e ajuda a encher o balde.",
    oido: "Tiago passa no quiosque, senta ao lado e ajuda a desencher o balde." },
  { nota: "Osirzoneu", debeDetectar: true,
    texto: "A padaria abre às seis e meia, e a rua ainda está escura. O rádio toca baixo atrás do balcão.",
    oido: "A padaria abre às 6h30 e a rua ainda está escura. Osirzoneu toca baixo atrás do balcão." },

  // ── Tomas BUENAS: el gate no puede tocarlas.
  { nota: "toma correcta", debeDetectar: false,
    texto: "Cada porta solta uma música diferente na calçada.",
    oido: "Cada porta solta uma música diferente na calçada." },
  { nota: "cifra normalizada por el STT", debeDetectar: false,
    texto: "A padaria abre às seis e meia, e a rua ainda está escura.",
    oido: "A padaria abre às 6h30 e a rua ainda está escura." },
  { nota: "nombre propio reescrito (Victor por Vitor)", debeDetectar: false,
    texto: "Vitor reconhece as seis palavras e canta junto sem parar de andar.",
    oido: "Victor reconhece as seis palavras e canta junto sem parar de andar." },
  { nota: "Thiago por Tiago", debeDetectar: false,
    texto: "Tiago atravessa a areia com passos rápidos até chegar lá.",
    oido: "Thiago atravessa a areia com passos rápidos até chegar lá." },
  { nota: "puntuación y tildes distintas", debeDetectar: false,
    texto: "Ele joga a casca no chão, entre os pés dela.",
    oido: "Ele joga a casca no chao entre os pes dela" },
];

let fallos = 0;
for (const c of CASOS) {
  const div = contentDivergence(c.texto, c.oido);
  const ok = c.debeDetectar ? div !== null : div === null;
  if (!ok) fallos++;
  const marca = ok ? "ok   " : "FALLO";
  const detalle = div ?? "sin divergencia";
  console.log(`${marca} ${c.debeDetectar ? "re-tira" : "acepta "}  ${c.nota.padEnd(34)} ${ok ? "" : `-> ${detalle}`}`);
}
console.log(`\n${CASOS.length - fallos}/${CASOS.length} casos correctos`);
if (fallos) { console.log("✗ el gate de contenido no se comporta como debe."); process.exit(1); }
console.log("✓ el gate re-tira los ocho fallos reales y respeta las cinco tomas buenas");
