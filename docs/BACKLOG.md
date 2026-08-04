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
- [x] **Fijar el criterio de los "Torneos Municipales"** — HECHO (04/08/2026): pertenecen a la temporada que termina en ese año; liga y torneo se suman.
- [ ] **Repasar las 4 hojas transcritas por visión** (2013/14 MdL, 2014/15 MdL y las dos de 2017/18): son escaneos sin texto, leídos de la imagen. En `docs/fichas_transcritas.json`.
- [ ] **Aclarar el caso de Adán Herrera Benzán**: jugó 3 partidos en 2017/18 sin constar en ninguna hoja de esa temporada.
- [ ] **Cabos del diccionario de la matriz** (`docs/HISTORIA_diccionario_matriz.md`): desambiguar 'Sam' (Rogaia vs Gruppo) por año, repartir 'Ignacio' entre Ferrando/Mileo/Mateos, y confirmar 'Jose' 2020 = Gil Fernández (confianza media).
- [ ] **Revisar 3 celdas del MdA 23/24** con decimales donde debería haber enteros (marcadas con "?" en el dashboard).
- [ ] **Recuperar, si existen, las actas de los partidos sin estadística individual**: 15/16 (5, 11, 18) y 21/22 (10 al 18).
- [ ] **Enriquecer las históricas** si aparecen las fuentes: fechas de partido, dorsales, parciales por cuarto del MdL y asistencia. Hoy no existen y por eso esas columnas y pestañas ni se muestran.

## Siguiente (bloque 2: historia del club)

- [x] **Datos de la Historia integrados, reconciliados y completados** — HECHO (04/08/2026, rama `feat/historia-club-datos`): `data/historia_club.json` (80 personas), `data/personas.json` (registro único de identidades) y `data/fichas_inscripcion.json` (21 hojas oficiales cruzadas).
- [x] **Sección visual "Historia de los Maccabis"** — HECHO (04/08/2026, rama `feat/historia-club-ui`): pestaña "El Club" con rejilla maestra, tira temporal y ficha de persona enlazada con las estadísticas.
- [ ] **Arreglar el desbordamiento horizontal en móvil** del dashboard (previo a la Historia: afecta también a las pestañas antiguas).
- [ ] ~~Sección visual "Historia de los Maccabis"~~ — detalle original:
  - Matriz de 80 personas × 14 temporadas (2013→2026), con dorsal y nº de temporadas en activo por persona.
  - Idea: línea temporal del club, quién estuvo cada año, veteranía, "since 2013". Diseño visual y bonito.
  - Nota: el Excel tiene hojas "Equipo", "Copy of Equipo" (ordenada por dorsal) y "Sheet2". Usar la principal.

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
