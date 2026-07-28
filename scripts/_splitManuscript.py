#!/usr/bin/env python3
"""Parte el manuscrito del libro en una narración por historia.

Cada capítulo del documento es: título, narración, "Vocabulary:", lista de
glosas, "Preguntas de opción múltiple", test. Sólo la narración es texto de
historia; lo demás es aparato del libro y NO debe entrar en la app.

  python3 scripts/_splitManuscript.py <manuscrito.txt> <outDir>
"""
import json
import os
import re
import sys

TITULOS = [
    ("el-mercado-de-medellin", "El mercado de Medellín"),
    ("la-leyenda-de-el-dorado", "La leyenda de El Dorado"),
    ("una-aventura-en-el-amazonas", "Una aventura en el Amazonas"),
    ("el-baile-en-la-plaza", "El baile en la plaza"),
    ("el-tesoro-escondido", "El tesoro escondido"),
    ("el-secreto-del-cafe", "El secreto del café"),
    ("el-carnaval-de-barranquilla", "El carnaval de Barranquilla"),
    ("la-excursion-a-la-sierra-nevada", "La excursión a la Sierra Nevada"),
    ("el-tren-de-la-sabana", "El tren de La Sabana"),
    ("la-feria-de-las-flores", "La feria de las flores"),
    ("la-leyenda-de-la-llorona", "La leyenda de la Llorona"),
    ("la-finca-en-la-montana", "La finca en la montaña"),
    ("el-misterio-del-bosque", "El misterio del bosque"),
    ("el-festival-de-la-arepa", "El festival de la arepa"),
    ("el-viaje-a-villa-de-leyva", "El viaje a Villa de Leyva"),
    ("la-leyenda-de-bochica", "La leyenda de Bochica"),
    ("el-rescate-en-la-laguna", "El rescate en la laguna"),
    ("el-misterio-de-la-catedral-de-sal", "El misterio de la Catedral de Sal"),
    ("la-fiesta-en-cartagena", "La fiesta en Cartagena"),
    ("la-leyenda-del-mohan", "La leyenda del Mohán"),
]


def body_start(text: str, title: str) -> int:
    """Inicio de la NARRACIÓN del capítulo.

    El título aparece tres veces: en el índice ("12. La finca…", con número
    delante), como encabezado del capítulo (solo en su línea) y a veces en las
    respuestas del final. Sólo vale la del encabezado, y se reconoce porque el
    bloque 'Vocabulary' de ese capítulo viene a una distancia de capítulo
    (entre 800 y 8000 caracteres), no a media docena de capítulos de ahí.
    """
    for m in re.finditer(rf"(?m)^{re.escape(title)}\s*$", text):
        seg = text[m.end():m.end() + 9000]
        cut = seg.find("Vocabulary")
        if 800 < cut < 8000:
            return m.end()
    return -1


def main():
    src, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    text = open(src, encoding="utf-8").read()

    resumen = []
    for slug, title in TITULOS:
        i = body_start(text, title)
        if i < 0:
            print(f"  {slug}: SIN CUERPO")
            continue
        rest = text[i:]
        cut = rest.find("Vocabulary")
        narrative = rest[:cut].strip()

        # La lista de vocabulario del libro va justo después; sirve para volver
        # a marcar las mismas palabras que ya estaban marcadas.
        vocab_block = rest[cut:].split("Preguntas")[0]
        words = re.findall(r"^([A-Za-zÁÉÍÓÚÑáéíóúñ' ]{2,28}):", vocab_block, re.M)
        words = [w.strip() for w in words if w.strip().lower() != "vocabulary"]

        open(os.path.join(out, f"{slug}.txt"), "w", encoding="utf-8").write(narrative + "\n")
        json.dump(words, open(os.path.join(out, f"{slug}.words.json"), "w"), ensure_ascii=False)
        resumen.append((slug, len(narrative.split()), len(words)))
        print(f"  {slug:<36} {len(narrative.split()):>4} palabras   vocab del libro: {len(words)}")

    print(f"\nhistorias extraídas: {len(resumen)}")


if __name__ == "__main__":
    main()
