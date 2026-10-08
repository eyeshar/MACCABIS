# PLAN DE TRABAJO 2026/27 — Proyecto Maccabis

> Acordado con Iván el 02/10/2026. Se revisa al cerrar cada fase.

## Principio
SportEasy queda completo como respaldo hasta septiembre de 2027. Mientras, Claude automatiza las tareas semanales **navegando el Chrome de Iván** (calendario y convocatoria) y **por Enlace Móvil de Windows con el móvil de Iván** (actas, D70, matiza D69), y la plataforma crece función a función. Normas en `NORMAS_DE_TRABAJO.md`.

## Las tres rutinas semanales
| Rutina | Cuándo | Qué hace Claude | Qué hace Iván | Fuente |
|---|---|---|---|---|
| **A. Actas y estadísticas** | Lunes por la mañana | Descarga las actas (PDF) y hojas de estadística (XLSX) de MdA y MdL desde Afición FBM, reflejada en el PC con **Enlace Móvil de Windows** desde el Samsung S22 Ultra de Iván, con **control del ordenador** (D70, matiza D69). Las procesa con el pipeline (`npm run jornada`), comprueba que los puntos suman el marcador y publica. Si algo no cuadra, para y avisa. | Tiene el móvil encendido, con wifi y cerca del PC (puede estar bloqueado). Decide la regla de publicación. | Afición FBM / acta digital Indalweb — **solo app de móvil: se usa vía Enlace Móvil, no es una web que navegar** |
| **B. Calendario del jueves** | Jueves desde las 20:15 | Lee la programación oficial de los dos equipos (fecha, hora, pista) y las sanciones, la compara con SportEasy y propone cambios. Con el OK de Iván, los aplica en SportEasy. | Responder OK a los cambios propuestos. | Deportes/web (deportesweb.madrid.es) o Madrid Móvil; datos abiertos 211549 como segunda fuente |
| **C. Disponibilidad y convocatoria** | Lunes y martes | Lee en SportEasy quién va, aplica las reglas de convocatoria (`REGLAS_CONVOCATORIA.md`), propone el reparto MdA/MdL y redacta el mensaje de WhatsApp. | Ajustar y aprobar el reparto. | SportEasy |

Cada rutina pasa por: aprendizaje con Iván → procedimiento escrito en `docs/RUTINAS/` → 2 ejecuciones supervisadas → tarea programada.
**Riesgo asumido (igual que D62):** Afición FBM (vía Enlace Móvil, D70) y Deportes/web prohíben en sus condiciones la extracción automatizada. Se mitiga actuando con la sesión de Iván (su propio móvil o su Chrome), a ritmo humano, una vez por semana y solo con documentos del club. Decisión de Iván; D70 matiza D69, D69 matiza D35, D63 matiza D47.

## Fases
| Fase | Fechas | Qué | Modelo |
|---|---|---|---|
| **0. Arranque** | 2–3/10 | Normas y plan en el proyecto (hecho). Pedido de ropa listo: Vercel configurado, vista previa revisada, merge, campaña abierta, enlaces enviados. | Opus (diseño) · Sonnet (Code: merge y docs) |
| **1. Aprendizaje** | 4–12/10 | J1 el 4/10. **Lun 5/10:** aprendizaje de la rutina A con las actas de la J1 (Enlace Móvil + control del ordenador, D70). **Jue 8/10, 20:15:** aprendizaje de la rutina B (calendario, por navegador). **Lun 12/10:** aprendizaje de la rutina C para la J2 (disponibilidad y convocatoria, por navegador). | Opus |
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
- Tener el móvil encendido, con wifi y cerca del PC, con Enlace Móvil configurado y la sesión de Afición FBM iniciada (D70).
- Tener iniciada en su Chrome la sesión de Deportes/web y SportEasy.
- Revisar en el móvil la vista previa del pedido de ropa.
- Registrar el hook "Before User Created" en Supabase (función `public.antes_de_crear_usuario`), para el login (D68, `plataforma/LEEME.md`).
- Revisar la vista previa de `feat/plataforma-v0` en Vercel y dar el "OK vista previa".
- Responder OK a los cambios y envíos que Claude proponga.

## Lo que deja de hacer falta
- La pantalla de "subir actas desde la zona de gestión" (BACKLOG, punto 4) pasa a ser solo un **plan B**: la rutina A la sustituye.
- La consulta a Indalweb (D49) se mantiene como opcional.

## Decisiones del 06/10/2026 (tarde)
Bloque «Unificación web» (paso 1 del rediseño). Detalle en `DECISIONS.md` (D76–D80), `ESTADO.md` y `MIGRACION_WEB.md`.

1. **Rediseño y una sola web (D76).** Todo vive en `maccabis.vercel.app` con el diseño aprobado (`privado/mockups_liga/rediseno/`): portada pública sin login en `/`, Acceso, Mi zona y Gestión con el aspecto nuevo. Las secciones de estadísticas de GitHub Pages siguen igual y se enlazan desde el menú; se migran por orden (Liga → Equipo/Jugadores/Ficha → Rankings y Cuartos → Rivales → El Club → MdA → Asistencia, `MIGRACION_WEB.md`). «Desde 2013» en un solo sitio, pendiente de que Iván confirme el año (SportEasy dice 2012).
2. **Calendario y «Tu agenda».** Calendario público en la portada (partidos con aviso de equipación y entrenos, filtros, «Añadir a mi calendario» con feed iCal sin datos personales). En Mi zona, «Tu agenda» solo con lo que ya hay (calendario, entrenos, avisos, partidos jugados); disponibilidad y convocatoria salen como «pendiente» hasta el paso 2.
3. **Entrenos de los miércoles (D77).** 20:30–22:30; Valdebernardo (Faustina Valladolid) **en obras**: cada miércoles «Pista por confirmar (Valdebernardo en obras)» hasta que se fije pista. 07/10: 20:00–21:00 en la Caja Mágica. Datos en `data/entrenos_2026-27.json`. Pendiente de Iván: miércoles sin entreno (Navidad, Semana Santa) y fin de la serie.
4. **Eventos en fase puente (D80).** Paso 2: los eventos se crean y editan en la plataforma (Eventos, EventoEditar) y Claude los copia a SportEasy con el OK de Iván; las respuestas se siguen leyendo de SportEasy hasta que los jugadores respondan en la plataforma (EventoMovil), con el criterio de D64.
5. **Avisos por la web instalada (D78).** Paso 3: notificaciones de la web añadida a la pantalla de inicio (sin app nativa). Ya está la base instalable (manifiesto, iconos del escudo, service worker mínimo, sin avisos).
6. **Recordatorios en la rutina C.** Hasta que existan los avisos del paso 3, los recordatorios a quien no ha respondido (entreno y partido) los **propone Claude dentro de la rutina C** (lunes y martes, con los datos de SportEasy) y **los envía Iván** por WhatsApp. Cuando lleguen los avisos, la plataforma los manda sola (lunes a las 19:00 y el mismo día a las 12:00, maqueta EventoEditar), con el OK de Iván por evento.
7. **Respuestas de Iván al paso 1 (06/10/2026, noche; D81–D87).** Fundación **2013** (temporada 2013/14). Entrenos sin el 23/12, 30/12, 06/01 y 24/03, ni miércoles festivos (comprobado en la fuente oficial: ninguno más hasta el final); **último entreno el 05/05/2027**. `datos:sync` va dentro de `npm run jornada` (si la jornada no cuadra, no sincroniza). La web pública **se indexa**; lo que exige login y las vistas previas, no. Página **`/club`**. Los **motivos de ausencia salen de los ficheros públicos**: solo los ven los gestores (Supabase con RLS; en real, pendiente de OK). Para los pasos 2 y 3: **«no voy» con motivo y periodos de no disponibilidad** elegidos en un calendario; los gestores ven motivos y periodos, los demás jugadores solo «no va»; en fase puente la rutina C los lee de SportEasy.
8. **Orden de construcción.**
   - **Paso 1 (hecho el 06/10, rama `feat/rediseno-web`, pendiente del OK de Iván):** web única, sistema visual, portada, calendario con entrenos e iCal, Acceso, Mi zona y Gestión con el aspecto nuevo, base instalable, inventario de migración.
   - **Paso 2:** Eventos y EventoEditar en gestión (tabla de eventos y pistas en Supabase, con backup y staging antes de producción), copia a SportEasy por navegador (fase puente), respuestas leídas de SportEasy en Gestión y «Tu agenda»; primera migración de sección (Liga).
   - **Paso 3:** EventoMovil (el jugador responde en la plataforma, «no voy» con motivo y periodos de no disponibilidad), avisos por la web instalada y recordatorios automáticos; después, el resto de secciones de `MIGRACION_WEB.md`.

## Decisiones del 07/10/2026 — paso 1b: una sola navegación (D89, D90)
1. **Una sola navegación en toda la web (D89).** Cabecera única en el layout raíz (la misma en portada, `/club`, Acceso, Mi zona, Mi cuenta y Gestión), que lee la sesión en el servidor; en móvil, barra inferior de 5 (Inicio · Partidos · Liga · Mi zona/Acceso · Más) y hoja «Más». Barras propias de Mi zona y de Gestión, fijas. Un solo tema oscuro; Mi zona a dos columnas en escritorio. GitHub Pages lleva una barra fija con «← Volver a Maccabis» y el mismo menú mientras se migra.
2. **Menú de Gestión con submenús (D90)** en tres grupos (La semana, Plantilla, Competición); lo que llega en el paso 2 se ve en gris con «paso 2». «Mi cuenta», una sola página `/cuenta`, solo en el menú de usuario.
3. **Orden de construcción (actualizado, manda sobre el punto 8 del 06/10):**
   1. **Paso 1b — navegación única** (07/10, rama `feat/navegacion-unica`, pendiente del OK de Iván a la vista previa).
   2. **Paso 2** (Eventos y pistas, Convocatoria, Asistencia y motivos; fase puente con SportEasy) **en paralelo con la migración de Liga** desde GitHub Pages a la plataforma.
   3. **Migración de Plantilla y Ficha** de jugador.
   4. **Migración de Historia.**
   5. **Paso 3** (EventoMovil, «no voy» con motivo y periodos de no disponibilidad, avisos por la web instalada, recordatorios automáticos).
   Cada sección migrada deja de enlazar a GitHub Pages en el menú (`MENU` en `plataforma/src/lib/web.ts`) y su pestaña de GitHub Pages pasa a llevar a la plataforma.

## Migración de GitHub Pages cerrada (07/10/2026, D91–D93)
Orden del 07/10 (punto 3 del bloque «paso 1b»): **hecha la migración de Liga, Plantilla/Ficha e Historia** a `maccabis.vercel.app` (`/liga`, `/liga/rivales`, `/liga/<temporada>/...`, `/plantilla`, `/jugador/<person_id>`, `/historia`), con cuadre celda a celda contra GitHub Pages. **GitHub Pages solo redirige** (commit `7a9b041`, reversible). Siguen: paso 2 de la plataforma (Eventos y pistas, Convocatoria, Asistencia y motivos; pista E) y paso 3 (EventoMovil, avisos, recordatorios). Para la rutina C hará falta la tabla de posiciones, niveles A–E y Dobla/No dobla de 2026/27, **solo en `privado/`** (BACKLOG).

## Paso 2 — Eventos y pistas en fase puente (07–08/10/2026, D94, D95)
Hecho (rama `feat/eventos-puente`): la **web es la única fuente de eventos**. Iván crea y cambia eventos solo en `/gestion/eventos`; cada cambio queda «pendiente de copiar» y genera el mensaje de WhatsApp; **Claude los copia a SportEasy con su OK** en el Chrome de Iván y los marca como copiados; las respuestas se traen a la plataforma con **Importar → Respuestas** (diccionario cerrado de nombres). Los jugadores siguen respondiendo en SportEasy hasta el paso 3. El calendario del Ayuntamiento se compara con **Importar → Calendario** (rutina B). Bloque hecho sin entorno de pruebas por decisión de Iván, con las mitigaciones y la forma de restaurar en D94. **Rutinas actualizadas:** B usa Importar y la cola de SportEasy; C (nueva, `RUTINAS/C_CONVOCATORIA.md`) lee SportEasy → Importar → Respuestas → convocatoria. Siguen: Convocatoria en la plataforma, paso 3 (respuestas de los jugadores en la web, avisos, recordatorios) y retirar `asistencia_motivos` (otra decisión).

## Decisiones del 08/10/2026 (D98)
- El **encuentro** es siempre 20 minutos antes de la hora de inicio.
- En convocatorias con rivales parejos se **equilibra por línea** (bases, exteriores, interiores), no solo en el total.
- **No se crea cuenta de gestor de pruebas en producción**: Claude revisa con la sesión de Iván.
- El mensaje de WhatsApp de cada evento lleva pista, número de pista y dirección (D98).

## Paso 3 — Respuestas en la web y avisos (08/10/2026, D99–D102)
Construido y entregado **apagado** (rama `feat/paso3-respuestas-avisos`). Sustituye lo dicho arriba sobre los recordatorios: salen solos a las **10:00** (no 12:00), sin OK por evento, cuando Iván encienda «respuestas en la web» (condiciones de D99.13). Orden para ponerlo en marcha: `BACKLOG.md` → Paso 3 (pendientes 1–7).
