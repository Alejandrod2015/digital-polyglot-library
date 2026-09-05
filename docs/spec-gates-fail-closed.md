# Spec: gates que fallan en cerrado (puntos 1 y 2 del diagnostico 2026-09-05)

Objetivo comun: que ninguna regla pueda saltarse por AUSENCIA de algo (un
fichero sin integrar, una memoria que no se autodeclara dura). Hoy el sistema
falla en abierto en las dos capas; este spec lo invierte.

Contexto medido (2026-09-05, worktree angry-lovelace):

- `pre-push` corre 9 lints y los 9 van envueltos en `if [ -f scripts/X.ts ]`:
  si el fichero no existe, el push pasa sin aviso. Caso real vivo:
  `scripts/checkGlossMoods.ts` sigue fuera de `origin/main` hoy; todo push
  desde un checkout de main se salta ese candado en silencio.
- El hook NO esta versionado: vive solo en `.git/hooks/pre-push` del repo
  principal (`core.hooksPath` apunta ahi). Un clon nuevo no tiene ninguno.
- `lint:hard-rules` solo ve las memorias que se AUTODECLARAN duras
  ("regla dura", "hard rule", "BLOQUEANTE"): 24 de 335. Con el criterio real
  (NUNCA, NEVER, JAMAS, prohibido) entran 179; de esas, 49 nombran su red,
  10 confiesan no tenerla y 120 callan o mienten (117 en silencio y 3
  nombrando enforcement que no existe: `project_mobile_auth_bug`,
  `project_tts_qa_auto_ear`, `project_vocab_multiword_render`).

## Punto 1: pre-push falla en cerrado

### 1a. Versionar el hook

- Crear `scripts/git-hooks/pre-push` con el contenido actual del hook (mas los
  cambios de 1b y 1c) y commitearlo.
- Apuntar git ahi: `git config core.hooksPath scripts/git-hooks`. Documentar
  el comando en `.claude/CLAUDE.md` (seccion del guard) para clones nuevos.
- El fichero de `.git/hooks/pre-push` queda como copia muerta; sustituirlo por
  dos lineas que ejecuten el versionado, por si algun entorno ignora
  `hooksPath`:

      #!/bin/sh
      exec "$(git rev-parse --show-toplevel)/scripts/git-hooks/pre-push" "$@"

### 1b. Manifiesto de lints, y ausencia = bloqueo

Sustituir los 9 bloques `if [ -f scripts/X.ts ]` por un manifiesto unico al
principio del hook y un bucle:

    # Un lint por linea: script | necesita (db, memoria o nada)
    LINTS="
    checkNoEmDash        -
    checkNoEmojis        -
    checkVoicesPublished db
    checkKaraokeFresh    db
    checkGlossContext    db
    checkGlossesReviewed db
    checkHardRules       memoria
    checkGlossMoods      db
    checkGlossVariants   db
    "

Reglas del bucle:

1. Si `scripts/<lint>.ts` NO existe: push BLOQUEADO con mensaje explicito
   ("el candado <lint> no esta en este arbol; esta en una rama sin integrar o
   se borro; integralo o quitalo del manifiesto en un commit visible").
   Sin variable de escape: quitar un lint exige editar el manifiesto, que es
   un cambio versionado que el usuario ve en el diff.
2. Si existe y falla: push bloqueado (comportamiento actual), conservando los
   mensajes de remedio que ya tiene cada bloque.
3. Si existe y no puede correr (sin base de datos, sin memoria): eso es un
   FALLO, no un salto. `checkHardRules` ya trata "no encuentro la memoria"
   como error; los lints con `db` deben hacer lo mismo si Prisma no conecta.

### 1c. Trinquete de enrolamiento

Nuevo paso en el hook, antes del bucle: comparar los `lint:*` de
`package.json` contra el manifiesto. Todo `lint:*` que no este ni en el
manifiesto ni en la lista de exclusiones documentada
(`lint:no-emdash:db` corre a demanda porque barre toda la base) bloquea el
push. Con esto, escribir un lint nuevo y no engancharlo tambien falla en
cerrado, que es exactamente como nacio el agujero de `checkGlossMoods`.

### Criterios de aceptacion

- `mv scripts/checkGlossVariants.ts /tmp && git push` (dry) bloquea con el
  mensaje de lint ausente; restaurar y vuelve a pasar.
- Anadir `"lint:prueba": "echo x"` a package.json bloquea por enrolamiento.
- Un clon limpio con `core.hooksPath` configurado ejecuta el hook versionado.
- `.git/push-audit.log` sigue registrando cada push.

## Punto 2: checkHardRules ve todas las reglas duras

### 2a. Ensanchar DURA

En `scripts/checkHardRules.ts`:

    const DURA = /regla dura|hard rule|BLOQUEANTE|\bNUNCA\b|\bNEVER\b|\bJAM[AA]S\b|prohibid/i;

(con la A acentuada en el rango; se escribe aqui sin tilde por el propio lint
de este documento). Cobertura pasa de 24 a 179 memorias. No se toca la
logica de ventanas ni la de fantasmas, que ya funcionan.

### 2b. Linea base, como el trinquete de emojis

Con 120 memorias fallando, el lint no puede bloquear pushes desde el dia uno
sin parar el proyecto. Copiar el patron de `checkNoEmojis`:

- `scripts/hard-rules-baseline.json`: la lista de las memorias que fallan hoy,
  generada una vez con `--generar-base`.
- Una memoria de la base que siga fallando NO bloquea; una memoria NUEVA que
  falle, o una de la base cuyo motivo EMPEORE (pasa de silencio a fantasma),
  bloquea.
- `--apretar` reescribe la base quitando las ya arregladas; nunca anade.
- La salida imprime siempre el tamano de la deuda: "quedan N de 120".

### 2c. Saldar la deuda

Sesiones de edicion de memoria, por tandas de una seccion de MEMORY.md por
vez. Para cada memoria de la base, una de tres salidas, en este orden de
preferencia:

1. Nombrar el check que YA existe (muchas de las 117 tienen red y no la
   citan; cruzar contra los 88 checks implementados y los 9 lints).
2. Confesar "sin gate" con la frase que `ADMITE_SIN_GATE` reconoce.
3. Si la regla es gateable y el hueco duele (las 7 filas "none" de
   `docs/story-rules.json` son las candidatas), abrir fila en el inventario,
   lo que obliga a escribir su check por `journey-rules-inventory`.

Los 3 fantasmas se arreglan en la primera tanda: o el enforcement citado se
integra desde su rama, o la memoria deja de prometerlo.

### Criterios de aceptacion

- `npm run lint:hard-rules` reporta 179 en alcance y "quedan N de 120".
- Una memoria nueva con NUNCA y sin red bloquea aunque no diga BLOQUEANTE.
- `--apretar` reduce la base y el numero nunca sube en un push que pasa.

## Orden de ejecucion

1. 1a y 1b juntos (un commit: hook versionado y en cerrado).
2. 2a y 2b juntos (un commit: lint ensanchado con linea base; el push no se
   rompe porque la deuda queda en la base).
3. 1c (un commit corto).
4. 2c en tandas, sin plazo: el trinquete garantiza que solo baja.

## Activacion (tras el merge a main)

El hook versionado NO se activa en la rama que lo introduce. Mientras
`scripts/git-hooks/pre-push` solo exista aqui, un checkout de `main` no lo
tiene, y el shim (que ejecuta ese fichero) haria fallar TODOS los pushes
legitimos desde main. Primero se fusiona; despues se activa.

Una vez esta rama esta en `main`, dos comandos, en este orden:

    git config core.hooksPath scripts/git-hooks

    printf '#!/bin/sh\nexec "$(git rev-parse --show-toplevel)/scripts/git-hooks/pre-push" "$@"\n' > .git/hooks/pre-push && chmod +x .git/hooks/pre-push

El primero apunta git al hook versionado (es la via normal). El segundo deja
`.git/hooks/pre-push` como shim de dos lineas hacia el mismo fichero, por si
algun entorno ignora `hooksPath`; sustituye la copia muerta que hay hoy ahi.

Comprobacion, desde un checkout de main con el hook ya presente:

    echo "refs/heads/x sha refs/heads/main sha" | DPL_PUSH_AUTHORIZED=1 .git/hooks/pre-push origin url

Debe correr los 9 candados del manifiesto. Un clon nuevo solo necesita el
primer comando.
