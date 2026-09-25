# Calendario automático 2026/27

_Rama `feat/calendario-automatico` (25/09/2026). **Sin mergear**: se verifica con Iván. Depende de `feat/pipeline-estadisticas` (reutiliza su lector del CSV) y se mergea después de ella._

## Qué hace

- **Fuente:** dataset **211549** del portal de datos abiertos del Ayuntamiento de Madrid ("temporada en curso", CSV semanal, CC BY 4.0). Trae, por partido: jornada, fecha, **hora**, **pista** (`Campo`), local/visitante, rival, estado y resultado.
- **Identificación por código, nunca por nombre** (hay homónimos, D26). Los códigos cambian cada temporada y las hojas de 26/27 no los traen: `--descubrir` propone el código del equipo llamado MdA/MdL **dentro de nuestro grupo exacto** (MdA en G1, MdL en G2) y se confirma con el acta de la jornada 1 (fecha y marcador) antes de escribirlo en `scripts/calendario/config_2026-27.json`. Probado con 2025/26: propone 178977 (MdA) y 177542 (MdL), que son los correctos.
- **Salidas (públicas, sólo datos de equipos):**
  - `data/calendario_2026-27.json`: calendario y marcadores de las dos fichas. El pipeline de estadísticas lo usa para saber la jornada de un acta y el ganador de una incomparecencia.
  - `data/sporteasy_calendario_2026-27.csv`: **tabla limpia para la plantilla de importación de SportEasy** (campeonato, tipo, fecha, hora, local/visitante, rival, lugar, jornada, otra ficha el mismo día, fuente). Se abre con Excel. Cuando soporte de SportEasy mande su plantilla, se copian las columnas.
  - Para la regla de doblaje (D33), cada partido indica si la otra ficha juega el mismo domingo, a qué hora y con cuántos minutos de diferencia. En 2025/26 hubo 17 domingos con las dos fichas, y alguno a la misma hora.
- Los CSV brutos del portal se guardan en `data/raw/` (fuera de git, D25: el CSV incluye pádel con nombres de personas).

## El robots.txt del portal (importante)

El `robots.txt` de datos.madrid.es **prohíbe a los bots** la ruta de descarga de los ficheros (`/dataset/*/resource/*`) y deja libres las páginas y los metadatos del dataset (`.rdf`), con `Crawl-delay: 10`. La licencia CC BY 4.0 permite reutilizar los datos, pero una descarga **programada** sería un bot. Por eso:

- **Cada lunes, automático:** el workflow sólo lee los **metadatos** (.rdf, permitido). Si el portal ha publicado una versión nueva, abre un aviso (issue) en GitHub, que le llega a Iván por correo.
- **Descarga: con botón.** Iván (o Claude Code cuando lo pida) pulsa *Actions → "Calendario JDM (datos abiertos)" → Run workflow*. Es una descarga iniciada por una persona, de un único fichero, como hacerlo desde el navegador. Regenera el calendario y la tabla de SportEasy y los sube.
- Si algún día se quiere la descarga 100 % programada, lo limpio es escribir al equipo de datos abiertos del Ayuntamiento (no a la FBM) y preguntar si una descarga semanal de un CSV con licencia abierta es aceptable. Queda como opción, no se ha hecho.
- **Riesgo técnico:** el cortafuegos del Ayuntamiento (Akamai) podría bloquear las IP de GitHub. Sólo se sabrá la primera vez que se pulse el botón; si pasa, se hace igual en local (`--descargar` desde el PC de Iván).

## La liga de Moratalaz empieza el 4/10 (antes que el resto, 17/10)

A 25/09/2026 el 211549 **sigue trayendo la 2025/26** (fichero `partidos_20260629.csv`, actualizado el 11/09) y avisa de que la 2026/27 estará "en la web municipal". Es probable que la jornada 1 (4/10) y quizá la 2 se jueguen **antes** de que el portal publique nuestro grupo.

**Qué pasa si aún no hay datos:** nada se rompe. `--descubrir` dice "aún no trae partidos de 47 JUEGOS DEPORTIVOS MUNICIPALES en nuestros grupos", el calendario sale vacío y la tabla de SportEasy también. El pipeline de estadísticas funciona igual: saca fecha, hora, pista y marcador de las actas; la jornada la toma del nombre de la hoja o de `jornadas_manuales`.

**Cómo se carga a mano mientras tanto (plan B):**
1. Iván pasa el calendario que reciben los delegados (PDF, correo o captura) al chat.
2. Se transcribe a `data/calendario_manual_2026-27.csv` (ya creado, sólo cabecera): `equipo;jornada;fecha;hora;local_visitante;rival;pista`, una fila por partido, `equipo` = MDA o MDL, fecha `dd/mm/aaaa`.
3. `node scripts/calendario/actualizar_calendario.js` genera el calendario y la tabla de SportEasy con esas filas (marcadas `fuente: manual`).
4. En cuanto el portal publique, **manda el dato abierto**: las filas manuales sólo rellenan lo que falte, y si una no coincide con el portal (hora o pista) se avisa.

Probado con dos filas de ejemplo: sale la tabla de SportEasy con "MdL 26/27 a las 10:15 (75 min de diferencia)".

## Comandos

```bash
node scripts/calendario/actualizar_calendario.js --comprobar   # ¿hay versión nueva? (sólo metadatos)
node scripts/calendario/actualizar_calendario.js --descargar   # descarga el CSV (a mano)
node scripts/calendario/actualizar_calendario.js --descubrir   # propone los códigos de MdA y MdL
node scripts/calendario/actualizar_calendario.js               # genera calendario + tabla SportEasy
```

## Pendiente al mergear

- La programación semanal sólo corre desde la rama por defecto (`main`): hasta mergear no hace nada.
- Confirmar los códigos de 26/27 en cuanto el portal publique (con el acta de la jornada 1).
- Poner en `campeonato_sporteasy` los nombres exactos de los dos campeonatos que Iván cree en SportEasy.
