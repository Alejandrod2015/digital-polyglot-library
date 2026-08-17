// Regresión del detector de audio contra los casos confirmados POR OÍDO.
//
// Existe porque el detector perdió cobertura dos veces al arreglar falsos
// positivos: el filtro de variantes ortográficas escondió "dobra-se" y el
// umbral de 4 letras escondió el "se" insertado. Cada filtro que calla ruido
// puede callar también un acierto, y sin esta prueba no se nota hasta que el
// usuario lo oye.
//
// Se corre DESPUÉS DE CADA CAMBIO en _sttDetect.ts:
//   npx tsx scripts/_detectorRegress.ts [--x3]
import { readFileSync } from "fs";
import { spawn } from "child_process";

type Caso = { slug: string; frase: string; error: string };
const fixture = JSON.parse(readFileSync("scripts/_detectorCases.json", "utf8")) as {
  casos: Caso[]; sanas: Array<{ slug: string; frase: string; nota: string }>;
};

function run(args: string[]): Promise<string> {
  return new Promise((res) => {
    const p = spawn("npx", ["tsx", "scripts/_sttDetect.ts", ...args]);
    let out = ""; p.stdout.on("data", (c) => (out += c)); p.stderr.on("data", (c) => (out += c));
    p.on("close", () => res(out));
  });
}

(async () => {
  const pasadas = process.argv.find((a) => /^--x\d$/.test(a)) ?? "--x2";
  const slugs = [...new Set(fixture.casos.map((c) => c.slug))];
  console.log(`Comprobando ${fixture.casos.length} casos confirmados en ${slugs.length} historias (${pasadas})…\n`);
  const salida = await run([...slugs, pasadas]);

  // Una frase se considera CUBIERTA si aparece con al menos una señal ALTA.
  const bloques = salida.split(/\[ALTA\]/).slice(1);
  const frasesAltas = bloques.map((b) => (b.match(/frase: "([^"]+)"/) ?? [])[1] ?? "");

  let fallos = 0;
  for (const c of fixture.casos) {
    const cubierto = frasesAltas.some((f) => f === c.frase);
    if (!cubierto) fallos++;
    console.log(`${cubierto ? "✓" : "✗ PERDIDO"}  ${c.slug}`);
    console.log(`     ${c.error}`);
    if (!cubierto) console.log(`     frase: "${c.frase}"`);
  }

  const falsos = fixture.sanas.filter((s) => frasesAltas.some((f) => f === s.frase));
  console.log(`\n${fixture.casos.length - fallos}/${fixture.casos.length} casos confirmados detectados`);
  if (falsos.length) {
    console.log(`⚠ ${falsos.length} frase(s) sanas marcadas como ALTA:`);
    for (const f of falsos) console.log(`   ${f.slug}: ${f.nota}`);
  }
  if (fallos > 0) { console.log("\n✗ REGRESIÓN: el detector perdió casos que ya sabía encontrar."); process.exit(1); }
  console.log("✓ sin regresión");
})();
