"""Gate de covers: falla si la imagen incumple la prohibición dura del rubor.

Existe porque con las historias hay validador y con las imágenes no: el único
control era yo mirando, después de pagar la tirada, y el 2026-08-12 se colaron
rubor y ojos punto en covers ya enseñados al usuario.

POR QUÉ NO DETECTA CARAS: el primer intento usó los cascades de Haar de
OpenCV. Están entrenados con fotografías y en ilustración encuentran cero
caras, así que devolvía "pasa" sin haber medido nada. Aquí se trabaja sobre
REGIONES DE PIEL, igual que `_deblush.py`, que sí funciona con dibujo.

Qué mide:
  RUBOR — dentro de cada región de piel, busca manchas rosadas compactas cuya
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


def analyse(path):
    img = cv2.imread(path)
    if img is None:
        return [f"no se pudo leer {path}"], 0
    h, w = img.shape[:2]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    hue, sat = hsv[..., 0].astype(np.float32), hsv[..., 1].astype(np.float32)

    mask = skin_mask(img)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    problems, regions = [], 0
    for i in range(1, n):
        area = stats[i, cv2.CC_STAT_AREA]
        if area < h * w * MIN_REGION:
            continue
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
                x, y = stats[i, cv2.CC_STAT_LEFT], stats[i, cv2.CC_STAT_TOP]
                problems.append(
                    f"rubor en piel ({x},{y}): mancha de {blob}px, "
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
            print(f"SIN DATOS  {name}  (0 regiones de piel: el gate no midió nada)")
            continue
        if problems:
            bad = True
            print(f"FALLA  {name}  ({regions} regiones de piel)")
            for p in problems:
                print(f"        {p}")
        else:
            print(f"pasa   {name}  ({regions} regiones de piel)")
    sys.exit(1 if bad else 0)


main()
