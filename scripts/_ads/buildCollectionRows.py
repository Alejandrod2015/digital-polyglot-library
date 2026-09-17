"""Version horizontal de la rejilla: tres filas de portadas que cruzan la
pantalla, cada una en sentido contrario a la de al lado.

Reutiliza la preparacion de portadas de buildCollectionGrid (alto de libro
normalizado, cara frontal alineada, pegado con mascara) y solo cambia la
disposicion: los libros van en fila y la base comun es la de cada fila.
"""
from PIL import Image, ImageChops
import glob, sys
import build_grid as g

ROW_H = 640                      # 3 filas x 640 = 1920
CELL = g.FACE_W + 96             # ancho por libro: cara + aire para lomo y sombra
ORDERS = [[0, 1, 2, 3, 4, 5], [0, 3, 1, 5, 2, 4], [4, 5, 0, 1, 2, 3]]


def build(country, reps=3):
    files = sorted(glob.glob(f"covers/{country}-*.png"))
    assert len(files) == 6, files
    items = [g.prepare(f) for f in files]
    one = len(items) * CELL
    for r, order in enumerate(ORDERS):
        strip = Image.new("RGB", (one * reps, ROW_H), g.BG)
        baseline = (ROW_H - g.BOOK_H) // 2 + g.BOOK_H
        for rep in range(reps):
            for k, idx in enumerate(order):
                img, face_left, book_bottom = items[idx]
                face_x = rep * one + k * CELL + (CELL - g.FACE_W) // 2
                m = ImageChops.difference(img, Image.new("RGB", img.size, g.BG))
                mask = m.convert("L").point(lambda v: 255 if v > 1 else 0)
                strip.paste(img, (face_x - face_left, baseline - book_bottom), mask)
        strip.save(f"row-{country}-{r}.png")
    print(country, "ciclo", one, "px")
    return one


if __name__ == "__main__":
    for c in sys.argv[1:] or ["colombia"]:
        build(c)
