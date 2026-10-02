# PLAN DE TRABAJO 2026/27 — Proyecto Maccabis

> Acordado con Iván el 02/10/2026. Se revisa al cerrar cada fase.

## Principio
SportEasy queda completo como respaldo hasta septiembre de 2027. Mientras, Claude automatiza las tareas semanales **navegando el Chrome de Iván** y la plataforma crece función a función. Normas en `NORMAS_DE_TRABAJO.md`.

## Las tres rutinas semanales
| Rutina | Cuándo | Qué hace Claude | Qué hace Iván | Fuente |
|---|---|---|---|---|
| **A. Actas y estadísticas** | Lunes por la mañana | Procesa con el pipeline (`npm run jornada`) las actas (PDF) y hojas de estadística (XLSX) que Iván deja sin renombrar, comprueba que los puntos suman el marcador y publica. Si algo no cuadra, para y avisa. | Descarga las actas y hojas de MdA y MdL **desde el móvil** (único gesto semanal, D35). | Afición FBM / acta digital Indalweb — **solo app de móvil, sin web que navegar** |
| **B. Calendario del jueves** | Jueves desde las 20:15 | Lee la programación oficial de los dos equipos (fecha, hora, pista) y las sanciones, la compara con SportEasy y propone cambios. Con el OK de Iván, los aplica en SportEasy. | Responder OK a los cambios propuestos. | Deportes/web (deportesweb.madrid.es) o Madrid Móvil; datos abiertos 211549 como segunda fuente |
| **C. Disponibilidad y convocatoria** | Lunes y martes | Lee en SportEasy quién va, aplica las reglas de convocatoria (`REGLAS_CONVOCATORIA.md`), propone el reparto MdA/MdL y redacta el mensaje de WhatsApp. | Ajustar y aprobar el reparto. | SportEasy |

Cada rutina pasa por: aprendizaje con Iván → procedimiento escrito en `docs/RUTINAS/` → 2 ejecuciones supervisadas → tarea programada. **Salvo la A**, que no tiene navegador que aprender (es el gesto manual de D35): solo necesita que Iván confirme el procedimiento una vez.
**Riesgo asumido (B y C, igual que D62):** Deportes/web prohíbe en sus condiciones la extracción automatizada. Se mitiga actuando con la sesión de Iván, a ritmo humano, una vez por semana y solo con documentos del club. Decisión de Iván; matiza D47 (ver D63, que corrige y no incluye ya a la rutina A ni a D35).

## Fases
| Fase | Fechas | Qué | Modelo |
|---|---|---|---|
| **0. Arranque** | 2–3/10 | Normas y plan en el proyecto (hecho). Pedido de ropa listo: Vercel configurado, vista previa revisada, merge, campaña abierta, enlaces enviados. | Opus (diseño) · Sonnet (Code: merge y docs) |
| **1. Aprendizaje** | 4–12/10 | J1 el 4/10. **Lun 5/10:** primera ejecución real de `npm run jornada` con las actas y hojas que Iván descargue del móvil (rutina A: no hay navegador que aprender, D63). **Jue 8/10, 20:15:** aprendizaje de la rutina B (calendario, por navegador). **Lun 12/10:** aprendizaje de la rutina C para la J2 (disponibilidad y convocatoria, por navegador). | Opus |
| **2. Supervisado → programado** | 13/10–1/11 | J2 el 18/10 (MdA y MdL a la misma hora, sin doblajes). Cada rutina hace 2 ejecuciones supervisadas y pasa a tarea programada. | Sonnet |
| **3. Plataforma** | Noviembre | Calendario único en la plataforma con iCal, motor de convocatoria en código (D48) alimentado por la rutina C, migración del dashboard. | Opus (datos y seguridad) · Sonnet (pantallas) |
| **4. Primera sustitución** | Final de noviembre | Revisión: qué función de SportEasy pasa primero a la plataforma (criterio: 3 jornadas sin arreglos a mano). | Opus |

## Qué hay que diseñar (en este orden)
1. **Regla de publicación de estadísticas:** publicar solo si todo cuadra, o siempre con OK de Iván.
2. **Dónde corre el pipeline en la rutina A:** shell del ordenador de Iván con el repositorio conectado, o entorno en la nube con acceso de escritura al repositorio. Se fija el 5/10.
3. **Formato del aviso del jueves:** qué cambió, en qué partido, botón OK.
4. **Formato de la propuesta de convocatoria** y del mensaje de WhatsApp.
5. **Mockups de la plataforma** de la fase 3, antes de construir.

## Pendientes de Iván (mínimos)
- Tener iniciada en su Chrome la sesión de Afición FBM (si tiene versión web), Deportes/web y SportEasy.
- Revisar en el móvil la vista previa del pedido de ropa.
- Responder OK a los cambios y envíos que Claude proponga.

## Lo que deja de hacer falta
- La pantalla de "subir actas desde la zona de gestión" (BACKLOG, punto 4) pasa a ser solo un **plan B**: la rutina A la sustituye.
- La consulta a Indalweb (D49) se mantiene como opcional.
