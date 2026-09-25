# Procedimiento de cada jornada (actas y estadísticas)

_Una página. Primera vez: la jornada 1 se juega el domingo 4/10/2026 y se procesa el lunes 5/10._

## Lo que haces tú (5 minutos, el lunes)

1. Abre la app **Afición FBM** y busca los dos partidos del domingo (MdA y MdL).
2. De **cada** partido descarga dos cosas:
   - el **acta** (PDF, se llama `Acta-Partido-<número>.pdf`);
   - la **hoja de estadística** (Excel, se llama `estadisticaPartido_…xlsx`).
   En total, **4 ficheros** si jugaron los dos equipos.
3. **No les cambies el nombre.** Déjalos en la carpeta **Descargas** del ordenador
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

## Si pasa algo

- **Falta una hoja** (p. ej. una incomparecencia): el partido cuenta, sin estadísticas por jugador. Te lo digo.
- **Un nombre nuevo que no reconozco**: te pregunto quién es antes de publicar.
- **Descargaste dos veces el mismo fichero** (`(1)` en el nombre): no pasa nada, detecto los duplicados.

## Importante antes del 5/10

La herramienta (`npm run jornada`) está en la rama `feat/pipeline-estadisticas`, **todavía sin
pasar a `main`**. Su prueba de regresión con toda la 2025/26 da "RESULTADO: OK" (comprobado el
26/09/2026). Para la jornada 1 hace falta que me digas "mergea el pipeline" antes del lunes 5/10.
