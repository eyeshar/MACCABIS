# MIGRACIÓN DE LA WEB PÚBLICA — inventario y plan (D76)

> 06/10/2026, bloque «Unificación web (paso 1 del rediseño)». Una sola web en `maccabis.vercel.app`: la portada nueva
> ya vive en la plataforma (Next.js). Las secciones de la web de estadísticas de GitHub Pages
> (`https://eyeshar.github.io/MACCABIS/`, `index.html` + `data/`) **siguen funcionando sin cambios** y el menú nuevo
> enlaza a ellas hasta que se migren.

## Qué hay ya en la web nueva

| Pieza | Dónde | Datos |
|---|---|---|
| Portada `/` (héroe, próxima jornada con aviso de equipación, últimos resultados, clasificación G1/G2 top 5, líderes Maccabis, calendario con entrenos y filtros, historia, pie) | `plataforma/src/app/page.tsx` | `src/data/` (copias de `data/`, `npm run datos:sync`) |
| Feed iCal `/calendario.ics` (partidos y entrenos, sin datos personales) | `plataforma/src/app/calendario.ics/route.ts` | ídem |
| Acceso `/entrar`, Mi zona, Gestión con el aspecto nuevo | `plataforma/src/app/...` | Supabase (con sesión) + `src/data/` |
| Privacidad `/privacidad` | `plataforma/src/app/privacidad/page.tsx` | — |

## Menú nuevo → destino hoy

| Menú | Destino | Nota |
|---|---|---|
| Inicio | `/` | nuevo |
| Partidos | `/#calendario` | nuevo (calendario público) |
| Liga | GitHub Pages `?p=liga` | pendiente de migrar (orden 1) |
| Plantilla | GitHub Pages `?p=jugadores` | pendiente de migrar (orden 2) |
| Historia | GitHub Pages `?p=historia` (El Club) | pendiente de migrar (orden 5) |
| El club | `/#club` (pie) | queda pendiente una página «El club» con contenido propio (ver dudas) |

## Inventario de secciones de GitHub Pages

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

## Orden de migración propuesto

| # | Sección | Por qué en este orden | Esfuerzo |
|---|---|---|---|
| 1 | **Liga 26/27** | Lo que más miran los jugadores en temporada; la portada ya tiene la mitad (clasificación, resultados, avisos) y el módulo de avisos es común. | M (≈1 sesión) |
| 2 | **Núcleo de temporada: Equipo, Jugadores y Ficha** | Construye la capa común (carga de `season_<t>`, selector de temporada, métricas por temporada) de la que dependen las demás. Enlace de Mi zona «Ver tu ficha completa». | M+M+S (≈2 sesiones) |
| 3 | **Rankings y Por cuartos** | Casi gratis con el núcleo hecho. | S (≈½ sesión) |
| 4 | **Rivales 26/27** | Independiente, útil en temporada; cuesta el modal y el SVG. | M (≈1 sesión) |
| 5 | **El Club (historia)** | La más grande y necesita la Ficha migrada. | L (≈2 sesiones) |
| 6 | **MdA (histórico)** | Poco uso. | S/M |
| 7 | **Asistencia** | Solo cuando Iván decida qué se publica (P1); lo probable es llevarla a la zona con login o publicarla sin excusa ni lesión. | S |

Al migrar cada sección: misma URL corta en la web nueva (p. ej. `/liga`, `/jugadores`, `/jugador/<person_id>`), el menú
deja de apuntar a GitHub Pages y la pestaña antigua redirige (o enlaza) a la nueva. GitHub Pages se mantiene hasta que
todo esté migrado.

## Revisión de privacidad de la web pública actual (06/10/2026)

**Sin hallazgos** de DNI, teléfonos, fechas de nacimiento, fechas de alta (D17), niveles, posiciones, «si dobla» o «si
entrena» (D39), jugadores o árbitros de otros equipos (D43/D73) en `data/`. `fichas_inscripcion.json` solo trae nombre y
`person_id` por año y equipo (cumple D17). Los ficheros de liga, calendario, equipaciones y rivales solo tienen datos por
equipo (cumple D73).

**Hallazgos (señalados, no cambiados: en este paso no se reescriben las secciones públicas; decide Iván):**

| # | Qué | Dónde | Regla | ¿Se ve? | Severidad | Propuesta |
|---|---|---|---|---|---|---|
| **P1** | Ausencias por jugador **con motivo**: «con excusa», «lesión» (dato de salud), «no convocado», «% no seleccionado» | `data/season_2025-26.json` y `season_2026-27.json` → `players[].asist_part` / `asist_entr` (`excusa`, `lesion`, `no_conv`, `sin_excusa`, `pct_nosel`); pestaña **Asistencia** | D46 (los jugadores nunca ven motivos de ausencia) | **Sí**, con nombre | **Alta** | Quitar esos campos de los JSON públicos y de la tabla; como mucho dejar «fueron» y el %, o llevar la pestaña a la zona con login. |
| **P2** | Correos personales de 3 jugadores | `docs/ESTADO.md` (bloque del 03/10/2026, cambio de correo seguro) | D17 / privacidad | No se pinta, pero el repositorio es público | **Alta** | **Corregido en este bloque** en la versión actual (sustituidos por `<correo>`). Siguen en el historial de git: decidir si se reescribe el historial (`git filter-repo`) o se asume y se avisa a los afectados. |
| P3 | Copia antigua del panel 25/26 con la asistencia embebida | `docs/dashboard-maccabis-25-26-v1.html` | D46 | Solo si alguien abre esa URL de Pages | Media | Borrarlo del repositorio o regenerarlo sin asistencia. |
| P4 | Recuentos de asistencia del resumen MdA (sin motivo) | `season_2023-24.json` y `2024-25` → `mda_resumen.jugadores[].asist_partidos/asist_entrenos`; pestaña MdA | D46, marginal | Sí | Baja | Aceptable; quitarlo junto a P1 si se quiere un criterio único. |
| P5 | Nota personal menor sobre un exjugador | `data/historia_club.json` → `personas[].nota` | — | No | Baja | Reducir la nota a «identificado por hoja de inscripción». |
| P6 | Ficheros internos de trabajo publicados sin uso en la web | `data/rivales_2026-27.json`, `data/diccionario_nombres.json` | — | No | Baja | Moverlos fuera de `data/` si la web no los necesita. |

La web nueva no hereda ninguno: la portada solo usa datos por equipo, los líderes (puntos, triples, tiros libres) y las
cifras de historia; Mi zona solo muestra al jugador sus propias estadísticas; la copia `src/data/temporada.json` incluye los
campos de P1 porque es copia literal de `data/`, pero **no se pinta** en ninguna pantalla nueva (corregir P1 en `data/` y
`npm run datos:sync` los quita también de ahí).
