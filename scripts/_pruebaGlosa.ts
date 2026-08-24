import { getTapGlossesForSlug } from "../src/lib/tapGlosses";
for (const slug of ["a-rede-do-conves", "sombrinha-torta", "a-mina-nao-tem-ouro"]) {
  const g = getTapGlossesForSlug(slug);
  console.log(slug, g ? `${Object.keys(g).length} glosas` : "SIN PAQUETE");
}
const g = getTapGlossesForSlug("a-ladeira-do-amparo")!;
for (const w of ["roda", "corrimão", "guarda", "seca", "larga", "fita", "leve", "pé"]) console.log(` ${w}: ${g[w]?.g ?? "(falta)"}`);
