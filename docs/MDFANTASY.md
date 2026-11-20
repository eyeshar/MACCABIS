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
| Compromiso, respuesta | Responde él mismo en 24 h desde el aviso (sin contar de 22:30 a 08:00): +2 | `respuestaRapida` 2, `horasRapida` 24 |
| | Responde él mismo antes del plazo: +1 | `respuestaATiempo` 1 |
| | No responde: −2 | `sinRespuesta` −2 |
| Compromiso, asistencia | Entreno al que fue de verdad: +2 | `entrenoAsistido` 2 |
| | Plantón (dijo «voy» y no fue): −5 | `planton` −5 |
| | Vino sin avisar: los +2 del entreno, sin puntos de respuesta | |
| Compromiso, tope | **Tope semanal: 6 por jugador y jornada.** Limita solo por arriba: los negativos cuentan enteros | `topeCompromiso` 6 |
| Total | rendimiento + compromiso, mínimo 0. No convocado: solo compromiso | |

**Duración real del partido:** la suma de los segundos de todo el equipo en la hoja, entre 5.

**Cosas que el encargo no decía y se han decidido (para revisión de Iván):**

1. **El domingo es una sola respuesta**, aunque haya dos partidos (la web ya lo trata así). Cada entreno es otra.
2. **Si nadie le avisó** (respondió antes de que saliera ningún recordatorio), cuenta como rápido: +2.
3. **Respondió fuera de plazo:** 0 (ni premio ni castigo). **Lo puso un gestor por él:** 0. **Duda que cerró el sistema:** 0.
4. **Avisó con una ausencia** («Días que no estoy»): +1 por cada evento que cubre. No +2, para que una baja larga no sume más que jugar.
5. **«No va» por defecto** (quien no suele entrenar): 0, ni −2. Sale del estado que ya ven los jugadores (`v_quien_va`), no de la tabla privada.
6. **Entreno sin respuesta de los gestores a «¿Faltó alguien ayer?»:** quien dijo «voy», fue (+2).
7. **Plantón en un partido:** solo si estaba convocado, dijo «voy», no sale en la hoja **y un gestor lo confirma**. Si nadie lo confirma, no hay plantón.
8. **Dijo «voy» y faltó con excusa** (pase de lista «con excusa» o «lesionado»): sin los +2 y sin plantón.
   - Lo que ven los jugadores de un plantón es **«no vino»**, sin motivo (el motivo es solo de gestores). **Si un gestor lo corrige** (en «¿Faltó alguien?» o en el pase de lista), la jornada se vuelve a puntuar **al momento**, aunque ya estuviera cerrada: puntos, ingresos y ranking se recalculan sin duplicar nada.
   - **El valor de mercado no se mueve con una corrección** (Iván, 20/11/2026): se queda como estaba hasta que se puntúe la siguiente jornada, para que nadie vea saltar un precio a mitad de semana después de comprar o vender. Lo ya comprado, vendido o robado no se revisa.
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
| 18/10 | 2 | 19 | 6,8 | 32 |
| 25/10 | 2 | 17 | 7,0 | 32 |
| 08/11 | 1 | 9 | 6,7 | 28 |
| 15/11 | 1 | 10 | 6,5 | 26 |

- **Rendimiento** de quien juega: media 7,1; mediana 5; máximo 29.
- **Compromiso** por jornada: media 2,0; de −4 a 6 (el tope semanal).
- **Valor de mercado** tras la J5: medio 7,5 M; mediano 5,0 M; máximo 29,0 M; 9 de 24 en el mínimo de 4 M.

**Límites de la simulación (hay que saberlos al leerla):**

- **Respuestas:** la web las guarda desde el 26/10. En la J1 y la J2 no hay ninguna (se respondía en SportEasy y no se
  importaron), así que **el compromiso de esas jornadas no cuenta respuestas** (un evento al que no respondió nadie no
  suma ni resta: regla del código, no solo de la simulación); en la J3, solo las de los eventos que sí las tienen.
- **Asistencia real:** nadie ha respondido todavía a «¿Faltó alguien ayer?» (no existía). Hasta el 23/10 se usa la
  asistencia de SportEasy; desde entonces, quien dijo «voy» cuenta como que fue. **No hay ningún plantón simulado.**
- **Hora de la respuesta:** el último cambio, no la primera respuesta (ver regla 9).

### Peso del compromiso (recalibrado el 20/11/2026)

Con los primeros pesos (rápido +3, entreno +3, sin tope) el compromiso suponía el 77 % de los puntos del 08/11 y el 61 % de
los del 15/11: catorce jugadores sumaban entre 6 y 9 sin jugar. Iván bajó los pesos (rápido +2, entreno +2) y puso el tope
semanal de 6. Tabla de `npm run fantasy:compromiso` con los pesos nuevos (24 elegibles):

| Jornada | Entrenos | Partidos | Jugaron | Rend. medio (quien jugó) | Comp. medio (todos) | Comp. medio (quien no jugó) | Comp. máx. | No jugaron y suman 6 o más | % del total que es compromiso |
|---|---|---|---|---|---|---|---|---|---|
| 04/10 | 0 | 2 | 15 | 6,9 | 0 | 0 | 0 | 0 | 0 % |
| 18/10 | 2 | 2 | 19 | 7,2 | 0,8 | −1,6 | 4 | 0 | 19 % |
| 25/10 | 1 | 2 | 17 | 7,7 | 1,2 | −0,3 | 3 | 0 | 23 % |
| 08/11 | 2 | 1 | 9 | 5,8 | 4,5 | 4,1 | 6 | 5 | 68 % |
| 15/11 | 1 | 1 | 10 | 7,4 | 3,4 | 2,9 | 6 | 0 | 53 % |

El compromiso sigue pesando más de la mitad el 08/11 y el 15/11 **porque esos domingos solo jugó un equipo** (9 y 10
jugadores con minutos de 24): los otros catorce solo pueden sumar compromiso. Quien juega hace 11 de media; quien no, 3 o 4.

### Hojas incompletas y partidos aplazados

- **La jornada es el domingo.** Se puntúa cuando están las hojas de **todos** nuestros partidos de ese domingo; mientras tanto, Jornada dice «Pendiente: falta la hoja de MdA» (o «faltan las hojas de MdA y MdL»).
- **Un partido aplazado cuenta para la jornada del domingo en que se juega.** Si por eso un jugador juega dos partidos ese día (aunque sean del mismo equipo), se aplica la regla de doblar: media de los dos más el extra. Cada hoja se puntúa con el marcador de su partido.
- **Porra con dos partidos del mismo equipo:** vale el de la jornada de ese día (el de número de jornada más alto), no el aplazado.

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
| 12 | 5 | 12 de 12 | 50,5 |
| 18 | 7 | 18 de 18 | 51,5 |
| 25 | 9 | 25 de 25 | 53,7 |

**Un mánager medio hace unos 52 puntos por jornada.**

**Objetivo del encargo:** que un mánager medio pueda permitirse el clausulazo de un jugador medio cada tres jornadas, y
el del más caro solo vendiendo.

- Clausulazo de un jugador medio: 7,5 × 1,5 = **11,2 M**. Hace falta ingresar unos **3,7 M por jornada**.
- **Ingreso elegido: 1,5 M fijos + 0,04 M por punto.** Con 52 puntos, 3,6 M; tres jornadas, 10,8 M (el clausulazo medio, en 3,1 jornadas).
  El fijo es algo menos de la mitad para que jugar bien se note sin hundir a quien va último (con 20 puntos ingresa 2,3 M).
- **Caja inicial elegida: 11 M**, un clausulazo medio. Permite uno desde el principio y, si se gasta, vuelve en tres jornadas.
- Clausulazo del más caro: 29,0 × 1,5 = **43,5 M**. Sin vender ni gastar nada, un mánager medio tarda **10 jornadas** en
  reunirlo; vendiendo, lo tiene mucho antes. Es decir: en la práctica, solo vendiendo.

| Parámetro | Valor | Por qué |
|---|---|---|
| `cajaInicial` | 11 M | un clausulazo de un jugador medio |
| `ingresoFijo` | 1,5 M | ~40 % del ingreso de una jornada media |
| `ingresoPorPunto` | 0,04 M | con 52 puntos, 2,1 M |
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
