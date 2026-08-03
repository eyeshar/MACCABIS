# Estadísticas Maccabis

Panel de estadísticas del club Maccabis (JDM Distrito Moratalaz), temporada a temporada.

## Cómo se ve
Abre la URL de GitHub Pages. El panel tiene pestañas de Equipo, Jugadores, Ficha de jugador,
Rankings, Por cuartos, Asistencia y MdA, con selector de temporada arriba.

Hay **11 temporadas**: de 2013/14 a 2025/26 (no existen datos de 16/17 ni de 22/23).
Cada temporada muestra **sólo las métricas que la liga registraba ese año**: antes de
2023/24 no hay minutos, y nunca hubo valoración, +/−, intentos de tiro de campo, fechas
ni parciales por cuarto del MdL. Esas columnas y pestañas no se pintan vacías: se ocultan.

Puedes enlazar a una temporada y pestaña concretas: `index.html?t=2013-14&p=jugadores`.

## Estructura del repositorio
- `index.html` — el panel (código; no se toca salvo mejoras de diseño).
- `data/index.json` — lista de temporadas disponibles.
- `data/season_AAAA-AA.json` — los datos de cada temporada.
- `data/diccionario_nombres.json` — mote → persona, por temporada. **Generado**, no editar a mano:
  la fuente de verdad es `docs/DICCIONARIO_NOMBRES_maccabis.md`.
- `scripts/` — utilidades para generar los JSON desde los Excel.
- `docs/INFORME_HISTORICO.md` — informe de generación del histórico, con las incidencias.

## Regenerar el histórico (2013/14 – 2024/25)

```bash
npm install
npm run build:datos          # busca los Excel en ~/Downloads
npm run historico -- --src "ruta/a/los/excel"
```

`build:datos` reconstruye el diccionario desde el `.md` y vuelve a generar las 10
temporadas históricas. Es idempotente: si sólo cambias el diccionario, basta con
relanzarlo. Los Excel de origen **no** están en el repositorio.

## Cómo añadir partidos / una temporada nueva
1. Exporta de la app **Afición FBM** las hojas de estadística de cada partido (XLSX).
2. Exporta de **SportEasy** el Excel de asistencia (partidos y entrenamientos).
3. Descarga las **actas PDF** de los partidos (para los parciales por cuarto).
4. Genera el JSON de la temporada con el script (o pídelo actualizado).
5. Sube el nuevo `data/season_AAAA-AA.json` y, si es temporada nueva, añádela a `data/index.json`.
6. GitHub Pages se actualiza solo en 1-2 minutos.

## Publicado en GitHub Pages

**https://eyeshar.github.io/MACCABIS/**

Se sirve desde la rama `main`, carpeta raíz del repositorio `eyeshar/MACCABIS`.
Cada push a `main` redespliega solo en 1-2 minutos. Como es una web estática que
lee los JSON por `fetch`, para actualizar datos basta con subir el
`data/season_AAAA-AA.json` correspondiente.

## Notas de datos
- Columnas siempre a cero (rebotes, asistencias, robos…) se descartan porque la liga no las registra.
- Todos los puntos están verificados contra el marcador de cada acta.
- **Con minutos** (23/24 en adelante): las medias se calculan sólo sobre partidos con minutos jugados (los DNP no cuentan).
- **Sin minutos** (13/14 – 22/23): las medias son por partido jugado; los "NJ" (No Jugó) cuentan como convocatoria pero no entran en el denominador.
- Las canastas de 2 de las temporadas antiguas son **derivadas**: `(PTS − 3·3P − TL anotados) / 2`. No hay intentos de tiro de campo en la fuente.
- Las filas "No identificado" y "Sin catalgar" de un boxscore son puntos que constan en el acta pero que no se pueden atribuir a una persona. Cuentan para el marcador del equipo; nunca para rankings ni fichas individuales.
- Algunos partidos aparecen marcados como **"sin stats"**: el marcador consta, pero no se conserva la estadística individual. No se ha inventado ninguna.
