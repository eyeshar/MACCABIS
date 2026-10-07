# RUTINA C — Disponibilidad y convocatoria (procedimiento, v1, 08/10/2026)

Cuándo: lunes y martes (la jornada es el domingo). Fuente de las respuestas: SportEasy, en el Chrome de Iván (fase puente, D80). Reglas: `docs/REGLAS_CONVOCATORIA.md`. Datos privados de plantilla (posición, nivel A–E, dobla): solo en `privado/plantilla_2026-27.csv` y `privado/criterios_convocatoria.md` (nunca a git ni a docs).

## 1. Traer las respuestas a la plataforma (Importar → Respuestas)
1. En SportEasy (sesión de Iván), abrir los eventos de la semana (entreno del miércoles y partidos del domingo de MdA y MdL) y leer, por jugador: respuesta (va / duda / no / sin responder), **motivo** y detalle de cada «no voy», y los **periodos de no disponibilidad** (D87).
2. Entrar en `https://maccabis.vercel.app/gestion/eventos/importar?t=respuestas` (sesión de gestor de Iván) y pegar, una línea por dato:
   - `evento;jugador;respuesta;motivo;detalle`, por ejemplo `14/10/2026 entreno;Jon Adrian Esteban Peñas;no voy;trabajo;Turno de tarde`. El evento se da por su fecha y, si hace falta, «entreno», «MdA» o «MdL».
   - `jugador;desde;hasta;motivo` para los periodos.
   El jugador se escribe **exactamente como sale en SportEasy**.
3. Pulsar **Revisar** y después **Guardar las válidas**. Un nombre que no está en el diccionario **no se empareja nunca por parecido**: bloquea solo su línea. Asignarlo a mano **una vez** con el selector (entra en el diccionario) y volver a guardar. Si una línea da error (evento ambiguo, motivo fuera de la lista: lesión, trabajo, viaje, familia u otro), corregirla y repetir; repetir una importación no duplica nada.
4. Comprobar en `/gestion/eventos/<evento>/respuestas`: orden no van → dudan → sin responder → van, motivos y franja de ausencias por periodo.

## 2. Convocatoria
5. Aplicar `REGLAS_CONVOCATORIA.md` con los datos de `privado/` y las respuestas guardadas; proponer a Iván el reparto MdA / MdL. Añadir al mensaje la línea de equipación del partido (`lineaEquipacion`, D75; la genera también el mensaje de WhatsApp del evento).
6. Redactar el mensaje de WhatsApp. **Lo envía Iván** (o Claude con su OK explícito).

## 3. Recordatorios
7. En el evento, **«Pedir recordatorio a Claude»** genera la lista de quien no ha respondido (sin contar a quien tiene una ausencia por periodo que cubre el día) y el texto. Claude lo envía desde SportEasy **solo con el OK de Iván**; mientras no existan los avisos del paso 3, el WhatsApp lo envía Iván.

## 4. Cola «Copia a SportEasy» (si hay cambios de eventos)
8. Si en `/gestion/eventos` la tarjeta **«Copia a SportEasy»** lista cambios pendientes, copiarlos a SportEasy **uno a uno con el OK de Iván** (crear, cambiar fecha, hora, pista o quedada, o cancelar, según diga la descripción), y después pulsar **«Marcar como copiado»**. Nunca marcar algo que no se haya copiado. Los 27 entrenos de la carga inicial salen como pendientes hasta que se compruebe que la serie existe en SportEasy.

Notas: no se piden las mismas respuestas en dos sitios (D64): los jugadores responden en SportEasy hasta el paso 3. Claude no inventa respuestas ni motivos: si SportEasy no muestra un motivo, la línea va sin motivo.
