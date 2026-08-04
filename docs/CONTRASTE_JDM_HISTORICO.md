# Contraste entre el portal de datos abiertos y el histórico propio

> Diagnóstico del 04/08/2026 · rama `feat/rivales-jdm`.
> **[AMPLIADO el mismo día]** La hipótesis sobre MdL/MdA quedó **verificada con evidencia
> interna de los Excel**: ver `docs/DIAGNOSTICO_MDL_MDA.md`. Allí también se corrige la
> conclusión de que `#149233` (2020/21) "no era del club": sí lo era.
> **Sólo investigación: no se ha modificado ningún dato**, ni de `rivales_jdm.json` ni de
> `season_*.json`. Lo que aquí se propone queda para un bloque futuro y decisión de Iván.

Se cruzaron partido a partido `data/rivales_jdm.json` (portal del Ayuntamiento) y los
`data/season_*.json` (histórico propio, de los Excel del club), emparejando **por marcador**
porque el nombre del rival se escribe distinto en cada fuente.

## Resumen: con qué ficha del portal casa el histórico propio

| Temporada | Partidos propios | Coincide con MdL | Coincide con MdA | Lectura |
|---|---|---|---|---|
| 2014-15 | 20 | **17/18 (94%)** | — | MdL ✓ (el MdA no existía) |
| 2015-16 | 20 | **18/18 (100%)** | — | MdL ✓ |
| 2017-18 | 21 | 0/21 (0%) | **21/21 (100%)** | ⚠ **casa con el MdA** |
| 2018-19 | 16 | 0/21 (0%) | **16/19 (84%)** | ⚠ **casa con el MdA** |
| 2020-21 | 13 | 0/13 (0%) | **13/13 (100%)** | ⚠ **casa con el MdA** |
| 2021-22 | 18 | **18/18 (100%)** | 0/18 | MdL ✓ |
| 2023-24 | 20 | **20/20 (100%)** | 0/20 | MdL ✓ |
| 2024-25 | 20 | **20/20 (100%)** | 0/20 | MdL ✓ |

## Hallazgo principal: tres temporadas podrían estar etiquetadas al revés

**DATO.** En **2017/18, 2018/19 y 2020/21**, los partidos del histórico propio coinciden al
100 %, 84 % y 100 % con lo que el portal atribuye a la ficha **"MACCABI DE ACOSTAR"**, y **al
0 %** con la ficha "MACCABI DE LEVANTAR". El caso de 2017/18 es literal, jornada a jornada:

| J | Histórico propio | Portal MdA (#122271) | Portal MdL (#122256) |
|---|---|---|---|
| 1 | VANNER 40-53 | VANNER PONENOS 40-53 | CARPASION SUIZA 48-28 |
| 2 | LAS NIEVES 38-24 | LAS NIEVES 38-24 | EL PENDULO 57-51 |
| 3 | BEL AIR 53-50 | BEL AIR BALLERS 53-50 | DVK JUVENTUD 50-34 |
| 4 | MORATALAZ 52-37 | MORATALAZ REBELS 52-37 | LOS SUECOS 32-47 |
| 5 | HIPERDESGUACE 22-71 | HIPER DESGUACE VIC. 22-71 | CAFE HERMANOS VELASCO 49-30 |

**DATO.** La asignación de códigos del pipeline no está en duda: `#122271` se llama
"MACCABI DE ACOSTAR" en el CSV **y** viene del Nº EQUIPO de
`Hoja De inscripción Maccabi de Acostar (1).pdf`; `#122256` se llama "MACCABI DE LEVANTAR"
**y** viene de `Ficha_Equipo_MDL.pdf`. Las dos fuentes coinciden entre sí.

**HIPÓTESIS.** Los Excel `Estadisticas_2017_2018.xls`, `Estadisticas_2018_2019.xls` y
`Estadisticas_2020_2021.xls` recogen los partidos de la ficha que el Ayuntamiento inscribió
como *Maccabi de Acostar*. Dos explicaciones posibles, y no se puede elegir entre ellas sin
Iván:

1. **El club usa su propia convención**: llama "MdL" (el equipo de siempre, el que lleva las
   estadísticas) al grupo de gente que esos años se inscribió administrativamente bajo la
   ficha del MdA. La etiqueta del ayuntamiento y la del club no tendrían por qué coincidir.
2. **Los ficheros están etiquetados al revés** para esos tres años. Es coherente con que sólo
   los de 23/24 y 24/25 lleven sufijo `_MDL` / `_MDA` en el nombre; los anteriores no lo llevan
   y se asumieron MdL.

**Alcance.** Esto **no afecta a `rivales_jdm.json`**, que se construyó con los códigos de
ficha y es coherente con el portal. Afecta a cómo se interpreta el campo `equipo: "MDL"` de
`season_2017-18.json`, `season_2018-19.json` y `season_2020-21.json`, y a la atribución
MdL/MdA de esas tres temporadas en el dashboard.

**Propuesta para un bloque futuro (no ahora):** que Iván confirme cuál de las dos
explicaciones es la buena. Si fuese la 2, habría que revisar la etiqueta de equipo de esas
tres temporadas; el rendimiento de los jugadores no cambiaría, sólo bajo qué ficha se cuenta.

## Los tres descuadres de recuento

### 2014-15 · portal 18, histórico 20

**17 partidos emparejan.** Las diferencias:

- **Sólo en el histórico propio (3), todos de fase MARCA:** SPORTING 34-59, FONTARRON 58-53
  y CB MADRID 51-61.
- **Sólo en el portal (1):** `@ RAIDERS 2-0` del 01/02/2015, en fase de liga.

**Lectura.** El marcador 2-0 es el que la federación usa para una **incomparecencia**: es un
partido administrativo que el club no anotó porque no se jugó. Y los 3 de MARCA son el torneo
de final de temporada, que **el portal no publicó ese año**. Las cuentas cierran:
20 − 3 = 17 y 18 − 1 = 17. **Ninguna de las dos fuentes tiene un error**; recogen cosas
distintas.

### 2015-16 · portal 18, histórico 20

**18 partidos emparejan**, todos los del portal.

- **Sólo en el histórico propio (2), ambos de fase MARCA:** VANNER 25-53 y GUARRIORS 53-56.
- **Sólo en el portal:** ninguno.

**Lectura.** El mismo caso que 2014-15: el portal no publica la fase MARCA. 20 − 2 = 18.
**Cuadra exactamente.**

### 2018-19 · portal 21, histórico 16

**0 partidos emparejan** con el MdL del portal. No es un descuadre de recuento sino el
hallazgo de arriba: el histórico propio de ese año casa con el **MdA** (16 de 19).

Contra la ficha correcta, el desglose es:

- El MdA del portal tiene 19 partidos: 16 de liga y 3 de torneo.
- El histórico propio tiene 16, todos de liga.
- **Los 3 que el portal añade son de torneo** (mayo-junio de 2019), que el histórico propio
  no recoge — igual que pasa en 2014-15 y 2015-16 pero al revés: aquí es el portal el que
  tiene el torneo y el club el que no lo anotó.

## Conclusión

- **Ningún error en `rivales_jdm.json`.** Los tres descuadres se explican por qué recoge cada
  fuente: el portal no publica la fase MARCA de 2014-15 y 2015-16; el club no anotó el torneo
  de 2018-19; y el portal incluye una incomparecencia administrativa (2-0) que el club no
  registró como partido.
- **Un hallazgo pendiente de decisión**: la etiqueta MdL/MdA de tres temporadas del histórico
  propio. No se ha tocado nada.
