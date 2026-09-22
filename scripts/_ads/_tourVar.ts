/**
 * Monta los anuncios de tour de variantes: renderiza sus piezas y las pega con
 * corte seco en un solo mp4.
 *
 *   npx tsx scripts/_ads/_tourVar.ts --ad 67 [--ratio 45]
 *   npx tsx scripts/_ads/_tourVar.ts --ad 68
 *
 * No sintetiza nada: cada pieza usa el audio ya narrado de su historia.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? def : process.argv[i + 1];
}

const AD = arg("ad", "67");
const RATIO = arg("ratio", "45");
const TAG = RATIO === "916" ? "9x16" : "4x5";

/** Piezas de cada tour, en orden, y el nombre del montaje. */
const TOURS: Record<string, { slug: string; parts: Array<[string, string]> }> = {
  "67": {
    slug: "67-variantes-es",
    parts: [["671", "var-mx"], ["672", "var-ar"], ["673", "var-co"], ["674", "var-es"], ["675", "var-catalogo"]],
  },
  "68": {
    slug: "68-variantes-es-2",
    parts: [["681", "var2-co"], ["682", "var2-mx"], ["683", "var2-ar"], ["684", "var2-es"], ["685", "var2-catalogo"]],
  },
  "69": {
    slug: "69-variantes-es-3",
    parts: [["691", "var3-es"], ["692", "var3-co"], ["693", "var3-mx"], ["694", "var3-ar"], ["695", "var3-catalogo"]],
  },
  "70": {
    slug: "70-variantes-es-4",
    parts: [["701", "var4-pe"], ["702", "var4-co"], ["703", "var4-ar"], ["704", "var4-es"], ["705", "var4-catalogo"]],
  },
  "71": {
    slug: "71-variantes-es-5",
    parts: [["711", "var5-co"], ["712", "var5-pe"], ["713", "var5-ar"], ["714", "var5-catalogo"]],
  },
};

const tour = TOURS[AD];
if (!tour) throw new Error(`no hay tour ${AD}; hay ${Object.keys(TOURS).join(", ")}`);
const OUT = `qa/ads/${tour.slug}-${TAG}.mp4`;

for (const [scene] of tour.parts) {
  execFileSync("npx", ["tsx", "scripts/_ads/renderAds.ts", "--scene", scene, "--ratio", RATIO], { stdio: "inherit" });
}

const list = `/tmp/claude-501/dpl-ads/tour-${AD}.txt`;
writeFileSync(list, tour.parts.map(([n, slug]) => `file '${process.cwd()}/qa/ads/${n}-${slug}-${TAG}.mp4'`).join("\n"));
// Re-codifica en vez de copiar: los trozos vienen del mismo pipeline, pero
// pegar por copia deja saltos de timestamp en el audio de algunos reproductores.
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list,
  "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", OUT], { stdio: "inherit" });

// Primer fotograma como miniatura, igual que renderAds.
execFileSync("bash", ["-c", `ffmpeg -y -loglevel error -i ${OUT} -frames:v 1 qa/ads/${tour.slug}-${TAG}.jpg`]);
// Las piezas sueltas no son anuncios: se borran para que no ocupen casilla en
// el mural ni se suban por error.
for (const [n, slug] of tour.parts) {
  execFileSync("bash", ["-c", `rm -f qa/ads/${n}-${slug}-${TAG}.mp4 qa/ads/${n}-${slug}-${TAG}.jpg`]);
}

const dur = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", OUT]).toString().trim();
console.log(`${OUT}  ${Number(dur).toFixed(2)}s`);
