# RUTINA C — Disponibilidad y convocatoria (procedimiento, v2, 31/10/2026; v1 del 08/10/2026)

> **31/10/2026, D153: SportEasy ya no se usa para nada.** Esta rutina no lee ni escribe en SportEasy. Las respuestas, los
> motivos y las ausencias se dan y se leen **solo en la web** («respuestas en la web» encendido desde el 26/10, D136). Lo de
> la fase puente (Importar → Respuestas, la tarea «Maccabis · respuestas de SportEasy», la cola «Copia a SportEasy», el
> procedimiento de activación) queda abajo, en **«Histórico»**: no son pasos vigentes.

Cuándo: lunes y martes (la jornada es el domingo); **la convocatoria del partido se propone el martes por la noche, después de las 20:00, cuando se cierran las dudas (D141)**. Fuente de las respuestas: **la web** (Gestión → Eventos → Respuestas, el tablero y la pantalla de Convocatoria). Reglas: `docs/REGLAS_CONVOCATORIA.md`. Datos privados de plantilla (posición, nivel A–E, dobla): solo en `privado/plantilla_2026-27.csv` y `privado/criterios_convocatoria.md` (nunca a git ni a docs).

## 0. Tarea programada «Maccabis · respuestas de SportEasy»: retirada (D153)
- **Tiene que estar pausada o borrada.** Lo hace **Iván en su Chrome** (Code no tiene acceso a las tareas programadas). Si sigue activa, no debe ejecutarse: ya no hay nada que importar de SportEasy.
- Lo que hacía, en «Histórico» (apartado H0).

## 1. Ver las respuestas (en la web)
1. Entrar con la sesión de gestor de Iván en `https://maccabis.vercel.app/gestion/eventos` y abrir los eventos de la semana (entreno del miércoles y partidos del domingo de MdA y MdL).
2. En `/gestion/eventos/<evento>/respuestas`: orden no van → dudan → sin responder → van, motivos y detalle de cada «no voy» y franja de las ausencias por periodo. La vista de conjunto, en `/gestion/tablero`; la de la convocatoria, en Gestión → Convocatoria.
3. Si un jugador dice algo por WhatsApp, **«Responder por él»** en la pantalla del evento (queda «puesto por …»).

## 2. Convocatoria
4. **Esperar al cierre de dudas: martes a las 20:00 (D141).** Antes de esa hora, la pantalla de Convocatoria enseña una propuesta *provisional* con los «va» y las dudas aparte en «Posibles (dudas)» (no se convocan). Pasadas las 20:00 (la tarea de cada 15 minutos las ha pasado a «no va · no confirmó»), aplicar `REGLAS_CONVOCATORIA.md` con los datos de `privado/` y las respuestas guardadas; proponer a Iván el reparto MdA / MdL. Añadir al mensaje la línea de equipación del partido (`lineaEquipacion`, D75; la genera también el mensaje de WhatsApp del evento).
5. Redactar el mensaje de WhatsApp. **Lo envía Iván** (o Claude con su OK explícito).
6. Después del martes a las 20:00 (cierre de dudas y convocatoria definitiva, D141; antes las 10:00), cualquier cambio de un partido sale en **banda roja** (y avisa a los gestores): revisar la convocatoria y pulsar «Visto».

## 3. Recordatorios (salen solos)
7. Los recordatorios salen solos (lunes 19:00 agrupado; martes 10:00 del partido, solo a quien no ha respondido; **a las 12:00 del día del límite, aviso a quien siga en «duda» (martes 20:00 para el entreno del miércoles y el partido; 24 h antes en los demás eventos), juntado con otro recordatorio de ese día si lo hay**; miércoles 10:00 del entreno). **Al llegar el límite, la «duda» pasa a «no va» (motivo interno «no confirmó», origen «sistema») y el jugador recibe un aviso; puede volver a decir «voy».** Si hace falta uno extra, **«Enviar un recordatorio ahora»** en la pantalla del evento. Horario de los avisos: D155 (nunca de 22:30 a 08:00, hora de Madrid).
8. **Ya no se marcan jornadas limpias con el interruptor encendido** (D139): la tarjeta del Panel es una franja compacta («encendido desde …», «Con avisos: N/27», «Faltan por entrar» si falta alguien y «Desactivar» dentro de «Más opciones»).

Notas: Claude no inventa respuestas ni motivos. Nunca se pide a los jugadores que respondan fuera de la web.

---

## Histórico (fase puente con SportEasy; no son pasos vigentes desde D153, 31/10/2026)

### H0. Tarea programada «Maccabis · respuestas de SportEasy» (24/10/2026 – activación del 26/10)
Tarea programada de Claude en el Chrome de Iván, **de lunes a miércoles a las 9:54**: hacía el paso H1 (leía las respuestas de SportEasy de los eventos de la semana y las importaba con **Importar → Respuestas**) y avisaba a Iván de lo importado y de lo que no se pudo guardar.
- **Regla de «No seleccionados»:** si un partido ya tenía jugadores en «No seleccionados» en SportEasy, **la convocatoria de ese partido ya estaba hecha** (a mano en SportEasy) y la tarea **no importaba sus respuestas** (sí las del entreno y las del otro partido, si no estaba convocado). Ahí «No seleccionado» no era un «no voy» del jugador.
- Primera importación real: 24/10/2026 (J3, entreno del 28/10 y J4: 92 respuestas, todas válidas). Para la J3, ya convocada a mano en SportEasy, Iván decidió contar «No seleccionado» en un partido como «va» si el jugador estaba presente en el otro partido del domingo (decisión puntual, D113).

### H1. Traer las respuestas a la plataforma (Importar → Respuestas)
1. En SportEasy (sesión de Iván), abrir los eventos de la semana (entreno del miércoles y partidos del domingo de MdA y MdL) y leer, por jugador: respuesta (va / duda / no / sin responder), **motivo** y detalle de cada «no voy», y los **periodos de no disponibilidad** (D87).
2. Entrar en `https://maccabis.vercel.app/gestion/eventos/importar?t=respuestas` (sesión de gestor de Iván) y pegar, una línea por dato:
   - `evento;jugador;respuesta;motivo;detalle`, por ejemplo `14/10/2026 entreno;Jon Adrian Esteban Peñas;no voy;trabajo;Turno de tarde`. El evento se da por su fecha y, si hace falta, «entreno», «MdA» o «MdL».
   - `jugador;desde;hasta;motivo` para los periodos.
   El jugador se escribe **exactamente como sale en SportEasy**.
3. Pulsar **Revisar** y después **Guardar las válidas** (tras guardar sale un resumen por evento para cotejar con SportEasy). Un nombre que no está en el diccionario **no se empareja nunca por parecido**: bloquea solo su línea. Asignarlo a mano **una vez** con el selector (entra en el diccionario) y volver a guardar. Si una línea da error (evento ambiguo, motivo fuera de la lista: lesión, trabajo, viaje, familia u otro), corregirla y repetir; repetir una importación no duplica nada. **Conflictos (D121):** si una línea sale como «Conflicto: <gestor> puso … ; SportEasy dice …», es que un gestor cambió esa respuesta después (tablero o «Responder por él»): **no marcar «Usar SportEasy»** (se guarda lo del gestor) y contárselo a Iván en el aviso, para que decida.
4. Comprobar en `/gestion/eventos/<evento>/respuestas`: orden no van → dudan → sin responder → van, motivos y franja de ausencias por periodo.

### H3. Recordatorios con el interruptor apagado
En el evento, **«Pedir recordatorio a Claude»** generaba la lista de quien no había respondido (sin contar a quien tenía una ausencia por periodo que cubría el día) y el texto. Claude lo enviaba desde SportEasy **solo con el OK de Iván**; mientras no existieron los avisos del paso 3, el WhatsApp lo enviaba Iván.

### H4. Cola «Copia a SportEasy» (si había cambios de eventos)
**Con «respuestas en la web» encendido (D104):** se creaba cada evento en SportEasy con el formulario completo (`/calendar/create/`, «Ajustes avanzados»): «Selección manual» (nace sin participantes) y «Enviar una notificación» apagado; nunca el formulario rápido de «Crear evento». El día de la activación, a los eventos futuros ya creados: «Modificar los participantes implicados» → «Seleccionar 0 miembros». No usar «Aplicar los ajustes a próximos entrenamientos» (sin probar). Apagado, como siempre:
Si en `/gestion/eventos` la tarjeta **«Copia a SportEasy»** listaba cambios pendientes, se copiaban a SportEasy **uno a uno con el OK de Iván** (crear, cambiar fecha, hora, pista o quedada, o cancelar, según dijera la descripción), y después se pulsaba **«Marcar como copiado»**. Nunca marcar algo que no se hubiera copiado. Los 27 entrenos de la carga inicial salían como pendientes hasta que se comprobara que la serie existía en SportEasy. _(D153: la tarjeta, el filtro «Pendientes de SportEasy» y «Marcar como copiado» se quitan de la web.)_

### H5. Al encender «respuestas en la web» (D99)
Al encender: **una última Importar → Respuestas** de todos los eventos abiertos (H1), siguiendo el procedimiento de activación (H6), y después ya no se importaba más: los jugadores responden en la web. La etiqueta de cada evento pasó a «Respuestas en la web». «Pedir recordatorio a Claude» desapareció. La condición 1 de D64 (jornadas limpias) solo se marcaba en el Panel con el interruptor **apagado** (D64 derogada por D153).

### H6. Procedimiento de activación de «respuestas en la web» (decidido por Iván el 26/10/2026, D136; hecho el 26/10)
En este orden:
1. **Claude importa las respuestas de TODOS los eventos abiertos de SportEasy** (entrenos hasta el 05/05/2027 y partidos de liga de MdA y MdL), con sus motivos y los periodos de ausencia, en **una sola pasada** de Importar → Respuestas (`/gestion/eventos/importar?t=respuestas`). No hay límite de fechas ni de líneas (comprobado con más de 1000 líneas en `pruebas:respuestas-pantallas`).
2. **Claude coteja evento a evento la web y SportEasy** con el resumen que sale tras «Guardar las válidas» (por evento: fecha, evento, «N van · N no · N sin responder» y cuántos llevan motivo; solo gestores, sin motivos) y **pasa el resumen a Iván**, con cualquier diferencia.
3. **Con el OK de Iván**, Claude pone los eventos futuros de SportEasy a «Modificar los participantes implicados» → **«Seleccionar 0 miembros»** y comprueba que no piden respuesta a nadie (condición 4, D104).
4. **Iván marca la J3** (jornada limpia), **la casilla de SportEasy** y pulsa **Activar** en el Panel (D99.13).
5. **Claude pausa la tarea programada «Maccabis · respuestas de SportEasy»** y prepara el WhatsApp para el grupo (lo envía Iván).

~~**SportEasy NO se cierra:** sigue abierto (chat e historial) hasta septiembre de 2027 (`NORMAS_DE_TRABAJO.md` §8).~~ _(Derogado por D153, 31/10/2026: SportEasy ya no se usa para nada.)_ **Lo que se responda allí después de activar no cuenta.**
**Red de seguridad:** con el interruptor encendido, una importación **nunca pisa una respuesta ni una ausencia dada en la web** (por el jugador o por un gestor): esas líneas salen como «No se toca: … en la web» y no se guardan, sin opción de «Usar SportEasy». Así, si la tarea programada se ejecutara por error tras la activación, no estropea nada.

Notas de la v1: no se piden las mismas respuestas en dos sitios (D64, derogada por D153): los jugadores respondían en SportEasy mientras el interruptor estuvo apagado. Claude no inventa respuestas ni motivos: si SportEasy no mostraba un motivo, la línea iba sin motivo.
