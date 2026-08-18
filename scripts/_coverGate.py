"""Gate de covers: falla si la imagen incumple la prohibición dura del rubor.

Existe porque con las historias hay validador y con las imágenes no: el único
control era yo mirando, después de pagar la tirada, y el 2026-08-12 se colaron
rubor y ojos punto en covers ya enseñados al usuario.

POR QUÉ NO DETECTA CARAS: el primer intento usó los cascades de Haar de
OpenCV. Están entrenados con fotografías y en ilustración encuentran cero
caras, así que devolvía "pasa" sin haber medido nada. Aquí se trabaja sobre
REGIONES DE PIEL, igual que `_deblush.py`, que sí funciona con dibujo.

Qué mide:
  RUBOR; dentro de cada región de piel, busca manchas rosadas compactas cuya
  saturación se dispara respecto a la MEDIANA DE ESA MISMA REGIÓN. La
  comparación es relativa a propósito: un umbral fijo hacía fallar a
  `_deblush.py` en fondos cálidos de playa, que tomaba la pared por piel
  (project_deblush_fails_warm_backgrounds).

Qué NO mide, y hay que seguir mirando a ojo: ojos punto, estilo, edad de los
personajes, y si la escena cuenta la historia. Esto cubre UNA de las dos
prohibiciones duras, no las dos.

Uso:
    .venv-cv/bin/python scripts/_coverGate.py <imagen.png> [...]
Sale 1 si alguna falla.
"""
import sys
import cv2
import numpy as np

MIN_REGION = 0.0015   # fracción de la imagen para que una mancha de piel cuente
SAT_LIFT = 30         # saturación por encima de la mediana de la región
MIN_BLOB = 0.040      # fracción de la región que debe estar rosada.
                      # Subido de 0.012 el 2026-08-12: el usuario confirmó
                      # que las pecas suaves entran dentro del límite, y a
                      # 0.012 el gate marcaba brazos al sol como mejillas.
MIN_BLOB_PX = 120     # y un mínimo absoluto, para no cazar ruido


def skin_mask(bgr):
    """Misma heurística que _deblush.py, que ya se usa en producción."""
    a = bgr[..., ::-1].astype(np.float32)  # a RGB
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    lips = (R > 150) & ((R - G) > 72) & (G < 155)
    skin = ((R > 95) & (R > G + 8) & (G > B - 2) & ((R - B) > 12) &
            ((R - B) < 135) & (R < 250) & (G > 60) & (~lips))
    m = cv2.morphologyEx((skin * 255).astype(np.uint8), cv2.MORPH_OPEN,
                         np.ones((5, 5), np.uint8))
    return cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))


def tiene_ojos(hsv, x, y, bw, bh, area):
    """¿Esta región de piel es una CARA?

    Se decide por los ojos, que en este estilo son un blanco de esclerótica
    con una pupila oscura dentro. Una naranja, una pared cálida o un brazo al
    sol no tienen eso, y eran justo lo que el gate marcaba como mejilla.

    No se usan los cascades de Haar: entrenados con fotografía, en ilustración
    encuentran cero caras (ver cabecera). Esto no detecta la cara, detecta el
    ojo, que en dibujo plano es mucho más estable que un contorno facial.
    """
    v = hsv[y:y + bh, x:x + bw, 2].astype(np.int16)
    s = hsv[y:y + bh, x:x + bw, 1].astype(np.int16)
    blanco = ((v > 195) & (s < 45)).astype(np.uint8) * 255
    oscuro = (v < 75).astype(np.uint8) * 255
    if blanco.sum() == 0 or oscuro.sum() == 0:
        return False
    nb, _, bstats, _ = cv2.connectedComponentsWithStats(blanco, 8)
    no, olab, ostats, _ = cv2.connectedComponentsWithStats(oscuro, 8)
    # El blanco del ojo es PEQUEÑO respecto a la cara. El tope descarta el
    # cuenco blanco de la cocina y la pared encalada, que son enormes.
    for j in range(1, nb):
        wa = bstats[j, cv2.CC_STAT_AREA]
        if not (25 <= wa <= area * 0.02):
            continue
        bx, by = bstats[j, cv2.CC_STAT_LEFT], bstats[j, cv2.CC_STAT_TOP]
        bwd, bht = bstats[j, cv2.CC_STAT_WIDTH], bstats[j, cv2.CC_STAT_HEIGHT]
        # ¿Hay una pupila dentro o pegada a ese blanco?
        pad = 4
        x0, y0 = max(0, bx - pad), max(0, by - pad)
        x1, y1 = min(oscuro.shape[1], bx + bwd + pad), min(oscuro.shape[0], by + bht + pad)
        trozo = olab[y0:y1, x0:x1]
        for k in np.unique(trozo):
            if k == 0:
                continue
            da = ostats[k, cv2.CC_STAT_AREA]
            if 12 <= da <= area * 0.02:
                return True
    return False


def analyse(path):
    img = cv2.imread(path)
    if img is None:
        return [f"no se pudo leer {path}"], 0
    h, w = img.shape[:2]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    hue, sat = hsv[..., 0].astype(np.float32), hsv[..., 1].astype(np.float32)

    mask = skin_mask(img)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(mask, 8)

    # ¿El detector de ojos encuentra ALGUNA cara en esta imagen? En los planos
    # a media distancia las caras son pequeñas y el blanco del ojo no llega al
    # mínimo, así que no encuentra ninguna. Antes eso contaba como fallo y se
    # descartaban tiradas SIN HABERLAS MEDIDO: siete se perdieron así el
    # 2026-08-18. Si no hay caras, se repliega a medir regiones de piel, que es
    # el gate original; más tosco, pero mide algo.
    caras_posibles = False
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < h * w * MIN_REGION:
            continue
        if tiene_ojos(hsv, stats[i, cv2.CC_STAT_LEFT], stats[i, cv2.CC_STAT_TOP],
                      stats[i, cv2.CC_STAT_WIDTH], stats[i, cv2.CC_STAT_HEIGHT],
                      stats[i, cv2.CC_STAT_AREA]):
            caras_posibles = True
            break

    problems, regions = [], 0
    for i in range(1, n):
        area = stats[i, cv2.CC_STAT_AREA]
        if area < h * w * MIN_REGION:
            continue
        x, y = stats[i, cv2.CC_STAT_LEFT], stats[i, cv2.CC_STAT_TOP]
        bw, bh = stats[i, cv2.CC_STAT_WIDTH], stats[i, cv2.CC_STAT_HEIGHT]
        if caras_posibles and not tiene_ojos(hsv, x, y, bw, bh, area):
            continue  # no es una cara: manos, brazos, fruta, muro al sol
        regions += 1
        comp = lab == i
        base = float(np.median(sat[comp]))
        # Rosa/rojo en HSV de OpenCV vive cerca de 0 y de 180.
        pink = comp & ((hue < 12) | (hue > 168)) & (sat > base + SAT_LIFT)
        if pink.sum() < MIN_BLOB_PX:
            continue
        # Que sea una MANCHA compacta, no píxeles sueltos por toda la región.
        pn, plab, pstats, _ = cv2.connectedComponentsWithStats(
            (pink * 255).astype(np.uint8), 8)
        for j in range(1, pn):
            blob = pstats[j, cv2.CC_STAT_AREA]
            if blob >= MIN_BLOB_PX and blob / area > MIN_BLOB:
                problems.append(
                    f"rubor en cara ({x},{y}): mancha de {blob}px, "
                    f"{blob/area*100:.1f}% de la región")
                break
    return problems, regions


def main():
    bad = False
    for path in sys.argv[1:]:
        problems, regions = analyse(path)
        name = path.split("/")[-1]
        if regions == 0:
            bad = True
            print(f"SIN DATOS  {name}  (ni caras ni piel: el gate no midió nada)")
            continue
        if problems:
            bad = True
            print(f"FALLA  {name}  ({regions} cara(s))")
            for p in problems:
                print(f"        {p}")
        else:
            print(f"pasa   {name}  ({regions} region(es))")
    sys.exit(1 if bad else 0)


main()
