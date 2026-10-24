# Reglas de convocatoria — versión 1

_23/10/2026, con los ajustes del 24/10/2026 (D108: interiores, dificultad con pocos datos, mensajes sin disponibles). Dictadas por Iván (D107). Sustituyen a la versión 0 (25–26/09/2026, D40 y D48). Las aplica el **motor de convocatoria** (`plataforma/src/lib/convocatoria/motor.ts`) y cada aviso de la pantalla dice qué regla lo causa con el **mismo número** que aquí (p. ej. «Regla 5.2»)._

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

- **2.1 Bases:** ideal **2 puros**. Los **bases de reserva** (exteriores que suben el balón) **cuentan como base** cuando faltan: «1 + 1 res.» está en el mínimo (amarillo). Dos de reserva es el último recurso (5.4).
- **2.2 Exteriores** (escoltas y aleros): ideal **4**, mínimo 3. Si faltan, **los bases que sobran cuentan como exteriores**.
- **2.3 Interiores** (pívots y ala-pívots): ideal **4**, mínimo **3**, **evitar 5**.
- En la pantalla, cada línea sale en **verde** si cumple el ideal, en **amarillo** si está en el mínimo y en **rojo** si está por debajo.

## 3. Nivel y dificultad del rival

- **Niveles de jugador: A, B, C, D y E** (A el más alto). Confidenciales (D39). No hay números fijos de cuántos de cada nivel.
- **Dificultad del rival: alta / media / baja.** La web la **propone** con la clasificación y la diferencia de puntos de la liga en curso (`data/liga_2026-27.json`) y **Iván la corrige** en la tarjeta del partido. Regla de la propuesta: si el rival ha jugado **menos de 3 partidos**, **media** con el porqué «pocos datos (N partidos)» (D108). Con 3 o más: **alta** si el rival está en el tercio de arriba con diferencia positiva o hace +15 o más por partido; **baja** si está en el tercio de abajo con diferencia negativa o hace −15 o menos por partido; **media** el resto y sin partidos jugados. El porqué sale al lado («10.º del G1 tras la J2 (-5 por partido)»).
- **3.1** El partido **más difícil** del domingo lleva **más nivel medio**. El motor reparte cada línea alternando, y el equipo del partido más difícil elige primero en cada ronda.
- **3.2** Si los dos rivales tienen la **misma dificultad**, se **equilibran los equipos por líneas** (bases, exteriores, interiores), no solo en el total (pregunta 1, D98): el reparto de cada línea va en serpiente.

## 4. Prioridad y rotación

- **Prioridad entre partidos cuando no se llega a todo (pregunta 2):** primero el **partido más difícil**; si están igualados, el **MdA**.
- **4.1 Rotación (pregunta 3):** «quien menos ha jugado» = **partidos convocado en la temporada, sumando MdA y MdL** (de las hojas de estadística). Orden de prioridad para ir convocado: (1) quien menos partidos lleva convocado; (2) a igual rotación, más nivel; (3) **a igual nivel, quien más ha entrenado en las últimas 4 semanas** (pregunta 4); (4) los «solo entreno», siempre al final. Cuando hay que dejar a alguien fuera por el tope, sale primero quien está en una línea que pasa del ideal y, dentro de ella, el de menos prioridad.
- Entrenos de las últimas 4 semanas: las respuestas «voy» a los entrenos de los 28 días anteriores al domingo (de SportEasy en la fase puente; de la web cuando se encienda el interruptor). No es todavía el pase de lista real.

## 5. Si no se llega a los mínimos: orden de sacrificio (pregunta 5)

**Solo se dobla para cubrir mínimos, nunca para llegar al ideal** (D108). Los mínimos de cada equipo: 7 jugadores (1.3), 2 bases contando los de reserva con al menos 1 puro (2.1) y **3 interiores** (2.3). Con 6 interiores entre los dos equipos la propuesta es **3 y 3**, sin doblar; las excepciones las hace Iván a mano. Si no se llega a un mínimo:

- **5.1** Dobla un **«Dobla»** (primero quien menos ha doblado esta temporada).
- **5.2** Si no hay, dobla un **«No dobla»**, con aviso.
- **5.3** Con 3 interiores se juega: no se dobla para tener el cuarto.
- **5.4** Y por último, **dos bases de reserva**, con aviso.
- **Nunca menos de 7 por equipo** (si no se llega ni doblando, error en rojo para que Iván decida).
- **«Dobla / No dobla» es una recomendación, no una regla:** Iván hace excepciones por partido (por eso el motor puede proponer a un «No dobla», con aviso, y la pantalla deja doblar a cualquiera, salvo a la misma hora).

## 5 bis. Sin disponibles

- Mientras nadie haya dicho «voy» y no haya nadie convocado a mano, cada equipo muestra **un solo mensaje**: «Todavía no hay disponibles para este domingo», en vez de un aviso por cada regla. Los avisos por regla salen en cuanto hay propuesta o convocatoria (D108).
- En la fase puente las respuestas llegan de SportEasy con **Importar → Respuestas**: la pantalla dice cuándo fue la última importación y si ese domingo aún no tiene ninguna, con el enlace a Importar.

## 6. Reglas personales (privadas, las configura Iván en «Datos de los jugadores»)

- **6.1 Fijo a un equipo:** solo va con ese equipo. Así se marca también al **entrenador-jugador**, que va fijo a su equipo.
- **6.2 Va al equipo al que le falte un jugador** (comodín): se coloca el último, en el equipo con menos jugadores.
- **6.3** Iván puede **cambiar la posición de un jugador solo para un partido** (cuenta en las líneas de ese partido).

## 7. Casos especiales

- **Domingo con un solo equipo** (p. ej. la **J4, 08/11/2026**: el MdA descansa y el MdL juega a las 11:30): una sola tarjeta; van los disponibles con ficha de ese equipo, hasta el máximo.
- **Misma hora** (p. ej. la **J13**): nadie dobla (1.4); el motor reparte a los disponibles entre los dos equipos.

## 8. Quién decide y cómo se cambia

- **Iván decide siempre.** La web propone y él ajusta. La **modificación manual siempre es posible**: pasar al otro equipo, doblar, quitar, añadir (a cualquiera de la plantilla, aunque no haya respondido o haya dicho «no voy», con aviso) o cambiar la posición para ese partido.
- **Cada cambio guarda su motivo** (Rotación, Rival, Lesión, Equilibrar, Lo ha pedido, Otro, más una nota opcional), quién y cuándo, para afinar las reglas con el tiempo.
- Tras cada cambio se recalculan el recuento y los avisos; la **propuesta solo se rehace** con «Recalcular propuesta».
- **Encuentro: 20 minutos antes** de la hora del partido (D98).
- Los niveles **nunca** salen en el mensaje de WhatsApp, ni en los avisos, ni en Mi zona.

## Datos que usa

| Dato | De dónde | ¿Público? |
|---|---|---|
| Calendario (hora, pista, local/visitante) | Tabla de eventos (D95) | Sí |
| Fichas y «solo entreno» | `jugadores` (Gestión → Jugadores) | Fichas sí |
| Disponibles del domingo | `respuestas` por partido (de la respuesta única del domingo, D103, o importadas de SportEasy) | Los jugadores ven quién va (D46) |
| Partidos convocado y doblajes | Hojas de estadística (`season_2026-27.json`) | Sí |
| Entrenos de las últimas 4 semanas | Respuestas «voy» a los entrenos | Solo gestores |
| Dificultad | Propuesta desde `data/liga_2026-27.json`, corregida por Iván (`convocatorias.dificultad`) | Solo gestores |
| Posición, nivel (el de Iván), Dobla, ataque usado, defensa, total, minutos y pts/min | Hoja de Iván `privado/jugadores_2026-27.xlsx` (pestañas «Jugadores» y «Parametros»), cargada con `npm run db:privado` en `jugadores_privado` (solo gestores). El ataque es el de la columna **«Ataque (usar)»** (con 300 minutos o más sale de los puntos por minuto; si no, la letra de Iván); el **nivel que usa el motor es «Nivel (tuyo)»**; el total es solo de referencia | **No. Nunca.** |
| Base de reserva, reglas personales, sanción | Gestión → Convocatoria → Datos de los jugadores (`jugadores_privado`) | **No. Nunca.** |
