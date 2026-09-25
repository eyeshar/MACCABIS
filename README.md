# Estadísticas Maccabis

Panel de estadísticas del club Maccabis (JDM Distrito Moratalaz), temporada a temporada.

## Cómo se ve
Abre la URL de GitHub Pages. El panel tiene pestañas de Equipo, Jugadores, Ficha de jugador,
Rankings, Por cuartos, Asistencia, MdA y **El Club**, con selector de temporada arriba.

Hay **11 temporadas**: de 2013/14 a 2025/26 (no existen datos de 16/17 ni de 22/23).
Cada temporada muestra **sólo las métricas que la liga registraba ese año**: antes de
2023/24 no hay minutos, y nunca hubo valoración, +/−, intentos de tiro de campo, fechas
ni parciales por cuarto del MdL. Esas columnas y pestañas no se pintan vacías: se ocultan.

La pestaña **El Club** es transversal a las temporadas: la rejilla de quién ha pasado por el club
(2013/14 → 25/26 más la 26/27 prevista), la evolución temporada a temporada con altas y bajas, y la
ficha de cada persona. Desde la ficha se salta a sus estadísticas del año que elijas.

Puedes enlazar a una temporada y pestaña concretas: `index.html?t=2013-14&p=jugadores`, y a la ficha
de una persona: `index.html?t=2023-24&p=jugador&j=villaescusa-silva-ivan`.

## Estructura del repositorio
- `index.html` — el panel (código; no se toca salvo mejoras de diseño).
- `data/index.json` — lista de temporadas disponibles.
- `data/season_AAAA-AA.json` — los datos de cada temporada.
- `data/personas.json` — **registro único de identidades del club**: fuente de verdad de los
  `person_id`. **Generado**, no editar a mano.
- `data/historia_club.json` — matriz de presencia: quién estuvo en el club cada temporada
  (2013→2026). Cerrado por Iván; referencia los `person_id` del registro.
- `data/diccionario_nombres.json` — mote → persona, por temporada y por ficha (MdL / MdA).
  **Generado**, no editar a mano: la fuente de verdad es `docs/DICCIONARIO_NOMBRES_maccabis.md`.
- `scripts/` — utilidades para generar los JSON desde los Excel.
- `docs/INFORME_HISTORICO.md` — informe de generación del histórico, con las incidencias.

## Identidad de las personas: un único `person_id`

Todo el proyecto identifica a cada persona por un **`person_id` canónico**, y `data/personas.json`
es la fuente de verdad de esos identificadores. El registro guarda **sólo identidad**
(id, nombre formal, display) y dos banderas de negocio:

- `es_entrenador` — Carlos Barreiro nunca jugó: queda fuera de cualquier ranking de jugador.
- `solo_mote` — persona real de paso sin nombre formal (Pupo, Eric, Alejandro). Se conserva
  en la historia del club, pero no tiene ficha de estadísticas.

Los dos lados del proyecto apuntan a ese mismo id y no duplican identidad:

| Qué | Dónde vive |
|---|---|
| Quién es cada persona | `data/personas.json` |
| En qué temporadas estuvo en el club | `data/historia_club.json` |
| Qué hizo en la cancha | `data/season_*.json` |

El id se deriva del nombre formal (`slug`: sin tildes, minúsculas, guiones). Cuando una misma
persona aparecía escrita de dos formas, se unificó a un id canónico y la escritura antigua queda
anotada en `alias_ids` para no repetir la reconciliación.

## Regenerar los datos

```bash
npm install
npm run build:datos          # diccionario + histórico + registro de personas
npm run historico -- --src "ruta/a/los/excel"   # por defecto, docs/estadisticas/ (fuera de git)
npm run check:personas       # sólo valida identidades y reglas; no escribe nada
```

`build:datos` reconstruye el diccionario desde el `.md`, regenera las 10 temporadas históricas
y vuelve a construir el registro de personas. Es idempotente: dos ejecuciones seguidas producen
exactamente los mismos ficheros. Los Excel de origen **no** están en el repositorio: viven en
`docs/estadisticas/`, que está en `.gitignore`.

`npm run fichas` falla (y no escribe nada) si falta el PDF de una hoja de inscripción ya registrada
o si un PDF con ese nombre ya es otra hoja. Las hojas cuyo PDF se perdió de verdad se congelan en
`docs/fichas_sin_pdf.json`. Para copiar ficheros a una carpeta de fuentes sin pisar nada:
`node scripts/lib/copia_segura.js <origen> <carpeta>`.

`check:personas` valida que todos los `person_id` de la Historia y de las estadísticas existan
en el registro, que `n_temporadas` cuadre con los años jugados y que 2026 (temporada 26/27,
prevista) no cuente como jugada. Devuelve código 1 si algo falla.

## Cómo añadir partidos (temporada 2026/27 en adelante)

Cada semana, después de la jornada:

1. En la app **Afición FBM**, descarga el **acta** (`Acta-Partido-<nº>.pdf`) y la **hoja de
   estadística** (`estadisticaPartido….xlsx`) de cada partido. No hace falta renombrarlas.
2. (Opcional) En **SportEasy**, Asistencias → balance → exportar (`bilan_presence….xlsx`).
3. Pide a Claude Code "procesar jornada", o ejecuta `npm run jornada`
   (`npm run jornada -- --desde <carpeta>` si no están en Descargas; `-- --dry` para simular).

El comando copia los ficheros nuevos a `fuentes_fbm/<temporada>/` (**fuera de git**: los ficheros
de la FBM nunca entran en el repositorio), valida que los puntos de cada hoja sumen el marcador del
acta y que los parciales sumen el resultado, regenera `data/season_<temporada>.json` y resume la
jornada. Si algo no cuadra, **no escribe nada**. Publicar es un paso aparte (commit y push de
`data/season_<temporada>.json` y `data/index.json`).

- Pipeline: `scripts/estadisticas/` (Node). Configuración por temporada en `temporadas.json`.
- `npm run test:regresion` comprueba que el pipeline reproduce la 2025/26 publicada.
- `npm run build:datos` incluye el paso `estadisticas` (sólo regenera las temporadas marcadas y
  sólo si sus ficheros están en este equipo; nunca deja una temporada con menos partidos o
  boxscores de los que tenía).
- Los scripts de Python `parse_stats.py`, `consolidate.py` y `generar_temporada.py` quedan como
  referencia histórica del pipeline de 2025/26; ya no se usan.
