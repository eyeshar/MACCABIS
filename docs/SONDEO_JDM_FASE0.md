# Sondeo del portal de datos abiertos de Madrid (JDM) — Fase 0

> **Veredicto: PARADA.** El dataset **sí contiene** los partidos del club y se ha verificado
> con coincidencia exacta, pero **no hay un identificador estable de club** y el nombre es
> errático. Antes de montar la descarga masiva hace falta que Iván fije un criterio de
> desambiguación. Ver "Qué hay que decidir" al final.
>
> _04/08/2026 · rama `feat/rivales-jdm` · sólo investigación, ningún dato generado._

## Fuente

- Dataset **300257 — Deportes colectivos (histórico)**, portal de datos abiertos del
  Ayuntamiento de Madrid. Licencia **CC BY 4.0** (republicable citando la fuente).
- La API CKAN del portal devuelve "en mantenimiento", pero **la descarga directa funciona**:
  `https://datos.madrid.es/egob/catalogo/300257-{n}-deportes-colectivos-historico.csv`
- Los recursos alternan clasificaciones / partidos. **Los de PARTIDOS son n = 3, 7, 11, 15,
  19, 22, 26, 30, 34, 38** — exactamente las 10 temporadas del histórico.

| n | Temporada | n | Temporada |
|---|---|---|---|
| 15 | 2014/2015 | 22 | 2020/2021 |
| 11 | 2015/2016 | 30 | 2021/2022 |
| 7 | 2016/2017 | 26 | 2022/2023 |
| 3 | 2017/2018 | 34 | 2023/2024 |
| 19 | 2018/2019 | 38 | 2024/2025 |

**No cubiertas por esta fuente:** 2013/14 y 2019/20 (no existen en el portal) y 2025/26
(está en el dataset 211549 de temporada en curso, no en el histórico).

## 1. Columnas del CSV

Separador `;`. Cabecera real:

```
Codigo_temporada;Codigo_competicion;Codigo_fase;Codigo_grupo;Jornada;Partido;
Codigo_equipo1;Codigo_equipo2;Resultado1;Resultado2;Codigo_campo;Fecha;Hora;
Programado;Estado;Nombre_temporada;Nombre_competicion;Nombre_fase;Nombre_grupo;
Nombre_deporte;Nombre_categoria;Nombre_jornada;Equipo_local;Equipo_visitante;
Campo;Sexo_grupo;Distrito;Observaciones;SISTEMA_COMPETICION;COORD_X_CAMPO;
COORD_Y_CAMPO;Color_Camiseta_1;Color_Camiseta_2
```

Trae **nombres además de códigos**, así que no hace falta un diccionario externo de equipos.
Fila real de un partido del club (2023/24):

```
Codigo_temporada    : 2023            Nombre_deporte    : BALONCESTO
Codigo_equipo1      : 102546          Nombre_categoria  : SENIOR MASCULINO
Codigo_equipo2      : 102961          Nombre_grupo      : JDM MOR DOM MAÑ BC SEN MAS G2
Resultado1 / 2      : 27 / 35         Equipo_local      : LOS KHINKIS RUSOS
Fecha               : 2024-04-14      Equipo_visitante  : MdL
Hora                : 10:15           Campo             : Baloncesto 2 Moratalaz
Jornada             : 17              Distrito          : MORATALAZ
Nombre_competicion  : 44 JUEGOS DEPORTIVOS MUNICIPALES
```

## 2. Cómo identificar baloncesto y categoría

- `Nombre_deporte = "BALONCESTO"` — estable en las 10 temporadas.
- `Nombre_categoria`: **cambia de valor con los años**. Es `"SENIOR"` hasta 2020/21 y
  `"SENIOR MASCULINO"` desde 2021/22. Filtrar por el literal completo **pierde 6 temporadas**.
- `Distrito = "MORATALAZ"` — funciona en las 10 y es el filtro que más discrimina.
- `Sexo_grupo = "M"` sirve de apoyo donde la categoría no distingue sexo.

## 3. Cómo aparece el club: **el nombre NO es estable**

El club nunca se llama igual dos épocas seguidas. Variantes encontradas en baloncesto:

| Temporada | Cómo aparece |
|---|---|
| 2014/15 | `MACCABI DE LEVANTAR`, `MACCABI D'ELEVANTAR` |
| 2015/16 | `MACCABI DE LEVANTAR` |
| 2016/17 | `MACCABI DE LEVANTAR`, `MACCABI D'ELEVANTAR`, `MDL` |
| 2017/18 | `MACCABI DE LEVANTAR`, `MACCABI DE ACOSTAR`, `MDL` |
| 2018/19 | `MACCABI DE LEVANTAR`, `MACCABI DE ACOSTAR`, `MDL` |
| 2020/21 | `MACCABI DE LEVANTAR`, `MDL`, `MDA` |
| 2021/22 | `MDL`, `MDA`, `MACABI DE LEVANTAR`, `Macabi Dacostar` |
| 2022/23 | `MdL`, `MdA`, `Macabi de Levantar`, `Macabi Dacostar` |
| 2023/24 | `MdL`, `MdA`, `Macabi de Levantar` |
| 2024/25 | `MdL`, `MdA`, `Macabi de Levantar` |

Y en 2014/15 aparece además `MACCABI DE ACORDAR` (errata de "Acostar") y en 2017/18
`MACCABI DE LEVANTAL`. **MdL y MdA sí se distinguen** en todas las temporadas en que el MdA
existe (desde 2017/18).

**Homónimos de otros deportes y distritos** que un filtro por nombre captura y hay que
descartar: `Macabi Circus` (fútbol sala), `Maccabi FC` / `Inter Maccabi` / `Maccabi El Piti`
(fútbol 7), `Maccabi España` (voleibol), `Valeixe Macabi`. Se resuelven filtrando
**deporte + distrito**.

## 4. El problema de fondo: no hay identificador estable de club

`Codigo_equipo` **no identifica al club, sino a cada inscripción**: cambia en cada temporada
y hay varios por temporada (liga, torneo, fase final). Inventario en baloncesto/Moratalaz:

| Temporada | Códigos con nombre tipo Maccabi |
|---|---|
| 2014/15 | `#93897` MACCABI DE LEVANTAR (18) · **`#95466` MACCABI (18)** |
| 2015/16 | `#103476` MACCABI DE LEVANTAR (18) |
| 2016/17 | `#112825` (18) · `#120202` (3) — ambos "MACCABI DE LEVANTAR" |
| 2017/18 | `#122256` MdL (18) · `#122271` MdA (18) · `#129335` MdL (3) · `#129337` MdA (3) |
| 2018/19 | `#132002` MdL (19) · `#132001` MdA (18) · `#138926` MdL (4) · `#138927` MdA (3) |
| 2020/21 | `#149302` MDL (14) · `#149303` MDA (14) · **`#149233` MACCABI DE LEVANTAR (14)** |
| 2021/22 | `#72599` MDL (18) · `#72598` MDA (18) |
| 2022/23 | `#82423` MdL (22) · `#82436` MdA (22) |
| 2023/24 | `#102961` MdL (22) · `#109217` MdA (22) |
| 2024/25 | `#158865` MdL (22) · `#158857` MdA (22) |

**Hallazgo lateral valioso:** los códigos `#119823` y `#120202` de 2016/17 son exactamente
los dos "Nº EQUIPO" de las hojas de inscripción de Torneos 2017 que se investigaron en el
bloque anterior. **El `Nº EQUIPO` de las hojas es el `Codigo_equipo` de este dataset**, lo
que da una vía de cruce fiable entre las dos fuentes.

## 5. Verificación: el dataset SÍ trae nuestros partidos

Contraste de `MACCABI DE LEVANTAR #93897` (2014/15) contra el histórico propio
`data/season_2014-15.json`. **Coinciden rival y marcador exacto en las 8 primeras jornadas:**

| J | Histórico propio | Dataset JDM |
|---|---|---|
| 1 | KINKIS 44-48 | @ LOS KINKIS RUSOS 44-48 |
| 2 | SETTAS 51-49 | vs SETTAS 51-49 |
| 3 | AQUASOL 40-47 | @ AQUASOL 40-47 |
| 4 | FONTARRON 43-56 | vs FONTARRON 43-56 |
| 5 | SPORTING 36-53 | vs SPORTING DE VALLEKAS 36-53 |
| 6 | LOS OTROS 49-47 | @ LOS OTROS 49-47 |
| 7 | LAS NIEVES 35-36 | vs LAS NIEVES 35-36 |
| 8 | GUARRIORS 39-54 | @ GUARRIORS 39-54 |

**El dataset es bueno y es el nuestro.** El problema no son los datos, es identificar qué
código nos corresponde cada año.

## 6. Las dos ambigüedades que obligan a parar

**a) 2014/15 — `MACCABI #95466` es un RIVAL, no nosotros.** Un filtro por nombre lo
capturaría como si fuera del club. Se ha podido descartar porque los dos equipos **se
enfrentaron entre sí** (J8: `MACCABI 21-54 MACCABI DE LEVANTAR`) y el histórico propio
registra ese partido como **"J16 vs MACCABI 54-21"**, es decir, como rival. Sin cruzar con
el histórico propio, no había forma de saberlo desde el dataset.

**b) 2020/21 — tres equipos con 14 partidos cada uno:** `MDL #149302`, `MDA #149303` y
`MACCABI DE LEVANTAR #149233`. El histórico propio sólo registra 13 partidos de MdL ese año.
**No se sabe cuál de los tres es cuál** sin decidirlo a mano.

## Qué hay que decidir antes de la Fase 1

1. **Criterio de identificación del club.** Propuesta: filtrar `BALONCESTO` + `MORATALAZ` +
   lista de variantes de nombre, y después **validar cada código candidato contra el
   histórico propio** (rival + marcador), quedándose sólo con los que casen. Es el método que
   ha funcionado en la verificación de arriba, pero implica cruzar con `season_*.json`, que
   este bloque prohibía expresamente. **Hace falta luz verde.**
2. **Qué hacer con 2020/21** y su tercer equipo.
3. **Qué hacer con las inscripciones de torneo** (los códigos de 3-4 partidos): ¿entran como
   partidos de la temporada, siguiendo D19, o se marcan aparte?

## Otros detalles técnicos ya resueltos en el sondeo

- **Dos formatos de fecha:** `15/11/2014` (hasta 2018/19) y `2020-11-15 00:00:00.000` (desde
  2020/21). Hay que normalizar.
- **Filas que no son partidos:** `DESCANSA` y `PASA RONDA` con resultado 0-0 (3-4 por
  temporada desde 2020/21). Hay que descartarlas.
- **Codificación rota** en `Nombre_grupo` de las temporadas antiguas: `DOM-MA�ANA`,
  `1� DIVISION`. Es latin-1 leído como UTF-8; se puede reparar.
- **`Campo` (sede) viene vacío** en las temporadas antiguas y en las filas de descanso.
- El CSV tiene **saltos de línea dentro de campos** (`Observaciones`), así que hay que
  parsearlo con un parser real, no por líneas.
