# BACKLOG — Proyecto Maccabis

> Lo pendiente, por prioridad. Se reordena según urgencia y decisiones.
> _Reordenado el 25/09/2026 (D30–D34): arranque de la 26/27 primero; actas automáticas y convocatorias por delante de la migración a Next.js._

## Ahora — arranque de la temporada 2026/27

### 0. Pendiente de Iván (desbloquea lo demás)
- [ ] **Confirmar `docs/PLANTILLA_26-27.md`**: 3 personas nuevas (García Gijón, Santos Artiles, Teruel Fernández), actualizar `previsto_2627`, y corregir el delegado del MdA (Varas → Barreiro; Barreiro también en el MdL).
- [ ] **Recuperar la hoja de Torneos 2018 del MdL** (antiguo `docs/Fichas/MDL.pdf`), sobrescrita al copiar la hoja de 26/27. Guardarla con otro nombre. Hasta entonces **no ejecutar `npm run fichas` ni `npm run build:datos`** (ver PLANTILLA_26-27).
- [ ] **Probar el export de Asistencias de SportEasy con eventos futuros** (pregunta clave, `docs/SPORTEASY.md`). Decide cómo se obtiene la disponibilidad cada lunes.
- [ ] **Comprobar si la liga JDM Moratalaz está en "Campeonatos"** de SportEasy (D31; casi seguro que no).
- [ ] **Decidir sobre el sondeo de actas** (`docs/SONDEO_ACTAS_FASE0.md`): aceptar el "un solo gesto" semanal, dónde se dejan los ficheros, si se pide permiso a la FBM / al portal, y si la Action de datos abiertos va sola o con botón.
- [ ] **Definir las reglas de convocatoria** (ver abajo).

### 1. Calendario 26/27 con horas + carga en SportEasy (antes de la jornada 1, ~17/10)
- [ ] **Tabla limpia del calendario 26/27** (Code): fecha, **hora**, pista, rival, local/visitante, campeonato (MdA G1 / MdL G2). Fuente: CSV del dataset 211549 en cuanto se publique; plan B, el calendario que reciban los delegados. La hora es imprescindible (D33).
- [ ] **Carga en SportEasy con agente supervisado** (D31): ~44 partidos, dos campeonatos, **piloto de 2 partidos** revisado por Iván antes del resto. El agente sólo transcribe la tabla limpia.
- [ ] **Arreglar la URL del 300257** en `scripts/build_rivales_2026_27.py`: `…/egob/catalogo/300257-{n}-…csv` ahora redirige a otra numeración de recursos (sondeo de actas, punto 4). Localizar el CSV desde la página del dataset.
- [ ] Refrescar el 211549 y regenerar la pestaña de rivales con los grupos definitivos (MdA en G1, MdL en G2).

### 2. Actas y estadísticas automáticas (primera prioridad de construcción, D32)
- [ ] **Pipeline local reproducible** (`generar_temporada`): hoy `parse_stats.py` lee de `/mnt/user-data/uploads` y `generar_temporada.py` es un esqueleto. Reconstruirlo y probarlo contra las 42 actas y 41 hojas de 2025/26 hasta reproducir `season_2025-26.json`. Guardar además **hora y pista** del acta.
- [ ] **"Un solo gesto" semanal**: Iván deja las 2 actas + 2 hojas de la jornada en un sitio fijo y el pipeline verifica y publica. Actas y estadísticas **no** se pueden descargar solas de forma legítima (robots.txt y avisos legales de la FBM).
- [ ] **Calendario y marcadores desde datos abiertos** (211549) con GitHub Actions: semanal o con botón. Sin login ni secretos. Riesgos en el sondeo.
- [ ] Opcional: carta a la FBM / Gesdeportiva pidiendo permiso o un acceso tipo feed.
- [ ] Tabla 2026/27 del diccionario de nombres (ojo: dos "Eduardo" en la plantilla).

### 3. Convocatorias con doble ficha (estreno en la jornada 3, ~18/10, D34)
- [ ] **Flujo semanal objetivo:**
  - **Lunes:** disponibles para el entrenamiento del miércoles y el partido del domingo; recordatorio a quien no ha contestado (SportEasy lo hace de serie en Premium con la relance automática).
  - **Lunes–martes:** propuesta de reparto MdA/MdL según las reglas de convocatoria y los horarios de los dos partidos (D33); Iván ajusta.
  - **Martes:** mensaje de convocatoria de WhatsApp generado, listo para copiar y pegar.
  - **Domingo noche:** actas y estadísticas procesadas y publicadas (con el "un solo gesto" de Iván, ver bloque 2).
- [ ] **Reglas de convocatoria (pendiente de que Iván las defina):** hoy son criterio propio de Iván. Hay que escribirlas como reglas explícitas antes de automatizar el reparto. Mínimo: qué es "solapar" (duración de partido, margen entre pistas), prioridades entre fichas, mínimos y máximos por partido, cómo cuentan asistencia a entrenamientos y rotación, quién no puede doblar. D33 fija la única regla ya cerrada: doblar sólo si los horarios no se solapan.
- [ ] Jornadas 1 y 2: se convocan como hasta ahora (D34).

### 4. Hacia 27/28: sustituir SportEasy (D30)
- [ ] **Confirmación de disponibilidad: primera función candidata a sustituir SportEasy en 27/28.** Es la que alimenta el flujo semanal y la que peor se extrae de SportEasy (no hay API y no consta que el export traiga eventos futuros).

## Después — migración a Next.js (continúa, por detrás de lo anterior, D32)

- [ ] **Arrancar el proyecto en Claude Code** (repositorio, Next.js base, conectar Supabase + Vercel). Iván debe crear cuentas gratuitas de Supabase y Vercel (credenciales NUNCA por chat; se manejan en Claude Code).
- [ ] Elegir **nombre para la sesión de Claude Code** (TCPC usa "Fable").
- [ ] **Migrar el dashboard de estadísticas 25/26** (v1 web estática) a la zona pública del nuevo stack.
- [x] **Integrar estadísticas históricas** de Carlos — HECHO (rama `feat/historico-temporadas`, 04/08/2026).
  - Las **10 temporadas** con estadística (13/14, 14/15, 15/16, 17/18, 18/19, 19/20, 20/21, 21/22, 23/24, 24/25) más los MdA agregados de 23/24 y 24/25.
  - Resuelto con **selector de temporada en el mismo dashboard** (ver DECISIONS D8), no aparte.
  - Pipeline reproducible: `npm run build:datos`. Informe en `docs/INFORME_HISTORICO.md`.

### Pendiente del histórico (cabos sueltos, ninguno bloquea)

- [ ] **Verificar la ficha de Ignacio Mateos Aparicio** ("Nacho S.", 23/24 y 24/25): la tabla MdA confirma que jugaba en las dos fichas (36 puntos en el MdA de 23/24), pero sigue sin aparecer en las fichas de inscripción MdL. Falta localizar en qué ficha constaba.
- [x] **Ampliar el diccionario de nombres al MdA** — HECHO (04/08/2026). Iván cerró las tablas `### 2023/24 (MdA)` y `### 2024/25 (MdA)`; los 37 motes resuelven a persona real y no queda ninguno sin catalogar.
- [ ] **Resolver 3 motes sueltos del MdL**: `Paaco` y `Coach` (14/15, sin puntos) y `Víctor` (17/18, **6 puntos**). No se han deducido: hace falta una fila explícita en el diccionario.
- [x] **Unificar el `person_id` de Víctor Martínez** — HECHO (04/08/2026). Unificado a `martinez-martinez-victor` en todos los datos.
- [x] **4 personas con estadísticas ausentes de la matriz** — HECHO (04/08/2026): añadidas en los años que confirman las actas.
- [x] **Identificar los nombres de hojas de inscripción** — HECHO (04/08/2026): 5 personas creadas y el "Alejandro de Alicante" unificado.
- [x] **Confirmar las correspondencias dudosas** — HECHO (04/08/2026): dos eran erratas de nombre y tres se confirmaron como alias.
- [x] **Fijar el criterio de los "Torneos Municipales"** — HECHO (04/08/2026): pertenecen a la temporada que termina en ese año; liga y torneo se suman (D19).
- [x] **Aplicar de verdad las hojas de torneo a la matriz** — HECHO (04/08/2026): retirado el filtro obsoleto que las excluía todas; 2016/17 pasa de 20 a 24 personas (D23).
- [x] **Las dos hojas de Torneos Municipales 2017 (#119823 y #120202)** — **ACLARADO (04/08/2026), corrigiendo la descripción anterior.** Eran **DOS TORNEOS DISTINTOS**, no dos versiones de la misma inscripción: el dataset del Ayuntamiento demuestra que cada código tiene sus propios partidos, en sedes y distritos distintos y contra rivales distintos, los mismos tres días (23/04, 07/05 y 14/05 de 2017):
  - `#119823` → **Vicálvaro** (CDM Valdebernardo): vs Sáinz de Vicuña B, Amazonia y VBA.
  - `#120202` → **Moratalaz** (pabellones 1 y 2): vs Inmsershore, Mistery Men y Fontarrón.
  - **Para la MATRIZ DE PERSONAS la conclusión anterior sigue siendo válida**: la plantilla de la 120202 es un subconjunto de la de la 119823 (jugaron casi los mismos), así que **no entró nadie nuevo y la matriz de 2016/17 no cambia** (24 personas). Lo que estaba mal era la descripción: no era "la misma competición con una hoja más corta", eran dos torneos con plantilla solapada.
  - **Los 6 partidos SÍ constan** en `data/rivales_jdm.json`, etiquetados con `fase: "torneo"`.
  - Del PDF de la 120202 sigue sin haber copia (sólo una captura), pero ya no hace falta: sus partidos están en el portal.
- [ ] **Identificar a "Pupo" (2016/17)** — investigado el 04/08/2026 sin resultado: no aparece en ninguna estadística ni en ninguna hoja conservada. Se planteó que la hoja 120202 pudiera contenerlo; al resolverse que es un subconjunto de la 119823, **esa vía queda descartada**. Pupo y los otros tres con 2016 que no salen en ninguna hoja (Alan Venegas, Carlos Pérez Núñez y Juan Carlos Blázquez) siguen viniendo sólo del Excel de la Historia. La vía que queda es **localizar la hoja de inscripción de la liga 2016/17 (37 JDM)**, que falta en `docs/Fichas`; si aparece, el nombre que no esté en ninguna otra será Pupo. Alternativa: preguntar a Carlos o a quien jugara ese año.
- [ ] **Repasar las 4 hojas transcritas por visión** (2013/14 MdL, 2014/15 MdL y las dos de 2017/18): son escaneos sin texto, leídos de la imagen. En `docs/fichas_transcritas.json`.
- [ ] **Aclarar el caso de Adán Herrera Benzán**: jugó 3 partidos en 2017/18 sin constar en ninguna hoja de esa temporada.
- [ ] **Cabos del diccionario de la matriz** (`docs/HISTORIA_diccionario_matriz.md`): desambiguar 'Sam' (Rogaia vs Gruppo) por año, repartir 'Ignacio' entre Ferrando/Mileo/Mateos, y confirmar 'Jose' 2020 = Gil Fernández (confianza media).
- [ ] **Revisar 3 celdas del MdA 23/24** con decimales donde debería haber enteros (marcadas con "?" en el dashboard).
- [ ] **Recuperar, si existen, las actas de los partidos sin estadística individual**: 15/16 (5, 11, 18) y 21/22 (10 al 18).
- [ ] **Enriquecer las históricas** si aparecen las fuentes: fechas de partido, dorsales, parciales por cuarto del MdL y asistencia. Hoy no existen y por eso esas columnas y pestañas ni se muestran.

## Rivales y clasificaciones desde datos abiertos (JDM)

Fuente: dataset **300257** del portal de datos abiertos del Ayuntamiento de Madrid
(licencia CC BY 4.0, republicable citando la fuente). Cubre **10 temporadas**: 2014/15,
2015/16, 2016/17, 2017/18, 2018/19, 2020/21, 2021/22, 2022/23, 2023/24 y 2024/25.

- [x] **Criterio de identificación del club** — RESUELTO (04/08/2026): por **Nº EQUIPO de la hoja de inscripción**, que es el `Codigo_equipo` del dataset. Descarta solo el club rival `MACCABI` de 2014/15 y los homónimos.
- [x] **Partidos de rivales** — HECHO (04/08/2026): `data/rivales_jdm.json` con **328 partidos** de 10 temporadas, informe en `docs/RIVALES_JDM.md`. Fuente independiente, sin cruzar con el histórico propio.
- [x] **2020/21, el tercer equipo** — RESUELTO por ficha: nuestros son #149302 (MdL) y #149303 (MdA); **#149233 no es del club**.
- [ ] **Diccionario de nombres de rival** (bloque futuro, no ahora): decidir sobre 20 pares de nombres que podrían ser el mismo equipo escrito de dos formas (`SETTAS`/`CAFÉ HNOS. VELASCO SETTAS`, `CDCEBE`/`CD CEBE`, `SUIZA`/`SUIZA B.C`/`CARPASION SUIZA`…). **No se han fusionado**: la fuente guarda el nombre literal. Ver `docs/RIVALES_JDM.md`.
- [x] **Los 3 recuentos que no cuadraban** — **DIAGNOSTICADOS (04/08/2026)**, ver `docs/CONTRASTE_JDM_HISTORICO.md`. No hay error en ninguna de las dos fuentes: recogen cosas distintas. 2014/15 y 2015/16 → el portal **no publica la fase MARCA** (3 y 2 partidos) y añade una **incomparecencia 2-0** que el club no anotó. 2018/19 → el portal incluye 3 partidos de **torneo** que el histórico propio no recoge.
- [ ] **BLOQUE FUTURO — Corregir la etiqueta MdL/MdA de 2017/18, 2018/19 y 2020/21, y documentar los huecos.** **VERIFICADO con evidencia interna de los Excel** (04/08/2026, ver `docs/DIAGNOSTICO_MDL_MDA.md`): esas tres temporadas llevan etiqueta `equipo: "MDL"` pero contienen las estadísticas del equipo que compitió como **Maccabi de Acostar**. Pruebas: la hoja `Clasificaciones` de cada fichero sitúa al MdA en el grupo cuyos rivales anota el Excel, y en 2020/21 el Excel **anota partidos contra `MDL` y contra `MACCABI DE LEVANTAR`** — nadie juega contra sí mismo. Confirmado también en sentido inverso: 2014/15, 2015/16 y 2021/22 sí son MdL.
  - **Huecos reales**: del MdL oficial de esas tres temporadas **no hay estadísticas de jugadores** en ninguna fuente del club, sólo su clasificación final. Sus partidos y marcadores sí están en `data/rivales_jdm.json`.
  - **Pendiente de decidir por Iván**: (a) si se corrige la etiqueta o si el club usa la convención "MdL = el equipo del que llevamos estadísticas"; (b) qué hacer con los huecos. **El rendimiento de los jugadores no cambia en ningún caso**: sólo bajo qué ficha se cuenta.
- [x] ~~**Añadir a `rivales_jdm.json` el tercer equipo de 2020/21 (`#149233`).** El bloque de rivales lo descartó por 0 % de coincidencia de marcadores, pero eso sólo probaba que no era el equipo del Excel: **la clasificación interna del Excel lo lista junto a `MDL` y `MDA` en el mismo grupo, así que sí era del club**. Faltan sus 14 partidos.~~ **CANCELADO (25/09/2026):** #149233 **no es del club**, es un rival. Lo resuelve la regla del nombre confirmada por Iván (D26): en 2020/21 ya existe `MDL`, así que el `MACCABI DE LEVANTAR` de ese año es otro equipo. `rivales_jdm.json` ya estaba bien.
- [ ] **Confirmar 2022/23** (bloque futuro): es la única temporada que quedó **sin validar** —no hay `season_2022-23.json` con el que contrastar—, así que su código se aceptó sólo por nombre dentro de Moratalaz. La 2016/17 sí quedó respaldada por los códigos de ficha.
- [ ] **Clasificaciones**: no se han tocado en el sondeo. Criterio ya acordado: la clasificación
  **de la fase donde acabó Maccabi** cada año. Los recursos de clasificaciones del dataset son
  los n impares (1, 5, 9, 13, 16, 20, 24, 28, 32).
- [ ] **Cruzar la fuente JDM con el histórico propio** (`season_*.json`, `personas.json`, la
  matriz): bloque futuro, sólo cuando la fuente JDM esté cerrada.
- [ ] **Tapar 2013/14, 2019/20 y 2025/26 desde las actas propias**: no están en el histórico
  del portal (2025/26 vive en el dataset 211549 de temporada en curso).
- [ ] **Vía de cruce descubierta**: el `Nº EQUIPO` de las hojas de inscripción es el
  `Codigo_equipo` de este dataset (verificado con #119823 y #120202 de Torneos 2017). Sirve
  para enlazar hojas y partidos sin depender del nombre.

## Siguiente (bloque 2: historia del club)

- [x] **Datos de la Historia integrados, reconciliados y completados** — HECHO (04/08/2026, rama `feat/historia-club-datos`): `data/historia_club.json` (80 personas), `data/personas.json` (registro único de identidades) y `data/fichas_inscripcion.json` (21 hojas oficiales cruzadas).
- [x] **Sección visual "Historia de los Maccabis"** — HECHO (04/08/2026, rama `feat/historia-club-ui`): pestaña "El Club" con rejilla maestra, tira temporal y ficha de persona enlazada con las estadísticas.
- [ ] **Arreglar el desbordamiento horizontal en móvil** del dashboard (previo a la Historia: afecta también a las pestañas antiguas).
- [ ] ~~Sección visual "Historia de los Maccabis"~~ — detalle original:
  - Matriz de 80 personas × 14 temporadas (2013→2026), con dorsal y nº de temporadas en activo por persona.
  - Idea: línea temporal del club, quién estuvo cada año, veteranía, "since 2013". Diseño visual y bonito.
  - Nota: el Excel tiene hojas "Equipo", "Copy of Equipo" (ordenada por dorsal) y "Sheet2". Usar la principal.

## Mejoras técnicas (prioridad baja, sin urgencia)

- [ ] **Agrupar las hojas de inscripción también por Nº de equipo** en `scripts/consolidar_fichas.js`. Hoy agrupa por año + equipo + competición y dentro de cada grupo se queda con la hoja de más jugadores; dos inscripciones distintas del mismo torneo caen en la misma clave y la más corta se descarta entera. Si algún año apareciera un caso donde la hoja corta tuviera a alguien que la larga no, se perdería en silencio. **Hoy no ocurre** —el único caso conocido, la 120202 de 2017, es subconjunto de la 119823 y no tiene exclusivos—, así que no corre prisa. El arreglo es incluir el Nº de equipo en la clave para que dos inscripciones **sumen**, igual que ya suman liga y torneo. No hay riesgo de doble conteo: la unión de nombres deduplica.

## Después (bloque 3: gestión — requiere login)

- [ ] Montar **login real** (Supabase Auth) y estructura de la zona de gestión (solo los 3 gestores).
- [ ] Diseñar la zona de gestión con pantallas reales (no en abstracto).
- [ ] **Tesorería / cuentas** (Eduardo). Datos sensibles → zona protegida.

## ~~Más adelante (bloque 4: convocatorias — esperar a octubre)~~ → subido a "Ahora", punto 3 (25/09/2026)

- [ ] **Convocatorias con doble ficha MdA/MdL** — el mayor dolor. _Ver el flujo semanal y las reglas en "Ahora", punto 3._
  - Cruzar disponibilidad (de export SportEasy) para decidir quién juega en cada ficha.
  - Generar mensaje de WhatsApp de convocatoria listo para copiar/pegar.
  - Generar recordatorio para quien no ha contestado.
- [ ] **Puente con SportEasy**:
  - Generar el Excel del calendario de la temporada en formato importable (evita crear ~20 eventos a mano por equipo). Preparar cuando salga el calendario 26/27.
  - Investigar la sección "Campeonatos" de SportEasy para vincular la liga JDM y traer el calendario hecho.
  - PRESIONAR por vías de sacar/subir datos de SportEasy más allá del Excel (deseo de Iván). Si no sale nada, Excel plan B.

## Temporada 26/27 (cuando arranque y se defina)

- [x] **Decidir los candidatos a mismo equipo** — HECHO en parte (25/09/2026): Iván confirmó 7 alias (D27) y descartó SPORTING DE VALLECAS (y variantes) y GSD VALLECAS como VALLEKAS BASKET.
- [ ] **Candidatos que siguen sin confirmar** (7, en `docs/RIVALES_2026-27.md`): ENFERMOS DEL BASKET, LITROS DE MAU, Litros de Pahou, JVK - Jugones ValleKas, THE RED BOYS, PONENOS, RH PROPERTIES PONENOS.
- [ ] **Regla del nombre del club fuera de Moratalaz** (D26): se ha aplicado dentro del distrito del club. Leída para todo Madrid chocaría con las fichas de 16/17, 17/18 y 18/19, porque había otro equipo "MDL" en Retiro. Confirmar que el ámbito es el distrito del club.
- [ ] **Pelota Naranja 08/03/2026 (MdL)**: el portal da 20-0 por incomparecencia y `season_2025-26.json` 0-0. Decidir si se corrige el histórico propio (bloque aparte, staging).
- [ ] **2019/20**: `season_2019-20.json` (etiqueta MDL) anota un partido contra "MDL" → probablemente es el MdA. Revisar junto con la decisión pendiente de DIAGNOSTICO_MDL_MDA (17/18, 18/19, 20/21).
- [ ] **Refrescar el 211549** cuando arranque la 26/27: el dataset "temporada en curso" pasará a la nueva temporada y la 2025/26 debería aparecer en el histórico 300257. Guardar antes otra copia bruta con fecha.
- [x] **Pestaña "Rivales 26/27"** — EN PRODUCCIÓN (25/09/2026): aprobada por Iván con los retoques de D29 y mergeada a `main`. https://eyeshar.github.io/MACCABIS/?p=rivales&g=MdL
- [ ] **Regenerar la pestaña de rivales cada temporada cuando salgan los grupos**: actualizar `RIVALES` en `scripts/build_rivales_2026_27.py` (y el nombre de la temporada), descargar el 211549 y el 300257, correr el script de Python y después `npm run build:rivales`.
- [ ] Añadir un `favicon.ico` (el único error de consola del sitio es su 404).

- [ ] Crear entrada de temporada 26/27 y cargar partido a partido. _(Ver "Ahora", puntos 1 y 2.)_
- [x] ~~Preparar calendario 26/27 para SportEasy.~~ → "Ahora", punto 1 (tabla limpia + agente supervisado, D31).
- [x] **Plantilla 26/27 extraída** (25/09/2026): 24 deportistas, 22 en ambas fichas; en `data/fichas_inscripcion.json` y `docs/PLANTILLA_26-27.md`. Falta la confirmación de Iván (punto 0).
- [ ] **Adaptar `consolidar_fichas.js` a 26/27** tras la confirmación: filtrar "Delegado/a" (no son jugadores), guardar grupo y fecha de alta, y no perder la hoja de Torneos 2018.

## Notas de datos disponibles (ya subidos por Iván en el chat de arranque)

- Hojas de inscripción oficiales MdA y MdL (con DNI, fecha nacimiento, teléfono, email, altas/bajas). DATOS SENSIBLES → zona protegida. Útiles para nombres completos oficiales y altas/bajas.
- `Historia_de_los_Maccabi.xlsx` (histórico del club 2013-2026).
- Estadísticas Carlos 23/24 y 24/25 (MdA .xlsx, MdL .xls).
- `Equipo_MdL_2025-2026_Claude.xlsx` (pendiente de revisar en detalle).
