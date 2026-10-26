# Procedimiento de cada jornada (actas y estadísticas)

> **Liga completa (D73):** desde la J2 se bajan también las hojas de los partidos donde no jugamos (los dos grupos). `npm run jornada` las copia a `fuentes_fbm/2026-27/liga/` y regenera `data/liga_2026-27.json` (solo datos por equipo). Los datos por jugador de los rivales no se publican (ver `docs/RUTINAS/A_ACTAS.md`).
> **Después de `npm run jornada` (D73):** para ver los datos por jugador de los rivales en la zona de gestión (Scouting rivales, Liga consolidada), cargar en Supabase con `npm run db:liga` en `plataforma/` (reemplaza la temporada entera; valida antes que la suma por jugador sea el total del equipo). Los datos por jugador nunca van al repositorio ni a GitHub Pages. Tras un despliegue, `node pruebas/verificar_produccion.mjs` comprueba producción con un gestor temporal.

> **Portada de la web (D84):** `npm run jornada`, si la jornada cuadra, sincroniza también `plataforma/src/data/` (resultados, clasificación y líderes de la portada) y falla si un JSON público llevara motivos de ausencia (D82). Publicar = commit de `data/` y de `plataforma/src/data/`. Después: `npm run db:liga` y `npm run db:asistencia` en `plataforma/`.

_Una página. Primera vez: la jornada 1 se juega el domingo 4/10/2026 y se procesa el lunes 5/10._

## Reparto desde el 24/10/2026: se publica solo si todo cuadra (D66)

- **Actas:** las baja Claude con la tarea programada «Maccabis · actas del lunes» (lunes y jueves, 8:00) desde gesdeportiva.fbm.es, en tu Chrome con la sesión iniciada.
- **Hojas de estadística:** las bajas tú desde la app **Afición FBM** del móvil (las nuestras y las de liga) y las dejas en Descargas del PC, sin renombrar.
- **Procesar y publicar:** `scripts/rutina_a_publicar.ps1`, desde el Programador de tareas de Windows (lunes y jueves, 13:00): `npm run jornada -- --no-interactivo`, pruebas, commit y push, `db:liga`, `db:asistencia` y `verificar_produccion`. Ante cualquier duda (nombre desconocido, hoja que no es de la jornada, acta que no cuadra, falta una hoja o un acta) **para sin publicar nada** y te avisa con una notificación de Windows («Rutina A parada: <motivo>»); si publica, «Jornada N publicada: MdA x–y Rival · Rival x–y MdL». Registro en `privado/registro_rutina_a.log`. Detalle en `docs/RUTINAS/A_ACTAS.md`.

Lo de abajo sigue valiendo para hacerlo a mano (o cuando la rutina para).

## Lo que haces tú (5 minutos, el lunes)

> **Reparto desde el 23/10/2026 (D106):** las **actas** se bajan de la web **gesdeportiva.fbm.es/clubes** (Competiciones → Resultados y actas; una cuenta ve MdA y MdL): tú inicias sesión en tu Chrome con la clave del gestor de contraseñas y Claude descarga desde ahí (nunca maneja la clave ni el «no soy un robot»). Las **hojas de estadística** (las nuestras y las de toda la liga, D73) siguen saliendo de la **app Afición FBM**, porque la web no las ofrece.

1. Deja la sesión de gesdeportiva.fbm.es/clubes iniciada en Chrome; Claude baja las **actas** de los dos partidos del domingo (PDF, `Acta-Partido-<número>.pdf`).
2. En la app **Afición FBM** descarga la **hoja de estadística** de cada partido (Excel, se llama `estadisticaPartido_<fecha de descarga>.xlsx`; si bajas dos el mismo día, la segunda lleva " 1", "_1" o "(1)") y las de los partidos de los dos grupos (`docs/RUTINAS/A_ACTAS.md`).
   En total, **4 ficheros nuestros** si jugaron los dos equipos, más las hojas de liga.
3. **No les cambies el nombre.** El nombre de la hoja **no importa**: el equipo, el rival y si es local o visitante se leen del interior (cabecera "Estadísticas - X vs Y - ..."), y el partido se identifica con el calendario. Déjalos en la carpeta **Descargas** del ordenador
   (si los bajas en el móvil, pásalos a Descargas del PC como hagas siempre).
4. Opcional: el Excel de asistencia de SportEasy (`bilan_presence…xlsx`), también en Descargas.
5. Abre Claude Code en la carpeta del proyecto y pídeme: **"procesa la jornada N"**.
6. Si en Descargas quedan hojas de jornadas anteriores, lo proceso desde una carpeta aparte con solo lo nuevo (`npm run jornada -- --desde <carpeta>`), como con la J2 y con las actas de J1 y J2.

## Lo que hago yo

1. Ejecuto `npm run jornada`: busca en Descargas los ficheros **nuevos** de la 26/27 y los
   **copia** (nunca los mueve ni los pisa) a `fuentes_fbm/2026-27/`, que no se sube a internet.
2. Comprueba que los puntos de la hoja suman el marcador del acta y que los parciales cuadran.
   **Si algo no cuadra, no escribe nada** y te digo qué falta o qué falla.
3. Te enseño el resumen (resultado, anotadores, avisos) y, con tu visto bueno, publico
   las estadísticas en la web (`data/season_2026-27.json`).

## Si todavía no hay actas
Si la FBM no ha publicado el acta, `npm run jornada` publica el partido **solo con la hoja**, marcado "pend. acta" (excepción D71, solo 26/27). Cuando el acta esté en Descargas y se repita `npm run jornada`, se completan parciales, hora y pista, y se valida el marcador; si no cuadra, para y avisa. Así se cerraron la J1 y la J2 el 23/10/2026 (4 actas, las 4 cuadran).

## Si pasa algo

- **Falta una hoja** (p. ej. una incomparecencia): el partido cuenta, sin estadísticas por jugador. Te lo digo.
- **Un nombre nuevo que no reconozco**: te pregunto quién es antes de publicar.
- **Descargaste dos veces el mismo fichero** (`(1)`, `_1` o " 1" en el nombre): no pasa nada, detecto los duplicados por contenido.
- **Quedan en Descargas hojas o actas de jornadas anteriores:** tampoco pasa nada. Antes de copiar, comparo el contenido de cada fichero con lo que ya hay en `fuentes_fbm/2026-27/` (hojas, liga, actas y asistencia) y descarto lo ya cargado diciendo dónde está. Y si una hoja no puede ser de la jornada a la que iría (nuestra hoja es de otra jornada según el calendario; una hoja de liga de un equipo que juega contra nosotros esa jornada, que ya tiene hoja de esa jornada, o descargada antes de que se jugara), **paro sin copiar nada** y te digo cuál y por qué (`npm run test:duplicados`).
- **Dos partidos "Campeonato" sin equipo en SportEasy:** se asignan a MdA o MdL cruzando quién consta "A tiempo" con quién jugó en cada hoja; si no es inequívoco, para y pregunta.

## Estado

La herramienta (`npm run jornada`) está en `main` desde el 26/09/2026 (merge `f69a39f`) y su
prueba de regresión con toda la 2025/26 da "RESULTADO: OK". Lista para la jornada 1.
Publicación automática (`scripts/rutina_a_publicar.ps1`, `--no-interactivo`): en `main` desde el 24/10/2026
(merge `65255e6` de `feat/rutina-a-auto`, aprobado por Iván). La tarea del Programador de tareas (lunes y jueves, 13:00)
la ejecuta desde la copia dedicada `Maccabis-rutina-a` (D114).
