/** ¿Las 28 glosas que el detector llama huérfanas salen de verdad en SU historia?
 *  El detector parte por palabras, así que una expresión de varias
 *  ("em voz alta") le sale huérfana aunque esté escrita tal cual. Antes de
 *  borrar nada, esto busca la cadena literal en el texto al que va pegada. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";

const p = new PrismaClient();
const CASOS: Array<[string, string[]]> = [
  ["a-caucao-volta-dia-trinta", ["corta", "de passagem", "em voz alta", "na frente do", "levantar a voz"]],
  ["chuva-na-marginal", ["guarda", "foi mal"]],
  ["tchau-no-engarrafamento", ["a pé", "banco de trás"]],
  ["garoa-no-corredor", ["tubo", "então", "no meio de", "todo mundo"]],
  ["galeto-antes-do-preco", ["começa", "com as mãos na massa"]],
  ["a-caixa-para-a-estrada", ["por cima", "queijo colonial"]],
  ["dinheiro-na-mao-errada", ["faz", "some", "cidade"]],
  ["o-telefone-sublinhado", ["capa dura"]],
  ["a-cota-do-dia", ["não", "frase", "lugar", "estava", "folheto"]],
  ["senha-b-quarenta-e-dois", ["teclea"]],
  ["deferido-no-diario", ["trâmite"]],
];

(async () => {
  for (const [slug, palabras] of CASOS) {
    const h = await p.journeyStory.findFirst({ where: { slug }, select: { title: true, text: true } });
    const texto = `${h?.title ?? ""}. ${h?.text ?? ""}`.toLowerCase();
    for (const w of palabras) {
      // Una sola palabra se busca con frontera: "guarda" dentro de
      // "guarda-chuva" no cuenta, y es justo el caso que engaña al substring.
      const l = w.toLowerCase();
      const sale = l.includes(" ")
        ? texto.includes(l)
        : new RegExp(`(?<!\\p{L})${l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\p{L})`, "u").test(texto);
      console.log(`${sale ? "SALE " : "MUERTA"}  ${slug} · ${w}`);
    }
  }
  await p.$disconnect();
})();
