"""Rejilla de portadas para los anuncios de catalogo de Meta.

Una tira POR COLUMNA, no una sola de 1080. Las dos columnas se desplazan en
sentidos opuestos, y partir una tira unica por la mitad cortaria las sombras
suaves de los mockups, que se cruzan por el centro.

Fondo: el MISMO gris (247,247,247) que traen de fabrica los mockups de Shopify,
para que la portada se funda con la pagina y cada libro conserve su sombra.

Alineacion: por la CARA FRONTAL y por la BASE. La caja del libro no sirve, su
ancho incluye el lomo y va de 0.72 a 0.89 veces el alto; la cara, medida a
media altura, se queda entre 0.710 y 0.734.
"""
from PIL import Image, ImageChops
import glob, sys

BG = (247, 247, 247)
W = 1080
COLS = 2
LANE_W = W // COLS
GAP = 26
BOOK_H = 545
FACE_W = 392
SHADOW_TOL = 5                  # solo fondo exacto: la sombra del mockup se queda
BOOK_TOL = 30                   # el libro, ignorando la sombra suave
FACE_TOL = 12                   # la cara: mas fino, o las portadas crema se
                                # confunden con el fondo y el borde sale corto


def book_box(im, tol=BOOK_TOL, step=2):
    w, h = im.size
    px = im.load()

    def out(x, y):
        p = px[x, y]
        return (abs(p[0] - BG[0]) > tol or abs(p[1] - BG[1]) > tol
                or abs(p[2] - BG[2]) > tol)

    xs = [x for x in range(0, w, step) if any(out(x, y) for y in range(0, h, step))]
    ys = [y for y in range(0, h, step) if any(out(x, y) for x in range(0, w, step))]
    if not xs or not ys:
        return (0, 0, w, h)
    return (min(xs), min(ys), max(xs), max(ys))


def face_edges(im, box):
    """Bordes de la cara frontal, medidos con la MEDIANA de las filas del tercio
    central; con una sola fila las portadas palidas dan el borde corto.

    Cada borde usa su propia tolerancia. La sombra del mockup cae abajo y a la
    IZQUIERDA, asi que ese borde se mide grueso (BOOK_TOL) para no comersela.
    El derecho se mide fino (FACE_TOL) porque ahi no hay sombra y lo que falla
    es lo contrario: una portada crema se confunde con el fondo.
    """
    x0, y0, x1, y1 = box
    px = im.load()
    h = y1 - y0
    lefts, rights = [], []
    for y in range(y0 + int(h * 0.30), y0 + int(h * 0.70), 3):
        left = [x for x in range(x0, x1 + 1)
                if any(abs(px[x, y][i] - BG[i]) > BOOK_TOL for i in range(3))]
        right = [x for x in range(x0, x1 + 1)
                 if any(abs(px[x, y][i] - BG[i]) > FACE_TOL for i in range(3))]
        if left:
            lefts.append(min(left))
        if right:
            rights.append(max(right))
    if not lefts or not rights:
        return (x0, x1)
    lefts.sort(); rights.sort()
    return (lefts[len(lefts) // 2], rights[len(rights) // 2])


def prepare(path):
    im = Image.open(path).convert("RGB")
    x0, y0, x1, y1 = book_box(im, SHADOW_TOL)
    pad = 6
    cut = im.crop((max(0, x0 - pad), max(0, y0 - pad),
                   min(im.width, x1 + pad), min(im.height, y1 + pad)))
    box = book_box(cut)
    sy = BOOK_H / max(1, box[3] - box[1])
    fl, fr = face_edges(cut, box)
    sx = sy * (FACE_W / max(1, round((fr - fl) * sy)))
    img = cut.resize((round(cut.width * sx), round(cut.height * sy)), Image.LANCZOS)
    box2 = book_box(img)
    fl2, _ = face_edges(img, box2)
    return img, fl2, box2[3]


def build_lane(files, name, reps=3):
    items = [prepare(f) for f in files]
    row_h = BOOK_H + GAP * 2
    one = len(items) * row_h + GAP
    lane = Image.new("RGB", (LANE_W, one * reps), BG)
    face_x = (LANE_W - FACE_W) // 2
    for rep in range(reps):
        for i, (img, face_left, book_bottom) in enumerate(items):
            baseline = rep * one + GAP + i * row_h + GAP + BOOK_H
            # con mascara: pegar el mockup como rectangulo pinta tambien su
            # fondo y tapa el borde del libro vecino.
            m = ImageChops.difference(img, Image.new("RGB", img.size, BG))
            mask = m.convert("L").point(lambda v: 255 if v > 1 else 0)
            lane.paste(img, (face_x - face_left, baseline - book_bottom), mask)
    lane.save(name)
    return one


# Argentina: con el orden natural, las dos portadas de mujer sola (Short
# Stories y 20 Wonders) caian seguidas en la misma columna.
ORDER = {"argentina": [1, 2, 5, 4, 3, 6]}


def build(country):
    files = sorted(glob.glob(f"covers/{country}-*.png"))
    assert len(files) == 6, files
    if country in ORDER:
        files = [next(f for f in files if f"-{i}-" in f) for i in ORDER[country]]
    left = build_lane(files[0::2], f"lane-{country}-L.png")
    right = build_lane(files[1::2], f"lane-{country}-R.png")
    print(f"lane-{country}-L.png / lane-{country}-R.png | ciclo: {left} y {right}")
    return left, right


if __name__ == "__main__":
    for c in (sys.argv[1:] or ["mexico"]):
        build(c)
