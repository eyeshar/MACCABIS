# Procedimiento de cada jornada (actas y estadísticas)

> **Liga completa (D73):** desde la J2 se bajan también las hojas de los partidos donde no jugamos (los dos grupos). `npm run jornada` las copia a `fuentes_fbm/2026-27/liga/` y regenera `data/liga_2026-27.json` (solo datos por equipo). Los datos por jugador de los rivales no se publican (ver `docs/RUTINAS/A_ACTAS.md`).
> **Después de `npm run jornada` (D73):** para ver los datos por jugador de los rivales en la zona de gestión (Scouting rivales, Liga consolidada), cargar en Supabase con `npm run db:liga` en `plataforma/` (reemplaza la temporada entera; valida antes que la suma por jugador sea el total del equipo). Los datos por jugador nunca van al repositorio ni a GitHub Pages. Tras un despliegue, `node pruebas/verificar_produccion.mjs` comprueba producción con un gestor temporal.

> **Portada de la web (D84):** `npm run jornada`, si la jornada cuadra, sincroniza también `plataforma/src/data/` (resultados, clasificación y líderes de la portada) y falla si un JSON público llevara motivos de ausencia (D82). Publicar = commit de `data/` y de `plataforma/src/data/`. Después: `npm run db:liga` y `npm run db:asistencia` en `plataforma/`.

_Una página. Primera vez: la jornada 1 se juega el domingo 4/10/2026 y se procesa el lunes 5/10._

## Lo que haces tú (5 minutos, el lunes)

1. Abre la app **Afición FBM** y busca los dos partidos del domingo (MdA y MdL).
2. De **cada** partido descarga dos cosas:
   - el **acta** (PDF, se llama `Acta-Partido-<número>.pdf`);
   - la **hoja de estadística** (Excel, se llama `estadisticaPartido_<fecha de descarga>.xlsx`; si bajas dos el mismo día, la segunda lleva " 1", "_1" o "(1)").
   En total, **4 ficheros** si jugaron los dos equipos.
3. **No les cambies el nombre.** El nombre de la hoja **no importa**: el equipo, el rival y si es local o visitante se leen del interior (cabecera "Estadísticas - X vs Y - ..."), y el partido se identifica con el calendario. Déjalos en la carpeta **Descargas** del ordenador
   (si los bajas en el móvil, pásalos a Descargas del PC como hagas siempre).
4. Opcional: el Excel de asistencia de SportEasy (`bilan_presence…xlsx`), también en Descargas.
5. Abre Claude Code en la carpeta del proyecto y pídeme: **"procesa la jornada N"**.

## Lo que hago yo

1. Ejecuto `npm run jornada`: busca en Descargas los ficheros **nuevos** de la 26/27 y los
   **copia** (nunca los mueve ni los pisa) a `fuentes_fbm/2026-27/`, que no se sube a internet.
2. Comprueba que los puntos de la hoja suman el marcador del acta y que los parciales cuadran.
   **Si algo no cuadra, no escribe nada** y te digo qué falta o qué falla.
3. Te enseño el resumen (resultado, anotadores, avisos) y, con tu visto bueno, publico
   las estadísticas en la web (`data/season_2026-27.json`).

## Si todavía no hay actas
Si la FBM no ha publicado el acta, `npm run jornada` publica el partido **solo con la hoja**, marcado "pend. acta" (excepción D71, solo 26/27). Cuando dejes el acta en Descargas y repitas `npm run jornada`, se completan parciales, hora y pista, y se valida el marcador; si no cuadra, para y avisa.

## Si pasa algo

- **Falta una hoja** (p. ej. una incomparecencia): el partido cuenta, sin estadísticas por jugador. Te lo digo.
- **Un nombre nuevo que no reconozco**: te pregunto quién es antes de publicar.
- **Descargaste dos veces el mismo fichero** (`(1)`, `_1` o " 1" en el nombre): no pasa nada, detecto los duplicados por contenido.
- **Dos partidos "Campeonato" sin equipo en SportEasy:** se asignan a MdA o MdL cruzando quién consta "A tiempo" con quién jugó en cada hoja; si no es inequívoco, para y pregunta.

## Estado

La herramienta (`npm run jornada`) está en `main` desde el 26/09/2026 (merge `f69a39f`) y su
prueba de regresión con toda la 2025/26 da "RESULTADO: OK". Lista para la jornada 1.
