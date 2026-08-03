# ESTADO — Proyecto Maccabis

> Foto de qué está hecho HOY. Se actualiza en cada sesión.

_Última actualización: 04/08/2026 — bloque "histórico de temporadas" (rama `feat/historico-temporadas`, pendiente de revisión y merge)._

## Hecho y funcionando

### Histórico completo: 10 temporadas 2013/14 → 2024/25 (rama `feat/historico-temporadas`)
- **11 temporadas en el dashboard** (13/14 → 25/26) con selector operativo. La 25/26 sigue siendo la temporada por defecto y **no ha cambiado**.
- Un `data/season_YYYY-YY.json` por temporada, con el **mismo esquema** que 25/26 (`season`, `label`, `partidos`, `players`, `box`, `qstats`) más claves nuevas donde el esquema no llegaba: `metrics`, `validacion`, `mda_resumen`.
- **Fuente:** los Excel de estadísticas de Carlos (`Estadisticas_YYYY_YYYY.xls` + los MdA `.xlsx` de 23/24 y 24/25). Están en `~/Downloads`, **no** en el repositorio.
- **Pipeline reproducible en Node** (`npm run build:datos`): `scripts/parse_diccionario.js` + `scripts/build_historico.js`.
- **Validación:** los 171 partidos con estadística individual disponible cuadran con el marcador del acta. Además, el total por jugador se contrasta con la columna TOTAL de la propia hoja: 0 discrepancias.
- Informe completo en `docs/INFORME_HISTORICO.md`.

| Temporada | Partidos | Balance | Jugadores | Minutos | MdA agregado |
|---|---|---|---|---|---|
| 2013/14 | 19 | 7-12 | 13 | no | — |
| 2014/15 | 20 | 10-10 | 12 | no | — |
| 2015/16 | 20 (3 sin stats) | 10-10 | 13 | no | — |
| 2017/18 | 21 | 11-10 | 18 | no | — |
| 2018/19 | 16 | 6-10 | 17 | no | — |
| 2019/20 | 16 | 8-8 | 12 | no | — |
| 2020/21 | 13 | 2-11 | 12 | no | — |
| 2021/22 | 18 (9 sin stats) | 12-6 | 14 | no | — |
| 2023/24 | 20 | 16-4 | 19 | **sí** | 18 jugadores |
| 2024/25 | 20 | 17-3 | 17 | **sí** | 19 jugadores |

> No hay estadísticas de 2016/17 ni de 2022/23: no existen en la fuente, no se han inventado.

### Dashboard de estadísticas 25/26 (v1, web estática)
- **Publicado y en vivo** en GitHub Pages: `https://eyeshar.github.io/MACCABIS/`
- Repositorio GitHub: `eyeshar/MACCABIS` (público).
- Arquitectura actual: web estática de un solo archivo (`index.html`) que carga datos por `fetch` desde `data/`. Estructura multitemporada ya preparada (selector de temporada, `data/index.json` + `data/season_2025-26.json`).
- **Esta v1 será migrada** al nuevo stack (Next.js+Supabase) como zona pública. La web estática fue el punto de partida; el proyecto real es la plataforma.

### Datos procesados y verificados de la temporada 25/26
- **42 actas PDF** de la FBM procesadas (MdA 22 partidos = 20 liga + 2 playoff; MdL 20 = 19 + 1 incomparecencia 0-0 sin stats).
- **41 hojas de estadística** oficiales (App Afición FBM) procesadas y **verificadas contra el marcador de cada acta** (la suma de puntos por jugador cuadra con el tanteo). MdA 20 hojas, MdL 19 (falta la del 0-0 por incomparecencia, que no genera hoja).
- **24 jugadores** reales consolidados (plantilla combinada MdA+MdL).
- Parciales por cuarto extraídos de las 42 actas y verificados (suma = marcador), 42/42 OK.
- Datos de asistencia (partidos y entrenamientos) de SportEasy vinculados por jugador.

### Contenido del dashboard v1 (pestañas)
Equipo (balance, racha, tabla de partidos con boxscore desplegable al clic) · Jugadores (ranking ordenable por columna) · Ficha de jugador (tarjetas, desglose de tiro, partido a partido con DNP) · Rankings (Top 5/10 de cada métrica) · Por cuartos (rendimiento del equipo por periodo) · Asistencia (partidos y entrenamientos) · Comparativa (radar jugador vs jugador, vs media, evolución — con Chart.js) · Gestión (zona privada con contraseña — SOLO placeholder, notas en localStorage; se reemplazará por la zona de gestión real con login).

## Cabos sueltos del histórico (pendientes de Iván, ninguno bloquea)

1. **Ignacio Mateos Aparicio ("Nacho S.", 23/24 y 24/25)** — incluido como jugador normal (107 y 87 puntos), pero **no consta en las fichas MdL disponibles**. Sigue pendiente verificar en qué ficha o equipo estaba.
2. **Diccionario de nombres del MdA** — el diccionario cubre sólo el MdL. Los motes del MdA que no aparecen en la tabla de esa temporada se muestran con el mote tal cual y la marca "sin catalogar": 11 en 23/24 (Jon, Jorge, Lukas, Edwin, Sergi, Alonso, Wall, Guille, Daniele, J. Perchín, Henry) y 10 en 24/25 (Jorge, Guille, Wall, Sergi, Lukas, Edwin, Daniele, J. Perchín, Rafa, Santi). **No se ha deducido ningún nombre.**
3. **Motes sueltos sin entrada en el diccionario** (tratados como "sin catalogar", sus puntos siguen contando en el equipo):
   - 14/15: `Paaco` y `Coach` — sin puntos, sólo aparecen en faltas/tiros libres. Probables erratas de `Paco` y de la etiqueta de entrenador.
   - 17/18: `Víctor` — **6 puntos**. La regla 4 del diccionario dice que "Víctor" = Víctor Martínez, pero la tabla de 17/18 no lo lista, así que no se ha aplicado.
4. **Dos `person_id` para Víctor Martínez** — el diccionario lo escribe "Martínez Martínez, Víctor" en 20/21 y 23/24 y "Martínez, Víctor" en 21/22. Sin efecto dentro de cada temporada, pero conviene unificarlo antes de cruzar temporadas.
5. **Tres celdas corruptas en el MdA 23/24** — valores decimales donde debería haber enteros (Jon/triples = 1,875; Edwin/TL = 1,875; J. Perchín/TL = 1,43). Se transcriben tal cual y salen marcadas con "?" en el dashboard.
6. **Dos jugadores con 2P no derivables en 20/21** (partido 10: Heriberto Gil 11 puntos y Alfredo David López 3, ambos sin triples ni tiros libres registrados). El dato de la fuente es incompleto; se deja ausente.
7. **Partidos sin estadística individual**: 3 en 15/16 (5, 11 y 18) y 9 en 21/22 (10 al 18). El marcador sí consta; el boxscore no se ha fabricado y salen marcados como "sin stats".

## En curso / decidido pero no empezado

- **Migración al stack Next.js + Supabase + Vercel.** Arquitectura aprobada. No iniciada.
- **Orden acordado:** (1) zona pública (estadísticas + histórico) primero; (2) histórico del club; (3) login + zona de gestión; (4) convocatorias (esperan a octubre, inicio de liga — lo menos urgente).

## Reglas de negocio ya establecidas (de las estadísticas)

- Columnas siempre a cero se descartan (rebotes, asistencias, robos, pérdidas, tapones, faltas recibidas). La liga solo registra: puntos, tiros de 2, de 3, tiros libres, faltas cometidas (FC), valoración (VAL), +/−.
- Las medias se calculan SOLO sobre partidos con minutos jugados. Los DNP (0 minutos) cuentan como convocatoria/asistencia, pero NO entran en el denominador de las medias.
- Notación de las actas: canasta normal = 2 puntos; con círculo = triple (3); precedida de paréntesis = tiro libre (1). Formato "tanteo arrastrado".
- El entrenador **Carlos Barreiro** se excluye de las estadísticas de jugadores.
- Errata "DE CARVLHO" (acta partido 1 MdL) fusionada con "DE CARVALHO RODRIGUES, JULIO CESAR".
- Nombres display: completos y en formato Título (Nombre + Apellidos). Mapa de nombres coloquiales (SportEasy) → formales (FBM) confirmado: Nacho Mileo=Ignacio Mileo, Manu Cala=Calahorro, Edu=Martín-Ortega Eduardo.

## Datos importantes de fiabilidad

- Los puntos por jugador NO se extraen de las actas PDF (formato "tanteo arrastrado" no fiable a ojo ni por parsing). Se usan las **hojas de estadística XLSX** de la app, que sí son limpias y verificables.
- Los parciales por cuarto SÍ se extraen bien del pie de las actas ("Tanteos: Cuarto n A:x B:y").
