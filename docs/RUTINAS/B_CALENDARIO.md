# RUTINA B — Calendario del Ayuntamiento (v3, 31/10/2026: automática con freno, D154; sin SportEasy, D153 · v2 del 31/10: solo la tabla de eventos, D151 · v1 del 08/10: Importar, D94/D95)

> **Procedimiento vigente (D154):** la rutina **aplica sola** los cambios del Ayuntamiento y **avisa a los jugadores** («Aplicar y avisar»), **sin OK previo**, salvo que salte el **freno** (abajo). **SportEasy ya no se usa (D153):** ni se lee ni se escribe. Aprendida con Iván el 31/10/2026 (ejecución supervisada 1); **sin segunda ejecución supervisada**, por decisión de Iván.

## Tarea programada «Maccabis · calendario del jueves»
- **Cuándo:** **jueves a las 20:20 (Europe/Madrid)**. La programación oficial sale el jueves a las 20:00 (Bases 47 JDM 4.2).
- **Dónde:** el Chrome de Iván, con la extensión de Claude. Cada ejecución es una sesión nueva: todo lo que tiene que saber está en este fichero.
- **Modelo:** Sonnet 5.5 (NORMAS §5).
- **Entrada (D131):** si Deportes/web o `maccabis.vercel.app` piden entrar y Usuario/Clave están **ya rellenados por Chrome** (o la cuenta ya elegida), pulsa entrar, **un solo intento**. Nunca escribe, cambia, lee ni copia una contraseña, ni resuelve un captcha. Si hay campos vacíos, captcha, código por correo o error: **para y avisa a Iván**. No cierra la sesión al terminar.
- **Solo lee** Deportes/web (programación de MdA y MdL y la clasificación); **solo escribe** en Importar → Calendario.

## Procedimiento
1. **Leer la programación.** https://deportesweb.madrid.es/DeportesWeb/ → Competiciones municipales → **Consulta de partidos** → centro Moratalaz → Temporada 2026/2027 · BALONCESTO · SENIOR MASCULINO · Grupo «JDM MOR DOM MAÑ BC SEN MAS G1» (MdA) → Buscar; repetir con «…G2» (MdL). Los filtros cargan en cascada (2–3 s cada uno): elegir uno, esperar, elegir el siguiente. Sale la temporada completa: nº de jornada, local, visitante, fecha, hora, pista y estado («Reprogramado»).
2. **Escribir las líneas**, una por partido de **los dos grupos completos** (también los de otros equipos: se ignoran solos, y sirven para ver los partidos que desaparecen): `grupo;jornada;local;visitante;fecha;hora;pista`.
   - `grupo`: `G1` (MdA) o `G2` (MdL). `jornada`: `5` o `J5`. Fecha `dd/mm/aaaa`, hora `hh:mm`.
   - **Pista:** Deportes/web la escribe «Baloncesto 2 Moratalaz» o «Pabellón baloncesto 3 Moratalaz». Se pasa a **«Pista 2»** / «Pista 3» (el número que lleva). Importar acepta también el texto tal cual (desde el 31/10/2026), pero la rutina escribe «Pista N». Sin pista: campo vacío (= por confirmar).
   - Jornada de descanso: `G1;4;Maccabi de Acostar descansa;;08/11/2026;;`.
3. **Comparar.** Pegar en `https://maccabis.vercel.app/gestion/eventos/importar` (pestaña **Calendario**) → **Comparar**. Sale «0 cambios» o la tabla de cambios (partido, campo, valor actual, valor del Ayuntamiento), más «Líneas que no se entienden» y «Para revisar a mano» si las hay.
4. **Freno — si se da cualquiera de estas, NO se aplica nada** (ni «Aceptar», ni «Aplicar») y se avisa a Iván con lo visto:
   - (a) **alguna línea con error** («N con error» en el resumen, o la caja «Líneas que no se entienden»);
   - (b) **alguna señal «no aparece en lo pegado (¿lo han quitado?)»** (o «el Ayuntamiento dice que DESCANSA y aquí hay partido», que es lo mismo);
   - (c) **algún partido nuevo** (señal «partido NUEVO que no tenemos» o «aquí figuraba como descanso y el Ayuntamiento trae partido»);
   - (d) **más de 4 cambios** (el título dice «5 cambios» o más).
   Las demás señales de «Para revisar a mano» (descanso nuevo, descanso en otra fecha) no frenan lo demás (no cambian nada solas), pero van al informe tal cual.
   Una línea con error que sea de la propia rutina (una pista mal copiada) se corrige y se vuelve a **Comparar**, una vez; si sigue, freno.
5. **Sin freno y con 1 a 4 cambios:** **Aceptar todos** → **«Aplicar y avisar (N)»**. Esperar al recuadro verde «Aplicado: N cambios aceptados (MdA J5…). Importación registrada. Aviso al móvil para M jugadores (enviado ya)» —o «(de noche: sale el dd/mm a las 08:00)»—. Copiarlo tal cual al informe. Si dice «Sin aviso: …», copiarlo también.
   - Qué pasa al aplicar: el evento cambia; la ficha y el inicio de cada jugador muestran la línea amarilla «Cambió …»; si cambia el **día**, **todas las respuestas del partido vuelven a «sin responder»** (lo hace la base); el aviso al móvil sale **en el momento salvo de 22:30 a 08:00 (Madrid), que sale a las 08:00** (D155), de cualquier partido que no se haya jugado.
   - Con «respuestas en la web» apagado solo hay «Aplicar lo aceptado» (no avisa): entonces **freno** y avisar a Iván.
6. **«0 cambios»:** nada que aplicar.
7. **Clasificación oficial** (abajo): leer la de los dos grupos tras la última jornada jugada, con la columna **«Sanc»**, y **contrastarla sola** (D164): escribir una línea por equipo, `grupo;equipo;puntos;J;G;P;TF;TC;Sanc` (p. ej. `G1;MACCABI DE ACOSTAR;6;3;3;0;192;71;0`; los nombres tal cual salen), pegarlas en `https://maccabis.vercel.app/gestion/clasificacion` → **Contrastar**. Sale **«Coincide»** (verde) o **«DIFIERE»** (rojo) con una línea por diferencia (equipo, campo, calculada · oficial). Las **diferencias conocidas** (D165: la J1 de MdA, publicada 16-62 cuando acta y hoja dicen 14-62) salen como «Conocida» y **no** hacen saltar «DIFIERE»; si esa misma diferencia cambia de cantidad, sí. Copiar el texto tal cual al informe. Si dice **DIFIERE**, el informe **empieza** por «AVISO: la clasificación calculada difiere de la oficial» (no se corrige nada: lo decide Iván; si la calculada va una jornada por detrás, porque la rutina A aún no ha publicado, se dice).
8. **Colores de los rivales** (D75, abajo): mirar si algún rival ha cambiado de equipación. Si cambia, **no se edita nada**: se avisa a Iván en el informe (editar `data/equipaciones_2026-27.json` es trabajo de Code).
9. **Informe a Iván** (empieza por «Iván,»; si el contraste dijo DIFIERE, lo primero es ese aviso): cambios aplicados (partido, campo, antes → después) y el texto del aviso; o «0 cambios»; o **FRENO: motivo** con las líneas, señales o cambios que lo han hecho saltar; la clasificación de MdA y MdL (puesto, puntos, G-P, TF-TC) y **Sanc** (si Sanc > 0, decirlo y no consultar más: Iván decide); cualquier «Reprogramado» o rareza.

**El calendario no se edita en ningún fichero (D151).** La rutina B solo cambia la tabla de eventos (Importar → Calendario). Los avisos de equipación (Panel, convocatoria, WhatsApp, Liga, Scouting, página de partido) leen la tabla, así que un cambio de local/visitante aplicado aquí ya cambia el aviso en la web en un minuto (la caché de 60 s). `data/calendario_2026-27.json` es una copia generada de la tabla: la regenera sola la rutina A (`npm run jornada`) y, si hace falta antes, `npm run calendario:exportar`. Lo único que se edita a mano son los **colores de los rivales** (D75): no son calendario.

**Nota (31/10/2026):** en Consulta de partidos sale la temporada completa con resultados y una columna de estado («Reprogramado»). Los filtros cargan en cascada (2–3 s cada uno): elegir uno, esperar, elegir el siguiente.

## Clasificación oficial (desde 31/10/2026)
Ruta: Deportes/web → Competiciones municipales → **Consulta de clasificaciones** → Moratalaz → Temporada 2026/2027 · BALONCESTO · SENIOR MASCULINO · Grupo «JDM MOR DOM MAÑ BC SEN MAS G1» (MdA) / «…G2» (MdL). La jornada viene por defecto en la última jugada; tipo **«General por equipos de la jornada»** → Buscar.
- **Columnas:** Puntos, J, G, P, I, TF, TC, TF-TC, TF/TC, Sanc, Progreso. Puntuación observada: victoria 2, derrota 1.
- **Se contrasta sola** con la clasificación calculada en `/gestion/clasificacion` (D74, D164; paso 7).
- **«Sanc»** es el control semanal de incidencias por equipo. La ficha de sanciones con nombres no se consulta salvo que Sanc > 0, y nada de ella va a la web pública.
- **«Clasificación de máximos anotadores»** (solo en G1): contiene nombres de terceros; no se extrae (D73).

**Hallazgos del 31/10 (ejecución supervisada 1, Claude en el Chrome de Iván):**
- **(a) Cambio de la J5 de MdA:** MdA–NABUCO TD figura el **20/12/2026 13:30** en Baloncesto 1 Moratalaz, mientras el resto de la J5 es el 15/11; sin marca de reprogramado. **Aplicado el 31/10 a las 17:09** (Importar → Calendario, 42 líneas, 2 cambios aceptados: fecha 15/11 → 20/12 y hora 09:00 → 13:30; respuestas reiniciadas a «sin responder»). El aviso al móvil **no salió** (el bug de D155: Importar solo avisaba de las dos próximas semanas).
- **(b) Clasificación oficial tras la J3 (25/10):** MdA 1.º en G1 (6 pts, 3-0, 192-71); MdL 1.º en G2 (6 pts, 3-0, 171-101). Sanc = 0 en ambos grupos.
- **(c)** J2 y J13 de MdA/MdL a las 10:15: sin cambios.

---
## Texto original (v0, 02/10/2026; histórico: comparaba con SportEasy, sin objeto desde D153)

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

~~**Copia de eventos a SportEasy con «respuestas en la web» encendido (D104):** si la revisión lleva a crear o cambiar un evento en SportEasy, se hace con el formulario completo (`/calendar/create/`, «Ajustes avanzados»): «Selección manual» (sin participantes) y «Enviar una notificación» apagado. Nunca el formulario rápido de «Crear evento» (invita a todos y notifica). No usar «Aplicar los ajustes a próximos entrenamientos» (sin probar). Apagado, como hasta ahora. Detalle en `docs/SPORTEASY.md`.~~ _(Sin objeto desde D153, 31/10/2026: SportEasy ya no se usa.)_
