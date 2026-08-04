# Informe de las hojas de inscripción oficiales

_Actualizado el 04/08/2026 con la regla definitiva de los Torneos Municipales._

> Los PDF originales **no están versionados** (`.gitignore`): contienen DNI, fecha de nacimiento,
> teléfono y email. De ellos sólo se extrae año, equipo y nombre, en `data/fichas_inscripcion.json`.

## Cómo se mapea cada hoja a una temporada

- **`N JUEGOS DEPORTIVOS MUNICIPALES`** → temporada `(N+1979)/(N+1980)`. 34 JDM = 2013/14.
- **`TORNEOS MUNICIPALES AAAA`** → eran copas jugadas **al final** de la temporada, así que
  pertenecen a la temporada que **termina** en AAAA: Torneos 2017 → 2016/17, Torneos 2018 → 2017/18,
  Torneos 2019 → 2018/19. Dejaron de jugarse hacia 2018/19.
- Liga y torneo del mismo periodo son **una sola temporada**: sus plantillas se **suman**.
  La regla de "la hoja con más jugadores manda" se aplica al comparar versiones de la *misma* hoja.

## Plantilla por temporada y equipo

| Temporada | Equipo | Personas | Hojas sumadas |
|---|---|---|---|
| 2013/14 | MdL | 24 | Torneos 2014 — `Ficha de equipo liga marca.pdf` (14)<br>34 JDM — `Ficha_equipo_sellada_13-14.pdf` (14, **visión**) |
| 2014/15 | MdL | 16 | 35 JDM — `Ficha_equipo (1).pdf` (16, **visión**) |
| 2015/16 | MdL | 17 | 36 JDM — `Ficha_equipo (2).pdf` (17) |
| 2016/17 | MdL | 20 | Torneos 2017 — `Hoja de inscripción Marca Valdebernardo (1).pdf` (20) |
| 2017/18 | MdA | 20 | 38 JDM — `Ficha_Equipo_MDA.pdf` (20, **visión**) |
| 2017/18 | MdL | 29 | 38 JDM — `Ficha_Equipo_MDL.pdf` (18, **visión**)<br>Torneos 2018 — `MDL.pdf` (17) |
| 2018/19 | MdA | 19 | 39 JDM — `Ficha_Equipo_MDA (1).pdf` (19)<br>Torneos 2019 — `Inscripción MdA.pdf` (15) |
| 2018/19 | MdL | 18 | 39 JDM — `Ficha_Equipo_MDL (1).pdf` (18)<br>Torneos 2019 — `Inscripción MdL (1).pdf` (18) |
| 2019/20 | MdA | 13 | 40 JDM — `Ficha_Equipo_MDA (2).pdf` (13) |
| 2019/20 | MdL | 15 | 40 JDM — `Ficha_Equipo_MDL (2).pdf` (15) |
| 2020/21 | MdA | 14 | 41 JDM — `Ficha_MDA.pdf` (14) |
| 2020/21 | MdL | 16 | 41 JDM — `Ficha_MDL.pdf` (16) |
| 2021/22 | MdA | 14 | 42 JDM — `Hoja_MDA.pdf` (14) |
| 2021/22 | MdL | 17 | 42 JDM — `Hoja_MDL.pdf` (17) |
| 2022/23 | MdA | 15 | 43 JDM — `Ficha_MdA_Jon.pdf` (15) |
| 2022/23 | MdL | 17 | 43 JDM — `MdL_NACHO.pdf` (17) |
| 2023/24 | MdA | 16 | 44 JDM — `MdA con doblajes (1).pdf` (16) |
| 2023/24 | MdL | 15 | 44 JDM — `Ficha MDL 2023 Completa.pdf` (15) |
| 2024/25 | MdA | 19 | 45 JDM — `MdA con Alex.pdf` (19) |
| 2024/25 | MdL | 10 | 45 JDM — `MdL 2025.pdf` (10) |
| 2025/26 | MdA | 22 | 46 JDM — `MdA con Lukas (1).pdf` (22) |
| 2025/26 | MdL | 21 | 46 JDM — `MdL con todos.pdf` (21) |

## Hojas descartadas

Otra versión de la misma hoja (mismo año, equipo y competición) con menos jugadores.

| Temporada | Equipo | Personas | Fichero |
|---|---|---|---|
| 2015 | MdL | 15 | `Hoja_2015-2016 (1).pdf` |
| 2017 | MdA | 15 | `Hoja De inscripción Maccabi de Acostar (1).pdf` |
| 2018 | MdA | 16 | `Hoja MdA.pdf` |
| 2018 | MdL | 17 | `Hoja MdL.pdf` |
| 2018 | MdA | 14 | `Inscripción MdA 2.pdf` |
| 2018 | MdA | 18 | `Inscripción MdA 3 (1).pdf` |
| 2018 | MdL | 13 | `Inscripción MdL (2).pdf` |
| 2019 | MdA | 10 | `Hoja MdA (1).pdf` |
| 2019 | MdL | 9 | `Hoja MdL (1).pdf` |

## Estado de la lectura

- **22 plantillas** reconstruidas, de 13 temporadas (2013/14 → 2025/26).
- **9 hojas descartadas** por ser versiones más cortas.
- **0 hojas ilegibles.**
- **4 hojas eran escaneos sin capa de texto** y están transcritas leyendo la imagen en `docs/fichas_transcritas.json`: 2013/14 MdL, 2014/15 MdL y las dos de 2017/18. **Conviene repasarlas.**
- Un PDF traía el texto mal codificado ("RodrÃ-guez"); se repara antes de parsear.
- **0 nombres sin identificar.** Todos los de hojas oficiales resuelven ya a una persona del registro.

## Hallazgo: la temporada 2016/17

La hoja de **Torneos 2017** resultó ser la plantilla de **2016/17**, la única temporada del club
sin ninguna hoja propia (tampoco hay estadísticas de ese año). Aporta 20 personas, de las que 5
no tenían registrado 2016: Roberto Ballesteros, Carlos José Barreiro, Julián Carrera, Enrique Moral
y el propio grupo ya conocido. Con ella, la matriz cubre los 13 años de 2013 a 2025 sin huecos.

## Anomalía pendiente

**Adán Herrera Benzán** jugó 3 partidos en 2017/18 pero no consta en ninguna hoja de esa temporada
(sí en las de 2018/19, 2021/22 y 2022/23). O falta su hoja, o se inscribió fuera de plazo.
