# RUTINA A — Actas y estadísticas (procedimiento, 02/10/2026; reparto actas/hojas del 23/10/2026, D106; publicación automática del 24/10/2026, D66; hojas con el S21 y Drive desde el 04/11/2026, D182 y D183)

**Cuándo:** lunes (tras la jornada del domingo), con una segunda pasada el jueves para lo que llegue tarde.

**Reparto desde el 24/10/2026 (quién hace qué):**
| Quién | Qué | Cuándo |
|---|---|---|
| **Claude** (tarea programada «Maccabis · actas del lunes», en el Chrome de Iván) | Baja de gesdeportiva.fbm.es las **actas** que falten a Descargas | Lunes y jueves, 9:30 |
| **Claude** (con el **S21 dedicado al club**, D182) | Baja las **hojas de estadística** (las nuestras y las de los grupos de la fase, D183) de la app **Afición FBM**; FolderSync las lleva a Google Drive y de ahí al PC | Domingo noche o lunes por la mañana (FolderSync, cada 10 minutos) |
| **`scripts/rutina_a_publicar.ps1`** (Programador de tareas de Windows, sin agentes) | Procesa (`npm run jornada -- --no-interactivo`) y, **si todo cuadra, publica solo** (D66); si no, para sin publicar nada | Lunes y jueves, 9:45 y 13:00 |

**Reparto de fuentes (D106, 23/10/2026):**
| Qué | De dónde | Cómo |
|---|---|---|
| **Actas** (`Acta-Partido-<nº>.pdf`, las de MdA y MdL) | Web **gesdeportiva.fbm.es/clubes** → Competiciones → Resultados y actas (una sola cuenta ve los dos equipos) | Iván inicia sesión en su Chrome (clave en el gestor de contraseñas); Claude descarga desde ahí con la extensión. Claude **nunca** maneja la clave ni resuelve el «no soy un robot»: si salen, para y avisa. |
| **Hojas de estadística** (las nuestras y las de toda la liga, D73) | App **Afición FBM** (la web no las ofrece, ni partidos de otros equipos) | Enlace Móvil de Windows con el **S21 dedicado al club** (D182, matiza D70); FolderSync → Google Drive → `I:\Mi unidad\Descargas aficion fbm\`. |
| Clasificación y listado completo de partidos (CSV) | La misma web | Pendiente de evaluar para la rutina B (contraste con la oficial, D74). |

Todo a **Descargas** (las actas) o a la **carpeta de Drive** (las hojas), sin renombrar. Si en Descargas quedan hojas de jornadas anteriores, `npm run jornada` se ejecuta con `--desde` una carpeta que solo tenga los ficheros nuevos (así se hizo con la J2 y con las actas de J1 y J2 el 23/10).

## Actas: web gesdeportiva.fbm.es (D106)

1. **La sesión de gesdeportiva no pasa de una pestaña a otra** (comprobado el 26/10/2026): cada pestaña nueva vuelve a mostrar el formulario, aunque haya otra pestaña con la sesión abierta.
2. Entrada (D131): Claude usa una pestaña de gesdeportiva que ya tenga la sesión abierta («26 MDA y MDL», «CERRAR SESIÓN») y, si no la hay, abre `https://gesdeportiva.fbm.es/clubes/` y pulsa **ENTRAR** con Usuario y Clave **ya rellenados por Chrome**. Nunca escribe, cambia ni lee la clave. Si los campos están vacíos, aparece un «no soy un robot» o ENTRAR da error, para y avisa a Iván. No cierra la sesión ni la pestaña de gesdeportiva al terminar (Iván, 26/10/2026): la siguiente ejecución la reutiliza.
3. Claude: Competiciones → **Resultados y actas** → «Por fechas» → **acta** de cada partido de MdA y MdL (`Acta-Partido-<nº>.pdf`, a Descargas).
4. Primera ejecución: 23/10/2026 (4 actas de J1 y J2, las 4 cuadran).
5. **Desde el 24/10/2026 lo hace una tarea programada de Claude**, «Maccabis · actas del lunes» (lunes y jueves a las 9:30 desde el 26/10/2026; antes 8:34): baja solo las actas que falten en Descargas. Necesita el Chrome de Iván abierto (con la extensión) y la clave guardada en Chrome para gesdeportiva.

## Publicación automática: `scripts/rutina_a_publicar.ps1` (D66, 24/10/2026)

Tarea **«\Maccabis\Rutina A - publicar jornada»** del Programador de tareas de Windows (desde el 01/11/2026 su acción es `conhost.exe --headless powershell.exe -NoProfile -ExecutionPolicy Bypass -File "…\scripts\rutina_a_publicar.ps1"`: sin ventana, ver ESTADO): lunes y jueves a las **9:45 y a las 13:00** (dos disparadores, hora local; el de las 9:45 se añadió el 26/10/2026 para publicar en cuanto «actas del lunes» de las 9:30 baje las actas; el de las 13:00 queda de repesca), solo con la sesión de Iván iniciada; si el PC estaba apagado a esa hora, se ejecuta al encenderlo. Ejecuta `scripts\rutina_a_publicar.ps1` de la **copia dedicada `C:\Users\Iván\Proyectos\Maccabis-rutina-a`** (directorio de trabajo de la tarea: esa misma carpeta), **nunca de la carpeta de trabajo** (D114). Es un script determinista: no usa agentes.

**Lo que la copia necesita y no está en git** lo enlaza el propio script en el paso 0 (unión de directorios a la carpeta del proyecto): `privado/`, `fuentes_fbm/` y, desde el 26/10/2026, `data/raw/` (los CSV del portal que usa `test:regresion`; sin ellos, la ejecución de las 11:59 del 26/10 paró en esa prueba sin publicar nada; enlazado, la de las 12:06 publicó la J3 con sus actas, commit `9cdfab5`).

**La copia dedicada** (24/10/2026): un **clon aparte** del repositorio (no un worktree: un worktree no puede tener `main` mientras la carpeta del proyecto también lo tiene), **solo para publicar y siempre en `main`**. Nadie trabaja en ella. Lo que no está en git:
| Qué | Cómo | Por qué |
|---|---|---|
| `privado/` | **Enlazado** (unión de directorios) a `C:\Users\Iván\Proyectos\Maccabis\privado` | Un solo registro (`registro_rutina_a.log`) y una sola asistencia privada (la que lee `db:asistencia`) |
| `fuentes_fbm/` | **Enlazado** (unión de directorios) a `C:\Users\Iván\Proyectos\Maccabis\fuentes_fbm` | `npm run jornada` decide qué ficheros son nuevos mirando lo que ya hay ahí: con una copia aparte volvería a cargarlo todo |
| `plataforma/.env.local` | **Copiado** de la carpeta del proyecto | Un enlace de fichero pide permisos de administrador. Si cambian las claves, se borra en la copia y el script la vuelve a copiar |
| `node_modules` (raíz y `plataforma/`) | `npm ci` propio | |
El script crea lo que falte (enlaces, `.env.local`, `npm ci`) al empezar; todo está en `.gitignore` y nada sube a git.

0. **La copia:** para si se lanza desde otra carpeta que no sea `Maccabis-rutina-a`; **para y avisa si la copia tiene cambios locales** (no toca nada); `git checkout main` y `git pull --ff-only`; enlaza o copia lo que falte (tabla de arriba); `npm ci` si faltan los `node_modules` o si el pull ha cambiado un `package-lock.json`.
1. **main al día:** para si hay commits sin subir.
2. **`npm run jornada -- --no-interactivo`:** ante cualquier duda **para con código distinto de 0** en lugar de seguir: un nombre que no está en `personas.json`, una hoja que no es de la jornada, un acta que no cuadra con su hoja, un fichero que no se puede leer, una hoja de liga sin jornada, un partido nuestro **sin hoja** (aún no bajada de Afición FBM) o **sin acta** (la excepción D71 no se aplica sola). Antes de escribir genera en seco; si para, deshace las copias que hizo en `fuentes_fbm/`, para que la siguiente pasada vuelva a ver esos ficheros como nuevos. **Sin ficheros nuevos, sale sin hacer nada** («Nada nuevo»). Con la jornada cuadrada recalcula también la temporada en curso de la Historia (`historia_club.json` y `personas.json`, D137): quien debuta pasa de amarillo a naranja en /historia sin tocar nada. **Lo primero (D151)**, regenera `data/calendario_2026-27.json` (y su copia de la plataforma) desde la tabla de eventos (`npm run calendario:exportar`): es una copia generada, así que el calendario que usa la jornada es el de la tabla; si la tabla no responde, sigue con la copia que hay, y con «Nada nuevo» la deja como estaba. El cambio de calendario, si lo hay, se publica en el mismo commit.
3. **Pruebas:** `test:regresion`, `test:liga`, `test:privacidad`, `check:historia` (D137) y `check:copias`. Desde D132, `npm run jornada` y `test:liga` paran si la liga tiene menos jornadas, hojas o partidos que el `liga.json` de `origin/main`.
4. **Publica:** commit de `data/` y `plataforma/src/data/` con el mensaje «datos(2026-27): jornada N (automático)» y push a `main`.
5. **En `plataforma/`:** `npm run db:liga` y `npm run db:asistencia`, con `--confirmar <ref>` del Supabase real escrito en el propio script (`$RefReal`, norma 19, D187): si la conexión de `.env.local` no es la de ese proyecto, paran sin conectarse y la rutina lo avisa como fallo. Después, **la comprobación sin navegador** (D179; `pruebas/verificar_jornada.mjs`), en dos partes:
   - **La base** (`verificar_jornada.mjs base --confirmar <ref>`): en el Supabase real, **en solo lectura** (transacción `read only`), que los partidos de G1 y G2 de la última jornada de `src/data/liga.json` están con su marcador y con las filas por jugador que da `db:liga` con las hojas (y nada de más). Por consola, solo equipos, marcadores y recuentos.
   - **La web** (`verificar_jornada.mjs web --commit <sha>`): espera a que **GitHub** diga que Vercel ha desplegado ese commit en producción (lo pregunta a la API de GitHub, no a producción; como mucho 10 minutos; si GitHub no contesta, 4 minutos) y hace **una sola petición HTTP** (`fetch`, sin navegador) a `https://maccabis.vercel.app/liga`: tiene que responder 200 y traer en el HTML los marcadores de la jornada de G1 y G2. **Nada más contra producción** (ni segundo intento).

   Lo ya publicado no se deshace: un fallo aquí se avisa («pero falla: jornada en la base / jornada en /liga»). `verificar_produccion.mjs` (navegador automático contra producción) queda en el repositorio **solo para uso manual** y la rutina ya no lo lanza.

**Si falla antes del push no publica nada** y deja el repositorio como estaba (`git reset --hard` al commit de partida y limpieza de `data/` y `plataforma/src/data/`).

**Registro:** cada ejecución añade fecha, resultado (`PUBLICADA`, `NADA NUEVO`, `PARADA`, `PUBLICADA CON FALLOS`…) y resumen a `privado/registro_rutina_a.log` (fuera de git); si para, también las últimas líneas del paso que falló.

**Aviso:** notificación de Windows al terminar: «Jornada N publicada: MdA x–y Rival · Rival x–y MdL» (el local primero) o «Rutina A parada: <motivo>». Sin ficheros nuevos no avisa (queda en el registro).

**A mano:** desde `C:\Users\Iván\Proyectos\Maccabis-rutina-a`, `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\rutina_a_publicar.ps1` (de verdad) o con `-Dry` (en seco: no hace checkout ni pull, no enlaza, no copia ni escribe nada; la carpeta, la rama y los cambios locales solo se avisan). Probado en seco el 24/10/2026 sobre lo ya cargado: «Nada nuevo».

**Si para:** mirar el motivo en el aviso o en el registro, arreglar (bajar la hoja que falta, confirmar un nombre nuevo en `personas.json`…) y relanzar a mano o esperar a la pasada del jueves. Las dudas las resuelve una persona: el script nunca adivina.

## Hojas: S21 dedicado al club + FolderSync → Drive (D182, matiza D70)

**Dispositivo:** un **Samsung S21 dedicado al club**, siempre encendido y con Afición FBM abierta, manejado por Claude con **Enlace Móvil de Windows**. La ventana «Pantalla del teléfono» va en la **mitad derecha del monitor principal** (desde el 09/11/2026; antes, en el segundo monitor: ver abajo). Sustituye al móvil personal de Iván (D70): ya no depende de que esté encendido, con wifi y cerca del PC. Probado el 04/11/2026.

**Manejar el S21 desde el PC (aprendido el 06/11/2026):**
- **Siempre en la ventana «Pantalla del teléfono»** (Enlace Móvil → «Abrir la pantalla del teléfono»). La ventana suelta de la app («Afición FBM» abierta desde Enlace Móvil → Aplicaciones) **Claude no la ve: sale tapada en las capturas**. Si está abierta, cerrarla.
- **Si la pantalla del teléfono se ve pero no responde a los toques** (tampoco a los de Iván): cerrar la conexión con el teléfono en Enlace Móvil y volver a abrirla (es lo que lo arregló el 06/11). Antes de seguir, comprobarlo con un toque que cambie algo visible (p. ej. abrir el cajón de apps). Si sigue sin responder tras reconectar, **avisar a Iván y parar**, sin reintentar en bucle.
- **Anuncio «Navega sin interrupciones»** (hoja blanca que sube desde abajo): se cierra **arrastrando hacia abajo la rayita gris de arriba**. **Nunca pulsar «Saber más».**
- **Abrir la app:** cajón de apps → buscador → escribir «fbm» (las letras pueden perderse al escribir: comprobar el texto en la captura) → **Afición FBM**.
- **Ruta a los partidos de cualquier grupo:** **Mis Equipos** → **MDL** (la tarjeta, no «Ver estadísticas categoría») → pestaña **PARTIDOS** → Fases **MORATALAZ** → **Grupos** (desplegable) → pestañas **JORNADA 1, 2, 3…**
- **Desplazarse:** arrastrar con el ratón **no** desplaza; la **rueda** sí. Con el puntero en la mitad de arriba de la pantalla desplaza la página entera y rápido; dentro de la lista va muy lento. Al bajar, las pestañas de jornada se van de la pantalla: **antes de pulsar una, comprobar en la captura que es la pestaña y no una tarjeta de partido** (pulsar una tarjeta abre el partido; se vuelve con la flecha de arriba a la izquierda).
- **La lista de partidos de cada jornada** trae local, visitante, marcador, fecha, hora y pista, y quién descansa: **es la fuente para apuntar la jornada en `jornadas_hojas.csv` al descargar** (D186, abajo). Un partido puede tener **resultado oficial y no tener hoja** (le pasó a G5 J1): se apunta igual, con su marcador y «sin hoja». Una **incomparecencia** sale como **20-0 con todo a cero**: se apunta con el 20-0 y «incomparecencia».

**Aprendido el 09/11/2026** (descarga a mano de la J4 por la tarde, 24 hojas):
- **Dónde va la ventana:** «Pantalla del teléfono» en la **mitad derecha del monitor principal**. El **monitor BenQ sale vacío en las capturas de Claude desde el 09/11** (antes funcionaba): no usarlo. El **centro del monitor principal** tiene una ventana que Claude ve en negro: no poner el teléfono encima.
- **Abrir el espejo siempre con Enlace Móvil → «Abrir la pantalla del teléfono»**; nunca la ventana suelta «Afición FBM» (no se ve).
- **Permisos:** basta con el de **«Enlace Móvil»** (el de `msedgewebview2` no hizo falta). Los permisos **caducan a los 30 minutos sin uso**: pedirlos todos de una vez.
- **Navegación probada:** Mis Equipos → MDL → PARTIDOS → Grupos (desplegable) → pestañas de jornada → el partido → ESTADÍSTICAS → EXCEL → «Abrir con» se cierra con **Atrás** → la **flecha de la app** para volver a la lista. **La jornada de cada grupo se comprueba por la FECHA del partido, no por el número** de la pestaña.
- **Desplazarse:** la rueda del ratón desplaza poco (lotes de ~100 pasos sobre la lista). **Una notificación del móvil puede tapar un toque: comprobar con captura cada pantalla antes de pulsar.** Tocar demasiado arriba abre el panel de notificaciones (se cierra con Atrás).
- **Anuncio «Navega sin interrupciones»:** arrastrar hacia abajo la barra gris; **nunca «Saber más»**.
- **Al desplazarse hay saltos y puede quedarse un partido sin ver:** al acabar, contar los partidos de cada grupo contra la lista de la jornada (con 11 equipos, 5 partidos y un descanso) y anotar en `jornadas_hojas.csv` lo bajado. El 09/11 el registro no existía y lo escribió después la sesión que procesó la jornada.

**Descargar una hoja (en la app):** equipo → **Partidos** → (desplegable **Grupos**) → el partido → **Estadísticas** → **EXCEL**. Sale «Abrir con»: se cierra con **Atrás**; el fichero queda en la carpeta Descargas del S21. En el buscador de la app, el texto se escribe letra a letra y llega en MAYÚSCULAS.

**Llegada al PC:** **FolderSync** (en el S21) copia Descargas → Google Drive, carpeta «Descargas aficion fbm» (un solo sentido, cada 10 minutos). En el PC, Google Drive para Windows la deja en `I:\Mi unidad\Descargas aficion fbm\`. Hay ficheros ocultos (`.exmu-cfg1.data`, `.thumbcache_*`) que se ignoran. Los nombres son `estadisticaPartido_<fecha de DESCARGA>.xlsx` con sufijos de duplicado (« (1)»…): **no dicen nada del partido**.

**Registro de descargas de G3–G6 (D186, desde el 05/11/2026):** la hoja no trae la jornada y los grupos ajenos no tienen calendario propio, así que **se apunta al descargar**. Por cada hoja de G3–G6, Claude añade una línea a `jornadas_hojas.csv`, en la raíz de la carpeta de Drive (`I:\Mi unidad\Descargas aficion fbm\`; si no existe, la crea con la cabecera):

```
archivo;grupo;jornada;local;visitante
estadisticaPartido_10112026 (3).xlsx;G5;4;NUSOTROS;TAURUS
;DOM TAR;4;IMSERSO;MAD FLOWERS
```

- `grupo`: `G3`…`G6` o su nombre de la app (`DOM MAÑ G3`, `DOM TAR`, `SAB TAR G1`, `SAB TAR G2`). `jornada`: el número (o `J4`). `local` y `visitante`, como en la app (el local primero).
- `archivo`: el nombre con que queda el fichero en Drive, si se conoce. Si va vacío, cuenta el partido (grupo + local + visitante), que no se repite en la fase.
- Las descargas se hacen **jornada a jornada y en orden** (así se dedujo la jornada de las 58 primeras, D186).
- Las actas no van a ese registro; G1 y G2 tampoco (su jornada sale del calendario).
- **Partido sin hoja o incomparecencia** (fix/g5-rutina-s21-y-repaso): la cabecera lleva además `marcador;fecha;hora;motivo` (columnas opcionales; las líneas de siempre las dejan vacías). Se apunta con `archivo` vacío, el marcador oficial de la lista de la jornada y `motivo` «sin hoja» o «incomparecencia» (siempre 20-0; no se presentó el del 0):

```
archivo;grupo;jornada;local;visitante;marcador;fecha;hora;motivo
estadisticaPartido_10112026 (3).xlsx;G5;4;NUSOTROS;TAURUS;;;;
;G5;5;EQUIPO A;EQUIPO B;41-37;07/11/2026;15:15;sin hoja
;G5;5;EQUIPO C;EQUIPO D;20-0;07/11/2026;19:00;incomparecencia
```

  **Una incomparecencia: leer también la clasificación oficial de ese grupo** en la app (los puntos que la FBM le da al que no se presenta dependen de si avisó a tiempo: derrota normal, 1, o sanción; D74) y escribir en `fuentes_fbm/2026-27/resultados_sin_hoja.csv`, columna `pts_no_presentado` de ese partido, los puntos **de ese partido**: total oficial − 2·G − 1·(P − incomparecencias). Si aún no sale, se deja vacía: su casilla dice «pendiente de la oficial» y el orden del grupo es provisional.

  `npm run jornada` copia el marcador a `fuentes_fbm/2026-27/resultados_sin_hoja.csv` (**fuera de git**: los marcadores de G3–G6 son privados, D184/D186) y deja en `data/jornadas_grupos_ajenos_2026-27.json` solo el hueco (emparejamiento y motivo, sin marcador). `db:liga` lo carga como partido con marcador y sin filas por jugador: cuenta en la clasificación calculada del grupo (la incomparecencia, como D74: gana el que se presenta, con el 20-0, y los puntos del que no se presenta quedan «pendiente de la oficial») y en Resultados sale con su marcador y «sin hoja» o «incomparecencia de <equipo>». Para (con `--no-interactivo`): una incomparecencia que no sea 20-0, un marcador o una fecha que no se entienden, o un partido que ya tiene hoja.

`npm run jornada` lee el registro: copia la hoja como `liga_J04_G5_…` y **anota el partido** en `data/jornadas_grupos_ajenos_2026-27.json` (público: solo grupo, jornada, local, visitante, hoja y comprobado, nunca marcadores, D186); de ahí lo toma `db:liga`. **Si una hoja de G3–G6 llega sin jornada, se carga igual (`liga_J--_…`) y se avisa**: no para la rutina; la jornada se apunta a mano en ese fichero (con el nombre de la copia en `hoja`). Lo que **sí para** (con `--no-interactivo`): una línea del registro mal escrita (grupo o jornada que no existen), un registro que dice otro partido para ese fichero, una jornada distinta de la que ya tenía ese partido en el fichero de datos o un equipo que ya juega esa jornada.

**Entrada al pipeline:** `npm run jornada` mira **Descargas y esa carpeta (con sus subcarpetas, p. ej. `respaldo_…`; Descargas no)** (`--drive <ruta>` / `MACCABIS_HOJAS_DRIVE` para otra ruta; `--sin-drive` para quitarla). Si la unidad no está montada, avisa y sigue con Descargas. Clasifica cada hoja por su **contenido**: la temporada, por la etiqueta de la cabecera («… - FBM - 26/27»; la hoja **no trae fecha del partido, ni grupo ni jornada**); el grupo, por los equipos; la jornada, del calendario (G1/G2) o, para los otros grupos, del registro de descargas (si falta, `J--` y aviso). Copia sin mover ni pisar y deduplica por contenido (la misma hoja reexportada trae bytes distintos).

**Qué hacer si:**
- **Aviso «sus equipos no están en ningún grupo conocido»:** falta el equipo en `scripts/estadisticas/grupos_fase.json` (G3-G6). Bajar el Excel de clasificación del grupo desde la app (queda en la misma carpeta de Drive, `clasificacion_<fecha>.xlsx`) y regenerar el mapa con `node scripts/estadisticas/mapa_grupos.js --escribir` (no se edita a mano; avisa si un equipo sale en dos grupos). La hoja se queda en la carpeta y se carga en la siguiente pasada.
- **Aviso «la cabecera dice la temporada X»:** hoja de otra temporada (25/26 está fuera de alcance, D183): se aparta sin procesar.
- **Sin hojas nuevas desde el domingo:** mirar que FolderSync del S21 esté activo y que Google Drive para Windows esté sincronizando.

## Reserva descartada por ahora: emulador Android (D69)

Play Store no deja instalar Afición FBM en emuladores ("This app won't work for your device", probado en Android 15 y Android 17 con traducción ARM). Copiarla desde el móvil con adb no fue posible: el cable USB de Iván solo carga, y la depuración inalámbrica falla en su red. Android Studio, el SDK y los dos móviles virtuales siguen instalados en F: por si se retoma con un cable de datos que sí transfiera.

## Aprendizaje

Lunes 5/10/2026: sesión de aprendizaje con las actas de la J1. Iván enseña el camino hasta el acta y la hoja de estadística dentro de Afición FBM; Claude lo registra aquí tras la sesión.

## Alcance: todas las hojas de la jornada de los grupos de la fase (D73 desde la J2; 6 grupos desde el 04/11/2026, D183)

Cada lunes, además de nuestras actas (web, D106) y hojas, se bajan **todas las hojas de estadística de la jornada de los grupos de la fase Moratalaz 26/27** (los nuestros, G1 de MdA y G2 de MdL, y cuatro ajenos: DOM MAÑ G3, DOM TAR, SAB TAR G1 y SAB TAR G2), para seguir a los posibles rivales de playoff. Solo **hojas**: las actas de los partidos ajenos **no** se bajan (Iván, 04/11/2026). El procedimiento en la app, arriba. G1 y G2 salen del calendario; G3-G6, del mapa de `scripts/estadisticas/grupos_fase.json` (D183), con la jornada del registro de descargas (`jornadas_hojas.csv`, D186; `J--` y aviso si falta). **Lo de G3-G6 no se publica**: sus datos por jugador y su clasificación van solo a Supabase con sesión (`db:liga`, D184); en `data/` solo sus emparejamientos (`jornadas_grupos_ajenos_<temporada>.json`, D186). **25/26 queda fuera** (la app no tiene sus datos): una hoja de otra temporada se aparta y se avisa.

`npm run jornada` hace el resto:
- Las hojas de partidos donde no jugamos van a `fuentes_fbm/2026-27/liga/` como `liga_J01_G1_<local>_vs_<visitante>_<hash>.xlsx` (copia segura, fuera de git). La jornada se infiere por fecha (la última ya jugada del grupo); si bajas hojas atrasadas, usa `npm run jornada -- --jornada N`.
- Regenera `data/liga_2026-27.json` (resultados, clasificación calculada y estadísticas por equipo) tras validar que la suma por jugador es el total de cada equipo. Si algo no cuadra, **no escribe nada** y avisa.
- Qué se publica: solo ese JSON (datos por equipo). Los datos por jugador de los rivales **no** se publican: se cargan a Supabase con `npm run db:liga` en `plataforma/` (rama `feat/plataforma-v0`), solo visibles para gestores (D73).
- **Si falta una hoja** (un partido sin descargar), el resumen avisa "faltan hojas" en esa jornada y la clasificación queda incompleta hasta que llegue.
- **Incomparecencias (D74):** no generan hoja (D29). Se anotan en `temporadas.json` (`liga.incomparecencias`: grupo, jornada, local, visitante, no_presentado); el partido se marca y los puntos del equipo que no se presentó se toman de la clasificación oficial de Deportes/web (la de los jueves, rutina B), en `liga.puntos_oficiales`. Hasta entonces, su casilla dice "pendiente de la oficial".
- Tras `npm run jornada`, para llevar los datos por jugador a Supabase: `npm run db:liga -- --confirmar <ref>` en `plataforma/` (reemplaza la temporada entera; el ref del real, D187).
- **Portada de la web y privacidad (D84, D82):** `npm run jornada`, si todo cuadra, comprueba que ningún JSON público lleve motivos de ausencia y sincroniza solo las copias de `plataforma/src/data/` (portada: resultados, clasificación, líderes). Publicar = commit de `data/` y de `plataforma/src/data/`. La asistencia con motivos queda en `privado/asistencia/asistencia_<temporada>.json` (fuera de git): cargarla en Supabase con `npm run db:asistencia` en `plataforma/` (solo gestores, cuando la tabla esté en real).
