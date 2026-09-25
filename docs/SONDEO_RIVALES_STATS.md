# Sondeo: estadísticas de rivales (por equipo y por jugador)

_25/09/2026. Sólo investigación: no se ha montado nada ni se ha consultado internet para este sondeo. Se han leído en local los CSV ya descargados del portal de datos abiertos (`data/raw/`, `.cache-jdm/`), los ficheros del repo y las 42 actas y la hoja XLSX de 2025/26 de `fuentes_fbm/2025-26/` (fuera de git). Este documento **no incluye** nombres, licencias ni dorsales concretos de jugadores rivales ni de árbitros: sólo estructura y recuentos._

## Veredicto

| Nivel | ¿Hay datos? | Fuente | Dónde se podría mostrar |
|---|---|---|---|
| **Por equipo** (resultados, puntos a favor y en contra, clasificación del grupo, rachas, local/visitante, incomparecencias) | **Sí, completo y para todos los equipos del grupo** | Datos abiertos 211549 (temporada en curso) y 300257 (histórico), CC BY 4.0 | Web pública, citando la fuente |
| **Parciales por cuarto del rival** | Sólo en **nuestros** partidos | Actas PDF (pie "Tanteos: Cuarto n") | Web pública como dato de partido (sin nombres) |
| **Por jugador del rival** (dorsal, nombre, puntos, canastas de 2 y de 3, tiros libres, faltas) | Sí, pero **sólo de los partidos contra nosotros** | Hoja XLSX de la app Afición FBM (y, peor, el acta PDF) | **Sólo zona de gestión con login** |

Los datos abiertos **no traen nada por jugador** (ya visto en `SONDEO_ACTAS_FASE0.md`, apartado 6). Todo lo individual del rival sale de nuestros ficheros de la FBM, que no entran en git.

## 1. Datos abiertos por equipo (211549 y 300257)

### Partidos (una fila por partido de cualquier equipo) — verificado en la copia local
Campos útiles: `Codigo_equipo1/2`, `Equipo_local`, `Equipo_visitante`, `Resultado1/2`, `Fecha`, `Hora`, `Campo`, `Jornada`, `Nombre_grupo`, `Nombre_fase`, `Estado`, `Programado`, `Observaciones`, distrito y coordenadas de la pista.
- En los seis grupos sénior masculinos de Moratalaz de 2025/26 hay **757 filas** (132 por grupo de 11 equipos, más la fase de distrito). Trae **todos los partidos de todos los equipos**, no sólo los nuestros.
- `Estado` distingue jugados, descansos y **no presentados** (29 filas "N" en esos grupos). `Observaciones` casi siempre vacío (1 fila con un aplazamiento).
- **No trae** parciales por cuarto, anotadores, faltas ni nada por jugador.

### Clasificaciones (una fila por equipo y grupo) — verificado
Campos: `Posicion`, `Puntos`, `Partidos_jugados/ganados/empatados/perdidos`, **`Goles_favor` y `Goles_contra`** (en baloncesto son **puntos a favor y en contra**), grupo, fase, distrito, nombre y código del equipo. En 2025/26 están los 11 equipos de cada grupo de Moratalaz y la fase final de distrito.
- Aviso ya detectado por `build_rivales_2026_27.py`: algunas filas oficiales no cuadran (PJ ≠ G + P); se muestran tal cual.

### Lo que ya está construido en el repo
- `scripts/build_rivales_2026_27.py` → `data/rivales_2026-27.json` y `docs/RIVALES_2026-27.md`: para cada rival de 2026/27, **trayectoria** en todas las temporadas del portal (2014/15–2025/26, sin 2013/14 ni 2019/20), puesto y balance de la temporada pasada con puntos a favor y en contra, mejor resultado histórico, **cara a cara** con MdL + MdA, alias confirmados y candidatos dudosos.
- `data/rivales_jdm.json`: 328 partidos del club según el 300257 (temporada, equipo, rival, código, fecha, hora, sede, puntos a favor y en contra).
- **Falta**, y se puede sacar de los mismos CSV sin fuentes nuevas: estadísticas **de la temporada en curso** de cada rival del grupo (media de puntos a favor y en contra, racha de los últimos partidos, balance en casa/fuera, resultados contra rivales comunes, incomparecencias). Todo esto depende de que el 211549 publique la 2026/27 (hoy sigue con la 2025/26).

## 2. Actas y hojas: qué traen del rival

### Actas PDF (acta digital de Indalweb, 42 de 2025/26) — verificado en local
Estructura, igual en las 42 (39 de una página y 3 de dos):
- **Cabecera:** competición, fecha, hora, nº de partido, pista, nombres de los equipos A y B, árbitro principal con su número, tanteo final y equipo vencedor.
- **Un bloque por equipo, con el del rival completo:** por jugador, **nº de licencia, apellido e inicial, dorsal**, marca de participación ("X"), **faltas personales** por casilla (con letras para técnicas o antideportivas), capitán marcado; al pie, **delegado con su licencia** y entrenador/ayudante si los hay; **tiempos muertos y faltas de equipo por cuarto**.
- **Tanteo arrastrado:** la secuencia de canastas con el **dorsal de quien anota** en cada punto, para los dos equipos. En teoría permite reconstruir los puntos por jugador del rival, pero ya se decidió que no es fiable leerlo (`docs/ESTADO.md`: canasta normal, triple con círculo y tiro libre con paréntesis, que el texto del PDF no conserva bien).
- **Pie:** parciales por cuarto de los dos equipos (las 42 actas los traen) y anotador de mesa con su número.
- **Recuento del bloque rival** en las 42 actas: normalmente **8 a 10 jugadores** (rango 5–14; una acta sin jugadores rivales, que corresponde a una incomparecencia). El nuestro, 7–13.
- Las 23 actas de 2022/23 que hay en Descargas son del formato anterior, pero con los mismos apartados (licencia, jugadores, nº, faltas por equipo y tanteo arrastrado).

### Hoja de estadística XLSX (app Afición FBM, `estadisticaPartido_21_mda.xlsx`) — verificado en local
- Una hoja, con cabecera "Estadísticas - MDA vs [rival] - SenMas JDM - … - 25/26" y **un bloque por equipo, el del rival incluido**, cada uno con su fila de totales.
- Columnas por jugador: `Num.` (dorsal), `Nombre` (**nombre y apellidos completos**), `MIN`, `PTS`, canastas de 2, de 3 y tiros libres (`A/I` y `%`), rebotes, asistencias, recuperaciones, pérdidas, tapones, faltas cometidas y recibidas, `VAL` y `+/-`.
- En esta hoja el rival trae **6 jugadores** con dorsal, nombre y puntos; los puntos del bloque suman el marcador del rival.
- **Qué es fiable** (en esta hoja; hay que confirmarlo con más): **puntos, canastas de 2 y de 3 anotadas, tiros libres anotados/intentados y faltas cometidas**. **Qué no:** en tiros de campo los intentos son iguales a los aciertos (sólo se apuntan los aciertos, 100 % siempre), rebotes, asistencias, robos, pérdidas y tapones salen a 0, y los **minutos** no cuadran (hay jugadores con 48:00 en un partido de 40 minutos). `VAL` y `+/-` dependen de eso: no usar.
- Sólo queda **una** hoja en local; las otras 40 de 2025/26 se subieron al chat y no están en el PC. `scripts/parse_stats.py` y el nuevo lector de `feat/pipeline-estadisticas` leen **sólo nuestro bloque**.

## 3. Qué se podría construir

| Estadística | Fuente | Alcance | Visibilidad |
|---|---|---|---|
| Clasificación del grupo en vivo, puntos a favor y en contra, medias, rachas, casa/fuera, rivales comunes, incomparecencias | 211549 (y 300257 para histórico) | Todos los equipos, todos sus partidos | Pública |
| Trayectoria e historial cara a cara | 300257 + 211549 (ya hecho) | Todos los rivales | Pública |
| Parciales por cuarto de nuestros partidos (cómo arranca o cierra cada rival contra nosotros) | Actas PDF | Sólo partidos contra nosotros | Pública (sin nombres) |
| "Ficha de scouting" del rival: quién le anotó contra nosotros, triples, tiros libres, faltas, dorsales habituales | Hojas XLSX (bloque rival) | Sólo partidos contra nosotros: 2 por temporada y ficha en liga, más cruces | **Zona de gestión** |
| Faltas por jugador rival y tiempos muertos por cuarto | Actas PDF | Ídem | **Zona de gestión** |
| Puntos por jugador de un rival en partidos **contra otros equipos** | **Ninguna** | — | No existe fuente abierta ni legítima |

Notas:
- Con 2 partidos por rival y temporada, la ficha individual es poca muestra; gana valor acumulando temporadas, siempre que el rival mantenga plantilla (el nombre de equipo cambia a menudo; ver alias en `RIVALES_2026-27.md`).
- Para cruzar un mismo jugador rival entre temporadas haría falta identificarlo por nombre y dorsal: es tratamiento de datos personales de terceros. Si se hace, sólo en gestión y con criterio mínimo.
- Esto obliga a cambiar el lector de hojas para que **también** lea el bloque rival y lo guarde **fuera de la web pública** (p. ej. en el almacenamiento de la zona de gestión, nunca en `data/` del repo público).

## 4. Privacidad
- **Web pública:** sólo datos de equipos (resultados, clasificaciones, parciales). Cero nombres, dorsales o licencias de jugadores rivales, árbitros, anotadores o delegados.
- **Zona de gestión (con login):** se podría guardar el bloque rival de las hojas (dorsal, nombre, puntos, tiros y faltas) para preparar partidos. Mínimo necesario: sin licencias, sin árbitros ni oficiales de mesa, y con borrado al cabo de un plazo razonable.
- **Ficheros de la FBM** (actas y hojas): nunca en git (`fuentes_fbm/` ya está en `.gitignore`). Recuerda que su aviso legal prohíbe reproducir el contenido: uso interno del club, no publicación.
- Los CSV brutos del portal también quedan fuera de git (`data/raw/`, `.cache-jdm/`), porque incluyen nombres de personas en otros deportes (D25).

## 5. Fuentes
- Datos abiertos: dataset 211549 (https://datos.madrid.es/dataset/211549-0-juegos-deportivos-actual) y 300257, CC BY 4.0. Copias locales: `data/raw/211549_partidos_20260925.csv`, `data/raw/211549_clasificaciones_20260925.csv`, `.cache-jdm/`.
- Repo: `scripts/build_rivales_2026_27.py`, `data/rivales_2026-27.json`, `data/rivales_jdm.json`, `docs/RIVALES_2026-27.md`, `docs/ESTADO.md`, `docs/SONDEO_ACTAS_FASE0.md`, `docs/SONDEO_JDM_FASE0.md`.
- Ficheros locales (no versionados): `fuentes_fbm/2025-26/actas/Acta-Partido-*.pdf` (42), `fuentes_fbm/2025-26/hojas/estadisticaPartido_21_mda.xlsx`, `~/Downloads/Acta-Partido-1526xx.pdf` (2022/23).
