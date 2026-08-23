# Portadas DE A0 Traveler (cmt0a8vb1000m32p1x7r5ba28)

Prompt cerrado antes de la primera tirada. Cada `scenes/<slug>.txt` es
autosuficiente y lleva las cuatro cosas: ficha literal de cada persona en
cuadro (edad, pelo, color fijo de ropa), reparto cerrado con el numero exacto
de figuras, registro visual anclado y prohibicion de texto.

Tirada (una por portada, descarga local, gate de rubor, NO pone nada vivo):

    bash scripts/_coverBatch.sh <ruta-absoluta-a-scripts/_deA0Covers> <slug> [...]

TOPE: 2 tiradas por portada. Si una falla dos veces por lo mismo, se arregla
la escena, no se vuelve a tirar.

Revision a tamano completo, una por una. La hoja de contactos solo sirve para
juzgar coherencia entre las 21.

Cosas que la escena fija a proposito porque el modelo las rellena mal:
- Emilia (34) lleva el pelo plateado por eleccion; la escena repite que es
  joven y sin arrugas porque el candado prohibe canas.
- El artesano de Zinnfiguren va a 52 con pelo oscuro: el texto dice "alter
  Handwerker", pero anciano es prohibicion dura.
- Relojes de cuco con esfera en blanco, casco del kutter sin numeros, latas
  sin rotulo, cruz de cumbre sin placa, sobre en blanco, y en la cabana del
  Eibsee no hay ni mapa ni cartas: todo objeto escribible sale con letras
  inventadas.

## Las seis tiradas de Dresde

Los PNG locales se borraron para liberar disco; las imágenes viven en R2:

- Wieder in Dresden, tirada 1: `wieder-in-dresden-styleB-flux-1787493456964.png`
- Wieder in Dresden, tirada 2: `wieder-in-dresden-styleB-flux-1787493812995.png`
- Die Brücke, tirada 1: `die-br-cke-ber-die-elbe-styleB-flux-1787493480966.png`
- Die Brücke, tirada 2: `die-br-cke-ber-die-elbe-styleB-flux-1787493845698.png`
- Die Treppe, tirada 1: `die-treppe-an-der-elbe-styleB-flux-1787493509333.png`
- Die Treppe, tirada 2: `die-treppe-an-der-elbe-styleB-flux-1787493882091.png`

Base: `https://pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev/media/generated/images/`

Ninguna está viva: `coverUrl` sigue vacío en las 21.
