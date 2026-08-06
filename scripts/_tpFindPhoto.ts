// scripts/_tpFindPhoto.ts
//
// Searches Wikimedia Commons for a usable photo and prints the candidates with
// their licence and author, ready to paste into the catalogue.
//
//   npx tsx scripts/_tpFindPhoto.ts "nur Barzahlung" "Euro Münzen Kasse"
//
// It only prints. Choosing is a human job: the licence filter says a file is
// legally usable, not that it is a good photograph or that it shows what the
// piece is about.

import { isAllowedCommonsLicence } from "@/lib/wikimediaCommons";

const API = "https://commons.wikimedia.org/w/api.php";
const WIDTH = 1600;

type Candidate = {
  title: string;
  url: string;
  filePage: string;
  author: string;
  licence: string;
  width: number;
  height: number;
};

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function search(term: string, limit = 12): Promise<Candidate[]> {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    // `filemime` es el filtro que de verdad restringe a fotos. Sin el, Commons
    // busca tambien en el TEXTO de los PDF y DJVU y devuelve escaneos de libros
    // y actas del Congreso de EE. UU. en vez de imagenes.
    gsrsearch: `filemime:image/jpeg ${term}`,
    gsrnamespace: "6", // File:
    gsrlimit: String(limit),
    prop: "imageinfo",
    iiprop: "url|extmetadata|size",
    iiurlwidth: String(WIDTH),
    format: "json",
  });

  const res = await fetch(`${API}?${params}`, {
    headers: {
      // Commons asks for a descriptive agent; anonymous scripts get throttled.
      "User-Agent": "DigitalPolyglot/1.0 (talking-points photo search)",
    },
  });
  if (!res.ok) throw new Error(`Commons ${res.status}`);
  const data = (await res.json()) as {
    query?: { pages?: Record<string, unknown> };
  };
  const pages = Object.values(data.query?.pages ?? {}) as Array<{
    title: string;
    imageinfo?: Array<{
      thumburl?: string;
      url: string;
      descriptionurl: string;
      thumbwidth?: number;
      thumbheight?: number;
      extmetadata?: Record<string, { value?: string }>;
    }>;
  }>;

  return pages.flatMap((p) => {
    const info = p.imageinfo?.[0];
    if (!info) return [];
    const meta = info.extmetadata ?? {};
    return [
      {
        title: p.title,
        url: info.thumburl ?? info.url,
        filePage: info.descriptionurl,
        author: stripHtml(meta.Artist?.value ?? "") || "(sin autor declarado)",
        licence: stripHtml(meta.LicenseShortName?.value ?? ""),
        width: info.thumbwidth ?? 0,
        height: info.thumbheight ?? 0,
      },
    ];
  });
}

async function main() {
  const terms = process.argv.slice(2);
  if (terms.length === 0) {
    console.error('Uso: npx tsx scripts/_tpFindPhoto.ts "término" ["otro término"]');
    process.exit(1);
  }

  for (const term of terms) {
    console.log(`\n===== "${term}" =====`);
    let candidates: Candidate[] = [];
    try {
      candidates = await search(term);
    } catch (err) {
      console.log("  error consultando Commons:", (err as Error).message);
      continue;
    }

    const usable = candidates.filter((c) => isAllowedCommonsLicence(c.licence));
    const rejected = candidates.length - usable.length;

    if (usable.length === 0) {
      console.log(`  sin resultados usables (${candidates.length} vistos)`);
      continue;
    }

    for (const c of usable) {
      console.log(`\n  ${c.title.replace(/^File:/, "")}`);
      console.log(`    licencia : ${c.licence}`);
      console.log(`    autor    : ${c.author.slice(0, 70)}`);
      console.log(`    tamaño   : ${c.width}x${c.height}`);
      console.log(`    url      : ${c.url}`);
      console.log(`    ficha    : ${c.filePage}`);
    }
    console.log(
      `\n  ${usable.length} usables, ${rejected} descartados por licencia (NC, ND o desconocida).`
    );
  }
}

main();
