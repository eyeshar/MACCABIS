# MIGRACIÓN DE LA WEB PÚBLICA — inventario y plan (D76)

> 06/10/2026, bloque «Unificación web (paso 1 del rediseño)». Una sola web en `maccabis.vercel.app`: la portada nueva
> ya vive en la plataforma (Next.js). Las secciones de la web de estadísticas de GitHub Pages
> (`https://eyeshar.github.io/MACCABIS/`, `index.html` + `data/`) **siguen funcionando sin cambios** y el menú nuevo
> enlaza a ellas hasta que se migren. **Actualizado el 01/11/2026: migración terminada (ver «Estado»).**

## Estado a 01/11/2026: migración TERMINADA

> Revisado el 01/11/2026 (bloque de Iván del 31/10, apartado F). Este documento decía «pendiente de migrar» para Liga,
> Plantilla e Historia, pero **las diez pestañas de GitHub Pages están migradas desde el 07/10/2026** (D91, D92, D93) y
> **las redirecciones están activas y la barra «← Volver a Maccabis» retirada** desde el OK final de Iván (commit
> `7a9b041`, ESTADO). No queda ninguna sección por migrar en el siguiente bloque; lo que sigue abierto está abajo.

| Pestaña de GitHub Pages (`?p=`) | Página en la web nueva | Decisión | Menú / enlaces |
|---|---|---|---|
| `liga` (Liga 26/27) | `/liga` (`?g=`, `?hoy=`) | D91 | Cabecera «Liga» (con y sin sesión) |
| `equipo` | `/liga/<temporada>/equipo` (`?eq=MDA\|MDL`) | D91 | Liga → «Estadísticas por temporada» |
| `jugadores` | `/plantilla?t=` (`/liga/<t>/jugadores` redirige ahí) | D91, D92 | Cabecera «Plantilla» (sin sesión) |
| `jugador` (Ficha) | `/jugador/<person_id>?t=` | D92 | Cada nombre de Plantilla, Rankings e Historia; «Mis números» (con sesión) |
| `rankings`, `cuartos` | `/liga/<t>/rankings`, `/liga/<t>/cuartos` | D91 | Pestañas de la temporada |
| `rivales` (Rivales 26/27) | `/liga/rivales` (`?g=`, `?r=`) | D91 | Liga → «Rivales 26/27» |
| `historia` (El Club) | `/historia` (`?persona=`) | D93 | Cabecera «Historia» |
| `mda` | `/liga/<t>/mda` | D91 | Pestañas de 23/24 y 24/25 |
| `asistencia` | `/liga/<t>/asistencia` | D91, D82 | Pestañas de 25/26 y 26/27 |

- **Redirecciones:** `data/redireccion_web.js` con `ESTA_ACTIVA = true` y las diez pestañas en `MIGRADAS`: cualquier URL
  antigua (`?t=`, `#2013-14`, `?p=`, `?j=`) salta a su página nueva. Se deshace con `git revert 7a9b041`
  (`docs/ACTIVAR_REDIRECCIONES.md`). Pruebas: `pruebas:activacion` y `pruebas:cuadre` (12 temporadas, mismos números que
  GitHub Pages).
- **Menú** (`plataforma/src/lib/web.ts`): `MENU` (sin sesión: Inicio, Partidos, Liga, Plantilla, Historia, El club) y
  `MENU_SESION` (Inicio, Agenda, Mis números, Liga, Historia) ya solo tienen rutas de la web nueva. Desde D162, con sesión,
  la Liga añade «Scouting rivales» y «Liga consolidada» (datos por jugador de terceros: nunca sin sesión).
- **P1 (privacidad, D82, D46):** ninguna página pública publica por jugador las ausencias «con excusa», «sin excusa»,
  «no convocado» ni «lesión»: la pestaña Asistencia y los `season_*.json` públicos solo llevan `{fueron, total, pct}`; los
  motivos viven en Supabase (`asistencia_motivos`, solo gestores, «Asistencia y motivos» de Gestión). Lo vigilan
  `npm run test:privacidad` (datos, código y HTML renderizado de las páginas migradas) y `pruebas:privacidad`.

### Lo que queda (no es migrar secciones)

1. **Retirar GitHub Pages del todo** (decide Iván): hoy `index.html` + `data/` siguen publicados solo para redirigir; los
   ficheros de `data/` siguen siendo públicos porque el repositorio lo es. Retirarla = desactivar Pages en GitHub; las
   URL antiguas dejarían de redirigir (404). Recomendación: mantenerla redirigiendo hasta final de temporada.
2. **`index.html` aún lee `data/calendario_2026-27.json`** para su pestaña Liga (solo si alguien desactivase la
   redirección): es la copia generada de la tabla de eventos (D151), no una fuente.
3. **P4–P6** de la tabla de abajo siguen como estaban (baja severidad).

## Histórico: el plan de 06/10/2026

_Lo que sigue es el inventario y el plan con el que se hizo la migración; se conserva como referencia._

### Qué había en la web nueva el 06/10/2026

| Pieza | Dónde | Datos |
|---|---|---|
| Portada `/` (héroe, próxima jornada con aviso de equipación, últimos resultados, clasificación G1/G2 top 5, líderes Maccabis, calendario con entrenos y filtros, historia, pie) | `plataforma/src/app/page.tsx` | `src/data/` (copias de `data/`, `npm run datos:sync`) |
| Feed iCal `/calendario.ics` (partidos y entrenos, sin datos personales) | `plataforma/src/app/calendario.ics/route.ts` | ídem |
| Acceso `/entrar`, Mi zona, Gestión con el aspecto nuevo | `plataforma/src/app/...` | Supabase (con sesión) + `src/data/` |
| Privacidad `/privacidad` | `plataforma/src/app/privacidad/page.tsx` | — |

### Inventario de secciones de GitHub Pages (06/10/2026)

`index.html`: 1.217 líneas (≈240 de CSS y ≈835 de JS en un solo `<script>`), más `data/avisos_equipacion.js`. Las 7
pestañas de temporada viven en `initDashboard(D)` y comparten `applySeasonUI()`, que oculta columnas y pestañas según las
métricas que existían cada temporada (`D.metrics`). Parámetros comunes: `?t=<temporada>` (o `#2013-14`), `?p=<pestaña>`,
`?j=<person_id>` (abre la Ficha).

| Pestaña (`?p=`) | Qué muestra | Datos | Parámetros | Código | Esfuerzo |
|---|---|---|---|---|---|
| `equipo` | Balance, puntos a favor y en contra, diferencial, racha y tabla de partidos ordenable con boxscore desplegable; filtros MdA/MdL/combinado y liga/playoff | `index.json`, `season_<t>.json` (`partidos`, `box`) | `t` | ≈50 líneas densas (`renderTeam`, `toggleBox`) | **M** (boxscore y columnas que cambian por temporada) |
| `jugadores` | Tabla de la plantilla ordenable (PJ, Pts, %, VAL, +/-), filtro de equipo y mínimo de partidos | `season_<t>.json` (`players`) | `t` | ≈22 líneas + `hideCols` | **S** |
| `jugador` (Ficha) | Dorsal, indicadores, desglose de tiro y partido a partido | `season_<t>.json` (`players[].games`) | `t`, `j` | ≈50 líneas (`renderCard`, `__abrirFichaJugador`) | **M** (enlace directo y salto desde El Club) |
| `rankings` | Top 5/10 por métrica con barras | `season_<t>.json` | `t` | ≈7 líneas densas | **S** |
| `cuartos` | Puntos a favor y en contra de media por cuarto | `season_<t>.json` (`qstats`) | `t` | ≈4 líneas densas | **S** |
| `asistencia` | Por jugador: fueron, con excusa, no convocado, lesión, % disponible, % jugados, % no seleccionado (partidos y entrenos); solo 25/26 y 26/27 | `season_<t>.json` (`asist_part`, `asist_entr`) | `t` | ≈33 líneas | **S**, pero **decidir antes qué se publica** (hallazgo P1) |
| `mda` | Resumen MdA desde la hoja de Carlos (23/24 y 24/25), anomalías marcadas «?» | `season_<t>.json` (`mda_resumen`) | `t` | ≈35 líneas | **S/M** (histórico, poco uso) |
| `historia` (El Club) | Rejilla de personas por temporada 2013→26/27, altas y bajas, buscador, orden, ficha modal que salta a estadísticas | `personas.json`, `historia_club.json`, `index.json` | — | ≈215 líneas | **L** (tabla ancha, modal, dos vistas; depende de la Ficha) |
| `rivales` (Rivales 26/27) | Lo esencial del grupo, tarjetas de rivales (puesto 25/26, cara a cara), ficha modal con gráfico SVG | `rivales_2026-27_web.json`, `equipaciones` | `g`, `r` | ≈157 líneas | **M** (modal y SVG propios) |
| `liga` (Liga 26/27) | Próximos partidos con aviso de equipación, clasificación calculada, resultados por jornada, ficha por equipo | `liga_2026-27.json`, `calendario_2026-27.json`, `equipaciones_2026-27.json`, `avisos_equipacion.js` | `g`, `hoy` | ≈110 líneas + módulo de avisos | **M** (el módulo de avisos ya lo usa la plataforma) |

Ficheros de `data/` que la web **no lee** pero son públicos (repositorio público): `fichas_inscripcion.json`,
`diccionario_nombres.json`, `rivales_2026-27.json`, `rivales_jdm.json`.

### Orden de migración propuesto (06/10/2026; hecho: D91–D93)

| # | Sección | Por qué en este orden | Esfuerzo |
|---|---|---|---|
| 1 | **Liga 26/27** | Lo que más miran los jugadores en temporada; la portada ya tiene la mitad (clasificación, resultados, avisos) y el módulo de avisos es común. | M (≈1 sesión) |
| 2 | **Núcleo de temporada: Equipo, Jugadores y Ficha** | Construye la capa común (carga de `season_<t>`, selector de temporada, métricas por temporada) de la que dependen las demás. Enlace de Mi zona «Ver tu ficha completa». | M+M+S (≈2 sesiones) |
| 3 | **Rankings y Por cuartos** | Casi gratis con el núcleo hecho. | S (≈½ sesión) |
| 4 | **Rivales 26/27** | Independiente, útil en temporada; cuesta el modal y el SVG. | M (≈1 sesión) |
| 5 | **El Club (historia)** | La más grande y necesita la Ficha migrada. | L (≈2 sesiones) |
| 6 | **MdA (histórico)** | Poco uso. | S/M |
| 7 | **Asistencia** | Desde D82 ya solo publica asistidos, total y % (sin motivos); los motivos viven en Supabase, solo gestores. Migrarla es solo copiar la tabla. | S |

Al migrar cada sección: misma URL corta en la web nueva (p. ej. `/liga`, `/jugadores`, `/jugador/<person_id>`), el menú
deja de apuntar a GitHub Pages y la pestaña antigua redirige (o enlaza) a la nueva. GitHub Pages se mantiene hasta que
todo esté migrado.

## Revisión de privacidad de la web pública actual (06/10/2026)

**Sin hallazgos** de DNI, teléfonos, fechas de nacimiento, fechas de alta (D17), niveles, posiciones, «si dobla» o «si
entrena» (D39), jugadores o árbitros de otros equipos (D43/D73) en `data/`. `fichas_inscripcion.json` solo trae nombre y
`person_id` por año y equipo (cumple D17). Los ficheros de liga, calendario, equipaciones y rivales solo tienen datos por
equipo (cumple D73).

**Hallazgos** (06/10/2026; estado tras las respuestas de Iván de esa misma noche, D82):

| # | Qué | Dónde | Regla | ¿Se ve? | Severidad | Propuesta |
|---|---|---|---|---|---|---|
| **P1** | Ausencias por jugador **con motivo** («con excusa», «lesión», «no convocado», «sin excusa», «% no seleccionado») en ficheros públicos y en la pestaña Asistencia | `data/season_2025-26.json`, `season_2026-27.json` (`asist_part`/`asist_entr`) | D46 | — | Alta | **RESUELTO (D82):** los JSON públicos y la pestaña solo llevan `{fueron, total, pct}`; el detalle va a `privado/asistencia/` y a Supabase (`asistencia_motivos`, solo gestores; en real pendiente del OK). `npm run test:privacidad` y `npm run jornada` fallan si vuelve. Las versiones antiguas siguen en el historial de git. |
| **P2** | Correos personales de 3 jugadores | `docs/ESTADO.md` (bloque del 03/10/2026) | D17 / privacidad | No | Alta | Sustituidos por `<correo>` en la versión actual. **No se reescribe el historial de git**: decidido por Iván (D88). |
| P3 | Copia antigua del panel 25/26 con la asistencia embebida | `docs/dashboard-maccabis-25-26-v1.html` | D46 | — | Media | **RESUELTO:** borrado del repositorio (D82). |
| P4 | Recuentos de asistencia del resumen MdA (sin motivo) | `season_2023-24.json` y `2024-25` → `mda_resumen.jugadores[].asist_partidos/asist_entrenos`; pestaña MdA | D46, marginal | Sí | Baja | Aceptable; quitarlo junto a P1 si se quiere un criterio único. |
| P5 | Nota personal menor sobre un exjugador | `data/historia_club.json` → `personas[].nota` | — | No | Baja | Reducir la nota a «identificado por hoja de inscripción». |
| P6 | Ficheros internos de trabajo publicados sin uso en la web | `data/rivales_2026-27.json`, `data/diccionario_nombres.json` | — | No | Baja | Moverlos fuera de `data/` si la web no los necesita. |

La web nueva no hereda ninguno: la portada y `/club` solo usan datos por equipo, los líderes (puntos, triples, tiros libres) y las cifras de historia; Mi zona solo muestra al jugador sus propias estadísticas. Desde D82 la copia `src/data/temporada.json` tampoco lleva motivos de ausencia (lo comprueba `npm run test:privacidad`).