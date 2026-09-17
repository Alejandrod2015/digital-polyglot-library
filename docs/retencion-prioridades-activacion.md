# Retencion: prioridades de activacion

Fecha: 2026-09-12

Este documento resume el analisis de retencion hecho sobre usuarios no compradores
de libro. El objetivo es decidir que ejecutar ahora para aumentar la
stickiness del producto.

## Definicion de la metrica principal

La metrica recomendada es **Activacion de Primer Ciclo 24h**.

Definicion:

> Porcentaje de usuarios nuevos que completan al menos una historia y completan
> al menos una practica dentro de las primeras 24 horas desde su primera senal.

Por que esta metrica:

- La retencion sube mucho cuando el usuario completa historia y practica.
- Abrir historias por si solo no predice stickiness.
- La practica parece ser el cierre del loop, no una feature secundaria.
- La metrica fuerza a optimizar una experiencia completa, no clics aislados.

Datos actuales usados como linea base:

| Ventana | Usuarios elegibles | Historia 24h | Practica 24h | Primer Ciclo 24h |
|---|---:|---:|---:|---:|
| Historico | 72 | 23 | 19 | 19, 26.4% |
| Ultimos 30 dias | 40 | 14 | 13 | 13, 32.5% |
| Ultimos 30 dias, eventual | 40 | - | - | 18, 45.0% |

Nota metodologica: se excluyeron compradores de libro mediante `ClaimToken`.
La primera senal en `UserMetric` se uso como proxy de alta. Esto sirve para
producto y direccion, pero no reemplaza un analisis definitivo basado en Clerk.

## Prioridad 1: asegurar el primer aterrizaje correcto

### Que significa

Todo usuario nuevo debe aterrizar en contenido que corresponda con su idioma,
variante y nivel, y que tenga un siguiente paso claro hacia completar historia
y practica.

No debe caer en:

- Una historia aleatoria.
- Un idioma equivocado.
- Una historia sin buen cierre hacia practica.
- Un onboarding que termina sin llevar a contenido accionable.
- Una pagina de exploracion donde la decision principal sea "elige algo".

### Fundamento

El salto observado alrededor del 2026-09-06 coincide con arreglos de routing:

| Commit | Fecha | Lectura |
|---|---|---|
| `fd71e2f7` | 2026-09-05 | La web aterriza en el journey de la persona, no en una historia al azar. |
| `9228968e` | 2026-09-06 | Nadie aterriza en una historia de un idioma que no pidio. |

Antes y despues de ese corte:

| Corte | Usuarios | Primer Ciclo 24h |
|---|---:|---:|
| Antes del arreglo de routing | 25 | 7, 28.0% |
| Despues del arreglo de routing | 16 | 6, 37.5% |
| Publico antes | 9 | 0, 0% |
| Publico despues | 8 | 2, 25.0% |
| Beta antes | 16 | 7, 43.8% |
| Beta despues | 8 | 4, 50.0% |

La conclusion no es que el routing explique todo, porque no hubo experimento.
Pero si es la explicacion operativa mas fuerte: cuando el usuario cae en
contenido mas correcto, el Primer Ciclo mejora.

### Acciones

1. Auditar todos los puntos de entrada de usuario nuevo:
   - signup web
   - signup desde app
   - acceptance email beta
   - welcome email
   - deep links
   - home anonima
   - `journey/start`

2. Para cada entrada, verificar:
   - idioma correcto
   - variante correcta
   - contenido publicado
   - historia con audio disponible
   - CTA claro hacia completar
   - CTA inmediato hacia practica al terminar

3. Crear un reporte de QA de primer aterrizaje con casos por plataforma:
   - iOS
   - Android
   - webapp

### Metrica de exito

Subir Activacion de Primer Ciclo 24h en usuarios no compradores de 32.5% a 40%
como primer objetivo, y luego a 45%.

## Prioridad 2: disenar el primer ciclo como una unidad cerrada

### Que significa

La primera experiencia no debe sentirse como "explora el producto". Debe sentirse
como una tarea pequena y completa:

1. Lee o escucha una historia corta.
2. Termina esa historia.
3. Haz una practica breve basada en esa historia.
4. Vuelve al punto de continuidad.

### Fundamento

La diferencia entre usuarios que completan el ciclo y quienes no lo completan
es grande.

Sin compradores de libro:

| Segmento | Usuarios | D7+ rolling | D30+ rolling |
|---|---:|---:|---:|
| Todos | 72 | 15/55, 27.3% | 5/32, 15.6% |
| Practicaron | 30 | Mucho mas alto | Mucho mas alto |
| Sin practica | 42 | Mucho mas bajo | Mucho mas bajo |

En el corte general previo:

| Segmento | D7+ rolling |
|---|---:|
| Hicieron practica | 60.0% |
| No hicieron practica | 11.3% |

La lectura: la practica es el cierre del loop sticky. Si el usuario completa
historia pero no llega a practica, el producto deja el valor a medias.

### Acciones

1. Reducir friccion entre historia y practica:
   - CTA inmediato al terminar historia.
   - Practica breve por defecto.
   - Evitar que el usuario vuelva a una pantalla de exploracion antes de practicar.

2. Hacer visible el progreso:
   - estado de historia
   - tiempo restante aproximado
   - marca de "te falta la practica para cerrar el ciclo"

3. Medir el embudo con pasos separados:
   - `story_opened`
   - `audio_complete` o `journey_story_read`
   - `practice_session_started`
   - `practice_session_completed`

4. Reportar cada semana:
   - Primer Ciclo 24h
   - historia 24h sin practica
   - practica empezada pero no completada
   - Primer Ciclo eventual

### Metrica de exito

La metrica principal es Activacion de Primer Ciclo 24h.

Metricas secundarias:

| Metrica | Uso |
|---|---|
| Historia completada 24h | Detecta si el problema esta antes de practica. |
| Practica completada 24h | Detecta si el problema esta despues de historia. |
| Primer Ciclo eventual | Mide rescate tardio. |
| D7+ rolling de activados vs no activados | Valida que la metrica sigue prediciendo retencion. |

## Prioridad 3: promocionar como primera experiencia solo historias que ya convierten

### Que significa

No todas las historias deben tener el mismo derecho a ser primer contacto. La
primera historia tiene una funcion de producto: debe llevar a completar y
practicar.

Una historia puede ser buena literariamente, pero mala como primera historia si
no cierra el ciclo.

### Fundamento

La exposicion sesga mucho los datos. Las primeras historias se leen mas porque
estan primeras, no necesariamente porque son mejores. Por eso conviene evaluar
historias por conversion condicionada:

- usuarios unicos expuestos
- completaron historia
- completaron practica
- tocaron vocabulario
- volvieron despues
- activacion cuando fue primera historia

Candidatas fuertes con datos actuales:

| Historia | Usuarios | First-story activation | Completion | Practice | Return |
|---|---:|---:|---:|---:|---:|
| `la-macchinetta-gialla` | 4 | 3/3 | 100% | 100% | 100% |
| `duas-moedas-para-copacabana` | 5 | 2/3 | 80% | 80% | 80% |
| `marta-ensena-el-retiro` | 9 | 4/5 | 77.8% | 55.6% | 88.9% |
| `la-promesa-del-mole` | 6 | 4/4 | 83.3% | 66.7% | 66.7% |
| `le-toca-a-mateo` | 12 | 5/8 | 66.7% | 33.3% | 66.7% |

Historias sospechosas como primer contacto:

| Historia | Usuarios | First-story activation | Completion |
|---|---:|---:|---:|
| `la-leyenda-del-mohan` | 4 | 0/3 | 0% |
| `la-gondola-sussurrante` | 3 | 1/2 | 0% |
| `asado-y-misterio-en-la-costanera` | 3 | 0/2 | 0% |

### Acciones

1. Crear una lista de historias aprobadas para primer contacto.

2. Sacar del primer contacto las historias con baja conversion hasta revisarlas.

3. Para cada idioma o variante, elegir una historia inicial por defecto que
maximice:
   - completion rate
   - practice rate
   - first-story activation

4. Revisar manualmente las historias sospechosas:
   - longitud
   - dificultad
   - inicio narrativo
   - claridad del audio
   - densidad de vocabulario
   - si la practica generada corresponde bien a la historia

### Metrica de exito

Cada historia candidata para primer contacto debe medirse con:

| Campo | Minimo recomendado para decidir |
|---|---:|
| Usuarios unicos | 5 o mas |
| First-story activation | 50% o mas |
| Completion rate | 65% o mas |
| Practice rate | 50% o mas |

Hasta que haya mas muestra, las decisiones deben tratarse como apuestas
reversibles, no como verdades definitivas.

## Orden de ejecucion recomendado

1. Primero, auditar y cerrar el primer aterrizaje.
2. Segundo, reforzar el flujo historia terminada a practica terminada.
3. Tercero, controlar que historias pueden ser primer contacto.

La tesis de producto queda asi:

> Digital Polyglot se vuelve sticky cuando el usuario termina una historia y
> una practica en la primera sesion. Todo lo que no empuje a ese ciclo debe
> esperar.

## Riesgos y limites del analisis

- La muestra es pequena.
- No hubo experimento controlado.
- Algunas plataformas quedaron como `unknown`.
- La alta real deberia venir de Clerk; aqui se uso primera senal en
  `UserMetric` como proxy.
- Las historias primeras tienen sesgo de posicion.
- Las tasas por historia pueden cambiar mucho con pocos usuarios nuevos.

Por eso, la ejecucion debe hacerse con instrumentacion semanal y comparacion
antes/despues.

