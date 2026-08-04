# BACKLOG — Proyecto Maccabis

> Lo pendiente, por prioridad. Se reordena según urgencia y decisiones.

## Ahora (bloque 1: arranque + zona pública)

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
- [x] **Segunda hoja de Torneos Municipales 2017 (Nº EQUIPO 120202, MdL, 17 jugadores)** — **DESCARTADA (04/08/2026)**. Iván la comparó con la 119823: misma competición y mismo equipo, y sus 17 nombres son un **subconjunto** de los 20 de la 119823 (le faltan Ballesteros, Carrera y Moral). **No aporta ninguna persona nueva**, así que no se integra: el pipeline ya se queda con la hoja de más jugadores y descartarla no pierde nada. La matriz de 2016/17 (24 personas) queda intacta y correcta. No existe PDF de esa hoja ni en el repositorio ni en el equipo de Iván —su única traza es una captura—, así que **no hay que seguir buscándolo**.
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

- [ ] **DECIDIR el criterio de identificación del club — BLOQUEA la descarga masiva.** La
  Fase 0 (04/08/2026, ver `docs/SONDEO_JDM_FASE0.md`) confirmó que el dataset **sí trae
  nuestros partidos** (8 de 8 jornadas de 2014/15 coinciden en rival y marcador exacto con el
  histórico propio), pero **no hay identificador estable de club**: el nombre tiene más de 8
  variantes y el `Codigo_equipo` cambia por temporada y por inscripción. Dos ambigüedades
  concretas a resolver:
  - **2014/15**: existe un club RIVAL llamado `MACCABI` (#95466) que un filtro por nombre
    capturaría como si fuera nuestro.
  - **2020/21**: tres equipos con 14 partidos (`MDL`, `MDA` y `MACCABI DE LEVANTAR`) y no se
    sabe cuál es cuál.
  - Propuesta pendiente de luz verde: validar cada código candidato contra el histórico propio
    (rival + marcador). Implica cruzar con `season_*.json`, que el bloque de sondeo prohibía.
- [ ] **Partidos de rivales (Fases 1 y 2)**: descargar y filtrar las 10 temporadas y guardar
  una fuente nueva e independiente (`data/rivales_jdm.json`). En espera de la decisión anterior.
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

## Más adelante (bloque 4: convocatorias — esperar a octubre)

- [ ] **Convocatorias con doble ficha MdA/MdL** — el mayor dolor, pero espera al inicio de liga (octubre).
  - Cruzar disponibilidad (de export SportEasy) para decidir quién juega en cada ficha.
  - Generar mensaje de WhatsApp de convocatoria listo para copiar/pegar.
  - Generar recordatorio para quien no ha contestado.
- [ ] **Puente con SportEasy**:
  - Generar el Excel del calendario de la temporada en formato importable (evita crear ~20 eventos a mano por equipo). Preparar cuando salga el calendario 26/27.
  - Investigar la sección "Campeonatos" de SportEasy para vincular la liga JDM y traer el calendario hecho.
  - PRESIONAR por vías de sacar/subir datos de SportEasy más allá del Excel (deseo de Iván). Si no sale nada, Excel plan B.

## Temporada 26/27 (cuando arranque y se defina)

- [ ] Crear entrada de temporada 26/27 y cargar partido a partido.
- [ ] Preparar calendario 26/27 para SportEasy.

## Notas de datos disponibles (ya subidos por Iván en el chat de arranque)

- Hojas de inscripción oficiales MdA y MdL (con DNI, fecha nacimiento, teléfono, email, altas/bajas). DATOS SENSIBLES → zona protegida. Útiles para nombres completos oficiales y altas/bajas.
- `Historia_de_los_Maccabi.xlsx` (histórico del club 2013-2026).
- Estadísticas Carlos 23/24 y 24/25 (MdA .xlsx, MdL .xls).
- `Equipo_MdL_2025-2026_Claude.xlsx` (pendiente de revisar en detalle).
