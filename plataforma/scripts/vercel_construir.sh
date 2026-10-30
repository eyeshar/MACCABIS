#!/bin/sh
# Ignored Build Step de Vercel (D149). Vercel lo ejecuta en la Root Directory (plataforma/) antes de construir:
# salir con 0 = no construir, con 1 = construir. Ante cualquier duda (sin historia, error de git) construye.
# Compara contra el ultimo commit desplegado bien de esta rama (VERCEL_GIT_PREVIOUS_SHA): asi un push con varios
# commits no se salta los de antes del ultimo. Si no lo hay, contra HEAD^1, el primer padre: en un merge --no-ff a
# main es el main anterior, y el diff recoge toda la rama mergeada. Si el desplegado no esta en el clon (Vercel
# clona con poca historia), construye: no se puede saber que cambio entre medias.
BASE="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -n "$BASE" ]; then
  git cat-file -e "$BASE^{commit}" 2>/dev/null || { echo "$BASE no esta en el clon: se construye"; exit 1; }
else
  BASE=$(git rev-parse --verify -q HEAD^1) || { echo "Sin commit anterior a mano: se construye"; exit 1; }
fi
if git diff --quiet "$BASE" HEAD -- .; then
  echo "Nada cambia en plataforma/ desde $BASE: no se construye"
  exit 0
fi
echo "Hay cambios en plataforma/ desde $BASE: se construye"
exit 1
