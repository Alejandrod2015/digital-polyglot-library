/**
 * Contact sheet de las portadas del A1 ES/Spain, en ORDEN DE LECTURA.
 *
 * WHY: la coherencia de estilo entre portadas es lo único que no mide ningún
 * gate y lo único que el lector ve de golpe, porque las portadas aparecen en
 * fila en la pantalla del journey. Mirarlas de una en una, según salen, no
 * enseña nada: el 2026-08-17 las tres del tema 1 salieron en color plano y las
 * del tema 2 con más línea y paleta apagada, y solo se nota al ponerlas juntas.
 *
 *   npx tsx scripts/_a1CoverGallery.ts [salida.png]
 *
 * No gasta tiradas: descarga lo que ya está en R2 y lo pega en una hoja.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { execFile } from "child_process";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { promisify } from "util";
import { PrismaClient } from "../src/generated/prisma";

const exec = promisify(execFile);
const prisma = new PrismaClient();
const J = "cmsvz6mz9000732gsgsfer0ko";

void (async () => {
  const salida = process.argv[2] ?? "a1-covers.png";
  const journey = await prisma.journey.findUnique({ where: { id: J }, select: { topics: true } });
  const orden = (journey?.topics as string[]) ?? [];
  const rows = await prisma.journeyStory.findMany({
    where: { journeyId: J },
    select: { slug: true, title: true, topic: true, slotIndex: true, coverUrl: true },
  });
  rows.sort((a, b) =>
    orden.indexOf(a.topic!) - orden.indexOf(b.topic!) || (a.slotIndex ?? 0) - (b.slotIndex ?? 0));
  const conPortada = rows.filter((r) => r.coverUrl);
  console.log(`${conPortada.length}/${rows.length} con portada`);
  if (!conPortada.length) { await prisma.$disconnect(); return; }

  const dir = mkdtempSync(path.join(tmpdir(), "gallery-"));
  const fichas: string[] = [];
  const titulos: string[] = [];
  for (const [i, r] of conPortada.entries()) {
    const f = path.join(dir, `${String(i).padStart(2, "0")}.png`);
    writeFileSync(f, Buffer.from(await (await fetch(r.coverUrl!)).arrayBuffer()));
    fichas.push(f);
    titulos.push(`${i + 1}. ${r.title}`);
    console.log(`  ${i + 1}. ${r.title}  (${r.topic})`);
  }

  // 3 por fila, un tema por fila, que es como se leen.
  const py = `
import sys
from PIL import Image, ImageDraw, ImageFont
args = sys.argv[1:]
sep = args.index("--")
fichas = args[:sep]; titulos = args[sep+1:-1]; out = args[-1]
BAR = 34
try:
    fuente = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 20)
except Exception:
    fuente = ImageFont.load_default()
W, GAP = 640, 12
minis = []
for f in fichas:
    im = Image.open(f).convert("RGB")
    minis.append(im.resize((W, int(im.height * W / im.width)), Image.LANCZOS))
H = max(m.height for m in minis) + BAR
cols, filas = 3, (len(minis) + 2) // 3
hoja = Image.new("RGB", (cols * W + (cols + 1) * GAP, filas * H + (filas + 1) * GAP), (17, 17, 17))
for i, m in enumerate(minis):
    x = GAP + (i % cols) * (W + GAP); y = GAP + (i // cols) * (H + GAP)
    hoja.paste(m, (x, y))
    d = ImageDraw.Draw(hoja)
    d.text((x + 6, y + m.height + 7), titulos[i], fill=(235, 235, 235), font=fuente)
hoja.save(out)
print(f"{hoja.width}x{hoja.height}")
`;
  const script = path.join(dir, "sheet.py");
  writeFileSync(script, py);
  const { stdout } = await exec(".venv-cv/bin/python", [script, ...fichas, "--", ...titulos, salida]);
  console.log(`hoja -> ${salida}  ${stdout.trim()}`);
  await prisma.$disconnect();
})();
