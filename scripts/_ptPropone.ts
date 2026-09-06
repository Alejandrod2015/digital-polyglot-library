/** SOLO LECTURA. Propone 20 plazas por historia: solo palabras LIBRES (que no
 *  ensena ningun journey de portugues ni otra historia del lote), repartidas
 *  por parrafo sin pasar del 30%, y marcando cuales caen fuera del universo B1
 *  para que se anadan a la lista o se descarten. */
import * as fs from "fs";
import { isPortugueseA1A2 } from "../src/lib/cefr/portugueseA1A2";
import { isPortugueseB1Lemma } from "../src/lib/cefr/portugueseB1";
const ens = new Set<string>(JSON.parse(fs.readFileSync(process.env.E!, "utf8")));
const d = JSON.parse(fs.readFileSync(process.env.F!, "utf8"));
const STOP = new Set("a o as os um uma uns umas de do da dos das em no na nos nas por para com sem que se e ou mas ja nao sim ao aos pelo pela sao foi era ele ela eles elas eu voce nos me te lhe seu sua meu minha dele dela isso isto aqui ali la quando onde como quem qual mais menos muito pouco tudo todo toda todos todas cada outro outra tambem so ate depois antes entao porque ainda assim agora nada quanto mesmo bem entre duas dois tres seis sete oito nove dez vinte trinta quarenta quinze cinco quatro".split(" "));
const usadas = new Set<string>();
for (const s of d) {
  const parr = String(s.text).split("\n\n");
  const elegidas: Array<{ w: string; p: number; nivel: boolean }> = [];
  const porParr = parr.map(() => 0);
  const cap = 6;
  for (let ronda = 0; ronda < 6; ronda++) {
    parr.forEach((t: string, i: number) => {
      if (porParr[i] > cap - 1 || elegidas.length >= 20) return;
      const ws = [...new Set((t.toLowerCase().match(/[a-zà-ÿ][a-zà-ÿ-]+/g) ?? []))]
        .filter((w) => w.length > 3 && !STOP.has(w) && !ens.has(w) && !usadas.has(w));
      ws.sort((a, b) => b.length - a.length);
      const w = ws[ronda];
      if (!w) return;
      usadas.add(w);
      elegidas.push({ w, p: i + 1, nivel: isPortugueseA1A2(w) || isPortugueseB1Lemma(w) });
      porParr[i]++;
    });
  }
  console.log(`\n== ${s.slug} (${elegidas.length} propuestas, por parrafo ${porParr.join(",")})`);
  console.log("  en nivel: " + elegidas.filter((e) => e.nivel).map((e) => `${e.w}[${e.p}]`).join(" "));
  console.log("  fuera:    " + elegidas.filter((e) => !e.nivel).map((e) => `${e.w}[${e.p}]`).join(" "));
}
