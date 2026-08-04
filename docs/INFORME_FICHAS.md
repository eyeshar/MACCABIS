# Informe de las hojas de inscripción oficiales

_Cruce de `docs/Fichas` contra la matriz de historia, 04/08/2026._

> Los PDF originales **no están versionados** (`.gitignore`): contienen DNI, fecha de nacimiento,
> teléfono y email. De ellos sólo se ha extraído año, equipo y nombre, en `data/fichas_inscripcion.json`.

## Ficha usada por año y equipo

Cuando hay varias hojas del mismo año y equipo vale siempre **la que más jugadores tiene** (regla de Iván).

| Temporada | Equipo | Jugadores | Fichero usado | Lectura | Descartadas por tener menos |
|---|---|---|---|---|---|
| 2013/14 | MdL | 14 | `Ficha_equipo_sellada_13-14.pdf` | **visión** (escaneo sin texto) | — |
| 2014/15 | MdL | 16 | `Ficha_equipo (1).pdf` | **visión** (escaneo sin texto) | — |
| 2015/16 | MdL | 17 | `Ficha_equipo (2).pdf` | texto | Hoja_2015-2016 (1).pdf (15) |
| 2017/18 | MdA | 20 | `Ficha_Equipo_MDA.pdf` | **visión** (escaneo sin texto) | Hoja De inscripción Maccabi de Acostar (1).pdf (15) |
| 2017/18 | MdL | 18 | `Ficha_Equipo_MDL.pdf` | **visión** (escaneo sin texto) | — |
| 2018/19 | MdA | 19 | `Ficha_Equipo_MDA (1).pdf` | texto | Hoja MdA.pdf (16)<br>Inscripción MdA 2.pdf (14)<br>Inscripción MdA 3 (1).pdf (18) |
| 2018/19 | MdL | 18 | `Ficha_Equipo_MDL (1).pdf` | texto | Hoja MdL.pdf (17)<br>Inscripción MdL (2).pdf (13) |
| 2019/20 | MdA | 13 | `Ficha_Equipo_MDA (2).pdf` | texto | Hoja MdA (1).pdf (10) |
| 2019/20 | MdL | 15 | `Ficha_Equipo_MDL (2).pdf` | texto | Hoja MdL (1).pdf (9) |
| 2020/21 | MdA | 14 | `Ficha_MDA.pdf` | texto | — |
| 2020/21 | MdL | 16 | `Ficha_MDL.pdf` | texto | — |
| 2021/22 | MdA | 14 | `Hoja_MDA.pdf` | texto | — |
| 2021/22 | MdL | 17 | `Hoja_MDL.pdf` | texto | — |
| 2022/23 | MdA | 15 | `Ficha_MdA_Jon.pdf` | texto | — |
| 2022/23 | MdL | 17 | `MdL_NACHO.pdf` | texto | — |
| 2023/24 | MdA | 16 | `MdA con doblajes (1).pdf` | texto | — |
| 2023/24 | MdL | 15 | `Ficha MDL 2023 Completa.pdf` | texto | — |
| 2024/25 | MdA | 19 | `MdA con Alex.pdf` | texto | — |
| 2024/25 | MdL | 10 | `MdL 2025.pdf` | texto | — |
| 2025/26 | MdA | 22 | `MdA con Lukas (1).pdf` | texto | — |
| 2025/26 | MdL | 21 | `MdL con todos.pdf` | texto | — |

## Hojas NO aplicadas: año ambiguo

Las hojas de "Torneos Municipales" llevan el año del torneo, que **no identifica la temporada sin ambigüedad**
(un torneo de primavera puede pertenecer a la temporada que termina o a la que empieza). No se han aplicado a
ningún año; quedan registradas para que Iván decida.

| Torneo | Equipo | Personas | Fichero |
|---|---|---|---|
| 2014 | MdL | 14 | `Ficha de equipo liga marca.pdf` |
| 2017 | MdL | 20 | `Hoja de inscripción Marca Valdebernardo (1).pdf` |
| 2018 | MdL | 17 | `MDL.pdf` |
| 2019 | MdA | 15 | `Inscripción MdA.pdf` |
| 2019 | MdL | 18 | `Inscripción MdL (1).pdf` |

## Personas en ficha SIN identificar

Aparecen en una hoja oficial pero no casan con ninguna persona del registro. **No se ha inventado ninguna identidad**:
no se han añadido a la matriz. Requieren decisión humana.

| Nombre en la ficha | Dónde aparece |
|---|---|
| Alvarez Marquez, Ivan | 2018 MdL, torneo 2019 MdL |
| García Jiménez, Hugo | 2014 MdL |
| Hernandez Gomez, Alejandro | torneo 2018 MdL |
| Hernández Gómez, Alejandro | 2017 MdA, 2017 MdL |
| Puertas Domingo, Carlos | 2019 MdA |
| RANZ CASADO, JORGE | 2022 MdL |

## Correspondencias dudosas (NO aplicadas)

El nombre de la ficha se parece a alguien del registro pero **difiere en un apellido**. No se han aplicado:
basta con confirmar o desmentir cada una para incorporarlas.

| Nombre en la ficha | Se parece a | Dónde |
|---|---|---|
| ABEL ESPINOSA, FERNANDO | `espinola-fernando-abel` | 2021 MdA |
| CASTRO MOYA, HENRY | `castro-mayo-henry-luis` | 2021 MdA, 2022 MdA, 2023 MdA |
| Hennessey Klein, Patrick | `klein-patrick-hennesey` | 2017 MdA, 2017 MdL, 2018 MdA, torneo 2018 MdL |
| Martin Calvo, Borja | `mar-calvo-borja` | 2018 MdA, torneo 2017 MdL |
| Martín Calvo, Borja | `mar-calvo-borja` | 2017 MdA |

## Cobertura

- **21 hojas aplicadas**, de 12 temporadas distintas.
- **Sin hoja disponible:** 2016/17 (no hay ninguna) y el MdA de 2013/14, 2014/15 y 2015/16 (el MdA se creó después).
- **4 hojas eran escaneos sin capa de texto** y se transcribieron leyendo la imagen: 2013/14 MdL, 2014/15 MdL y las dos de 2017/18.
- **Ninguna hoja quedó sin procesar.** Un PDF traía el texto mal codificado ("RodrÃ-guez"); se repara antes de parsear.
