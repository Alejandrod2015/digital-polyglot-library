#!/bin/bash
# -- Cola del lote --------------------------------------------------------
# Un commit que tiene que ir en el SIGUIENTE push a main, lo haga el chat que
# lo haga, se apunta como ref compartida (las refs viven en el .git comun, asi
# que todos los worktrees la ven):
#
#     git update-ref refs/lote/<nombre> <sha>
#
# Este gate corre en cada push a main y BLOQUEA si alguna entrada de la cola
# no va en lo que se sube. Cuando va (por merge, que conserva el sha, o por
# cherry-pick, que se reconoce por patch-id), la entrada se borra sola. Asi un
# chat puede cerrarse con su trabajo commiteado sin depender de que alguien
# se acuerde de traerlo.
#
# Uso: lote-pendiente.sh <sha local que se sube a main>
# Salida 0 si la cola esta vacia o todo va incluido; 1 si falta algo.

LOCAL_SHA="$1"
[ -z "$LOCAL_SHA" ] && exit 0

# patch-id de cada commit que sube y no esta en origin/main, para reconocer
# los cherry-picks (cambian de sha, no de parche).
UPSTREAM=$(git rev-parse -q --verify origin/main 2>/dev/null)
if [ -n "$UPSTREAM" ]; then
  RANGE="$UPSTREAM..$LOCAL_SHA"
else
  RANGE="$LOCAL_SHA"
fi
INCLUDED_IDS=$(git log -p --format=%H "$RANGE" 2>/dev/null | git patch-id --stable | cut -d' ' -f1)

MISSING=""
for ref in $(git for-each-ref --format='%(refname)' refs/lote/); do
  sha=$(git rev-parse "$ref")
  # Ya subido: fuera de la cola.
  if [ -n "$UPSTREAM" ] && git merge-base --is-ancestor "$sha" "$UPSTREAM" 2>/dev/null; then
    git update-ref -d "$ref"
    continue
  fi
  # Va en este push tal cual (merge o la misma rama).
  if git merge-base --is-ancestor "$sha" "$LOCAL_SHA" 2>/dev/null; then
    git update-ref -d "$ref"
    continue
  fi
  # Va en este push como cherry-pick.
  want=$(git show "$sha" | git patch-id --stable | cut -d' ' -f1)
  if [ -n "$want" ] && printf '%s\n' "$INCLUDED_IDS" | grep -qx "$want"; then
    git update-ref -d "$ref"
    continue
  fi
  MISSING="$MISSING
      $ref
        $sha  $(git log -1 --format=%s "$sha")
        traer con:  git cherry-pick $sha"
done

[ -z "$MISSING" ] && exit 0

cat >&2 <<EOM

══════════════════════════════════════════════════════════════════════
  PUSH HELD: hay trabajo en la cola del lote que no va en este push

  Otro chat dejo estos commits listos para que se los llevara el
  siguiente push a main, y este push no los incluye:
$MISSING

  Traelos (cherry-pick o merge) y vuelve a pushear. Para sacar uno de la
  cola a proposito:  git update-ref -d <ref>
══════════════════════════════════════════════════════════════════════

EOM
exit 1
