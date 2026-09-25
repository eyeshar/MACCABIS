# ESTADO — Proyecto Maccabis

> Foto de qué está hecho HOY. Se actualiza en cada sesión.

_Última actualización: 25/09/2026 (noche) — **bloque "Cierre del sondeo y cimientos 26/27"**: plantilla confirmada, protección de las fuentes, URL de rivales, pipeline de estadísticas y calendario automático (en ramas sin mergear), sondeo de datos por jugador, cláusula de SportEasy, reglas de convocatoria v0 y decisiones D35–D43. La liga empieza el **4/10/2026** (D38)._

### Ramas pendientes de verificar con Iván (NO mergeadas)
| Rama | Qué trae | Cómo se comprueba |
|---|---|---|
| **`feat/pipeline-estadisticas`** | `scripts/estadisticas/` (Node): actas + hojas XLSX + asistencia → `data/season_<t>.json`; `npm run jornada` (comando semanal); `npm run test:regresion`; `data/season_2026-27.json` vacío con la plantilla; paso `estadisticas` en `build:datos`. | `npm run test:regresion` → "RESULTADO: OK". Es lo que hace falta para la **jornada 1 (4/10)**. |
| **`feat/calendario-automatico`** (sale de la anterior) | `scripts/calendario/actualizar_calendario.js`, workflow `.github/workflows/calendario.yml`, `data/calendario_2026-27.json` y `data/sporteasy_calendario_2026-27.csv` (vacíos hasta que el portal publique), plan B manual. `docs/CALENDARIO.md`. | Probado con 2025/26. Se mergea después del pipeline. |

### Test de regresión del pipeline (25/09/2026)
- **Fuentes de 2025/26 en el equipo de Iván:** las **42 actas** (Descargas), la **asistencia** (Excel montado por Iván con SportEasy) y **sólo 1 de las 41 hojas XLSX** (`estadisticaPartido_21_mda.xlsx`). Las otras 40 se subieron al chat de Claude en su día y no hay copia en ninguna unidad (búsqueda en C:, D: y E:). Copiadas a `fuentes_fbm/2025-26/` (fuera de git).
- **A. 42 actas reales:** partidos y parciales medios idénticos, salvo 42 × hora y 42 × pista (datos nuevos) y 2 correcciones de jornada.
- **B. Hoja real (jornada 21 MdA):** boxscore idéntico, 0 diferencias.
- **C. JSON completo** (41 hojas reconstruidas desde el boxscore publicado): **idéntico** en jugadores, medias, porcentajes, redondeos, asistencia, boxscores y orden. Diferencias, todas explicadas: hora y pista; **329781** (incomparecencia Pelota Naranja) es la jornada **16**, no `null`; **329814** (MdL–Chavalitros 10/05) es la jornada **22**, no la 11; la fila con la errata "DE CARVLHO" ahora lleva `person_id`.
- **Hallazgo:** la hoja que faltaba en 25/26 no era la de la incomparecencia (esa existe, con 0 puntos) sino la del **MdL–Chavalitros del 10/05/2026**.
- La 2025/26 publicada **no se ha regenerado** (D43). Para aplicar las 3 correcciones y añadir hora y pista hacen falta las 40 hojas.

### Plantilla 2026/27 — **CONFIRMADA** (25/09/2026)
- 24 deportistas (22 en las dos fichas; Galán Domingo y Varas García sólo en el MdA). MdA en **G1**, MdL en **G2**.
- **3 personas nuevas creadas**: García Gijón, Santos Artiles y Teruel Fernández (`historia_club.json` → `personas.json`, 87 identidades). `previsto_2627`: salen Rausse, Mateos y Rodríguez Pérez; entran Galán, Vallesi, Villa Guerrero y los 3 nuevos. En "El Club" salen en un tramo propio ("Llegan en 26/27").
- Tabla de motes → nombre oficial → `person_id` en `docs/PLANTILLA_26-27.md`. Yamin, Perchín y Mateos siguen en SportEasy pero se ignoran en los cruces.

### Protección de las fuentes (D41)
- **Torneos 2018 del MdL** (antiguo `MDL.pdf`): irrecuperable; **congelada** en `docs/fichas_sin_pdf.json` con sus 17 nombres (recuperados del commit `63229e6`) y `sin_pdf: true`.
- `consolidar_fichas.js` procesa ya el 47 JDM y **falla sin escribir** si falta un PDF registrado o si un PDF ya es otra hoja (probado en los dos casos).
- `scripts/lib/copia_segura.js`: copias sin sobrescribir nunca (sin distinguir mayúsculas).
- La **fecha de alta** de las hojas de 26/27 ya no se publica (D17).
- `build_historico.js` lee los Excel de Carlos de `docs/estadisticas/`. Se copiaron allí (sin pisar nada) 4 ficheros de Descargas con el nombre exacto: dos de las copias que había en `docs/estadisticas/` (`Estadisticas_2017_2018 (1).xls` y `Estadisticas_2023_2024_MDL (1).xls`) son **versiones distintas** que no reproducen los datos publicados. No se han borrado.
- **`npm run build:datos` no altera ningún dato** (dos ejecuciones seguidas, ficheros idénticos) y `check:personas` da 87 identidades sin problemas.
- `.gitignore`: `docs/estadisticas/`, `privado/` y `fuentes_fbm/` (verificado con `git check-ignore`).

### Rivales
- El portal **renumeró** los recursos del 300257 (y ya trae la 2025/26). Tabla nueva en `build_rivales_2026_27.py`; `rivales_2026-27.json`, `RIVALES_2026-27.md` y `rivales_2026-27_web.json` se regeneran **idénticos**.

### Sondeos y SportEasy
- **Datos abiertos por jugador: no existen** (`docs/SONDEO_ACTAS_FASE0.md`, apartado 6). Se mantiene el gesto manual de Iván sin pedir permiso a la FBM (D35).
- El **211549 sigue con la 2025/26** a 25/09/2026. Su robots.txt veta a los bots las descargas: calendario programado sólo con metadatos, descarga con botón (D42).
- **SportEasy:** cláusula literal copiada; plantilla del soporte como vía principal y agente como plan B (D36); recordatorios cubiertos por Premium (D37). **Indicio:** el export de hoy termina el 23/09 (sin eventos futuros); pendiente de la prueba de Iván.

### Convocatoria
- `docs/REGLAS_CONVOCATORIA.md` v0, sin nombres ni niveles (D40). Niveles confidenciales en `privado/` (D39). Nada construido.

### Decisiones del bloque
D35 (actas: un gesto, sin permiso FBM) · D36 (SportEasy: plantilla del soporte; agente plan B) · D37 (recordatorios Premium) · D38 (liga desde el 4/10) · D39 (niveles confidenciales) · D40 (reglas v0) · D41 (protección de fuentes) · D42 (calendario por código, descarga con botón) · D43 (pipeline en Node; 25/26 no se regenera).

### Bloque anterior (25/09/2026, tarde): "Arranque 26/27"
Repositorio verificado (todo en `main`), plantilla extraída, sondeos de actas y SportEasy, D30–D34. Sus cambios, que estaban sin commit, se subieron en este bloque.

### Pestaña "Rivales 26/27" — **EN PRODUCCIÓN desde el 25/09/2026**
- **Publicada en** https://eyeshar.github.io/MACCABIS/?p=rivales&g=MdL (y `&g=MdA`, `&r=<id-rival>`). Iván aprobó las capturas; merge `--no-ff` de `feat/rivales-2026-27` a `main`, que arrastra `feat/rivales-jdm`. Ramas conservadas. Comprobado en producción con Chrome a 375 px: carga la pestaña con el grupo MdL, sin errores de JS y sin desbordamiento.
- **Retoques de la aprobación (D29):** "N incomparecencias" junto al puesto cuando explican PJ ≠ G+P (el ⚠ queda para lo que no explican); tarjetas ordenadas por % de victorias en partidos jugados en 2025/26 (28500 pasa de último a 3º del MdL); el selector de temporada se oculta mientras la pestaña está activa.

#### Historial de la construcción
- En `index.html`. Capturas aprobadas en `docs/capturas/rivales/`.
- Selector Grupo MdA / Grupo MdL, "Lo esencial", tarjetas por rival ordenadas por puesto relativo 2025/26 y ficha con gráfico de trayectoria (SVG propio, D28), tabla temporada a temporada y cara a cara. Enlace `?p=rivales&g=MdA&r=<id>`.
- Datos: `data/rivales_2026-27_web.json` (74 KB) con `npm run build:rivales`, generado de `data/rivales_2026-27.json`.
- Probado con Chrome sin interfaz: sin errores de JS (sólo el 404 de `favicon.ico`, que no existe en el sitio), 70/70 combinaciones temporada×pestaña correctas, **sin desbordamiento horizontal a 375 px**, y los números cuadran con `docs/RIVALES_2026-27.md` en los 18 rivales con rastro.

### Datos del scouting 2026/27 — CERRADOS (25/09/2026)
- **Regla del nombre del club (D26):** #149233 "MACCABI DE LEVANTAR" (2020/21) es un **rival**, no un tercer equipo. `DIAGNOSTICO_MDL_MDA.md` marcado como corregido.
- **7 alias confirmados (D27)** aplicados a todo; SPORTING DE VALLECAS y GSD VALLECAS descartados; quedan 7 candidatos sin confirmar.
- Cara a cara: 410 partidos, **0 contados dos veces**; las 5 cifras que esperaba Iván cuadran (Suanzes Motor 11G-2P, LOS KHINKIS RUSOS 15G-6P, NABUCO TD 0G-2P, VALLEKAS BASKET y F.T. FLOPPERS nunca).
- `feat/rivales-jdm` está mergeada en esta rama (no en `main`).

### Scouting de rivales 2026/27 — rama `feat/rivales-2026-27` (25/09/2026, NO mergeada) — primera versión
- **Qué hay:** `data/rivales_2026-27.json` + `docs/RIVALES_2026-27.md`, generados por `scripts/build_rivales_2026_27.py` (Python). Trayectoria en los JDM de los **20 rivales** de 2026/27 (baloncesto sénior masculino, **todos los distritos**, 2014/15–2025/26, liga, segundas fases, fase de distrito, fase final de Madrid y torneos municipales) y **cara a cara** con el club.
- **Fuente:** portal de datos abiertos del Ayuntamiento de Madrid (CC BY 4.0). 300257 (histórico) + **211549 descargado el 25/09/2026, que aún trae la 2025/26 completa** (no la 26/27). Copias brutas en `data/raw/` y `.cache-jdm/`, **no versionadas** (D25).
- **Resultado:** 17 rivales con rastro en los JDM; **sin rastro: Craps, F.T. FLOPPERS y Quinto Tiempo**. Alias confirmados aplicados (D24). **23 candidatos** a mismo equipo pendientes de Iván, sin fusionar.
- **Cara a cara:** 423 partidos del club combinados (portal 300257 vía `rivales_jdm.json` de `feat/rivales-jdm`, 14 del tercer equipo 2020/21 #149233 aparte, portal 211549 para 2025/26 y los `season_*.json`), deduplicados por fecha+marcador o temporada+marcador.
- **Verificación:** 2025/26 portal vs `season_2025-26.json`: **41/42** casan; el que no, **Pelota Naranja 08/03/2026**: portal 20-0 (incomparecencia), histórico propio 0-0. Clasificaciones: 528 filas con PJ ≠ G+P (418 son incomparecencias que el portal cuenta en PJ pero no en G/P; 56 sin explicar) y 48 grupos con ΣPF ≠ ΣPC. Informado, no corregido.
- **Hallazgos:** `season_2019-20.json` (etiqueta MDL) anota un partido **contra "MDL"** → probablemente es el MdA, como 17/18, 18/19 y 20/21 (no se ha tocado). Codificación CP850 en los CSV antiguos reparada (`CASTA¥AZO` → CASTAÑAZO). En 2025/26 hay 13 grupos con clasificación pero sin partidos en el portal (Hortaleza, Retiro, Vicálvaro…). Homónimo no incluido: #179099 "Maccabi de levantar" (Vicálvaro, 2025/26).
- **Depende de** `feat/rivales-jdm` (lee `data/rivales_jdm.json` de esa rama con `git show` si no está en local). Ambas ramas publicadas en origin, ninguna mergeada.


### Interfaz de la Historia: pestaña "El Club" — **EN PRODUCCIÓN desde el 04/08/2026**
- **Publicada en** https://eyeshar.github.io/MACCABIS/?p=historia — mergeada a `main` (merge `--no-ff`, conservando el histórico de los 17 commits de la rama).
- **Qué incluye:**
  - **Rejilla maestra de 84 personas** × 13 temporadas (2013/14 → 2025/26) más la 26/27 prevista, con la trayectoria de cada una como barra continua: naranja donde hay estadísticas, morado donde sólo consta presencia.
  - **Ficha de trayectoria** al pinchar una fila, con **puente a las estadísticas por `person_id`**: las temporadas con datos abren la vista de jugador de ese año.
  - **Dos modos de orden excluyentes**: veteranía (agrupada en tramos) o año de incorporación (lista plana).
  - **Tira temporal** con plantilla, altas y bajas de cada temporada.
  - **2016/17 completa con 24 personas**, recuperada de la hoja de Torneos 2017: era el único año sin estadísticas ni hoja propia.
- **Verificado antes del merge**: `check:personas` 84 identidades sin incidencias, cuadre de actas 171/171, `build:datos` idempotente y las dos suites de pruebas sin errores de JS.
- **Transversal a las temporadas**: se carga una vez desde `data/personas.json` y `data/historia_club.json`; no depende del selector ni lo altera.
- **Dos modos de orden excluyentes en la rejilla** (decisión de Iván, ver D22): por **veteranía** (con agrupación en tramos, es el de por defecto) o por **año de incorporación** (lista plana, sin tramos). La cifra dorada de cada fila cambia en consecuencia: nº de temporadas o temporada de debut.
- **Rejilla maestra**: 84 personas × 13 temporadas + la 26/27 prevista. Cada trayectoria es una barra continua; naranja = temporada con estadísticas, morado = sólo presencia. Cabecera y columna de nombre fijas, agrupación por tramos de veteranía, buscador y filtro con/sin estadísticas. Entrenador en sección propia.
- **Tira temporal**: una tarjeta por temporada con plantilla, altas y bajas. La 26/27 aparte, marcada como no empezada.
- **Ficha de persona**: al pinchar una fila. Temporadas, debut, veteranía y presencia año a año.
- **Puente con las estadísticas**: desde la ficha, las temporadas con datos cargan esa temporada y abren la ficha de jugador de esa persona (enlace por `person_id`). También por URL: `?t=2023-24&p=jugador&j=<person_id>`.
- Sin librerías nuevas y sin almacenamiento del navegador. Las demás pestañas quedan intactas.
- **Pendiente conocido**: el dashboard tiene desbordamiento horizontal en pantallas estrechas. **Es previo a este bloque** (se reproduce igual en la versión anterior); la rejilla de la Historia lleva su propio scroll contenido.

## Repositorio y publicación

- **Remoto:** `https://github.com/eyeshar/MACCABIS.git` (público). Conectado el 04/08/2026.
- **Ramas publicadas:** `main` (es la que sirve GitHub Pages), `feat/rivales-jdm` y `feat/rivales-2026-27` (mergeadas a `main` el 25/09/2026; se conservan).
- El repositorio local **no estaba bajo git**; se inicializó en este bloque. El remoto tenía un único commit de subida manual (`45b31d9`) con una versión anterior del proyecto. Las dos historias estaban desconectadas y se unieron con `--allow-unrelated-histories`: **el commit `45b31d9` se conserva** como segundo padre del merge `b42576b`. Ningún archivo suyo se perdió.
- Hay una etiqueta local `pre-merge-remoto` (= `99e52d3`) como punto de retorno anterior a esa unión.
- **URL pública:** https://eyeshar.github.io/MACCABIS/

## Hecho y funcionando

### Historia del club: matriz de presencia 2013→2026 (rama `feat/historia-club-datos`)
- **84 personas** con sus temporadas de presencia en el club, en `data/historia_club.json`. **Cubre 2013-2025 sin huecos.**
- **2016/17 completada de verdad (04/08/2026).** El bloque anterior dio esa temporada por integrada, pero un filtro obsoleto en `completar_historia.js` impedía aplicar las hojas: los 4 jugadores que aportaba la hoja de Torneos 2017 nunca llegaron a la matriz. Corregido y verificado: **24 personas** constan ya en 2016/17, entre ellas las 20 de la hoja. (cerrado por Iván el 04/08/2026 a partir de `Historia_de_los_Maccabi.xlsx` + SportEasy).
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
11. **"Pupo" (2016/17) sigue sin identificar** — investigado el 04/08/2026 y **no resuelto a propósito**: su única traza es la fila del Excel de la Historia. No aparece en ninguno de los 17 Excel de estadísticas (2016/17 es la única temporada sin ellos) ni en ninguna hoja de inscripción. Los 20 nombres de la hoja de Torneos 2017 están todos identificados y cada uno tiene su propia fila en la matriz. **Falta la hoja de la liga de 2016/17 (37 JDM)**, que no está entre los PDF: es la vía con más recorrido para identificarlo.
12. **Adán Herrera Benzán jugó 3 partidos en 2017/18 sin constar en ninguna hoja de esa temporada** (sí en 2018/19, 2021/22 y 2022/23). O falta su hoja, o se inscribió fuera de plazo. Anomalía de la fuente.
13. **Las 4 hojas transcritas por visión conviene repasarlas** (2013/14 MdL, 2014/15 MdL y las dos de 2017/18): son escaneos sin capa de texto, leídos de la imagen. Están en `docs/fichas_transcritas.json`.
14. ~~**Cuatro personas con estadísticas que no están en la matriz de historia**~~ — Ignacio Ferrando del Rincón (23/24), Ramón Mora-Gil Jiménez (21/22 y 23/24), Javier Páez García (20/21) y Daniele Vallesi (21/22, 23/24, 24/25). **No se han fusionado con nadie**: había parecidos superficiales (otro Ramón, otro Javier, otro Ignacio) que son personas distintas. Falta decidir si se añaden a la matriz o si su ausencia es intencionada. `npm run check:personas` los avisa en cada ejecución.
15. **Partidos sin estadística individual**: 3 en 15/16 (5, 11 y 18) y 9 en 21/22 (10 al 18). El marcador sí consta; el boxscore no se ha fabricado y salen marcados como "sin stats".

## En curso / decidido pero no empezado

- **Migración al stack Next.js + Supabase + Vercel.** Arquitectura aprobada. No iniciada.
- ~~**Orden acordado:** (1) zona pública (estadísticas + histórico) primero; (2) histórico del club; (3) login + zona de gestión; (4) convocatorias (esperan a octubre, inicio de liga — lo menos urgente).~~
- **Orden vigente (25/09/2026, D32):** (1) calendario 26/27 con horas y carga en SportEasy; (2) actas y estadísticas automáticas; (3) convocatorias con doble ficha (estreno en la jornada 3, D34); después, la migración a Next.js y la zona de gestión.

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
