# BACKLOG — Proyecto Maccabis

> Lo pendiente, por prioridad. Se reordena según urgencia y decisiones.

## Ahora (bloque 1: arranque + zona pública)

- [ ] **Arrancar el proyecto en Claude Code** (repositorio, Next.js base, conectar Supabase + Vercel). Iván debe crear cuentas gratuitas de Supabase y Vercel (credenciales NUNCA por chat; se manejan en Claude Code).
- [ ] Elegir **nombre para la sesión de Claude Code** (TCPC usa "Fable").
- [ ] **Migrar el dashboard de estadísticas 25/26** (v1 web estática) a la zona pública del nuevo stack.
- [ ] **Integrar estadísticas históricas** de Carlos:
  - 2023/24 MdA (.xlsx) y MdL (.xls)
  - 2024/25 MdA (.xlsx) y MdL (.xls)
  - Requiere normalizar formatos heterogéneos (ver DECISIONS D7). Los .xls de MdL tienen hojas separadas: Puntos, Faltas, Triples, Tiros_libres, Min, Asist_medias, Rivales, Informe_resumen, Clasificaciones. Los .xlsx de MdA: Asistencia + Totales + Medias con PTS/MIN.
  - Decidir si van en el dashboard con selector de temporada o aparte.
  - OJO: 24/25 usaba plataforma SWISH; 25/26 usa Afición FBM. Formatos de origen distintos.

## Siguiente (bloque 2: historia del club)

- [ ] **Sección visual "Historia de los Maccabis"** a partir de `Historia_de_los_Maccabi.xlsx`:
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
