# RUTINA B — Revisión del calendario (v2, 31/10/2026: la rutina solo cambia la tabla de eventos, D151; v1 del 08/10: Importar y la cola de SportEasy, D94/D95)

> **Desde el paso 2 la web es la única fuente de eventos.** Los pasos 4 y 5 de abajo (comparar a mano con SportEasy y aplicar allí) se sustituyen por: **Importar → Calendario** en la plataforma (compara y propone) y, después, copiar a SportEasy lo que quede en la cola «Copia a SportEasy». El texto original se conserva por si hay que volver al método antiguo.

## Procedimiento actual
1. Leer en Deportes/web la programación de MdA (G1) y MdL (G2) (pasos 1–3 de abajo).
2. Pegarla en `https://maccabis.vercel.app/gestion/eventos/importar` (pestaña **Calendario**), una línea por partido: `grupo;jornada;local;visitante;fecha;hora;pista` (la jornada vale `1` o `J1`; G1 = MdA, G2 = MdL; una jornada de descanso se escribe «Maccabi de Acostar descansa»; las líneas de otros equipos se ignoran). Pulsar **Comparar**: sale «0 cambios» o la lista de cambios con campo, valor actual y valor del Ayuntamiento.
3. **Proponer los cambios a Iván** y, con su OK, pulsar **Aceptar** (o **Ignorar**, o **Aceptar todos**) y **Aplicar lo aceptado**. Nada se aplica sin OK. Los partidos nuevos o que «no aparecen en lo pegado (¿lo han quitado?)» salen como señales: se revisan a mano, no se crean ni se borran solos.
4. Lo aceptado queda **pendiente de copiar a SportEasy**. Abrir `/gestion/eventos`, tarjeta **«Copia a SportEasy»**: copiar cada cambio a SportEasy con el OK de Iván y pulsar **«Marcar como copiado»**.
5. Cada importación queda registrada (quién, cuándo, líneas, qué se aceptó) en la misma pantalla.
**El calendario no se edita en ningún fichero (D151).** La rutina B solo cambia la tabla de eventos (Importar → Calendario). Los avisos de equipación (Panel, convocatoria, WhatsApp, Liga, Scouting, página de partido) leen la tabla, así que un cambio de local/visitante aceptado aquí ya cambia el aviso en la web en un minuto (la caché de 60 s), sin tocar nada más. `data/calendario_2026-27.json` es una copia generada de la tabla: la regenera sola la rutina A (`npm run jornada`) y, si hace falta antes, `npm run calendario:exportar`. Lo único que se sigue editando a mano son los **colores de los rivales** (D75, abajo): no son calendario.

**Nota (31/10/2026):** en Consulta de partidos sale la temporada completa con resultados y una columna de estado («Reprogramado»). Los filtros cargan en cascada (2–3 s cada uno): elegir uno, esperar, elegir el siguiente.

## Clasificación oficial (desde 31/10/2026)
Ruta: Deportes/web → Competiciones municipales → **Consulta de clasificaciones** → Moratalaz → Temporada 2026/2027 · BALONCESTO · SENIOR MASCULINO · Grupo «JDM MOR DOM MAÑ BC SEN MAS G1» (MdA) / «…G2» (MdL). La jornada viene por defecto en la última jugada; tipo **«General por equipos de la jornada»** → Buscar.
- **Columnas:** Puntos, J, G, P, I, TF, TC, TF-TC, TF/TC, Sanc, Progreso. Puntuación observada: victoria 2, derrota 1.
- **Se contrasta** con la clasificación calculada (BACKLOG, D74).
- **«Sanc»** es el control semanal de incidencias por equipo. La ficha de sanciones con nombres no se consulta salvo que Sanc > 0, y nada de ella va a la web pública.
- **«Clasificación de máximos anotadores»** (solo en G1): contiene nombres de terceros; no se extrae (D73).

**Hallazgos del 31/10 (ejecución supervisada 1, Claude en el Chrome de Iván):**
- **(a) Posible cambio de la J5 de MdA:** MdA–NABUCO TD figura el **20/12/2026 13:30** en Baloncesto 1 Moratalaz, mientras el resto de la J5 es el 15/11; sin marca de reprogramado. `data/calendario_2026-27.json` tiene hoy ese partido el 15/11/2026 a las 09:00 (local, campo 1), es decir, **difiere**. Pendiente: pasarlo por Importar → Calendario y proponerlo a Iván; nada se aplica sin su OK.
- **(b) Clasificación oficial tras la J3 (25/10):** MdA 1.º en G1 (6 pts, 3-0, 192-71); MdL 1.º en G2 (6 pts, 3-0, 171-101). Sanc = 0 en ambos grupos.
- **(c)** J2 y J13 de MdA/MdL a las 10:15: sin cambios.

---
## Texto original (v0, 02/10/2026)

Cuándo: jueves desde las 20:15 (programación oficial a las 20:00 del jueves previo, Bases 47 JDM 4.2).

Pasos (Deportes/web, sesión de Iván iniciada en su Chrome):

1. https://deportesweb.madrid.es/DeportesWeb/ → Competiciones municipales → Consulta de partidos → centro Moratalaz.
2. Filtros: Temporada 2026/2027 · BALONCESTO · SENIOR MASCULINO · Grupo "JDM MOR DOM MAÑ BC SEN MAS G1" (MdA) → Buscar; repetir con G2 (MdL). Cada filtro recarga la página: elegir uno, esperar, elegir el siguiente.
3. Sale la temporada entera: nº de partido, local, visitante, fecha, hora y pista.
4. Comparar con SportEasy (campeonatos "Temporada MdA" y "Temporada MdL") por la vista de Campeonatos, jornada a jornada (la lista del calendario carga por partes): fecha, hora, pista, rival y local/visitante.
5. Proponer a Iván los cambios; aplicarlos en SportEasy solo con su OK.
6. Pendiente: sanciones (Juegos Deportivos Municipales-Equipos → equipo → más opciones → sanciones).

**Hallazgos del 02/10:** J1 MdA oficialmente visitante en la pista 2 (SportEasy la tenía como local; Iván avisó por WhatsApp y decidió no tocar el evento). Mismo domingo a la misma hora: 18/10 y 07/02 (10:15). J1–J3 coinciden en todo lo demás.

**Revisar cambios de equipación de los rivales (D75):** cada vez que se revise el calendario, comprobar en Deportes/web (ficha del equipo rival: colores de primera equipación) si algún rival ha cambiado de camiseta o pantalón. Si cambia: editar `data/equipaciones_2026-27.json` (texto original, color normalizado, fecha), correr `npm run datos:sync` en `plataforma/` y `npm run pruebas:equipacion`. ~~Si cambia el calendario (fecha, rival, local/visitante), también `equipacion:sync` (copia del calendario en la plataforma).~~ _(Desde D151, no: el calendario se cambia solo en la tabla.)_ Los avisos de choque se recalculan solos.

**Si cambia el color de un rival, regenerar avisos y la portada (`npm run datos:sync` en `plataforma/`; también si cambia un entreno, una pista o un festivo en `data/entrenos_2026-27.json`; en la rutina A ya lo hace `npm run jornada`, D84)**, y correr `npm run pruebas:equipacion`. Quién cambia lo fija el calendario (Bases 47 JDM, 5.11: cambia el que figura en segundo lugar = visitante), así que un cambio de local/visitante convierte «cambian ellos» en «nos toca cambiar» (o al revés) sin tocar nada más: _desde D151 basta con aceptarlo en Importar → Calendario_ (antes había que editar también el JSON del calendario y correr `datos:sync`).

**Copia de eventos a SportEasy con «respuestas en la web» encendido (D104):** si la revisión lleva a crear o cambiar un evento en SportEasy, se hace con el formulario completo (`/calendar/create/`, «Ajustes avanzados»): «Selección manual» (sin participantes) y «Enviar una notificación» apagado. Nunca el formulario rápido de «Crear evento» (invita a todos y notifica). No usar «Aplicar los ajustes a próximos entrenamientos» (sin probar). Apagado, como hasta ahora. Detalle en `docs/SPORTEASY.md`.
