# Diagnóstico: qué equipo contiene realmente cada Excel de estadísticas

> **[CORREGIDO 25/09/2026]** La conclusión de este documento de que `#149233` "MACCABI DE LEVANTAR"
> (2020/21) era **un tercer equipo del club era errónea**. Lo que resolvió el caso es la **regla del
> nombre del club**, confirmada por Iván el 25/09/2026 (DECISIONS D26): *el club compitió como MACCABI
> DE LEVANTAR hasta que otro grupo se quedó con ese nombre; en cuanto aparece MDL en una temporada, el
> MACCABI DE LEVANTAR de esa temporada NO es el club.* En 2020/21 ya existe `MDL` (#149302), así que
> **#149233 es un RIVAL**, y **la conclusión original del bloque de rivales era la correcta**
> ("#149233 no es del club"). Que la clasificación interna del Excel lo listara junto a MDL y MDA sólo
> significa que jugaba en el mismo grupo.
>
> **Sigue siendo válido** el resto del diagnóstico: los Excel de 2017/18, 2018/19 y 2020/21 contienen
> al MdA. Los partidos del MdA contra `MACCABI DE LEVANTAR` en 2020/21 siguen siendo prueba de que
> ese Excel no es el MdL; simplemente eran partidos contra un rival. El texto antiguo se conserva
> abajo, con las partes superadas marcadas.

> Investigación del 04/08/2026 · rama `feat/rivales-jdm`.
> **No se ha modificado ningún dato.** Ni `season_*.json`, ni `rivales_jdm.json`, ni la matriz.
> La corrección, si Iván la aprueba, va en un bloque aparte con staging.

## Método

Iván encontró a mano el caso de 2017/18: el Excel etiquetado MdL contiene en realidad al
equipo que compitió como **Maccabi de Acostar**. Se ha aplicado el mismo método a las demás
temporadas, usando **evidencia interna del propio Excel**, no sólo el porcentaje de marcadores:

1. **La hoja `Clasificaciones`** de cada fichero dice en qué grupo juega cada equipo del club.
2. **La hoja `Resultados`** dice contra quién anotó los partidos.
3. Si los rivales anotados son los del grupo X, el Excel es el equipo que juega en el grupo X.
4. **Prueba decisiva:** si el Excel anota un partido **contra** un equipo del propio club, no
   puede ser ese equipo. Nadie juega contra sí mismo.

## Resultado por temporada

| Temporada | El Excel contiene… | Prueba | ¿Faltan estadísticas de…? |
|---|---|---|---|
| 2014/15 | **MdL** | Anota un partido contra `MACCABI` (club **rival**, no del club). Sin otro equipo del club en liza. | — |
| 2015/16 | **MdL** | La clasificación interna no lista ningún otro equipo del club. | — |
| **2017/18** | **MdA** ⚠ | La clasificación interna pone a `MACCABI DE ACOSTAR` en el **grupo 3** y los rivales anotados son los del grupo 3. | **MdL** (grupo 4 y 2ª fase A): sólo clasificación |
| **2018/19** | **MdA** ⚠ | `MACCABI DE ACOSTAR` está en el **grupo 4**; los 8 rivales de 1ª fase del Excel son exactamente los otros 8 del grupo 4. | **MdL** (grupo 3 y 2ª fase A): sólo clasificación |
| **2020/21** | **MdA** ⚠ | El Excel anota partidos **contra `MDL` y contra `MACCABI DE LEVANTAR`**. | **MDL**: sólo clasificación. ~~y el tercer equipo `MACCABI DE LEVANTAR`~~ **[SUPERADO: es un rival, D26]** |
| 2021/22 | **MdL** | El Excel anota un partido **contra `MDA`**, y el balance (18 PJ, 12-6) es el de `MDL` en la clasificación interna. | — |

### El detalle de 2018/19

La clasificación interna del propio Excel:

- **Grupo 3:** Mistery Men, Sparteños, **MACCABI DE LEVANTAR**, Los Khinkis Rusos, Alaria,
  Sporting de Vallekas, Superloosers, Celtics Cortos, Moratalaz Rebels.
- **Grupo 4:** Guindillas, DVK Juventud, Hiper Desguace Vicálvaro, Rivas 69ers, CD Cebe,
  **MACCABI DE ACOSTAR**, Café Hermanos Velasco Settas, Wild Boys, Cocoon.

Los 8 rivales que anota el Excel en 1ª fase son **Guindillas, Settas, Wild Boys, Rivas,
Cocoon, CDCebe, Hiperdesguace y DVK**: los otros ocho del **grupo 4**. Ninguno del grupo 3.
El balance también cuadra (3-5, igual que `MACCABI DE ACOSTAR` en la tabla interna).

### El detalle de 2020/21: ~~había TRES equipos del club~~ [SUPERADO 25/09/2026: eran dos; #149233 es un rival, ver D26]

La clasificación interna del grupo único lista a los tres, y el portal les da un código a cada uno:

| En la clasificación del Excel | Código del portal | PJ | Balance |
|---|---|---|---|
| 2º `MDL` | `#149302` | 9 | 8-1 |
| 8º `MACCABI DE LEVANTAR` | `#149233` | 8 | 2-6 |
| 9º `MDA` | `#149303` | 8 | 0-8 |

Y los 13 partidos del Excel coinciden **uno a uno y en orden** con los 13 que el portal
atribuye a `MDA #149303`, incluidos los tres derbis internos: contra `MDL` (27-47) y dos veces
contra `MACCABI DE LEVANTAR` (38-47 y 36-45). **[SUPERADO 25/09/2026: sólo el de `MDL` es un derbi interno; los dos
contra `MACCABI DE LEVANTAR` son partidos contra un rival, D26.]**

> **[SUPERADO 25/09/2026 — esta "corrección" era la errónea; ver la nota al principio y D26.]**
>
> **Corrección de un bloque anterior.** En el bloque de rivales concluí que `#149233` "no es
> del club" porque 0 de sus 13 marcadores coincidían con el histórico propio. Era una
> inferencia incorrecta: lo único que demostraba ese 0 % es que **no es el equipo cuyas
> estadísticas están en el Excel**. La clasificación interna del propio fichero de Iván lo
> lista junto a `MDL` y `MDA` en el mismo grupo, así que **sí era un tercer equipo del club**.
> `data/rivales_jdm.json` no lo incluye: le faltan esos 14 partidos.

## Por qué 2018/19 daba 84 % y no 100 %

No era una anomalía: el Excel tiene **16 partidos** (8 de 1ª fase + 8 de 2ª) y el portal
atribuye **19** al MdA (16 de liga + **3 de torneo**, de mayo-junio de 2019). Los 16 de liga
coinciden; los 3 de torneo no están en el Excel porque el club no los anotó. 16/19 = 84 %.
**El patrón de 17/18 se repite idéntico en 18/19**; lo único que cambia es que en 20/21 hay un
~~tercer equipo~~ **[SUPERADO 25/09/2026: no lo hay; #149233 es un rival, D26]**.

## Qué significa esto

**DATO.** Tres temporadas del histórico (2017/18, 2018/19 y 2020/21) llevan la etiqueta
`equipo: "MDL"` en sus `season_*.json`, pero las estadísticas de jugadores que contienen son
las del equipo que compitió oficialmente como **Maccabi de Acostar**.

**DATO.** De los equipos que compitieron como **Maccabi de Levantar** en esas tres temporadas
**no hay estadísticas de jugadores** en ninguna fuente del club: sólo su clasificación final,
dentro del mismo Excel. Sus **partidos y marcadores sí existen** en `data/rivales_jdm.json`,
extraídos del portal.

**NO SE PROPONE NADA TODAVÍA.** Quedan por decidir dos cosas distintas:

1. Si la etiqueta `MDL`/`MDA` de esas tres temporadas debe corregirse, o si el club usa una
   convención propia en la que "MdL" significa "el equipo del que llevamos estadísticas".
2. Qué hacer con los huecos: tres temporadas de las que existe el resultado de los partidos
   (vía portal) pero no el rendimiento individual.

Nada de esto afecta al rendimiento de ningún jugador: los puntos, tiros y faltas siguen siendo
los mismos. Lo que cambiaría es **bajo qué ficha se cuentan**.
