# RUTINA B — Revisión del calendario (v1, 08/10/2026: usa Importar y la cola de SportEasy, D94/D95)

> **Desde el paso 2 la web es la única fuente de eventos.** Los pasos 4 y 5 de abajo (comparar a mano con SportEasy y aplicar allí) se sustituyen por: **Importar → Calendario** en la plataforma (compara y propone) y, después, copiar a SportEasy lo que quede en la cola «Copia a SportEasy». El texto original se conserva por si hay que volver al método antiguo.

## Procedimiento actual
1. Leer en Deportes/web la programación de MdA (G1) y MdL (G2) (pasos 1–3 de abajo).
2. Pegarla en `https://maccabis.vercel.app/gestion/eventos/importar` (pestaña **Calendario**), una línea por partido: `grupo;jornada;local;visitante;fecha;hora;pista` (la jornada vale `1` o `J1`; G1 = MdA, G2 = MdL; una jornada de descanso se escribe «Maccabi de Acostar descansa»; las líneas de otros equipos se ignoran). Pulsar **Comparar**: sale «0 cambios» o la lista de cambios con campo, valor actual y valor del Ayuntamiento.
3. **Proponer los cambios a Iván** y, con su OK, pulsar **Aceptar** (o **Ignorar**, o **Aceptar todos**) y **Aplicar lo aceptado**. Nada se aplica sin OK. Los partidos nuevos o que «no aparecen en lo pegado (¿lo han quitado?)» salen como señales: se revisan a mano, no se crean ni se borran solos.
4. Lo aceptado queda **pendiente de copiar a SportEasy**. Abrir `/gestion/eventos`, tarjeta **«Copia a SportEasy»**: copiar cada cambio a SportEasy con el OK de Iván y pulsar **«Marcar como copiado»**.
5. Cada importación queda registrada (quién, cuándo, líneas, qué se aceptó) en la misma pantalla.
6. Colores de los rivales y `npm run datos:sync` / `pruebas:equipacion`: como antes (abajo). Si cambia el orden local/visitante, el aviso de equipación se recalcula con los datos del calendario del repo: tras aceptar un cambio de local/visitante, actualizar también `data/calendario_2026-27.json` y correr `datos:sync` hasta que los avisos lean de la tabla.

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

**Revisar cambios de equipación de los rivales (D75):** cada vez que se revise el calendario, comprobar en Deportes/web (ficha del equipo rival: colores de primera equipación) si algún rival ha cambiado de camiseta o pantalón. Si cambia: editar `data/equipaciones_2026-27.json` (texto original, color normalizado, fecha), correr `npm run equipacion:sync` en `plataforma/` y `npm run pruebas:equipacion`. Si cambia el calendario (fecha, rival, local/visitante), también `equipacion:sync` (copia del calendario en la plataforma). Los avisos de choque se recalculan solos.

**Si cambia el orden local/visitante o el color de un rival, regenerar avisos y la portada (`npm run datos:sync` en `plataforma/`, antes `equipacion:sync`; también si cambia un entreno, una pista o un festivo en `data/entrenos_2026-27.json`; en la rutina A ya lo hace `npm run jornada`, D84)**, y correr `npm run pruebas:equipacion`. Quién cambia lo fija el calendario (Bases 47 JDM, 5.11: cambia el que figura en segundo lugar = visitante), así que un cambio de local/visitante convierte «cambian ellos» en «nos toca cambiar» (o al revés) sin tocar nada más.
