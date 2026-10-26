# RUTINA C — Disponibilidad y convocatoria (procedimiento, v1, 08/10/2026)

Cuándo: lunes y martes (la jornada es el domingo). Fuente de las respuestas: SportEasy, en el Chrome de Iván (fase puente, D80). Reglas: `docs/REGLAS_CONVOCATORIA.md`. Datos privados de plantilla (posición, nivel A–E, dobla): solo en `privado/plantilla_2026-27.csv` y `privado/criterios_convocatoria.md` (nunca a git ni a docs).

## 0. Tarea programada «Maccabis · respuestas de SportEasy» (desde el 24/10/2026)
Tarea programada de Claude en el Chrome de Iván, **de lunes a miércoles a las 9:54**: hace el paso 1 (lee las respuestas de SportEasy de los eventos de la semana y las importa con **Importar → Respuestas**) y avisa a Iván de lo importado y de lo que no se pudo guardar.
- **Regla de «No seleccionados»:** si un partido ya tiene jugadores en «No seleccionados» en SportEasy, **la convocatoria de ese partido ya está hecha** (a mano en SportEasy) y la tarea **no importa sus respuestas** (sí las del entreno y las del otro partido, si no está convocado). Ahí «No seleccionado» no es un «no voy» del jugador.
- Primera importación real: 24/10/2026 (J3, entreno del 28/10 y J4: 92 respuestas, todas válidas). Para la J3, ya convocada a mano en SportEasy, Iván decidió contar «No seleccionado» en un partido como «va» si el jugador estaba presente en el otro partido del domingo (decisión puntual, D113).

## 1. Traer las respuestas a la plataforma (Importar → Respuestas)
1. En SportEasy (sesión de Iván), abrir los eventos de la semana (entreno del miércoles y partidos del domingo de MdA y MdL) y leer, por jugador: respuesta (va / duda / no / sin responder), **motivo** y detalle de cada «no voy», y los **periodos de no disponibilidad** (D87).
2. Entrar en `https://maccabis.vercel.app/gestion/eventos/importar?t=respuestas` (sesión de gestor de Iván) y pegar, una línea por dato:
   - `evento;jugador;respuesta;motivo;detalle`, por ejemplo `14/10/2026 entreno;Jon Adrian Esteban Peñas;no voy;trabajo;Turno de tarde`. El evento se da por su fecha y, si hace falta, «entreno», «MdA» o «MdL».
   - `jugador;desde;hasta;motivo` para los periodos.
   El jugador se escribe **exactamente como sale en SportEasy**.
3. Pulsar **Revisar** y después **Guardar las válidas** (tras guardar sale un resumen por evento para cotejar con SportEasy). Un nombre que no está en el diccionario **no se empareja nunca por parecido**: bloquea solo su línea. Asignarlo a mano **una vez** con el selector (entra en el diccionario) y volver a guardar. Si una línea da error (evento ambiguo, motivo fuera de la lista: lesión, trabajo, viaje, familia u otro), corregirla y repetir; repetir una importación no duplica nada. **Conflictos (D121):** si una línea sale como «Conflicto: <gestor> puso … ; SportEasy dice …», es que un gestor cambió esa respuesta después (tablero o «Responder por él»): **no marcar «Usar SportEasy»** (se guarda lo del gestor) y contárselo a Iván en el aviso, para que decida.
4. Comprobar en `/gestion/eventos/<evento>/respuestas`: orden no van → dudan → sin responder → van, motivos y franja de ausencias por periodo.

## 2. Convocatoria
5. Aplicar `REGLAS_CONVOCATORIA.md` con los datos de `privado/` y las respuestas guardadas; proponer a Iván el reparto MdA / MdL. Añadir al mensaje la línea de equipación del partido (`lineaEquipacion`, D75; la genera también el mensaje de WhatsApp del evento).
6. Redactar el mensaje de WhatsApp. **Lo envía Iván** (o Claude con su OK explícito).

## 3. Recordatorios
7. En el evento, **«Pedir recordatorio a Claude»** genera la lista de quien no ha respondido (sin contar a quien tiene una ausencia por periodo que cubre el día) y el texto. Claude lo envía desde SportEasy **solo con el OK de Iván**; mientras no existan los avisos del paso 3, el WhatsApp lo envía Iván.

## 4. Cola «Copia a SportEasy» (si hay cambios de eventos)
8. **Con «respuestas en la web» encendido (D104):** crear cada evento en SportEasy con el formulario completo (`/calendar/create/`, «Ajustes avanzados»): «Selección manual» (nace sin participantes) y «Enviar una notificación» apagado; nunca el formulario rápido de «Crear evento». El día de la activación, a los eventos futuros ya creados: «Modificar los participantes implicados» → «Seleccionar 0 miembros». No usar «Aplicar los ajustes a próximos entrenamientos» (sin probar). Apagado, como siempre:
   Si en `/gestion/eventos` la tarjeta **«Copia a SportEasy»** lista cambios pendientes, copiarlos a SportEasy **uno a uno con el OK de Iván** (crear, cambiar fecha, hora, pista o quedada, o cancelar, según diga la descripción), y después pulsar **«Marcar como copiado»**. Nunca marcar algo que no se haya copiado. Los 27 entrenos de la carga inicial salen como pendientes hasta que se compruebe que la serie existe en SportEasy.

## 5. Con «respuestas en la web» encendido (paso 3, D99)
9. Al encender: **una última Importar → Respuestas** de todos los eventos abiertos (paso 1), siguiendo el procedimiento de activación del apartado 6, y después ya no se importa más: los jugadores responden en la web. La etiqueta de cada evento pasa a «Respuestas en la web».
10. Los recordatorios salen solos (lunes 19:00 agrupado; martes 10:00 del partido, también a quien tiene «duda»; miércoles 10:00 del entreno). «Pedir recordatorio a Claude» desaparece; si hace falta uno extra, «Enviar un recordatorio ahora» en la pantalla del evento.
11. Si un jugador dice algo por WhatsApp, «Responder por él» en la pantalla del evento (queda «puesto por …»).
12. Después del martes a las 10:00, cualquier cambio de un partido sale en **banda roja** (y avisa a los gestores): revisar la convocatoria y pulsar «Visto».
13. Cada lunes, marcar la jornada anterior en el Panel (limpia / con arreglo): es la condición 1 de D64.

## 6. Procedimiento de activación de «respuestas en la web» (decidido por Iván el 26/10/2026, D136)
En este orden:
1. **Claude importa las respuestas de TODOS los eventos abiertos de SportEasy** (entrenos hasta el 05/05/2027 y partidos de liga de MdA y MdL), con sus motivos y los periodos de ausencia, en **una sola pasada** de Importar → Respuestas (`/gestion/eventos/importar?t=respuestas`). No hay límite de fechas ni de líneas (comprobado con más de 1000 líneas en `pruebas:respuestas-pantallas`).
2. **Claude coteja evento a evento la web y SportEasy** con el resumen que sale tras «Guardar las válidas» (por evento: fecha, evento, «N van · N no · N sin responder» y cuántos llevan motivo; solo gestores, sin motivos) y **pasa el resumen a Iván**, con cualquier diferencia.
3. **Con el OK de Iván**, Claude pone los eventos futuros de SportEasy a «Modificar los participantes implicados» → **«Seleccionar 0 miembros»** y comprueba que no piden respuesta a nadie (condición 4, D104).
4. **Iván marca la J3** (jornada limpia), **la casilla de SportEasy** y pulsa **Activar** en el Panel (D99.13).
5. **Claude pausa la tarea programada «Maccabis · respuestas de SportEasy»** y prepara el WhatsApp para el grupo (lo envía Iván).

**SportEasy NO se cierra:** sigue abierto (chat e historial) hasta septiembre de 2027 (`NORMAS_DE_TRABAJO.md` §8). **Lo que se responda allí después de activar no cuenta.**
**Red de seguridad:** con el interruptor encendido, una importación **nunca pisa una respuesta ni una ausencia dada en la web** (por el jugador o por un gestor): esas líneas salen como «No se toca: … en la web» y no se guardan, sin opción de «Usar SportEasy». Así, si la tarea programada se ejecutara por error tras la activación, no estropea nada.

Notas: no se piden las mismas respuestas en dos sitios (D64): los jugadores responden en SportEasy mientras el interruptor esté apagado. Claude no inventa respuestas ni motivos: si SportEasy no muestra un motivo, la línea va sin motivo.
