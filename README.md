# Estadísticas Maccabis

Panel de estadísticas del club Maccabis (JDM Distrito Moratalaz), temporada a temporada.

## Cómo se ve
Abre la URL de GitHub Pages. El panel tiene pestañas de Equipo, Jugadores, Ficha de jugador,
Rankings, Por cuartos y Asistencia, con selector de temporada arriba.

## Estructura del repositorio
- `index.html` — el panel (código; no se toca salvo mejoras de diseño).
- `data/index.json` — lista de temporadas disponibles.
- `data/season_AAAA-AA.json` — los datos de cada temporada.
- `scripts/` — utilidades para generar el JSON de una temporada nueva desde los Excel.

## Cómo añadir partidos / una temporada nueva
1. Exporta de la app **Afición FBM** las hojas de estadística de cada partido (XLSX).
2. Exporta de **SportEasy** el Excel de asistencia (partidos y entrenamientos).
3. Descarga las **actas PDF** de los partidos (para los parciales por cuarto).
4. Genera el JSON de la temporada con el script (o pídelo actualizado).
5. Sube el nuevo `data/season_AAAA-AA.json` y, si es temporada nueva, añádela a `data/index.json`.
6. GitHub Pages se actualiza solo en 1-2 minutos.

## Publicar en GitHub Pages
1. Crea un repositorio (por ejemplo `maccabis-stats`).
2. Sube estos archivos (index.html, carpeta data, carpeta scripts, README).
3. En Settings → Pages → Source, elige la rama `main` y carpeta `/root`.
4. Tu URL será `https://TU_USUARIO.github.io/maccabis-stats/`.

## Notas de datos
- Las medias se calculan solo sobre partidos con minutos jugados (los DNP no cuentan).
- Columnas siempre a cero (rebotes, asistencias, robos…) se descartan porque la liga no las registra.
- Todos los puntos están verificados contra el marcador de cada acta.
