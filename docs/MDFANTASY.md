# MdFantasy — reglas, simulación y parámetros (D196)

> Fantasy interno del club. Encargo de Iván del 20/11/2026; construido en `feat/mdfantasy`, **sin mergear y sin aplicar en
> el real**. Este documento es la fase 1 del encargo (simulación antes de construir) y la referencia de las reglas tal como
> han quedado en el código. Decisión: `DECISIONS.md`, D196. Estado y cómo probarlo: `ESTADO.md`.
>
> El detalle con nombres (puntos de cada jugador en cada jornada y por qué) **no está en git**: lleva quién respondió y
> cuándo. Está en `privado/fantasy/simulacion_detalle.md`. Aquí solo hay cifras agregadas.

## 1. Reglas, como han quedado

**Elegibles:** jugadores con rol «jugador» y activos (hoy, 24). Los de solo entreno y el entrenador no. Nadie puede tener
su propia copia.

**Mánager:** cualquier persona de la plantilla con sesión (también los de solo entreno y el entrenador, que juegan como
mánagers pero no son elegibles). Una cuenta de gestor sin ficha no puede jugar.

**Jornada:** cada día con partido de liga (los domingos). Lo que pasa entre un domingo con partido y el siguiente
(entrenos incluidos) cuenta para el siguiente.

### Puntos de un jugador en una jornada

| Concepto | Regla | Parámetro |
|---|---|---|
| Rendimiento, por partido | 1 punto por punto anotado | `puntoPorPunto` 1 |
| | +/- relativo = su +/- − margen del equipo × sus segundos / duración real. Se suma la mitad, redondeada, con tope de ±5 | `masMenosDivisor` 2, `masMenosTope` 5 |
| | Sin bonus por victoria. Mínimo 0 por partido | |
| | Dos partidos el mismo domingo: media de los dos + 3 | `bonusDoblete` 3 |
| Compromiso, respuesta | Responde él mismo en 24 h desde el aviso (sin contar de 22:30 a 08:00): +3 | `respuestaRapida` 3, `horasRapida` 24 |
| | Responde él mismo antes del plazo: +1 | `respuestaATiempo` 1 |
| | No responde: −2 | `sinRespuesta` −2 |
| Compromiso, asistencia | Entreno al que fue de verdad: +3 | `entrenoAsistido` 3 |
| | Plantón (dijo «voy» y no fue): −5 | `planton` −5 |
| | Vino sin avisar: los +3 del entreno, sin puntos de respuesta | |
| Total | rendimiento + compromiso, mínimo 0. No convocado: solo compromiso | |

**Duración real del partido:** la suma de los segundos de todo el equipo en la hoja, entre 5.

**Cosas que el encargo no decía y se han decidido (para revisión de Iván):**

1. **El domingo es una sola respuesta**, aunque haya dos partidos (la web ya lo trata así). Cada entreno es otra.
2. **Si nadie le avisó** (respondió antes de que saliera ningún recordatorio), cuenta como rápido: +3.
3. **Respondió fuera de plazo:** 0 (ni premio ni castigo). **Lo puso un gestor por él:** 0. **Duda que cerró el sistema:** 0.
4. **Avisó con una ausencia** («Días que no estoy»): +1 por cada evento que cubre. No +3, para que una baja larga no sume más que jugar.
5. **«No va» por defecto** (quien no suele entrenar): 0, ni −2. Sale del estado que ya ven los jugadores (`v_quien_va`), no de la tabla privada.
6. **Entreno sin respuesta de los gestores a «¿Faltó alguien ayer?»:** quien dijo «voy», fue (+3).
7. **Plantón en un partido:** solo si estaba convocado, dijo «voy», no sale en la hoja **y un gestor lo confirma**. Si nadie lo confirma, no hay plantón.
8. **Dijo «voy» y faltó con excusa** (pase de lista «con excusa» o «lesionado»): sin los +3 y sin plantón.
   - Lo que ven los jugadores de un plantón es **«no vino»**, sin motivo (el motivo es solo de gestores). **Si un gestor lo corrige** (en «¿Faltó alguien?» o en el pase de lista), la jornada se vuelve a puntuar **al momento**, aunque ya estuviera cerrada: puntos, ingresos y ranking se recalculan sin duplicar nada.
9. **Cuándo respondió:** hasta ahora la base solo guardaba el último cambio. La migración apunta desde ahora la **primera** respuesta de cada jugador a cada evento; en lo anterior se usa el último cambio.

### Puntos de un mánager

- Suma los puntos de sus alineados (hasta 5). El **capitán dobla solo el rendimiento**; si no tiene minutos en la hoja, lo hereda el **vicecapitán**.
- El capitán no puede ser el mismo dos jornadas seguidas. Si no toca la alineación, **se mantiene** y capitán y vicecapitán **se intercambian**.
- **Porra:** +3 por cada equipo acertado (gana o pierde).
- **Duelo:** un rival por jornada, todos contra todos por turno; solo cuenta para la clasificación de duelos (2 por victoria, 1 por empate).

### Mercado (millones)

- **Valor** = media de sus puntos en las últimas 4 jornadas con datos, mínimo 4 M.
- **Copias por jugador** = las justas para (mánagers × 7) con un 15 % de margen. Se recalcula con cada alta.
- **Alta:** plantilla al azar de valor parecido para todos (±10 % de 7 × el valor medio) más la caja inicial. Quien entra tarde, igual con las copias libres; **si con las que quedan no sale una plantilla dentro del margen, la diferencia va a su caja**.
- **Fichar** una copia libre: su valor. **Vender:** recupera el valor actual.
- **Clausulazo:** sin copias libres, pagando valor × 1,5 se le quita la copia al dueño que se elija, que cobra ese importe. Uno por mánager y jornada; una copia robada no se vuelve a robar esa jornada. Hace falta hueco en la plantilla. Aviso inmediato al afectado (de 22:30 a 08:00 espera a las 08:00).
- **Ingresos por jornada:** fijo + por punto.
- **Horario:** todo cerrado desde el primer partido del domingo hasta que se publican las estadísticas. Clausulazos cerrados desde el sábado a las 20:00. Los gestores no pueden operar (mercado y alineación; la porra sí) desde que existe el borrador de la convocatoria hasta que se aprueba.
- Todos los parámetros se cambian en **MdFantasy › Ajustes** (solo gestores).

## 2. Simulación con los datos reales de 2026-27

**Cómo:** `npm run fantasy:extraer -- --confirmar <ref>` lee el real en solo lectura (nunca `jugadores_privado`) y
`npm run fantasy:simular` aplica **el mismo código que usa la web** (`plataforma/src/lib/fantasy`). Datos del 20/11/2026:
5 jornadas, 8 partidos.

| Jornada | Partidos | Jugaron | Media de puntos por jugador | Máximo |
|---|---|---|---|---|
| 04/10 | 2 | 15 | 4,3 | 21 |
| 18/10 | 2 | 19 | 7,9 | 34 |
| 25/10 | 2 | 17 | 7,5 | 33 |
| 08/11 | 1 | 9 | 9,5 | 33 |
| 15/11 | 1 | 10 | 8,0 | 27 |

- **Rendimiento** de quien juega: media 7,1; mediana 5; máximo 29.
- **Compromiso** por jornada: media 3,2; de −4 a 12 (dos entrenos en una jornada de tres semanas).
- **Valor de mercado** tras la J5: medio 8,7 M; mediano 7,2 M; máximo 31,5 M; 6 de 24 en el mínimo de 4 M.

**Límites de la simulación (hay que saberlos al leerla):**

- **Respuestas:** la web las guarda desde el 26/10. En la J1 y la J2 no hay ninguna (se respondía en SportEasy y no se
  importaron), así que **el compromiso de esas jornadas no cuenta respuestas** (un evento al que no respondió nadie no
  suma ni resta: regla del código, no solo de la simulación); en la J3, solo las de los eventos que sí las tienen.
- **Asistencia real:** nadie ha respondido todavía a «¿Faltó alguien ayer?» (no existía). Hasta el 23/10 se usa la
  asistencia de SportEasy; desde entonces, quien dijo «voy» cuenta como que fue. **No hay ningún plantón simulado.**
- **Hora de la respuesta:** el último cambio, no la primera respuesta (ver regla 9).

### Nombres de la hoja

`liga_estadisticas_jugador` identifica por nombre. De los 23 nombres de nuestras hojas:

- **22 casan exactos** con el nombre oficial de la ficha (sin tildes ni mayúsculas).
- **1 casa por aproximación:** «MENDEZ ESCANDON, FERNANDO ANTONIO» ↔ la ficha «Méndez Escandón, Fernando» (la hoja trae un segundo nombre). El código lo acepta porque el nombre de la ficha es el principio del de la hoja y no hay otro candidato.
- **Ninguno sin casar.** Si aparece uno, la jornada se puntúa sin él, se avisa a los gestores y se arregla en Ajustes («Nombres de la hoja sin casar»), que vuelve a puntuar.
- El jugador elegible que aún no sale en ninguna hoja es `galan-domingo-guillermo` (no ha jugado).

### Mánagers simulados y economía

Plantillas al azar de valor parecido, alineando a los 5 de más valor:

| Mánagers | Copias por jugador | Plantillas dentro del ±10 % | Puntos por jornada (media) |
|---|---|---|---|
| 12 | 5 | 12 de 12 | 57,2 |
| 18 | 7 | 18 de 18 | 57,9 |
| 25 | 9 | 25 de 25 | 60,6 |

**Un mánager medio hace unos 59 puntos por jornada.**

**Objetivo del encargo:** que un mánager medio pueda permitirse el clausulazo de un jugador medio cada tres jornadas, y
el del más caro solo vendiendo.

- Clausulazo de un jugador medio: 8,7 × 1,5 = **13,1 M**. Hace falta ingresar unos **4,4 M por jornada**.
- **Ingreso elegido: 2 M fijos + 0,04 M por punto.** Con 59 puntos, 4,4 M; tres jornadas, 13,1 M.
  El fijo es algo menos de la mitad para que jugar bien se note sin hundir a quien va último (con 25 puntos ingresa 3 M).
- **Caja inicial elegida: 13 M**, un clausulazo medio. Permite uno desde el principio y, si se gasta, vuelve en tres jornadas.
- Clausulazo del más caro: 31,5 × 1,5 = **47,3 M**. Sin vender ni gastar nada, un mánager medio tarda **8 jornadas** en
  reunirlo; vendiendo a dos jugadores medios, lo tiene al momento. Es decir: en la práctica, solo vendiendo.

| Parámetro | Valor | Por qué |
|---|---|---|
| `cajaInicial` | 13 M | un clausulazo de un jugador medio |
| `ingresoFijo` | 2 M | ~45 % del ingreso de una jornada media |
| `ingresoPorPunto` | 0,04 M | con 59 puntos, 2,4 M |
| `margenCopias` | 0,15 | con 25 mánagers, 9 copias: 216 para 175 huecos |
| `margenInicio` | 0,10 | el ±10 % del encargo |

**A revisar tras tres o cuatro jornadas jugadas de verdad:** el valor del más caro es 3,6 veces el medio; si el mercado se
queda parado (nadie llega a los caros) o demasiado suelto, se toca `ingresoPorPunto` o `clausula` en Ajustes, sin código.

## 3. Cómo se puntúa (para quien mantenga esto)

- La tarea de avisos de cada 15 minutos mira si hay jornadas **con todas sus hojas publicadas** y sin puntuar
  (`fantasy_pendientes`); si las hay, las puntúa (`lib/fantasy/tarea.ts`). No hay ningún botón que pulsar; en Ajustes
  hay «Puntuar ahora» por si no se quiere esperar.
- **Repetible:** todo se guarda por jornada y persona; el ingreso de cada mánager es un único movimiento por jornada que
  se corrige si los puntos cambian. Si la hoja se corrige después, la jornada se vuelve a puntuar sola.
- La caja no se guarda: es la suma de los movimientos.
- Las jornadas anteriores a que alguien se apunte se puntúan igual (hacen falta para el valor de mercado), sin avisar a nadie.
