# ESTADO — Proyecto Maccabis

> Foto de qué está hecho HOY. Se actualiza en cada sesión.

_Última actualización: 04/08/2026 — bloque "interfaz de la Historia" (rama `feat/historia-club-ui`, sin mergear)._

### Interfaz de la Historia: pestaña "El Club" (rama `feat/historia-club-ui`)
- **Transversal a las temporadas**: se carga una vez desde `data/personas.json` y `data/historia_club.json`; no depende del selector ni lo altera.
- **Rejilla maestra**: 84 personas × 13 temporadas + la 26/27 prevista. Cada trayectoria es una barra continua; naranja = temporada con estadísticas, morado = sólo presencia. Cabecera y columna de nombre fijas, agrupación por tramos de veteranía, buscador y filtro con/sin estadísticas. Entrenador en sección propia.
- **Tira temporal**: una tarjeta por temporada con plantilla, altas y bajas. La 26/27 aparte, marcada como no empezada.
- **Ficha de persona**: al pinchar una fila. Temporadas, debut, veteranía y presencia año a año.
- **Puente con las estadísticas**: desde la ficha, las temporadas con datos cargan esa temporada y abren la ficha de jugador de esa persona (enlace por `person_id`). También por URL: `?t=2023-24&p=jugador&j=<person_id>`.
- Sin librerías nuevas y sin almacenamiento del navegador. Las demás pestañas quedan intactas.
- **Pendiente conocido**: el dashboard tiene desbordamiento horizontal en pantallas estrechas. **Es previo a este bloque** (se reproduce igual en la versión anterior); la rejilla de la Historia lleva su propio scroll contenido.

## Repositorio y publicación

- **Remoto:** `https://github.com/eyeshar/MACCABIS.git` (público). Conectado el 04/08/2026.
- **Ramas publicadas:** `main` (es la que sirve GitHub Pages) y `feat/historico-temporadas` (idéntica, queda para revisión).
- El repositorio local **no estaba bajo git**; se inicializó en este bloque. El remoto tenía un único commit de subida manual (`45b31d9`) con una versión anterior del proyecto. Las dos historias estaban desconectadas y se unieron con `--allow-unrelated-histories`: **el commit `45b31d9` se conserva** como segundo padre del merge `b42576b`. Ningún archivo suyo se perdió.
- Hay una etiqueta local `pre-merge-remoto` (= `99e52d3`) como punto de retorno anterior a esa unión.
- **URL pública:** https://eyeshar.github.io/MACCABIS/

## Hecho y funcionando

### Historia del club: matriz de presencia 2013→2026 (rama `feat/historia-club-datos`)
- **84 personas** con sus temporadas de presencia en el club, en `data/historia_club.json`. **Cubre 2013-2025 sin huecos.** (cerrado por Iván el 04/08/2026 a partir de `Historia_de_los_Maccabi.xlsx` + SportEasy).
- **Sólo datos**: la interfaz visual (rejilla, tira temporal, fichas) es el bloque siguiente y NO está construida.
- **Registro único de identidades** en `data/personas.json` (80 personas): fuente de verdad de los `person_id` que comparten la Historia y las estadísticas. Ver DECISIONS D13-D15.
- **Completada y verificada (04/08/2026)** contra las otras dos fuentes, con esta jerarquía: estadísticas (actas) > hojas de inscripción > matriz. La matriz sólo se completa; nunca se quita a nadie ni se recorta un año.
  - **4 personas añadidas** desde las estadísticas: Javier Páez García, Daniele Vallesi, Ramón Mora-Gil Jiménez e Ignacio Ferrando del Rincón. Ya no queda nadie con estadísticas fuera de la matriz.
  - **43 pares persona-año añadidos** sobre 22 personas. El caso mayor: Santiago Pazo Pascual, que tenía 3 temporadas y las actas confirman 4 más (2017, 2018, 2019 y 2024) — probable resto de la fila "Santi" fundida con Calvo González en el Excel original.
  - **21 hojas de inscripción oficiales** procesadas (`data/fichas_inscripcion.json`), de 12 temporadas. Informe en `docs/INFORME_FICHAS.md`.
- **Cierre de datos (04/08/2026)**, con las decisiones de Iván aplicadas:
  - **Dos nombres canónicos corregidos**: "Castro Mayo" → **"Castro Moya, Henry Luis"** y "Mar Calvo" → **"Martín Calvo, Borja"**. Cambian su `person_id`; los antiguos quedan en `alias_ids`.
  - **5 personas identificadas** desde hojas oficiales: Iván Álvarez Márquez (2018), Carlos Puertas Domingo (2019), Jorge Ranz Casado (2022), Hugo García Jiménez (2014) y **Alejandro Hernández Gómez (2017)**, que era el solo_mote "Alejandro, el de Alicante". Sólo quedan 2 solo_mote: Pupo y Eric.
  - **Regla de los Torneos Municipales**: eran copas del final de temporada, así que "Torneos AAAA" es la temporada que **termina** en AAAA. Liga y torneo del mismo periodo son una temporada y sus plantillas se suman.
  - **Temporada 2016/17 recuperada** de la hoja de Torneos 2017 (20 personas). Era el único año sin hoja propia ni estadísticas.
  - **Revisión de 2017/18**: ningún nombre se había resuelto contra la hoja equivocada.
- Validado contra sus propias reglas: `n_temporadas` cuadra con los años jugados 2013-2025 en las 76; ninguna tiene 2026 como jugada (22 la tienen como **prevista** 26/27, que no cuenta en veteranía); sin ids duplicados.
- `npm run check:personas` valida las identidades y las reglas sin escribir nada.

#### Reconciliación de identidades (04/08/2026)
- **55** personas coincidían de id exactamente entre Historia y estadísticas.
- **3 unificadas**, cada una confirmada por apellidos Y coincidencia de temporadas:
  | Antes | Después | Dónde se corrigió |
  |---|---|---|
  | `martinez-victor` | `martinez-martinez-victor` | `.md` del diccionario (21/22) + temporadas regeneradas |
  | `ballesteros-fuentes-robert` | `ballesteros-fuentes-roberto` | `data/historia_club.json` |
  | `mendez-escandon-fernando-antonio` | `mendez-escandon-fernando` | alias; el acta 25/26 trae el nombre legal completo |
- **21** personas sólo en la Historia, sin estadísticas: es lo esperado (el entrenador, los 3 `solo_mote` y quienes jugaron años sin actas o sólo en el MdA).
- **4** personas con estadísticas que **no aparecen en la matriz** — pendientes de revisión humana, ver cabos sueltos.
- La 25/26 era la única temporada sin `person_id` (venía del pipeline antiguo): estampado en sus 24 jugadores y 382 filas de boxscore, sin alterar ningún dato deportivo.

### Histórico completo: 10 temporadas 2013/14 → 2024/25 (rama `feat/historico-temporadas`)
- **11 temporadas en el dashboard** (13/14 → 25/26) con selector operativo. La 25/26 sigue siendo la temporada por defecto y **no ha cambiado**.
- Un `data/season_YYYY-YY.json` por temporada, con el **mismo esquema** que 25/26 (`season`, `label`, `partidos`, `players`, `box`, `qstats`) más claves nuevas donde el esquema no llegaba: `metrics`, `validacion`, `mda_resumen`.
- **Fuente:** los Excel de estadísticas de Carlos (`Estadisticas_YYYY_YYYY.xls` + los MdA `.xlsx` de 23/24 y 24/25). Están en `~/Downloads`, **no** en el repositorio.
- **Pipeline reproducible en Node** (`npm run build:datos`): `scripts/parse_diccionario.js` + `scripts/build_historico.js`.
- **Validación:** los 171 partidos con estadística individual disponible cuadran con el marcador del acta. Además, el total por jugador se contrasta con la columna TOTAL de la propia hoja: 0 discrepancias.
- **Nombres del MdA cerrados** (04/08/2026): el diccionario tiene tabla propia por ficha (`### 2023/24 (MdA)`), con clave `2023-24-MdA` en el JSON. Ningún mote queda sin catalogar en el MdA.
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
| 2023/24 | 20 | 16-4 | 19 | **sí** | 18 jugadores (todos identificados) |
| 2024/25 | 20 | 17-3 | 17 | **sí** | 19 jugadores (todos identificados) |

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

1. **Ignacio Mateos Aparicio ("Nacho S.", 23/24 y 24/25)** — incluido como jugador normal (107 y 87 puntos en MdL, 36 en el MdA de 23/24). La tabla MdA del diccionario confirma que **jugaba en las dos fichas**, pero sigue sin constar en las fichas de inscripción MdL disponibles. Queda pendiente localizar su ficha.
2. ~~**Diccionario de nombres del MdA**~~ — **RESUELTO (04/08/2026).** Iván cerró las tablas `### 2023/24 (MdA)` y `### 2024/25 (MdA)`. Los 18 motes de 23/24 y los 19 de 24/25 resuelven a persona real; **no queda ninguno sin catalogar**. Cada ficha tiene su propia tabla y no se usa una como respaldo de la otra, porque un mismo mote puede ser otra persona según el equipo (p.ej. "Santi" o "Jorge").
3. **Motes sueltos sin entrada en el diccionario** (tratados como "sin catalogar", sus puntos siguen contando en el equipo):
   - 14/15: `Paaco` y `Coach` — sin puntos, sólo aparecen en faltas/tiros libres. Probables erratas de `Paco` y de la etiqueta de entrenador.
   - 17/18: `Víctor` — **6 puntos**. La regla 4 del diccionario dice que "Víctor" = Víctor Martínez, pero la tabla de 17/18 no lo lista, así que no se ha aplicado.
4. ~~**Dos `person_id` para Víctor Martínez**~~ — **RESUELTO (04/08/2026).** Unificado a `martinez-martinez-victor` en el `.md` fuente y en las cuatro temporadas donde aparece (20/21, 21/22, 23/24, 24/25). El id retirado queda anotado en `alias_ids`.
5. **Tres celdas corruptas en el MdA 23/24** — valores decimales donde debería haber enteros (Jon/triples = 1,875; Edwin/TL = 1,875; J. Perchín/TL = 1,43). Se transcriben tal cual y salen marcadas con "?" en el dashboard.
6. **Dos jugadores con 2P no derivables en 20/21** (partido 10: Heriberto Gil 11 puntos y Alfredo David López 3, ambos sin triples ni tiros libres registrados). El dato de la fuente es incompleto; se deja ausente.
7. ~~**Cuatro personas con estadísticas que no están en la matriz**~~ — **RESUELTO (04/08/2026)**: añadidas a la matriz en los años que confirman las actas.
8. ~~**Seis nombres en hojas sin identificar**~~ — **RESUELTO (04/08/2026)**: los 5 confirmados por Iván se crearon como personas; ya no queda ningún nombre de hoja oficial sin identificar.
9. ~~**Cinco correspondencias dudosas en fichas**~~ — **RESUELTO (04/08/2026)**: dos eran erratas de nombre (corregidas) y las otras tres se confirmaron como alias.
10. ~~**Cinco hojas de "Torneos Municipales" sin aplicar**~~ — **RESUELTO (04/08/2026)**: Iván fijó la regla y las cinco están aplicadas.
11. **Adán Herrera Benzán jugó 3 partidos en 2017/18 sin constar en ninguna hoja de esa temporada** (sí en 2018/19, 2021/22 y 2022/23). O falta su hoja, o se inscribió fuera de plazo. Anomalía de la fuente.
12. **Las 4 hojas transcritas por visión conviene repasarlas** (2013/14 MdL, 2014/15 MdL y las dos de 2017/18): son escaneos sin capa de texto, leídos de la imagen. Están en `docs/fichas_transcritas.json`.
13. ~~**Cuatro personas con estadísticas que no están en la matriz de historia**~~ — Ignacio Ferrando del Rincón (23/24), Ramón Mora-Gil Jiménez (21/22 y 23/24), Javier Páez García (20/21) y Daniele Vallesi (21/22, 23/24, 24/25). **No se han fusionado con nadie**: había parecidos superficiales (otro Ramón, otro Javier, otro Ignacio) que son personas distintas. Falta decidir si se añaden a la matriz o si su ausencia es intencionada. `npm run check:personas` los avisa en cada ejecución.
14. **Partidos sin estadística individual**: 3 en 15/16 (5, 11 y 18) y 9 en 21/22 (10 al 18). El marcador sí consta; el boxscore no se ha fabricado y salen marcados como "sin stats".

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
