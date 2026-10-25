# Reglas de convocatoria — versión 1

_23/10/2026, con los ajustes del 24/10/2026 (D108: interiores, dificultad con pocos datos, mensajes sin disponibles; D109: el nivel va antes que la rotación y deuda de 2 domingos fuera; D110: en 2026/27 no hay entrenador-jugador fijo; D112: con rivales parejos, convocados igualados; D115: nadie dobla por bases; D124: proyección de anotación, regla 3.3 y §9; D125: modo rápido). Dictadas por Iván (D107). Sustituyen a la versión 0 (25–26/09/2026, D40 y D48). Las aplica el **motor de convocatoria** (`plataforma/src/lib/convocatoria/motor.ts`) y cada aviso de la pantalla dice qué regla lo causa con el **mismo número** que aquí (p. ej. «Regla 5.2»)._

> **Privacidad (D39).** Este documento no lleva nombres de jugadores ni niveles. Los datos por jugador (posición, base de reserva, nivel A–E, Dobla / No dobla, reglas personales, sanciones) viven **solo en la zona de gestión** (tabla `jugadores_privado` de Supabase, con RLS: solo los 3 gestores) y en `privado/` (fuera de git) como copia de Iván. **Nunca** en JSON públicos, mensajes de WhatsApp, avisos ni páginas de jugador. «Solo entreno» y las fichas siguen en la plantilla (`jugadores`).

## 0. Quién está disponible

- **0.1** Solo están disponibles para un partido quienes responden «voy» a ese partido (la respuesta única del domingo, D103, ya se guarda por partido; en la fase puente, las respuestas importadas de SportEasy). «Duda», «no voy» y «sin responder» no cuentan; Iván puede convocarlos a mano y la pantalla lo avisa.
- **0.2** Si a un jugador le faltan datos privados (posición o nivel), cuenta como **exterior de nivel C** y sin doblar, con aviso, hasta que se carguen.

## 1. Límites duros

- **1.1 Máximo 10 por equipo.** Más de 10 solo si ese domingo hay **más de 20 disponibles**: entonces el máximo es el reparto de los disponibles entre los partidos, con **tope de 12** (ficha de partido).
- **1.2 Con 20 o más disponibles, los «solo entreno» no van.** Por debajo de 20, un «solo entreno» entra solo para cubrir un hueco: va el último en el orden de prioridad (4.1) y es el primero en salir por el tope.
- **1.3 Nunca menos de 7 por equipo.** Ideal: 10.
- **1.4 Doblar (D33, pregunta 7):** se puede doblar siempre que los dos partidos **no empiecen a la misma hora exacta** (se juega en el mismo pabellón). A la misma hora (p. ej. la J13), **nadie dobla**: la pantalla lo bloquea y la web también lo rechaza al guardar.
- **1.5** Quien tiene ficha de un solo equipo solo va con ese equipo.
- **1.6 Sancionados (D51):** «sancionado hasta la jornada X» (lo pone un gestor en los datos del jugador) no se convoca hasta esa jornada incluida.

## 2. Posiciones (en cada equipo)

- **2.1 Bases:** ideal **2 puros**. Los **bases de reserva** (exteriores que suben el balón) **cuentan como base** cuando faltan: «1 + 1 res.» está en el mínimo (amarillo). Dos de reserva es el último recurso (5.4). **2 bases es lo ideal, no un mínimo para doblar (D115):** si un equipo no llega a 2 bases puros, el hueco lo cubre un base de reserva disponible para ese partido; si no hay ninguno, sale el aviso 2.1, pero **nadie dobla por bases**.
- **2.2 Exteriores** (escoltas y aleros): ideal **4**, mínimo 3. Si faltan, **los bases que sobran cuentan como exteriores**.
- **2.3 Interiores** (pívots y ala-pívots): ideal **4**, mínimo **3**, **evitar 5**.
- En la pantalla, cada línea sale en **verde** si cumple el ideal, en **amarillo** si está en el mínimo y en **rojo** si está por debajo.

## 3. Nivel y dificultad del rival

- **Niveles de jugador: A, B, C, D y E** (A el más alto). Confidenciales (D39). No hay números fijos de cuántos de cada nivel.
- **Dificultad del rival: alta / media / baja.** La web la **propone** con la clasificación y la diferencia de puntos de la liga en curso (`data/liga_2026-27.json`) y **Iván la corrige** en la tarjeta del partido. Regla de la propuesta: si el rival ha jugado **menos de 3 partidos**, **media** con el porqué «pocos datos (N partidos)» (D108). Con 3 o más: **alta** si el rival está en el tercio de arriba con diferencia positiva o hace +15 o más por partido; **baja** si está en el tercio de abajo con diferencia negativa o hace −15 o menos por partido; **media** el resto y sin partidos jugados. El porqué sale al lado («10.º del G1 tras la J2 (-5 por partido)»).
- **3.1** El partido **más difícil** del domingo lleva **más nivel medio**. El motor reparte cada línea alternando, y el equipo del partido más difícil elige primero en cada ronda.
- **3.2** Si los dos rivales tienen la **misma dificultad**, se **equilibran los equipos por líneas** (bases, exteriores, interiores), no solo en el total (pregunta 1, D98): el reparto de cada línea va en serpiente. **Y el número de convocados queda igualado: diferencia máxima de 1** (D112). Los disponibles para los dos partidos se reparten hacia el equipo con menos convocados; el máximo de 10 (1.1) es un tope, no un objetivo a llenar. Si un equipo lleva 5 interiores porque esos interiores solo están disponibles para su partido, no es un error: sale el aviso «evitar 5» (2.3), pero no se mueve a nadie que no esté disponible para el otro partido.
- **3.3 Anotación mínima (D124):** si la **proyección de anotación** de un equipo (§9) baja de **45 puntos** (umbral provisional de la pestaña «Parametros» de la hoja de Iván; se recalibra tras la J6), sale un aviso como los demás: «Proyección ≈ N puntos: por debajo de la anotación mínima (45).». Es un aviso, no cambia la propuesta.

## 4. Prioridad y rotación

- **Prioridad entre partidos cuando no se llega a todo (pregunta 2):** primero el **partido más difícil**; si están igualados, el **MdA**.
- **4.1 Orden para ir convocado (D109: el nivel va antes que la rotación):** (1) **cubrir las líneas** (bases, exteriores, interiores) según las secciones 2 y 5; (2) **más nivel total**; (3) a igual nivel, **menos partidos convocado en la temporada**, sumando MdA y MdL (de las hojas de estadística); (4) a igualdad, **quien más ha entrenado en las últimas 4 semanas** (pregunta 4); (5) los «solo entreno», siempre al final. Cuando hay que dejar a alguien fuera por el tope, sale primero quien está en una línea que pasa del ideal y, dentro de ella, el de menos prioridad.
- **4.2 Deuda de rotación (D109):** si un jugador estuvo disponible y no fue convocado en los **2 últimos domingos en que estuvo disponible**, entra **por delante del nivel** (criterio 2 de la 4.1; las líneas siguen primero y los «solo entreno» siguen al final), con el aviso «entra por rotación (2 domingos fuera)». Los domingos en que no estuvo disponible no cuentan ni cortan la cuenta; la cuenta se para en el último domingo en que fue convocado. «Disponible» = dijo «voy» a algún partido de liga de ese domingo con un equipo del que tiene ficha; «convocado» = sale en las hojas de estadística de ese domingo o en su convocatoria aprobada.
- Entrenos de las últimas 4 semanas: las respuestas «voy» a los entrenos de los 28 días anteriores al domingo (de SportEasy en la fase puente; de la web cuando se encienda el interruptor). No es todavía el pase de lista real.

## 5. Si no se llega a los mínimos: orden de sacrificio (pregunta 5)

**Solo se dobla para cubrir mínimos, nunca para llegar al ideal** (D108). Los mínimos de cada equipo: 7 jugadores (1.3) y **3 interiores** (2.3). **Por bases no se dobla nunca** (D115): el hueco de base lo cubre un base de reserva y, si no hay, aviso 2.1. Con 6 interiores entre los dos equipos la propuesta es **3 y 3**, sin doblar; las excepciones las hace Iván a mano. Si no se llega a un mínimo:

- **5.1** Dobla un **«Dobla»** (primero quien menos ha doblado esta temporada).
- **5.2** Si no hay, dobla un **«No dobla»**, con aviso.
- **5.3** Con 3 interiores se juega: no se dobla para tener el cuarto.
- **5.4** Bases: sin bases puros, **dos bases de reserva**, con aviso; nunca se dobla un base para cubrirlo (D115).
- **Nunca menos de 7 por equipo** (si no se llega ni doblando, error en rojo para que Iván decida).
- **«Dobla / No dobla» es una recomendación, no una regla:** Iván hace excepciones por partido (por eso el motor puede proponer a un «No dobla», con aviso, y la pantalla deja doblar a cualquiera, salvo a la misma hora).

## 5 bis. Sin disponibles

- Mientras nadie haya dicho «voy» y no haya nadie convocado a mano, cada equipo muestra **un solo mensaje**: «Todavía no hay disponibles para este domingo», en vez de un aviso por cada regla. Los avisos por regla salen en cuanto hay propuesta o convocatoria (D108).
- En la fase puente las respuestas llegan de SportEasy con **Importar → Respuestas**: la pantalla dice cuándo fue la última importación y si ese domingo aún no tiene ninguna, con el enlace a Importar.

## 6. Reglas personales (privadas, las configura Iván en «Datos de los jugadores»)

- **6.1 Fijo a un equipo:** solo va con ese equipo. Así se marca también al **entrenador-jugador**, que va fijo a su equipo. **En 2026/27 no hay entrenador-jugador: nadie es fijo** (D110).
- **6.2 Va al equipo al que le falte un jugador** (comodín): se coloca el último, en el equipo con menos jugadores.
- **6.3** Iván puede **cambiar la posición de un jugador solo para un partido** (cuenta en las líneas de ese partido).

## 7. Casos especiales

- **Domingo con un solo equipo** (p. ej. la **J4, 08/11/2026**: el MdA descansa y el MdL juega a las 11:30): una sola tarjeta; van los disponibles con ficha de ese equipo, hasta el máximo.
- **Misma hora** (p. ej. la **J13**): nadie dobla (1.4); el motor reparte a los disponibles entre los dos equipos.

## 8. Quién decide y cómo se cambia

- **Iván decide siempre.** La web propone y él ajusta. La **modificación manual siempre es posible**: pasar al otro equipo, doblar, quitar, añadir (a cualquiera de la plantilla, aunque no haya respondido o haya dicho «no voy», con aviso) o cambiar la posición para ese partido.
- **Cada cambio guarda su motivo** (Rotación, Rival, Lesión, Equilibrar, Lo ha pedido, Otro, más una nota opcional), quién y cuándo, para afinar las reglas con el tiempo.
- Tras cada cambio se recalculan el recuento, los avisos y la proyección; la **propuesta solo se rehace** con «Recalcular propuesta».
- **Modo rápido (D125), por defecto** en cuanto se elige «Usar propuesta» o «Empezar en blanco»: los jugadores se **arrastran** entre MdA, MdL y «Disponibles sin convocar» (escritorio, con las zonas de destino a la vista) o se **marcan** y se mueven con la barra «Mover a…» (móvil y teclado: nunca solo arrastrar). Cada movimiento se guarda **al momento** con el motivo «ajuste manual», sin preguntar, y hay «Deshacer» del último. Mover es exclusivo (quien va a un equipo sale del otro; para doblar, «Cambiar»). Una zona donde el jugador no tiene ficha se marca como **no válida** y no se puede soltar (1.5); soltar a quien dijo «no voy» a ese partido se puede, con aviso. «Cambiar» sigue igual para dejar un motivo concreto.
- **El tablero (D121) es el ajuste manual de un vistazo:** `/gestion/tablero` (o «Abrir tablero» desde la convocatoria) enseña una línea por jugador con su estado en cada partido del domingo; tocar «Convocar» / «Convocado» o seleccionar a varios y pulsar «Al MdA», «Al MdL» o «Quitar convocatoria» guarda en la misma convocatoria, con un solo motivo para el grupo («ajuste manual» por defecto) y quién y cuándo. Solo convoca a quien está disponible para ese partido y nunca deja doblar a la misma hora (1.4). Los avisos de las reglas se recalculan al momento (mínimos, evitar 5 interiores, más de 10, ningún base puro y la diferencia de convocados de D112). Una convocatoria aprobada que se toca queda «cambiada» y sus salidas vuelven a pendientes, como al cambiarla aquí. El motor sigue proponiendo; el tablero no rehace la propuesta.
- **Encuentro: 20 minutos antes** de la hora del partido (D98).
- Los niveles **nunca** salen en el mensaje de WhatsApp, ni en los avisos, ni en el inicio del jugador (antes Mi zona), ni en su calendario personal, ni en los grupos de entreno publicados. En el tablero y en los grupos sin publicar, solo los ven los gestores.

## Datos que usa

| Dato | De dónde | ¿Público? |
|---|---|---|
| Calendario (hora, pista, local/visitante) | Tabla de eventos (D95) | Sí |
| Fichas y «solo entreno» | `jugadores` (Gestión → Jugadores) | Fichas sí |
| Disponibles del domingo | `respuestas` por partido (de la respuesta única del domingo, D103, o importadas de SportEasy) | Los jugadores ven quién va (D46) |
| Partidos convocado y doblajes | Hojas de estadística (`season_2026-27.json`) | Sí |
| Domingos disponible y fuera (4.2) | Respuestas «voy» a los partidos ya jugados, hojas de estadística y convocatorias aprobadas | Solo gestores |
| Entrenos de las últimas 4 semanas | Respuestas «voy» a los entrenos | Solo gestores |
| Dificultad | Propuesta desde `data/liga_2026-27.json`, corregida por Iván (`convocatorias.dificultad`) | Solo gestores |
| Posición, nivel (el de Iván), Dobla, ataque usado, defensa, total, minutos y pts/min | Hoja de Iván `privado/jugadores_2026-27.xlsx` (pestañas «Jugadores» y «Parametros»), cargada con `npm run db:privado` en `jugadores_privado` (solo gestores). El ataque es el de la columna **«Ataque (usar)»** (con 300 minutos o más sale de los puntos por minuto; si no, la letra de Iván); el **nivel que usa el motor es «Nivel (tuyo)»**; el total es solo de referencia | **No. Nunca.** |
| Base de reserva, reglas personales, sanción | Gestión → Convocatoria → Datos de los jugadores (`jugadores_privado`) | **No. Nunca.** |

## 9. Proyección de anotación (D124) — solo gestores

En la cabecera de cada equipo de la convocatoria y en el resumen por equipo del tablero: **«Proyección ≈ N puntos (entre A y B)»**, que se recalcula con cada cambio. Debajo, «Quién aporta» (cada convocado con sus puntos esperados y la marca «pocos datos») y «El rival encaja de media X y anota Y». Lo calcula `plataforma/src/lib/convocatoria/proyeccion.ts` (funciones puras):

- **a) Puntos por minuto** de cada convocado con la temporada actual **pesando el doble** que la anterior: (2·puntos actuales + puntos anteriores) / (2·minutos actuales + minutos anteriores). Con **menos de 60 minutos sumados** (las dos temporadas), lo que falta hasta 60 se completa con la **tasa media de su letra de Ataque** («Ataque (usar)» de `jugadores_privado`) y se marca «pocos datos». La tasa de cada letra se calibra con los jugadores de esa letra que sí tienen 60 minutos o más; una letra sin nadie así (o un jugador sin letra) toma la media de todos los calibrados.
- **b) Minutos esperados:** 240 por partido, repartidos según los minutos medios por partido de cada uno (ponderados igual; 20 si no tiene partidos), con un **máximo de 40** por jugador: lo que pasaría de 40 se reparte entre los demás. Con 6 o menos convocados, todos 40.
- **c) Factor rival:** puntos que encaja el rival por partido frente a la media de su grupo (`data/liga_2026-27.json`, solo las jornadas anteriores a la del partido). Con **menos de 2 partidos** del rival, factor 1 y la nota «rival con pocos datos».
- **d) Margen:** ±15 % mientras la temporada tenga **menos de 5 jornadas** jugadas; ±10 % después.
- **Proyección** = suma de (puntos por minuto × minutos esperados) × factor rival, redondeada; el intervalo, con el margen.
- **Calibración:** tras cada jornada publicada (`npm run jornada`, también en la rutina A) se guarda en `privado/proyecciones_2026-27.json` (fuera de git; `npm run proyeccion:calibrar` en `plataforma/`) la proyección de cada partido nuestro, hecha con lo que se sabía **antes** de esa jornada y con los que salen en su hoja, y el resultado real. Lo guardado queda congelado. La pantalla de convocatoria lo muestra: «Acierto de la proyección: error medio N puntos en M partidos».
- **Privacidad:** lleva la letra de Ataque (D39): nunca es pública ni la ve un jugador.
