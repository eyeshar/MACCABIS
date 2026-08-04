# Rivales del club según los datos abiertos del Ayuntamiento de Madrid

_Generado por `scripts/build_rivales_jdm.js` el 04/08/2026 · fuente `data/rivales_jdm.json`._

> **Fuente:** Ayuntamiento de Madrid, dataset **300257** "Deportes colectivos — histórico"
> (datos.madrid.es). Licencia **CC BY 4.0**: republicable citando al Ayuntamiento de Madrid.
>
> **Fuente independiente**: no se ha cruzado con `season_*.json`, `personas.json` ni la matriz.
> El histórico propio sólo se ha leído para validar qué código de equipo nos corresponde.

## Temporadas NO cubiertas

| Temporada | Motivo |
|---|---|
| 2013-14 | No existe en el portal de datos abiertos. |
| 2019-20 | No existe en el portal de datos abiertos. |
| 2025-26 | Está en el dataset 211549 (temporada en curso), no en el histórico 300257. |

## Cómo se identifica al club

El nombre de equipo **no sirve de filtro**: en 2014/15 hay un club **rival** llamado `MACCABI`,
la grafía cambia cada año (`MACCABI DE LEVANTAR`, `MACABI`, `MdL`, `MACCABI D'ELEVANTAR`…) y hay
homónimos en otros deportes. El identificador estable es el **Nº EQUIPO de la hoja de inscripción**,
que resultó ser el `Codigo_equipo` del dataset.

| Vía | Qué significa |
|---|---|
| `ficha` | El código sale del Nº EQUIPO de una hoja de `docs/Fichas`. Criterio primario. |
| `respaldo` | Sin ficha: candidato por nombre en Moratalaz, **validado por marcador** contra el histórico propio. |
| `nombre_en_distrito` | MdA sin ficha: el histórico propio no trae partido a partido del MdA, así que no se puede validar por marcador. Aceptado por nombre inequívoco dentro de Moratalaz. |
| `respaldo_sin_validar` | Sin ficha y **sin** histórico propio de esa temporada. Aceptado sólo por nombre. |

## Partidos por temporada y equipo

| Temporada | Equipo | Partidos | Fases | Vía | Código(s) | Histórico propio |
|---|---|---|---|---|---|---|
| 2014-15 | MdL | 18 | liga: 18 | `respaldo` | 93897 | 20 partidos |
| 2015-16 | MdL | 18 | liga: 18 | `respaldo` | 103476 | 20 partidos |
| 2016-17 | MdL | 24 | liga: 18, torneo: 6 | `ficha` | 112825,119823,120202 | — |
| 2017-18 | MdL | 21 | liga: 18, torneo: 3 | `ficha` | 122256,129335 | 21 partidos |
| 2017-18 | MdA | 21 | liga: 18, torneo: 3 | `ficha` | 122271,129337 | — |
| 2018-19 | MdL | 21 | liga: 17, torneo: 4 | `ficha` | 132002,138926 | 16 partidos |
| 2018-19 | MdA | 19 | liga: 16, torneo: 3 | `ficha` | 132001,138927 | — |
| 2020-21 | MdL | 13 | liga: 13 | `ficha` | 149302 | 13 partidos |
| 2020-21 | MdA | 13 | liga: 13 | `ficha` | 149303 | — |
| 2021-22 | MdL | 18 | liga: 18 | `respaldo` | 72599 | 18 partidos |
| 2021-22 | MdA | 18 | liga: 18 | `nombre_en_distrito` | 72598 | — |
| 2022-23 | MdL | 22 | liga: 22 | `respaldo_sin_validar` | 82423 | — |
| 2022-23 | MdA | 22 | liga: 22 | `nombre_en_distrito` | 82436 | — |
| 2023-24 | MdL | 20 | liga: 20 | `respaldo` | 102961 | 20 partidos |
| 2023-24 | MdA | 20 | liga: 20 | `nombre_en_distrito` | 109217 | — |
| 2024-25 | MdL | 20 | liga: 20 | `respaldo` | 158865 | 20 partidos |
| 2024-25 | MdA | 20 | liga: 20 | `nombre_en_distrito` | 158857 | — |

**Total: 328 partidos** · 17 combinaciones temporada-equipo · 111 rivales distintos.

## Rivales únicos

Nombres **tal cual vienen en la fuente**, sin corregir ni fusionar.

| Rival | Enfrentamientos | Temporadas |
|---|---|---|
| LOS KHINKIS RUSOS | 20 | 2015-16, 2017-18, 2018-19, 2020-21, 2021-22, 2022-23, 2023-24, 2024-25 |
| HIPER DESGUACE VICALVARO | 14 | 2016-17, 2017-18, 2018-19, 2020-21, 2021-22, 2023-24 |
| Mistery Men | 12 | 2021-22, 2022-23, 2023-24, 2024-25 |
| GUINDILLAS | 10 | 2018-19, 2021-22, 2023-24, 2024-25 |
| DVK JUVENTUD | 8 | 2015-16, 2017-18, 2018-19, 2020-21 |
| FONTARRON | 8 | 2014-15, 2015-16, 2016-17, 2017-18, 2018-19 |
| LOS SUECOS | 7 | 2015-16, 2017-18, 2018-19 |
| WILD BOYS | 7 | 2018-19, 2022-23, 2024-25 |
| BEL AIR BALLERS | 6 | 2015-16, 2016-17, 2017-18, 2023-24 |
| CAFE HERMANOS VELASCO SETTAS | 6 | 2017-18, 2018-19, 2020-21 |
| IN EXTREMIS | 6 | 2021-22, 2023-24 |
| SPARTE�OS SUPERA BASKET | 6 | 2016-17, 2017-18, 2018-19 |
| SUIZA | 6 | 2015-16, 2022-23 |
| SUPERLOOSERS | 5 | 2016-17, 2018-19, 2020-21 |
| VANNER PONENOS | 5 | 2015-16, 2016-17, 2017-18, 2018-19 |
| AQUASOL | 4 | 2014-15, 2016-17, 2017-18 |
| Bodydroga CB | 4 | 2023-24, 2024-25 |
| Dados | 4 | 2023-24, 2024-25 |
| GSD Vallecas | 4 | 2021-22 |
| La Cancha Roja | 4 | 2023-24, 2024-25 |
| LAS NIEVES | 4 | 2014-15, 2017-18 |
| LOS PANAS | 4 | 2021-22 |
| LOS URSULINOS | 4 | 2015-16, 2016-17, 2017-18 |
| MISTERY MEN | 4 | 2016-17, 2017-18, 2018-19 |
| ONDEQUEIRAS | 4 | 2021-22 |
| SAINZ DE VICU�A D | 4 | 2022-23 |
| SAN CRISTOBAL | 4 | 2022-23 |
| SETTAS | 4 | 2014-15, 2016-17 |
| SPORTING DE VALLECAS | 4 | 2017-18, 2020-21 |
| SPV | 4 | 2022-23 |
| SuperLoosers | 4 | 2022-23 |
| UNI�N PENOSA | 4 | 2022-23 |
| VANNER | 4 | 2022-23 |
| CARPASION | 3 | 2020-21 |
| CD CEBE | 3 | 2018-19 |
| EL PENDULO | 3 | 2017-18, 2018-19 |
| LOS GUARRIORS | 3 | 2017-18, 2018-19 |
| MACCABI DE LEVANTAR | 3 | 2020-21 |
| MDA | 3 | 2020-21, 2021-22 |
| MDL | 3 | 2020-21, 2021-22 |
| SPORTING DE VALLEKAS | 3 | 2014-15, 2018-19 |
| , MARAVILLAS | 2 | 2016-17 |
| 28500 | 2 | 2023-24 |
| 2KNUTOS | 2 | 2024-25 |
| ALARIA BASKET | 2 | 2018-19 |
| Astro Ballers | 2 | 2024-25 |
| CAFÉ HNOS. VELASCO SETTAS | 2 | 2023-24 |
| CAFÉ HONS. VELASCO SETTAS | 2 | 2024-25 |
| CAPUCHINOS LAST DANCE | 2 | 2023-24 |
| CARPASION SUIZA | 2 | 2017-18 |
| CASTAÑAZO | 2 | 2023-24 |
| CBZA | 2 | 2024-25 |
| CDCEBE | 2 | 2016-17, 2017-18 |
| Chavalitros | 2 | 2023-24 |
| CHOLFOS | 2 | 2023-24 |
| CHUPITIMANGUIS | 2 | 2024-25 |
| COCOON, C.B. | 2 | 2017-18, 2018-19 |
| DESCANSO | 2 | 2017-18 |
| DVK Juventud | 2 | 2023-24 |
| EAU DE PACHULIA | 2 | 2023-24 |
| Fakin Panzas | 2 | 2023-24 |
| Fontarrón | 2 | 2023-24 |
| LITROS DE MAHOU | 2 | 2024-25 |
| Los Diferentes | 2 | 2024-25 |
| LOS OTROS | 2 | 2014-15 |
| LOSMASKBRONES | 2 | 2023-24 |
| MdA | 2 | 2022-23 |
| MdL | 2 | 2022-23 |
| MORATALAZ REBELS | 2 | 2017-18, 2018-19 |
| NABUCO | 2 | 2024-25 |
| PelotaNaranja | 2 | 2024-25 |
| Playground | 2 | 2024-25 |
| PORNLAND TRAIL BRAZZERS | 2 | 2017-18 |
| Project Team | 2 | 2024-25 |
| PROYECTO DARWIN | 2 | 2024-25 |
| RIVAS 69 ERS | 2 | 2018-19 |
| SAINZ DE VICUÑA | 2 | 2024-25 |
| AMAZONIA | 1 | 2016-17 |
| C.B. PERALES | 1 | 2016-17 |
| C.B. PERALES BLANCO | 1 | 2015-16 |
| CELTICS CORTOS | 1 | 2018-19 |
| CHIQUI Y DESGUACES | 1 | 2018-19 |
| GENERACION ARMAGEDON | 1 | 2014-15 |
| GUARRIORS | 1 | 2014-15 |
| HIPERDESGUACE VICALVARO | 1 | 2015-16 |
| INMSERSHORE | 1 | 2016-17 |
| KARL MALONE DE LA PENINSULA | 1 | 2017-18 |
| LOS CALIENTES | 1 | 2017-18 |
| LOS KINKIS RUSOS | 1 | 2014-15 |
| MACABBI DE LEVANTAR | 1 | 2015-16 |
| MACCABI | 1 | 2014-15 |
| MO ES MO | 1 | 2018-19 |
| NI�OS & CIA | 1 | 2015-16 |
| NO SE PRESENTAN | 1 | 2015-16 |
| NOSOTROS | 1 | 2014-15 |
| NYDIKS | 1 | 2015-16 |
| PERALES BLANCO | 1 | 2014-15 |
| RAIDERS | 1 | 2014-15 |
| RUFIANES INFAMES | 1 | 2016-17 |
| SAINZ DE VICU�A B | 1 | 2016-17 |
| SPORTING VALLECAS | 1 | 2015-16 |
| STEAVA DEL GRIFO | 1 | 2016-17 |
| SUIZA B.C | 1 | 2018-19 |
| SUPERLLOSERS | 1 | 2018-19 |
| TANINOS C.B | 1 | 2016-17 |
| THE RED BOYS | 1 | 2018-19 |
| TITANES | 1 | 2014-15 |
| UNICORNIOS DE NOTREDAME | 1 | 2017-18 |
| URSULINOS | 1 | 2014-15 |
| VANITEAM | 1 | 2017-18 |
| VBA | 1 | 2016-17 |

## Anomalías para que Iván decida

### Nombres de rival que podrían ser el mismo equipo

**No se han fusionado.** Sólo se señalan.

| Nombre A | Nombre B | Motivo |
|---|---|---|
| SETTAS | CAFE HERMANOS VELASCO SETTAS | uno contiene al otro |
| SETTAS | CAFÉ HNOS. VELASCO SETTAS | uno contiene al otro |
| SETTAS | CAFÉ HONS. VELASCO SETTAS | uno contiene al otro |
| FONTARRON | Fontarrón | idéntico al normalizar |
| GUARRIORS | LOS GUARRIORS | uno contiene al otro |
| URSULINOS | LOS URSULINOS | uno contiene al otro |
| PERALES BLANCO | C.B. PERALES BLANCO | uno contiene al otro |
| MACCABI | MACCABI DE LEVANTAR | uno contiene al otro |
| DVK JUVENTUD | DVK Juventud | idéntico al normalizar |
| HIPERDESGUACE VICALVARO | HIPER DESGUACE VICALVARO | idéntico al normalizar |
| SUIZA | CARPASION SUIZA | uno contiene al otro |
| SUIZA | SUIZA B.C | uno contiene al otro |
| C.B. PERALES BLANCO | C.B. PERALES | uno contiene al otro |
| VANNER PONENOS | VANNER | uno contiene al otro |
| CDCEBE | CD CEBE | idéntico al normalizar |
| SUPERLOOSERS | SuperLoosers | idéntico al normalizar |
| MISTERY MEN | Mistery Men | idéntico al normalizar |
| CARPASION SUIZA | CARPASION | uno contiene al otro |
| MDL | MdL | idéntico al normalizar |
| MDA | MdA | idéntico al normalizar |

### Recuentos que no cuadran con el histórico propio

Sólo comparable en MdL (el histórico propio no trae partido a partido del MdA).

| Temporada | JDM | Histórico propio | Diferencia |
|---|---|---|---|
| 2014-15 | 18 | 20 | -2 |
| 2015-16 | 18 | 20 | -2 |
| 2018-19 | 21 | 16 | +5 |

### Códigos sin ficha de inscripción

Temporadas cuyo código se dedujo sin Nº EQUIPO de ficha:

- **2014-15 MdL** (#93897) — vía `respaldo`.
- **2015-16 MdL** (#103476) — vía `respaldo`.
- **2021-22 MdL** (#72599) — vía `respaldo`.
- **2021-22 MdA** (#72598) — vía `nombre_en_distrito`.
- **2022-23 MdL** (#82423) — vía `respaldo_sin_validar`.
- **2022-23 MdA** (#82436) — vía `nombre_en_distrito`.
- **2023-24 MdL** (#102961) — vía `respaldo`.
- **2023-24 MdA** (#109217) — vía `nombre_en_distrito`.
- **2024-25 MdL** (#158865) — vía `respaldo`.
- **2024-25 MdA** (#158857) — vía `nombre_en_distrito`.

## Campos de cada partido

```json
{
 "temporada": "2016-17",
 "equipo": "MdL",
 "codigo_equipo": "119823",
 "identificado_por": "ficha",
 "fase": "torneo",
 "competicion": "TORNEOS MUNICIPALES",
 "nombre_fase": "TMPAL GRUPO",
 "grupo": "BC SEN MASC DM GR1",
 "jornada": "1",
 "fecha": "2017-04-23",
 "hora": "12:45",
 "local": false,
 "rival": "SAINZ DE VICU�A B",
 "codigo_rival": "121018",
 "pf": 17,
 "pc": 54,
 "sede": "CDM VALDEB:PAB:BC:2",
 "distrito": "VICALVARO"
}
```

- `fase`: `liga`, `torneo` o `fase_final`. Los de torneo **suman** a la temporada (D19) pero van etiquetados.
- `sede` y `distrito` vienen vacíos en las temporadas antiguas: el CSV no los traía.
- `rival` es el nombre literal de la fuente.
