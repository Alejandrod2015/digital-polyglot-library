# Friends DE A2 (Hannover): lo que espera al oido del usuario

Decision del usuario el 2026-09-23: las palabras y fragmentos marcados se
revisan TODOS JUNTOS al final del journey, no tema a tema. Esta lista es el
recordatorio; se vacia cuando el revisador recoja los veredictos.

## Pendientes

- `bettruhe-in-der-probezeit`, fragmento 0 (el titulo), gate de CONTENIDO:
  el reconocedor de ElevenLabs oye "betrue" donde el texto dice "Bettruhe".
  Contraprueba hecha: whisper transcribe los dos primeros segundos como
  "Bettruhe in der Probezeit.", entera. Lo que hay que escuchar es si la voz
  se come la segunda mitad de la palabra compuesta (Bett + Ruhe).

- `bettruhe-in-der-probezeit`, fragmento 1, cobertura: dio `HUECO: 38 komma 9`
  donde el texto dice "achtunddreissig Komma neun". Contraprueba hecha: whisper
  transcribe ese fragmento entero y escribe "38,9". La voz dice el numero con
  palabras y el reconocedor lo escribe en cifras; el comparador no los empareja.
  No hay nada que arreglar, pero queda para tu oido.

- `einladung-ohne-namen`, fragmento 2: 3,69 palabras por segundo contra una
  mediana de 2,27. Se frena con una toma a speed 0,70, unos 130 caracteres.

- `brot-und-salz-fuer-die-neue`, fragmento 4: 3,56 w/s contra 2,46. Igual.

## Ya juzgado y cerrado

Todo lo demas de los temas 1 a 5 esta en `docs/veredictos-audio-gates.json`.

## Aceptado sabiendo lo que mide

- `zu-dritt-im-treppenhaus`, titulo a +4,5 st. El usuario lo deja asi.
