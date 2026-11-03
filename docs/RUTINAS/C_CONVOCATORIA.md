# RUTINA C — Disponibilidad y convocatoria (v3, 02/11/2026, D173; v2 del 31/10/2026, v1 del 08/10/2026)

> **La hace la plataforma sola.** Claude ya no tiene pasos en esta rutina: todo corre dentro de la tarea de avisos de cada
> 15 minutos (pg_cron → `/api/avisos/tarea`), sin tareas programadas aparte. Lo único que hace Iván es **revisar y aprobar
> desde el móvil el martes**. Reglas: `docs/REGLAS_CONVOCATORIA.md`. SportEasy no se usa (D153, D172): lo de la fase puente,
> abajo, en «Histórico».

## Lo que hace la plataforma sola cada semana (hora de Madrid; nunca de 22:30 a 08:00, D155)

| Cuándo | Qué |
|---|---|
| **Lunes 19:00** | A cada jugador, un aviso con todo lo que le falta de la semana (entreno y partido). |
| **Martes 09:00** | (Si la convocatoria de ese domingo ya está aprobada, no sale.) A quien no ha respondido al partido o sigue en «duda»: «Tienes hasta hoy a las 12:00 para decir si vas; si no, te quedas fuera de la convocatoria» (uno solo, junto con lo demás de ese día). |
| **Martes 12:00 — cierre del partido** | Las «duda» pasan a «no va · no confirmó» (con su aviso). A quien sigue sin responder: «No has respondido: no entras en la propuesta…» (su respuesta no se toca). **Propuesta automática** como borrador (si no hay una aprobada ni un borrador tocado a mano) y **push a Iván**: «Convocatoria del domingo DD/MM lista: MdA 9 · MdL 9 · 1 aviso…» o «MdL: 6 de 7, faltan interiores». También se ve en el Panel. |
| **Martes 19:00** | Si sigue sin aprobar: recordatorio a Iván. |
| **Martes 21:00** | Si sigue sin aprobar: aviso a los tres gestores (puede aprobar cualquiera). |
| **Miércoles 09:00** | A quien no ha respondido al entreno o sigue en «duda»: «Tienes hasta hoy a las 12:00…». |
| **Miércoles 12:00 — cierre del entreno** | Las «duda» del entreno pasan a «no va». |
| **Tras aprobar, hasta el domingo** | Si un convocado dice «no voy» (o un gestor lo cambia): push a los gestores «Sale Jon (MdA). Propuesta: entra Fernando M.», con la hoja de recambio. Un «voy» tardío solo avisa si un equipo está por debajo de un mínimo. Si un cambio de calendario (Importar, editar o cancelar un partido) rompe la convocatoria aprobada, push con el arreglo. |

**Nunca se aprueba sola.** Ningún aviso ni WhatsApp lleva niveles ni la marca «reserva».

## Lo que hace Iván (el martes, desde el móvil)

1. Abrir el push o Gestión → Panel → **«Revisar y aprobar»** (`/gestion/convocatoria?fecha=…`).
2. Mirar arriba, por equipo: convocados por línea, avisos (rojo / ámbar), **riesgo** (rojo / ámbar: nivel del partido más difícil y proyección; cambiar la dificultad no rehace la propuesta), proyección, rival y dificultad (se puede cambiar ahí), y quién se queda fuera y por qué. Si alguien dijo «voy» después de la propuesta, sale en «Respondió después de la propuesta» con **«Rehacer propuesta»**. Si no se llega a un mínimo, la lista de quién falta por responder con un **WhatsApp para copiar**.
3. Ajustar si hace falta con lo de siempre, debajo («Mover a…», «Deshacer», «Cambiar», o el tablero).
4. **«Aprobar y avisar»**: aprueba y avisa ya a cada jugador (convocado; convocado con un equipo y no con el otro; o «esta vez no entras»).
5. En la salida: «Avisados N de M (los otros no tienen avisos)» y **«Copiar mensaje»** para pegar el WhatsApp en el grupo. «Reenviar» solo si algún aviso falló.
6. Si después llega un push de baja: abrir la hoja de recambio, dejar el propuesto o elegir otro (o ninguno) y **«Aplicar y avisar»**; copiar el WhatsApp del cambio.

**El WhatsApp de la convocatoria queda «al día» solo al pulsar «Copiar mensaje»** (Gestión → Convocatoria → Salida; D173, sin «Ya lo he pegado»): ahí se apunta lo copiado y el siguiente WhatsApp de cambios parte de eso. **Si el mensaje se manda por otra vía** (escrito a mano, desde otro móvil…), pulsar «Copiar mensaje» **una vez** igualmente para que el siguiente WhatsApp de cambios parta de lo enviado y no repita ni omita cambios.

Cualquier gestor puede hacer lo mismo. Responder por un jugador que escribe por WhatsApp: «Responder por él» en la pantalla del evento o el tablero (queda «puesto por …»). Notas: nadie inventa respuestas ni motivos; nunca se pide a los jugadores que respondan fuera de la web.

### Antes de D173 (v2, 31/10/2026)
Claude proponía el reparto el martes por la noche tras el cierre de las 20:00 y redactaba el WhatsApp; el aviso «Estás convocado» salía con «Enviar ahora» (D127); recordatorios el martes y el miércoles a las 10:00 y aviso de dudas a las 12:00 (D99.6, D141).

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
