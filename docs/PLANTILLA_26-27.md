# Plantilla 2026/27 — reconciliación con el registro de personas

_Extraída el 25/09/2026 y **confirmada por Iván el mismo día**. Identidades nuevas creadas y `previsto_2627` actualizado; `npm run check:personas` sin incidencias (87 identidades)._

## Fuente

Las dos hojas de inscripción oficiales del **47 JDM** (= temporada 2026/27), impresas el 24/09/2026. Los PDF están en `docs/Fichas/` y **no se versionan** (D17). De ellos sólo se extrae temporada, equipo, grupo y nombre, a `data/fichas_inscripcion.json` (`anio: "2026"`). Nada de DNI, fecha de nacimiento, teléfono ni email. **La fecha de alta tampoco se publica** (el bloque anterior la guardaba; se retiró el 25/09/2026 antes de subir nada, por D17).

| Equipo | Fichero | Grupo (según la hoja) | Deportistas |
|---|---|---|---|
| **MdA** | `MdA.pdf` | **3 JDM MOR DOM MAÑ BC SEN MAS G1** | 24 |
| **MdL** | `MDL.pdf` | **4 JDM MOR DOM MAÑ BC SEN MAS G2** | 22 |

Desde el 25/09/2026 la extracción de 26/27 la hace el propio `scripts/consolidar_fichas.js` (antes fue un script puntual), con las reglas nuevas: sólo filas "Deportista", el grupo, y `person_id` sólo por coincidencia exacta o alias ya confirmado. Regenera exactamente los mismos nombres que la extracción puntual.

**Cambio de grupos en 26/27 (confirmado por Iván):** el MdA pasa al G1 y el MdL al G2. En temporadas anteriores el MdL era el G1 (ver MEMORIA). Se registra sólo como dato de 2026/27; el histórico no se toca.

**Resultado:**
- **24 deportistas distintos.**
- **22 inscritos en ambas fichas.**
- **Sólo en el MdA: Galán Domingo, Guillermo y Varas García, Luis Alberto.** Nadie está sólo en el MdL.

### Delegados (no son jugadores)
- Las filas "Delegado/a" **no** se tratan como jugadores. MdA: Varas García y Villaescusa Silva; MdL: Villaescusa Silva.
- **Luis Alberto Varas García figura como delegado del MdA por error**: el delegado de ambos equipos es Carlos Barreiro. Consta sólo como **deportista del MdA**, que es como figura en la hoja.
- **Carlos Barreiro no aparece en ninguna de las dos hojas.** Cuando se corrija el delegado conviene que salga en la hoja definitiva (lo gestiona Iván con la organización).
- Iván aparece como delegado en ambas y también como deportista en ambas: cuenta como jugador de las dos fichas.

## Plantilla confirmada — 24 personas

| Persona (nombre formal) | `person_id` | MdA | MdL | Nota |
|---|---|:-:|:-:|---|
| Baños Gallego, Carlos | `banos-gallego-carlos` | ✔ | ✔ | |
| Calahorro Sánchez, Manuel | `calahorro-sanchez-manuel` | ✔ | ✔ | |
| De Carvalho Rodrigues, Julio César | `de-carvalho-rodrigues-julio-cesar` | ✔ | ✔ | |
| De María Sánchez, Jaime | `de-maria-sanchez-jaime` | ✔ | ✔ | |
| Esteban, Jon | `esteban-jon` | ✔ | ✔ | |
| Galán Domingo, Guillermo | `galan-domingo-guillermo` | ✔ | — | vuelve (jugó 2020-2024) |
| **García Gijón, Eduardo** | `garcia-gijon-eduardo` | ✔ | ✔ | **nuevo** |
| Gianatti, Adriano | `gianatti-adriano` | ✔ | ✔ | |
| Jorba López, Sergi | `jorba-lopez-sergi` | ✔ | ✔ | |
| López Lucero, Alfredo David | `lopez-lucero-alfredo-david` | ✔ | ✔ | |
| Martínez Martínez, Andrés | `martinez-martinez-andres` | ✔ | ✔ | |
| Martínez Martínez, Víctor | `martinez-martinez-victor` | ✔ | ✔ | |
| Martín-Ortega Rico, Eduardo | `martin-ortega-rico-eduardo` | ✔ | ✔ | |
| Méndez Escandón, Fernando Antonio | `mendez-escandon-fernando` ¹ | ✔ | ✔ | |
| Mileo, Ignacio Agustín | `mileo-ignacio-agustin` | ✔ | ✔ | |
| Pérez Núñez, Víctor | `perez-nunez-victor` | ✔ | ✔ | |
| Romero Barrueco, Alonso | `romero-barrueco-alonso` | ✔ | ✔ | |
| **Santos Artiles, Enyel Geuris** | `santos-artiles-enyel-geuris` | ✔ | ✔ | **nuevo** |
| Tejeiro Pérez de Ágreda, Fernando | `tejeiro-perez-de-agreda-fernando` | ✔ | ✔ | |
| **Teruel Fernández, Tomás** | `teruel-fernandez-tomas` | ✔ | ✔ | **nuevo** |
| Vallesi, Daniele | `vallesi-daniele` | ✔ | ✔ | vuelve (no estuvo en 25/26) |
| Varas García, Luis Alberto | `varas-garcia-luis-alberto` | ✔ | — | |
| Villa Guerrero, Edwin | `villa-guerrero-edwin` | ✔ | ✔ | vuelve (2022-2024) |
| Villaescusa Silva, Iván | `villaescusa-silva-ivan` | ✔ | ✔ | |

¹ Casa con un `alias_id` ya confirmado el 04/08/2026 (D14: el acta 25/26 trae el nombre legal completo). No es una fusión nueva.

### Las 3 personas nuevas
García Gijón, Santos Artiles y Teruel Fernández son **personas nuevas** (primera temporada en el club, confirmado por Iván). Se han creado como cualquier otra identidad: una fila en `data/historia_club.json` (sin temporadas jugadas, `n_temporadas: 0`, `previsto_2627: true`, con nota) y, al regenerar, su entrada en `data/personas.json` con el `person_id` que da la regla D14. En la pestaña "El Club" salen en un tramo propio, "Llegan en 26/27 · aún sin temporadas", y no cuentan todavía en los indicadores de "han vestido la camiseta".

### Previsión 26/27 de la matriz (`previsto_2627`) — actualizada
- **Salen:** Rausse, Lukas · Mateos Aparicio, Ignacio · Rodríguez Pérez, Iván.
- **Entran:** Galán Domingo, Guillermo · Vallesi, Daniele · Villa Guerrero, Edwin · y los 3 nuevos.
- Resultado: **25 previstos = los 24 jugadores de las hojas + Barreiro** (entrenador, no jugador). 26/27 sigue siendo *prevista*: no cuenta como temporada jugada hasta que empiece.

Respecto a las hojas de 25/26 salen: Hernández Faura, Jorge · Ortega Delgado, Pablo · Perchín García, Javier · Rausse, Lukas · Yamín Squicciarini, Nicolás · Rogaia, Samuele.

## Correspondencia de nombres (motes) — confirmada por Iván

Para evitar ambigüedades en convocatorias, estadísticas y cruces con SportEasy. Sólo identidad: ni posiciones ni niveles (eso es privado, ver `docs/REGLAS_CONVOCATORIA.md`).

| Mote | Nombre oficial | `person_id` |
|---|---|---|
| Victor | Martínez Martínez, Víctor | `martinez-martinez-victor` |
| Wall | Pérez Núñez, Víctor | `perez-nunez-victor` |
| Andrés | Martínez Martínez, Andrés | `martinez-martinez-andres` |
| Edu | Martín-Ortega Rico, Eduardo | `martin-ortega-rico-eduardo` |
| Eduardo (nuevo) | García Gijón, Eduardo | `garcia-gijon-eduardo` |
| Fernando (el que juega) | Tejeiro Pérez de Ágreda, Fernando | `tejeiro-perez-de-agreda-fernando` |
| Fernando (el que sólo entrena) | Méndez Escandón, Fernando Antonio | `mendez-escandon-fernando` |
| Nacho / Nacho Argentino | Mileo, Ignacio Agustín | `mileo-ignacio-agustin` |
| Manu | Calahorro Sánchez, Manuel | `calahorro-sanchez-manuel` |
| David | López Lucero, Alfredo David | `lopez-lucero-alfredo-david` |
| Jon | Esteban, Jon | `esteban-jon` |

**Ojo con los dos "Eduardo" y los dos "Fernando":** "Edu" es siempre Martín-Ortega y "Eduardo" a secas, García Gijón. En las hojas de estadística de la FBM no hay ambigüedad (traen nombre completo); la tabla sirve para lo que llega por WhatsApp o SportEasy.

### Personas que siguen en SportEasy pero NO juegan en 26/27
**Nicolás Yamin, Javier Perchín y (Ignacio) Mateos** siguen dados de alta en SportEasy, pero no juegan esta temporada. **Se ignoran en cualquier cruce** (disponibilidad, asistencia, convocatorias). No están en las hojas del 47 JDM, así que cualquier cruce que parta de la plantilla confirmada ya los deja fuera.

## Avisos técnicos

- **La hoja de Torneos 2018 del MdL está congelada ("sin PDF").** Hasta el 25/09/2026 `docs/Fichas/MDL.pdf` era la hoja de Torneos Municipales 2018 del MdL (temporada 2017/18, 17 nombres). Al copiar `MdL.pdf` de 26/27 a la carpeta, Windows (que no distingue mayúsculas en los nombres) **la sobrescribió**, y llega un segundo PDF con el mismo nombre que no tiene nada que ver con el primero. **Iván confirma que el original es irrecuperable.** Sus 17 nombres se han recuperado **del historial de git** (commit `63229e6`, en su orden original) y viven en `docs/fichas_sin_pdf.json`; en `data/fichas_inscripcion.json` la hoja lleva `sin_pdf: true`. No se ha perdido ningún nombre ni ningún año de nadie.
- **El script de fichas ya no puede perder hojas en silencio.** Antes de escribir compara con el JSON anterior: si falta el PDF de una hoja registrada que no esté congelada, o si un fichero con ese nombre ya es otra hoja (otro año, equipo o competición), **falla con un aviso claro y no escribe nada**. Probado en los dos casos (código de salida 1, JSON intacto).
- **Nunca se sobrescribe una fuente.** `scripts/lib/copia_segura.js` copia ficheros a una carpeta de fuentes comprobando antes, sin distinguir mayúsculas, si el nombre ya existe; si existe y es distinto, para y avisa. Lo usa también el pipeline de estadísticas.
- **Delegados y entrenadores en hojas antiguas:** `consolidar_fichas.js` sigue incluyendo las filas "Delegado/a" y "Entrenador/a" en las hojas anteriores a 2026 (por eso Barreiro consta en las de 25/26). No se ha cambiado para no alterar el histórico; en 2026/27 ya sólo cuentan los "Deportista".
