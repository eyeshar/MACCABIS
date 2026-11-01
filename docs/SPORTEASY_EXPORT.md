# SPORTEASY_EXPORT — qué trae el export completo de SportEasy (01/11/2026)

> Fichero: `privado/sporteasy/sporteasy_maccabis_completo_2026-11-01.json` (≈62 MB, **fuera de git**: lleva datos
> personales). Export completo por la API de SportEasy hecho por Claude el 01/11/2026 (sello interno `exportado`:
> 31/10/2026 23:10 UTC). SportEasy ya no se usa (D153): esto es el archivo histórico, de solo lectura.
> Este documento describe la **estructura**, sin nombres, correos ni teléfonos.

## Raíz

| Clave | Qué es |
|---|---|
| `equipo` | El equipo de SportEasy y lo que no depende de la temporada. |
| `temporada_<aaaa-aaaa>` | Una por temporada: de `temporada_2017-2018` a `temporada_2026-2027` (10). |

## `equipo`

| Clave | Contenido | Notas |
|---|---|---|
| `exportado` | Fecha y hora del export. | |
| `equipo` | Ficha del equipo (nombre, deporte, país, logo, temporada actual, suscripción, roles de miembro, enlaces de la API). | Sin datos de jugadores. |
| `temporadas` | 10 temporadas: inicio, fin, nombre, `current`, `archived`. | |
| `miembros` | 44 miembros: id de perfil, nombre, apellidos, **correo, teléfono, fecha de nacimiento, peso, altura**, dorsal, posición habitual, rol, si es administrador, estado, año de llegada, avatar. | **Datos personales**: nunca a un fichero público ni a una pantalla de jugador. Ninguno archivado. |
| `rivales` | 90 rivales: id, nombre y (a veces) correo. | **No traen colores.** |
| `ubicaciones` | 20 instalaciones: nombre, dirección, coordenadas, enlace de mapas, detalles. | |
| `tareas` | 4 tipos de tarea (icono y nombre). | Sin asignaciones. |
| `cobros` | 1 cobro: concepto, tarifas, estado, recuentos de pagados/pendientes e importes agregados. | Tesorería (D52): solo zona protegida. Sin pagos por persona. |

## `temporada_<slug>`

| Clave | Contenido | Notas |
|---|---|---|
| `temporada` | id, nombre, fechas, número de eventos. | |
| `categorias` | Tipos de evento de la temporada: `training` (entreno), `friendly` (amistoso), `challenge`, `tournament`, `simple` (otro), `play-off-moratalaz` y los campeonatos por ficha (`temporada-mda`, `temporada-mdl`, `…-2afase`, `torneo-marca-…`; en 2025/26 `temporada-mda-2025`/`temporada-mdl-2025`), con el número de partidos. | La categoría dice si un evento es de liga y de qué ficha. |
| `campeonatos` | Por categoría de campeonato: jornadas (`partidos.days[].events[]`: equipos, marcador si se puso, fecha, instalación, incomparecencia) y equipos participantes. | Calendario de liga tal como se cargó en SportEasy. |
| `estadisticasEquipo` | Agregados del equipo: victorias, empates, derrotas, puntos a favor y en contra, medias, rachas, distribución de marcadores. | Solo de los partidos con marcador en SportEasy. |
| `estadisticasJugadores` | Por jugador: asistencias (`has_attended`), faltas, rebotes, minutos, tapones, triples, tiros libres, dobles, puntos, asistencias de juego, robos, victorias/derrotas jugadas, «MVP», nota. | Muchas columnas vacías: el club apuntaba poco en SportEasy; las estadísticas buenas son las de las hojas de la FBM. |
| `asistenciasCSV` | El balance de asistencia (un .xlsx) **guardado como texto**. | **Inservible:** el binario se corrompió al guardarlo (≈26.000 caracteres de sustitución). La asistencia se saca de `eventos`. |
| `eventos[]` | Cada evento con `lista`, `detalle`, `alineaciones` y `estadisticas` (abajo). | 3 (2017/18), 98, 84, 83, 90, 145, 89, 94, 90 y 95 (2026/27, incluidos los futuros). |

### `eventos[]`

| Clave | Contenido |
|---|---|
| `lista` | Lo que se ve en el calendario: id, categoría, temporada, inicio y fin, cancelado, equipos (`opponent_left`/`opponent_right`: nombre, local, **marcador**, **color de camiseta** en hexadecimal), si es deportivo, pasado, recuentos por grupo de asistencia. |
| `detalle` | Lo mismo y además: `attendees` (abajo), `presence_groups`, `pending_attendance_count`, formato, recordatorios, instrucciones, `stats`, `meeting_at` (quedada), `has_lineup`. |
| `detalle.attendees[].results[]` | **Una fila por persona convocada al evento:** id de perfil (`profile.id`, el que casa con `diccionario_sporteasy`), datos del perfil (personales), rol, posición, dorsal, `group` (`played` = presente, `not_played` = ausente), `presence` (`on_time` a tiempo, `late` tarde, `excused` con excusa, `not_excused` sin excusa, `injured` lesionado), cuándo se le pidió y cuándo respondió, y desde 2025/26 a veces `absence_reason` (fechas y motivo: `other`, etc.). |
| `alineaciones` | La alineación si se hizo (casi nunca: 11 eventos en todo el archivo). |
| `estadisticas` | Estadísticas por jugador del evento si se apuntaron (puntos, rebotes…), con sus cabeceras. |

## Qué **no** hay

- **Mensajes** del muro o del chat del equipo, ni **comentarios** de los eventos: solo el id del hilo (`thread_id`).
- **Fotos**, documentos ni álbumes (solo las direcciones de los avatares).
- **«No convocado»**: en la API quien no estaba convocado simplemente no aparece en `attendees` (el Excel de SportEasy sí escribe «No convocado»).
- **Colores de los rivales** en `rivales`: solo en cada evento (`jersey_color`), y no siempre.
- Pagos por persona del cobro (solo totales).
- Temporadas anteriores a 2017/18.

## Cómo se casan las personas

`diccionario_sporteasy` (32 entradas en el real) guarda el **nombre** de SportEasy y el `person_id`, **no el id de perfil**.
Por eso se casa por **nombre exacto** (`first_name` + `last_name` del perfil, con los espacios limpios), con el diccionario y
con `scripts/estadisticas/nombres_sporteasy.json` (coinciden al 100 %). Lo que no casa no se adivina: va a una lista fuera de
git. Si se quiere casar por id de perfil, haría falta añadir el id al diccionario (columna nueva, D111).

## Contraste 2026/27: Excel (`bilan_presence`) frente al export (01/11/2026)

- 27 de 27 eventos del Excel (19/07–30/10) tienen pareja en el export (misma fecha y tipo; los dos «Campeonato» del mismo día,
  por el que más coincide). Ningún evento del export hasta el 31/10 queda sin pareja.
- 1.242 celdas comparadas. **Con la misma persona en los dos lados, 0 diferencias de estado.**
- Las 43 «diferencias» restantes son **3 personas escritas distinto** en el Excel y en la API (mismos eventos uno a uno).
- **6 celdas «Lesionado»** del Excel (04/10, 14/10, 18/10 ×2, 28/10 ×2) que la API no trae: la API deja fuera de `attendees` a
  quien estaba de baja. Las 4 anteriores al 24/10 ya están cargadas desde el Excel (D161), así que lo cargado es lo más completo.
- Conclusión: **la carga de 2026/27 (D161) no cambia**. Detalle (con nombres, fuera de git):
  `privado/sporteasy/contraste_excel_export_2026-27.txt`.

## 2025/26: lo cargado frente al export (cuadre, sin escribir nada)

Lo que hay hoy en `asistencia_motivos` para 2025/26 sale del Excel «compuesto» que Iván montó a mano en 2025/26 (el que
alimentó `season_2025-26.json`). El export, evento a evento (81 eventos jugados: 42 entrenos, 37 de liga de las dos fichas y 2
de play-off; 4 nombres sin casar, 5 apariciones):

| Ámbito | Ahora (asistió / total) | Ahora: con excusa · sin excusa · no conv. · lesión | Export (asistió / total) | Export: con excusa · sin excusa · no conv. · lesión |
|---|---|---|---|---|
| Partidos de liga | 329 / 790 (24 personas) | 264 · 0 · 171 · 26 | 355 / 638 (25 personas) | 282 · 1 · 0 · 0 |
| Entrenos | 379 / 701 (19 personas) | 244 · 0 · 32 · 46 | 410 / 709 (27 personas) | 283 · 16 · 0 · 0 |
| Play-off (2 partidos) | — | — | 23 / 30 (16 personas) | 7 · 0 · 0 · 0 |

Por qué no cuadran:
- La API **no trae «no convocado» ni «lesionado»** (quien no estaba convocado o estaba de baja no sale en `attendees`): el
  total del export es menor en partidos y los motivos «no convocado» y «lesión» desaparecerían.
- En partidos, lo cargado **ya está corregido con las hojas** (manda quien jugó, D72); el export dice quién respondió «a
  tiempo» en SportEasy (355 frente a 329).
- En entrenos, el Excel compuesto **solo tenía a 19 personas**; el export trae a 27 (8 más) y 16 «sin excusa» que el Excel no
  distinguía.

**Decisión de Iván (01/11/2026): opción 1, 2025/26 no se toca.**

**Recomendación (no aplicada; decide Iván):** no sustituir la temporada. Opciones:
1. **No tocar 2025/26** (lo cargado es lo curado y lo que da la web pública).
2. **Solo entrenos desde el export** (27 personas, con «sin excusa»), manteniendo partidos como están. Se pierde la
   separación «no convocado»/«lesión» de los entrenos (32 y 46 hoy).
3. **Completar sin pisar:** añadir solo a las 8 personas que el Excel no tenía en entrenos, con sus cifras del export.

Cuadre por persona (con nombres, fuera de git): `privado/sporteasy/cuadre_asistencia_2025-26.md`.

## Qué más del histórico podría entrar (propuesta, no construida)

> **Decisión de Iván (01/11/2026, D166, cargada):** la asistencia de 2018/19 a 2024/25 se carga, una pestaña por temporada en «Asistencia y motivos» (solo gestores), con una persona por id de perfil de SportEasy; los que no casan, como personas históricas y con propuestas para Iván (`privado/sporteasy/propuestas_para_ivan.md`). Lo demás, no por ahora.

| Qué | Qué hay en el export | Valor | Coste | Recomendación |
|---|---|---|---|---|
| Asistencia de 2017/18 a 2024/25 | 15.438 filas persona-evento en 8 temporadas | **Medio:** constancia de cada jugador por temporada en «Asistencia y motivos» (pestañas por temporada; solo gestores) | **Medio:** casar nombres de 8 años (más sin casar cuanto más antiguo); sin «no convocado» ni «lesión»; los «Campeonato» llevan la ficha en la categoría | Sí, como pestañas «histórico (SportEasy)», marcado como menos completo que 2025/26 en adelante |
| Resultados de amistosos y torneos | 62 jugados (31 amistosos, 19 «challenge», 12 de torneo), **solo 7 con marcador** | **Bajo:** sin marcador casi nunca | Bajo | No, salvo una lista de «torneos jugados» por temporada, sin resultados |
| Rivales con sus colores | 90 rivales **sin color**; color de camiseta solo en eventos, **4 rivales** | **Muy bajo** | Bajo | No: los colores buenos ya vienen del Ayuntamiento (`equipaciones_2026-27.json`) |
| Instalaciones | 20 con dirección y coordenadas | Bajo-medio: completar `pistas` (hoy 17, 14 con coordenadas) para amistosos y planes | Bajo | Solo las que falten, a mano y con el OK de Iván |
| Estadísticas por jugador de SportEasy | Casi vacías (el club no las apuntaba ahí) | Muy bajo | — | No: las buenas son las hojas de la FBM |
| Cobros | 1 cobro con totales, sin pagos por persona | Bajo para la tesorería (D52) | — | Solo como referencia al diseñar la tesorería |
