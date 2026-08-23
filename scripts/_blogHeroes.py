#!/usr/bin/env python3
"""Heroes for the blog posts that still carry the generic placeholder.

Source: Wikimedia Commons. No API key, machine-readable licence on every file,
same source `src/lib/wikimediaCommons.ts` already uses for Talking Points. The
cost is that attribution is mandatory, so `build` writes a `heroCredit` block
into the post's frontmatter and the article page renders it under the image.

  python3 scripts/_blogHeroes.py candidates [slug ...]   -> contact sheets
  python3 scripts/_blogHeroes.py build [slug ...]        -> hero.webp + credits

Picking is a human job: the licence filter says a file is legally usable, not
that it is a good photograph or that it shows what the post is about.
"""
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAP = os.path.join(ROOT, "scripts", "_blogHeroes.map")
PICKS = os.path.join(ROOT, "scripts", "_blogHeroes.picks.json")
CACHE = os.path.join(ROOT, "scripts", "_blogheroes-cache")
SHEETS = os.environ.get("SHEETS_DIR", os.path.join(CACHE, "sheets"))
API = "https://commons.wikimedia.org/w/api.php"
UA = "DigitalPolyglot/1.0 (blog hero search; delcarpio321@gmail.com)"

W, H = 1200, 675

ALLOWED = ("cc0", "public domain", "pd", "cc by", "cc by-sa")

# Files that are legally fine and visually useless as a hero.
JUNK = re.compile(
    r"\b(map|mapa|karte|diagram|flag|bandera|coat of arms|escudo|logo|chart|"
    r"seal|banknote|stamp|graph|plaque|sign|signage|schema|poster|cover|"
    r"screenshot|satellite|aerial view|panorama of|blank|"
    # Escenas que son legalmente validas y editorialmente inservibles para un
    # blog de idiomas: sangre, politica y duelo. Una portada tiene que invitar
    # a leer, y ninguna de estas lo hace.
    r"bullfight|bullfighting|corrida|torero|toreo|plaza de toros|novillada|"
    r"protest|demonstration|manifestacion|manifestaci|strike|riot|police|"
    r"military|army|soldier|war|cemetery|funeral|election|campaign rally|"
    r"homeless|abandoned|derelict|ruins|demolition|construction site|"
    r"garbage|landfill|sewage|slum|"
    # Papel, no escena. Commons guarda muchisimo documento escaneado y mucha
    # pintura, y ninguna de las dos cosas es una foto de gente.
    r"letter|manuscript|diary|handwritten|page|folio|painting|engraving|"
    r"lithograph|drawing|illustration|postcard|portrait of|print of)\b",
    re.I,
)


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read()


def strip_html(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s or "")).strip()


# Autores que piden que se les escriba antes de un uso comercial. La licencia
# CC BY-SA permite ese uso y la peticion no la anula, pero el blog es comercial
# y no vamos a discutirlo con nadie por una foto: se descarta y se coge otra.
ASKS_PERMISSION = re.compile(
    r"contact me before commercial|before commercial use|"
    r"non-?commercial use only|ask me before",
    re.I,
)


def tidy_author(raw):
    """El campo Artist de Commons va de un nombre a un parrafo entero.

    Lo que se pinta debajo de la foto tiene que caber en una linea, asi que se
    corta en la primera frase y, si lo unico que hay es una URL de Flickr, se
    usa el nombre de usuario, que es como se llama esa persona alli.
    """
    a = strip_html(raw)
    m = re.match(r"https?://(?:www\.)?flickr\.com/photos/([^/]+)/?$", a)
    if m:
        return f"{m.group(1)} (Flickr)"
    a = re.split(r"(?<=[a-z])\.\s", a)[0].strip().rstrip(".")
    return (a[:80].rstrip() if len(a) > 80 else a) or "Wikimedia Commons"


def licence_ok(name):
    n = (name or "").strip().lower()
    if not n:
        return False
    if "nc" in n.split("-") or "nd" in n.split("-"):
        return False
    return any(n.startswith(a) for a in ALLOWED)


def search(query, limit=50):
    params = urllib.parse.urlencode(
        {
            "action": "query",
            "generator": "search",
            "gsrsearch": f"filemime:image/jpeg {query}",
            "gsrnamespace": "6",
            "gsrlimit": str(limit),
            "prop": "imageinfo",
            "iiprop": "url|extmetadata|size",
            "iiurlwidth": "1600",
            "format": "json",
        }
    )
    data = json.loads(get(f"{API}?{params}"))
    pages = list((data.get("query") or {}).get("pages", {}).values())
    # `generator=search` returns pages unordered; `index` restores relevance.
    pages.sort(key=lambda p: p.get("index", 999))
    # Commons ordena por relevancia de TEXTO COMPLETO, y la ficha de un archivo
    # incluye categorias y descripcion larga, asi que "Buenos Aires street" saca
    # cualquier foto tomada en la ciudad. Reordenar por cuantas palabras de la
    # consulta aparecen en el NOMBRE del archivo acerca mucho mas la escena.
    terms = [t.lower() for t in re.findall(r"\w+", query) if len(t) > 3]

    def title_score(title):
        low = title.lower()
        return sum(1 for t in terms if t in low)

    out = []
    for p in pages:
        info = (p.get("imageinfo") or [None])[0]
        if not info:
            continue
        meta = info.get("extmetadata") or {}
        lic = strip_html((meta.get("LicenseShortName") or {}).get("value", ""))
        title = p["title"].replace("File:", "")
        w, h = info.get("width", 0), info.get("height", 0)
        if not licence_ok(lic):
            continue
        if w < 1400 or h < 800 or w / max(h, 1) < 1.35:
            continue
        if JUNK.search(title):
            continue
        artist = (meta.get("Artist") or {}).get("value", "")
        if ASKS_PERMISSION.search(strip_html(artist)):
            continue
        out.append(
            {
                "title": title,
                "url": info.get("thumburl") or info["url"],
                "filePage": info["descriptionurl"],
                "author": tidy_author(artist),
                "licence": lic,
                "width": w,
                "height": h,
            }
        )
    out.sort(key=lambda c: -title_score(c["title"]))
    return out


def read_map(only):
    rows = []
    with open(MAP) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            slug, query = line.split("|")[:2]
            if only and slug not in only:
                continue
            rows.append((slug, query))
    return rows


def cover_crop(im, w, h):
    im = im.convert("RGB")
    sw, sh = im.size
    scale = max(w / sw, h / sh)
    im = im.resize((max(w, int(sw * scale + 0.5)), max(h, int(sh * scale + 0.5))), Image.LANCZOS)
    nw, nh = im.size
    left = (nw - w) // 2
    # Crop a little above centre: in street photography the faces sit high.
    top = int((nh - h) * 0.4)
    return im.crop((left, top, left + w, top + h))


def cmd_candidates(only):
    os.makedirs(SHEETS, exist_ok=True)
    os.makedirs(CACHE, exist_ok=True)
    # Se fusiona con lo que ya hubiera: rehacer un slug suelto no puede borrar
    # los candidatos de los otros veintinueve, que es de donde lee `build`.
    cpath = os.path.join(CACHE, "candidates.json")
    index = json.load(open(cpath)) if os.path.exists(cpath) else {}
    for slug, query in read_map(only):
        cands = []
        seen = set()
        for term in [t.strip() for t in query.split(";") if t.strip()]:
            for c in search(term):
                if c["title"] in seen:
                    continue
                seen.add(c["title"])
                cands.append(c)
            if len(cands) >= 6:
                break
        cands = cands[:6]
        index[slug] = cands
        if not cands:
            print(f"  SIN CANDIDATOS  {slug}  ({query})")
            continue
        tw, th = 420, 236
        cols, rows = 3, 2
        sheet = Image.new("RGB", (cols * tw, rows * th + 26), "white")
        d = ImageDraw.Draw(sheet)
        d.text((8, 6), f"{slug}   <-  {query}", fill="black")
        for i, c in enumerate(cands):
            try:
                im = Image.open(io.BytesIO(get(c["url"])))
            except Exception as e:  # noqa: BLE001
                print(f"  fallo thumb {slug} #{i+1}: {e}")
                continue
            time.sleep(0.25)  # Commons devuelve 429 si se piden las miniaturas seguidas.
            im = cover_crop(im, tw - 4, th - 4)
            x, y = (i % cols) * tw, 26 + (i // cols) * th
            sheet.paste(im, (x + 2, y + 2))
            d.rectangle([x + 2, y + 2, x + 26, y + 22], fill="black")
            d.text((x + 10, y + 7), str(i + 1), fill="white")
        sheet.save(os.path.join(SHEETS, f"{slug}.png"))
        print(f"  {slug}: {len(cands)} candidatos")
        time.sleep(0.3)
    with open(cpath, "w") as f:
        json.dump(index, f, indent=1, ensure_ascii=False, sort_keys=True)


def cmd_build(only):
    index = json.load(open(os.path.join(CACHE, "candidates.json")))
    picks = json.load(open(PICKS)) if os.path.exists(PICKS) else {}
    credits = {}
    cpath = os.path.join(ROOT, "scripts", "_blogHeroes.credits.json")
    if os.path.exists(cpath):
        credits = json.load(open(cpath))
    for slug, _query in read_map(only):
        pick = picks.get(slug)
        if not pick:
            print(f"  sin eleccion  {slug}")
            continue
        c = index[slug][pick - 1]
        im = Image.open(io.BytesIO(get(c["url"])))
        out_dir = os.path.join(ROOT, "public", "blog", slug)
        os.makedirs(out_dir, exist_ok=True)
        dest = os.path.join(out_dir, "hero.webp")
        cover_crop(im, W, H).save(dest, "WEBP", quality=82, method=6)
        credits[slug] = {
            "author": c["author"],
            "licence": c["licence"],
            "filePage": c["filePage"],
            "title": c["title"],
        }
        print(f"  {slug}  {os.path.getsize(dest)//1024} KB  {c['licence']}  {c['author'][:40]}")
    with open(cpath, "w") as f:
        json.dump(credits, f, indent=1, ensure_ascii=False, sort_keys=True)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "candidates"
    args = set(sys.argv[2:])
    {"candidates": cmd_candidates, "build": cmd_build}[cmd](args)
