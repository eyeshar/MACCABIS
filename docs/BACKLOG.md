# BACKLOG — Proyecto Maccabis

> Lo pendiente, por prioridad. Se reordena según urgencia y decisiones.
> _Reordenado el 25/09/2026 (D30–D34) y actualizado el mismo día al cerrar el bloque "Cierre del sondeo y cimientos 26/27" (D35–D43)._

## ORDEN VIGENTE (26/09/2026, bloque "Plataforma v0", D44–D57)

> Manda sobre todo lo de abajo. SportEasy sale de la operativa desde la J2 (D44): las tareas antiguas de "cargar el calendario en SportEasy" (plantilla del soporte, agente) quedan **canceladas**.

1. **[ESTE BLOQUE] Plataforma v0: identidad, zona personal y pedido de ropa** — rama `feat/plataforma-v0`, **sin mergear**.
   - [x] Esqueleto Next.js en `plataforma/` + migraciones con RLS en todas las tablas + semilla de la plantilla 26/27 y enlaces.
   - [x] Zona personal `/j/<enlace>`, pedido de ropa (VIVE), zona de gestión (jugadores y enlaces, pedidos, Excel para VIVE).
   - [x] Pruebas de extremo a extremo (`npm run pruebas`, 81 comprobaciones OK).
   - [x] Supabase real creado por Iván, migraciones y semilla aplicadas, Iván gestor; verificación de seguridad contra el proyecto real 42/42 OK (26/09/2026).
   - [x] Nombres visibles confirmados (D61). Dorsal libre en pedidos para familiares (D60).
   - [ ] **Iván:** configurar Vercel (carpeta raíz `plataforma`, 2 variables públicas) y revisar la **vista previa** de `feat/plataforma-v0` con la lista de comprobación. Hasta entonces **no se comparte nada con los jugadores**.
   - [ ] **Iván:** en Supabase, Authentication → URL Configuration → Site URL = la URL de Vercel (para "He olvidado la contraseña").
   - [ ] Dar de alta como gestores a Carlos y Edu cuando tengan su usuario (`npm run db:gestor`).
   - [ ] Merge a `main` tras la verificación de Iván.
2. **Bloque siguiente, para la J2 (11/10):** staging de Supabase (D53); **calendario único** (carga inicial desde el Ayuntamiento o desde el calendario de los delegados subido una vez); eventos editables por gestores; entreno recurrente con todos los que entrenan convocados; **"Mi semana"** (disponibilidad por partido, plazo martes 22:00); lista de quién va (D46); panel de disponibilidad con recordatorio de WhatsApp; pase de lista posterior; detector de cambios con Aceptar/Ignorar (D47, ver `docs/SONDEO_CALENDARIO_AYTO.md`).
3. **Motor de convocatoria v0.1 para la J3 (18/10):** solo restricciones duras (D48, `docs/REGLAS_CONVOCATORIA.md`); nivel y rotación entre la J4 y la J6.
4. **Subida de actas desde la zona de gestión** (hoy: `npm run jornada`, `docs/PROCEDIMIENTO_JORNADA.md`).
5. **Migración del dashboard** a la plataforma.
6. **Estadísticas de rivales** (`docs/SONDEO_RIVALES_STATS.md`; datos por jugador de otros equipos solo en gestión).
7. **Tesorería** (solo registro de cuentas, D52).

**Además:**
- [ ] **Exportar el balance de asistencias de SportEasy antes de apagarlo** (noviembre), para conservar los eventos de 26/27.
- [ ] **Una única consulta a Indalweb** (soporte@gesdeportiva.es) sobre una exportación oficial de actas y estadísticas; si dicen que no, se cierra (D49).
- [x] ~~Mergear `feat/pipeline-estadisticas`~~ — HECHO (26/09/2026, `f69a39f`), test de regresión OK en `main`. Listo para la J1 (5/10).
- [ ] `feat/calendario-automatico`: revisar y mergear como detector de cambios (D47), dentro del bloque de la J2.

---

## Ahora — arranque de la temporada 2026/27 (jornada 1: domingo 4/10, D38) — _histórico; ver "Orden vigente" arriba_

### 0. Pendiente de Iván (desbloquea lo demás)
- [ ] **Verificar con Claude Code la rama `feat/pipeline-estadisticas`** y decidir si se mergea **antes del 4/10**. Es lo que procesa la jornada 1 (ver punto 2).
- [ ] **Verificar la rama `feat/calendario-automatico`** (se mergea después de la del pipeline).
- [ ] **Prueba de exportación de SportEasy:** ¿"Asistencias → Por eventos → exportar" incluye **eventos futuros con respuestas** (p. ej. el amistoso del 27/09)? Indicio: el export de hoy llega sólo hasta el 23/09 (`docs/SPORTEASY.md`). Decide la "Decisión pendiente" de abajo.
- [ ] **Pedir al soporte de SportEasy la plantilla Excel de importación del calendario** (vía principal, D36).
- [ ] **Leer la cláusula literal de SportEasy** (`docs/SPORTEASY.md`) y decidir si se mantiene el agente de carga como plan B (D36).
- [ ] **Guardar en `privado/`** (fuera de git) los datos por jugador para convocar: posición, base secundario, nivel, si dobla, si entrena. Code no lo lee hasta que se pida.
- [ ] **Responder las preguntas abiertas** de `docs/REGLAS_CONVOCATORIA.md` (7 preguntas).
- [ ] **Corregir el delegado del MdA** en la organización (Varas → Barreiro; Barreiro también en el MdL).
- [ ] **Localizar las 40 hojas XLSX de 25/26** que faltan (sólo si se quiere regenerar la 25/26 con hora, pista y las 3 correcciones; ver ESTADO). No es urgente.
- [x] ~~Confirmar `docs/PLANTILLA_26-27.md`~~ — HECHO (25/09/2026): 3 personas nuevas creadas, `previsto_2627` actualizado, tabla de motes.
- [x] ~~Recuperar la hoja de Torneos 2018 del MdL~~ — **irrecuperable** (Iván): congelada como "sin PDF" con sus 17 nombres (D41).
- [x] ~~Decidir sobre el sondeo de actas~~ — HECHO: un solo gesto de Iván; sin permiso de la FBM (D35).

### Decisión pendiente — ¿sustituir YA la confirmación de disponibilidad de SportEasy?
**Si el Excel de SportEasy no trae eventos futuros** (prueba de Iván arriba), la disponibilidad semanal no se puede sacar de SportEasy y habría que adelantar a 26/27 lo que D30 dejaba para 27/28: una función propia de confirmación de disponibilidad. Dos opciones:
- **(a) Cuentas de usuario** para los ~22 jugadores (login real, Supabase Auth). Más robusto; más fricción para el jugador (registro y contraseña).
- **(b) Enlace personal sin contraseña** por jugador (un enlace secreto por persona, que se manda por WhatsApp). Cero fricción; si el enlace se reenvía, otro puede contestar por él.
- **Requisito en las dos:** **roles separados**. Un jugador **nunca** puede ver niveles ni datos de gestión (D39); sólo su propia disponibilidad (y como mucho, quién va).
- **Depende de** la prueba de exportación de Iván. No se construye nada hasta decidir.

### 1. Calendario 26/27 con horas + carga en SportEasy
- [x] **Tabla limpia del calendario y marcadores desde datos abiertos** — HECHO en rama `feat/calendario-automatico` (sin mergear): `data/calendario_2026-27.json` + `data/sporteasy_calendario_2026-27.csv`, por código de equipo, con margen entre las dos fichas del mismo domingo. Workflow gratuito (aviso semanal + descarga con botón). `docs/CALENDARIO.md`.
- [ ] **Cuando el portal publique la 26/27:** `--descubrir`, confirmar los códigos de MdA (G1) y MdL (G2) con el acta de la jornada 1 y escribirlos en `scripts/calendario/config_2026-27.json`.
- [ ] **Mientras no publique (probable en la jornada 1, D38):** transcribir el calendario que reciban los delegados a `data/calendario_manual_2026-27.csv`.
- [ ] **Carga en SportEasy con la plantilla del soporte** (D36). Plan B: agente supervisado (D31), si Iván lo mantiene.
- [x] ~~Arreglar la URL del 300257~~ — HECHO (25/09/2026): el portal renumeró los recursos; tabla nueva en `build_rivales_2026_27.py`, resultado idéntico.
- [ ] Refrescar la pestaña de rivales con los grupos definitivos cuando el 211549 publique la 26/27.

### 2. Actas y estadísticas (primera prioridad de construcción, D32)
- [x] **Pipeline local reproducible** — HECHO en rama `feat/pipeline-estadisticas` (sin mergear): `scripts/estadisticas/`, en Node, integrado en `build:datos`. Test de regresión contra 2025/26 superado (`npm run test:regresion`). Guarda además **hora y pista**.
- [x] **"Un solo gesto" semanal** — HECHO en la misma rama: `npm run jornada`. Iván descarga actas y hojas sin renombrar; el comando copia a `fuentes_fbm/2026-27/` (fuera de git), valida y resume.
- [ ] **Jornada 1 (4/10):** primera ejecución real de `npm run jornada` (requiere haber mergeado la rama).
- [ ] Probar la lectura del **export directo de SportEasy** con partidos de liga de 26/27 (hasta ahora sólo hay amistosos y entrenamientos).
- [ ] Opcional: sugerir al Ayuntamiento que publique los anotadores en datos abiertos (sondeo, apartado 6).
- [x] ~~Tabla 2026/27 del diccionario de nombres (dos "Eduardo")~~ — resuelto por la tabla de motes de `docs/PLANTILLA_26-27.md`; las hojas de la FBM traen nombre completo.

### 3. Convocatorias con doble ficha (estreno en la jornada 3, D34)
- [x] **Reglas de convocatoria v0** — DOCUMENTADAS (25/09/2026): `docs/REGLAS_CONVOCATORIA.md` (sin nombres ni niveles). Se validan en las jornadas 1 y 2, convocadas a mano con el chat de diseño (D40).
- [ ] **Flujo semanal objetivo** (sin cambios): lunes disponibilidad (recordatorios: SportEasy Premium, D37) · lunes-martes propuesta de reparto MdA/MdL · martes mensaje de WhatsApp · domingo noche actas y estadísticas (`npm run jornada`).
- [ ] **Reglas v1** tras las jornadas 1 y 2, con los ajustes anotados por Iván.
- [ ] Jornadas 1 y 2: se convocan como hasta ahora, aplicando las reglas v0 a mano (D34, D40).

### 4. Hacia 27/28: sustituir SportEasy (D30)
- [ ] **Confirmación de disponibilidad:** primera función candidata. Puede adelantarse a 26/27: ver "Decisión pendiente" arriba.

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

- [x] **`data/season_2026-27.json` creado vacío con la plantilla** (rama `feat/pipeline-estadisticas`). Se carga partido a partido con `npm run jornada`.
- [x] ~~Preparar calendario 26/27 para SportEasy.~~ → "Ahora", punto 1 (tabla limpia + agente supervisado, D31).
- [x] **Plantilla 26/27 confirmada** (25/09/2026): 24 deportistas, 22 en ambas fichas; 3 personas nuevas creadas. `docs/PLANTILLA_26-27.md`.
- [x] **`consolidar_fichas.js` adaptado a 26/27** (25/09/2026): sólo "Deportista", con grupo (la fecha de alta no se publica); falla si falta un PDF registrado; Torneos 2018 congelada (D41).

## Notas de datos disponibles (ya subidos por Iván en el chat de arranque)

- Hojas de inscripción oficiales MdA y MdL (con DNI, fecha nacimiento, teléfono, email, altas/bajas). DATOS SENSIBLES → zona protegida. Útiles para nombres completos oficiales y altas/bajas.
- `Historia_de_los_Maccabi.xlsx` (histórico del club 2013-2026).
- Estadísticas Carlos 23/24 y 24/25 (MdA .xlsx, MdL .xls).
- `Equipo_MdL_2025-2026_Claude.xlsx` (pendiente de revisar en detalle).
