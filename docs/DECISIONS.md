# DECISIONS — Proyecto Maccabis

> Decisiones tomadas y su porqué. Para no re-discutir lo ya cerrado y entender el razonamiento.

## D1 — Plataforma con login real (Supabase), no web estática con contraseña
**Decisión:** montar una plataforma Next.js + Supabase con autenticación real y RLS.
**Por qué:** la zona de gestión contendrá información sensible de verdad (tesorería, datos personales, decisiones sobre personas). Una web estática pública (GitHub Pages) no puede guardar secretos: una contraseña en el código JS es un "cartel de no pasar", no una cerradura. Para datos reales hace falta control de acceso de servidor (RLS). Iván eligió esta opción (Opción 2) conscientemente.

## D2 — Reutilizamos la METODOLOGÍA de TCPC, no su STACK completo por defecto
**Decisión:** heredar el flujo de trabajo de Tres Cantos (prompts consolidados, docs de continuidad, Claude Code autónomo, ser crítico, staging antes de prod), y usar su stack (Next.js+Supabase+Vercel) SOLO porque ahora el login lo justifica.
**Por qué:** TCPC usa ese stack por tener 140 jugadores, menores, RLS compleja y APIs de federación en vivo. Maccabis es mucho más pequeño (~24 adultos, sin menores, sin datos en vivo). El stack se adopta por la necesidad de login/gestión, no por imitación. Si esto fuera solo estadísticas, la web estática habría bastado.

## D3 — Sin capa de privacidad de menores
**Decisión:** no replicar la protección de menores de TCPC.
**Por qué:** todos los jugadores de Maccabis son adultos. PERO sí hay datos personales sensibles de adultos (DNIs, teléfonos, nacimiento, tesorería) → van en zona protegida, nunca en la pública.

## D4 — Relación con SportEasy: puente por Excel (Opción A "realista")
**Decisión:** la plataforma "bebe" de SportEasy vía exportación manual a Excel (subir archivo), no en tiempo real. Genera mensajes de WhatsApp y archivos de importación para SportEasy listos para copiar/pegar, pero no envía ni sincroniza sola.
**Por qué:** SportEasy NO tiene API pública (ver SPORTEASY.md). Prometer sincronía en vivo sería engañar. El export/import de Excel es lo que su sistema permite y es estable. Aun así, Iván quiere PRESIONAR por vías alternativas de sacar/subir datos antes de dar Excel por definitivo. Excel es el plan B confirmado si no aparece nada mejor.

## D5 — WhatsApp y SportEasy se mantienen; la plataforma sustituye a los Excel
**Decisión:** no crear una "cuarta herramienta" que competir con las existentes. WhatsApp (día a día) y SportEasy (registro oficial) siguen. La plataforma reemplaza el trabajo manual en Excel y se convierte en el centro de mando.
**Por qué:** si la plataforma no se integrara en el ecosistema, Iván tendría MÁS herramientas que gestionar, no menos. El valor está en matar el Excel manual, no en añadir otra cosa.

## D6 — Orden de construcción: lo público primero, convocatorias al final
**Decisión:** construir en este orden: (1) zona pública estadísticas → (2) histórico del club → (3) login + zona de gestión → (4) convocatorias.
**Por qué:** las convocatorias son el mayor dolor PERO lo menos urgente (la liga empieza en octubre). Empezar por lo público (casi listo) da una victoria rápida, enseña a Iván a trabajar con Claude Code en este stack, y permite diseñar la gestión con pantallas reales delante en vez de en abstracto. Iván reconoce que aún no tiene claridad sobre la zona de gestión; construir lo claro primero da esa claridad.

## D7 — Integrar histórico de temporadas anteriores
**Decisión:** integrar las estadísticas de Carlos (23/24, 24/25, ambos equipos) como temporadas históricas en el modelo de estadísticas, y crear una sección visual "Historia de los Maccabis" (2013-2026) aparte.
**Por qué:** hay material valioso. PERO los formatos de Carlos NO son homogéneos entre temporadas ni entre equipos (los .xlsx de MdA y los .xls de MdL tienen estructuras distintas, con hojas separadas de Puntos/Faltas/Triples/etc.). Requiere normalización cuidadosa temporada por temporada. (Pendiente de decidir si el histórico de Carlos entra en el mismo dashboard con el selector de temporadas o va aparte — se decidirá al construirlo.)

## D8 — El histórico va en el MISMO dashboard, con selector de temporada
**Decisión:** las 10 temporadas históricas (13/14–24/25) se sirven como un `data/season_YYYY-YY.json` cada una, con el mismo esquema que la 25/26, y se eligen con el selector de temporada del dashboard actual. No hay una web ni una sección aparte.
**Por qué:** el esquema de 25/26 ya soportaba multitemporada (`data/index.json` + selector), así que reutilizarlo cuesta menos que mantener dos vistas. El histórico se adapta al esquema existente, nunca al revés: la 25/26 no se ha tocado. Cierra el punto que D7 dejaba abierto.

## D9 — Cada temporada declara sus métricas; la interfaz oculta lo que no existe
**Decisión:** cada JSON histórico lleva un bloque `metrics` con lo que la fuente recogía ese año. El dashboard oculta columnas, controles y pestañas sin datos en vez de pintar ceros o guiones. Si un JSON no trae `metrics` (caso 25/26), se asume todo disponible.
**Por qué:** la liga no registraba lo mismo cada año. Antes de 23/24 no hay minutos, y nunca hubo valoración, +/−, intentos de campo, fechas, dorsales ni parciales por cuarto del MdL. Una tabla llena de "—" da la impresión de datos perdidos cuando en realidad nunca existieron. El valor por defecto permisivo garantiza que la 25/26 siga funcionando exactamente igual.

## D10 — Sin minutos, las medias son por partido jugado
**Decisión:** en las 8 temporadas sin minutos, el denominador de las medias es el número de partidos con participación real. Los "NJ" (No Jugó) cuentan como convocatoria pero quedan fuera del denominador.
**Por qué:** es el equivalente honesto de la regla de 25/26 ("sólo partidos con minutos"). Decisión de Iván, ya recogida en el diccionario de nombres.

## D11 — Ruido y no catalogados: fuera de los rankings, dentro del marcador
**Decisión:** los motes de tipo `ruido` (NS, "No sabemos", "(coach)") y `sin_catalogar` (Eric, Lonchas, y los motes del MdA que el diccionario no cubre) no generan ficha de jugador ni entran en rankings, pero sus puntos permanecen en el total de equipo y aparecen como fila propia en el boxscore.
**Por qué:** si se descartan, los boxscores dejan de cuadrar con el marcador del acta y el dato deja de ser verificable. Mostrarlos como fila sin ficha mantiene la trazabilidad sin atribuir puntos a nadie.

## D12 — Las canastas de 2 son derivadas; lo que no está en la fuente se deja ausente
**Decisión:** los 2P anotados se calculan como `(PTS − 3·3P − TL anotados) / 2`. Si el resultado no es un entero no negativo, el dato se deja ausente y se registra la incidencia. Nunca se rellena a ojo. Lo mismo con los partidos cuya estadística individual no se conserva ("SD" o bloques vacíos): consta el marcador, pero no se fabrica boxscore.
**Por qué:** la derivación es aritmética exacta sobre datos que sí están, no una estimación. Cuando falla es señal de que la fuente está incompleta, y eso hay que verlo, no taparlo.

## D13 — Un único registro de identidades: `data/personas.json`
**Decisión:** los `person_id` viven en un solo sitio, `data/personas.json`, generado por `scripts/build_personas.js`. Guarda únicamente identidad (id canónico, nombre formal, display) y dos banderas (`es_entrenador`, `solo_mote`). La pertenencia al club por temporada vive en `data/historia_club.json` y el rendimiento en `data/season_*.json`; ambos referencian el mismo id y no duplican nombres.
**Por qué:** con la Historia entraban 76 personas y las estadísticas ya tenían 59 identidades propias. Sin un registro común habría dos listas de nombres divergiendo con cada temporada. Separar identidad / pertenencia / rendimiento evita que un cambio de nombre obligue a tocar once ficheros de temporada.

## D14 — Los ids se derivan del nombre formal, y las variantes se resuelven con alias explícitos
**Decisión:** `person_id = slug(nombre formal)` (NFD sin diacríticos, minúsculas, no alfanumérico → `-`). Cuando la misma persona aparecía escrita de dos formas se elige un id canónico, se corrigen **ambos** lados y la escritura retirada queda anotada en `alias_ids`. Las tres unificaciones aplicadas el 04/08/2026 están declaradas en la constante `ALIAS` de `scripts/build_personas.js`, cada una con su justificación.
**Por qué:** derivar el id del nombre lo hace reproducible y auditable, pero las fuentes escriben los nombres de forma distinta ("Robert"/"Roberto", con o sin segundo apellido). Un mapa de alias corto y comentado es preferible a un id opaco: se puede revisar de un vistazo y revertir. **Ninguna unificación se hizo por parecido de nombre**: las tres se confirmaron cruzando apellidos Y temporadas.

## D15 — Lo que no se puede confirmar no se fusiona: se reporta
**Decisión:** cuatro personas con estadísticas (Ferrando del Rincón, Mora-Gil Jiménez, Páez García y Vallesi) no aparecen en la matriz de historia. No se han inventado filas ni se han fusionado con nadie parecido: quedan en el registro como identidades propias, marcadas `en_historia: false`, y el script las avisa en cada ejecución.
**Por qué:** había candidatos superficialmente parecidos (otro Ramón, otro Javier, otro Ignacio) que son personas distintas. Fusionar por similitud de nombre habría atribuido estadísticas a quien no las jugó. Un aviso recurrente es más barato que un dato falso.

## D16 — Jerarquía de fuentes sobre quién estuvo en el club
**Decisión:** ante desacuerdo manda, por este orden: (1) **estadísticas** de `season_*.json`, que salen de actas oficiales — si alguien tiene ficha de estadísticas en una temporada, estuvo ese año y no se discute; (2) **hojas de inscripción** oficiales, como límite inferior fiable; (3) **matriz** de `historia_club.json`, que es un registro manual y el único que puede tener olvidos. La matriz se completa con 1 y 2, **nunca al revés**, y nunca se quita a nadie ni se recorta un año. Cuando hay varias hojas del mismo año y equipo vale siempre la que más jugadores tiene.
**Por qué:** las tres fuentes se contradicen a veces, y sin una jerarquía explícita cada cruce sería una decisión ad hoc. Que la matriz sólo crezca hace la operación segura y repetible: `npm run completar:historia` se puede relanzar sin miedo a perder nada.

## D17 — De los PDF de inscripción sólo sale el nombre
**Decisión:** los PDF de `docs/Fichas` no se versionan (`.gitignore`). De ellos se extrae únicamente temporada, equipo y nombre, y eso es lo que vive en `data/fichas_inscripcion.json`.
**Por qué:** las hojas traen DNI, fecha de nacimiento, teléfono y email de cada jugador, y el repositorio es **público**. La regla del proyecto es que los datos personales sensibles nunca salen a la zona pública (ver D3). El nombre y el año de inscripción no son sensibles: ya se publican en las estadísticas.

## D18 — ~~Las hojas de "Torneos Municipales" no se aplican~~ (DEROGADA por D19, ver D23)
**Decisión:** las hojas cuya cabecera es "TORNEOS MUNICIPALES <año>" quedan registradas con `aplicable: false` y no añaden años a nadie.
**Por qué:** a diferencia de los JDM (donde la edición identifica la temporada sin ambigüedad: 34 JDM = 2013/14), un torneo de primavera puede pertenecer a la temporada que termina o a la que empieza. El propio diccionario de la matriz es ambiguo al respecto. Elegir un año a ciegas metería datos falsos en la fuente de pertenencia; dejarlas marcadas cuesta una decisión de Iván y no pierde nada.


## D19 — Los Torneos Municipales cierran la temporada, no la abren
**Decisión:** una hoja de "TORNEOS MUNICIPALES AAAA" pertenece a la temporada que **termina** en AAAA (año de matriz `AAAA-1`): Torneos 2017 → 2016/17, Torneos 2018 → 2017/18, Torneos 2019 → 2018/19. Liga y torneo del mismo periodo son **una sola temporada** y sus plantillas se **suman**; la regla de "la hoja con más jugadores manda" se aplica sólo al comparar versiones de la misma hoja. Dejaron de jugarse hacia 2018/19.
**Por qué:** eran copas que se disputaban al final del curso, después de la liga regular. Sin esta regla las cinco hojas de torneo quedaban sin aplicar (sustituye a D18). Con ella aparece la plantilla de **2016/17**, el único año del que no había ni hoja propia ni estadísticas, y la matriz pasa a cubrir 2013-2025 sin huecos.

## D20 — Un nombre mal escrito en una fuente oficial sigue siendo un nombre mal escrito
**Decisión:** "Castro Mayo, Henry Luis" y "Mar Calvo, Borja" eran erratas; los nombres correctos son **"Castro Moya, Henry Luis"** y **"Martín Calvo, Borja"**. Se corrigen en el `.md` fuente y se propagan a todo lo generado. Los `person_id` antiguos quedan en `alias_ids`.
**Por qué:** la hoja de inscripción de 2015 escribe "Mar Calvo" y varias escriben "Castro Mayo", pero Iván confirma que son erratas de transcripción del propio ayuntamiento. Que una fuente sea oficial no la hace infalible en la ortografía de un apellido. Los alias garantizan que ningún enlace anterior se rompa.

## D21 — El pipeline se ordena por dependencia de datos, no por comodidad
**Decisión:** `npm run build:datos` va: diccionario → histórico → fichas → completar historia → personas. `completar_historia.js` lee los `season_*.json` **directamente**, nunca el índice de `personas.json`.
**Por qué:** `personas.json` se genera al final, así que leerlo desde un paso anterior arrastra los `person_id` de la ejecución previa. Al corregir dos nombres, eso creó dos identidades fantasma en la matriz. Leer la fuente real en cada paso rompe la circularidad y hace el pipeline idempotente: dos ejecuciones seguidas producen ficheros idénticos.


## D22 — Los dos modos de orden de la rejilla son excluyentes
**Decisión:** la rejilla de la Historia se puede ordenar por **veteranía** (agrupada en tramos: históricos, veteranos, de varias temporadas, de una sola) o por **año de incorporación** (lista plana, **sin** tramos). Nunca las dos cosas a la vez. La cifra dorada de cada fila acompaña al criterio activo: nº de temporadas en el primer modo, temporada de debut en el segundo. El cuerpo técnico se mantiene en su propia sección en ambos modos.
**Por qué:** decisión de Iván. Mezclar los tramos de veteranía con un orden cronológico produce grupos que se leen como saltos hacia atrás en el tiempo y hacen ilegible el criterio. Separar el cuerpo técnico no es una agrupación por veteranía: Barreiro debutó en 2013/14 y aparecería entre las incorporaciones fundacionales pese a no haber jugado nunca.

## D23 — D18 queda formalmente derogada por D19, y el código deja de arrastrarla
**Decisión:** **D18 ("las hojas de Torneos Municipales no se aplican") queda derogada.** La sustituye D19: un torneo cierra la temporada que termina ese año y su plantilla se suma a la de la liga. En consecuencia se ha retirado el filtro `if (!f.aplicable) continue` de `scripts/completar_historia.js`, y **no se repone el campo `aplicable`** en `consolidar_fichas.js`.
**Por qué:** el campo nació con D18, cuando el año de un torneo se consideraba ambiguo. Al adoptar D19, `consolidar_fichas.js` dejó de generarlo, pero el filtro siguió en pie: como ninguna hoja traía ya el campo, la condición pasó a excluirlas **todas**. El síntoma fue que 2016/17 —la temporada que D19 venía justamente a rescatar— se quedó sin sus 4 jugadores nuevos. Reponer el campo habría restaurado el comportamiento de D18; retirar el filtro es lo que deja el código alineado con la decisión vigente.
**Lección operativa:** una decisión derogada no se cierra hasta que el código deja de implementarla. Al cambiar D18 por D19 se cambió el generador pero no el consumidor, y la incoherencia sobrevivió a dos verificaciones porque el efecto era una **ausencia** de datos, no un dato erróneo. Los informes de esos bloques describían lo que la fuente aportaba, no lo que acababa en la matriz; conviene que las verificaciones comparen siempre el resultado final contra el estado anterior.

## D24 — Alias de rivales confirmados por Iván (25/09/2026)
**Decisión:** a todos los efectos (trayectoria en los JDM y cara a cara) se tratan como el mismo equipo:
- **Suanzes Motor = SUIZA**
- **VANNER = VANNER PONENOS**

Ninguna otra variante está confirmada. En particular **no** lo están `CARPASION SUIZA`, `CARPASION`, `SUIZA B.C` ni `PONENOS` a secas: van a la tabla "Candidatos a mismo equipo — decide Iván" de `docs/RIVALES_2026-27.md`, con su trayectoria y su cara a cara por separado.
**Por qué:** el emparejamiento de nombres del portal es sólo exacto (tras normalizar mayúsculas, tildes y signos). Un parecido de nombre no demuestra que sea el mismo equipo, y hay homónimos en otros distritos; sólo Iván sabe qué equipos han cambiado de nombre. Los alias viven en `ALIAS_CONFIRMADOS` de `scripts/build_rivales_2026_27.py` y en `alias_confirmados` de `data/rivales_2026-27.json`.

## D25 — La copia bruta del 211549 no se versiona
**Decisión:** `data/raw/` (copias brutas con fecha del dataset 211549) y `.cache-jdm/` (CSV del 300257) quedan en `.gitignore`. Al repositorio sólo va lo que se extrae: nombres de equipo, clasificaciones y marcadores de baloncesto sénior masculino.
**Por qué:** el CSV completo del 211549 incluye todos los deportes, y en pádel los "equipos" se llaman con **nombre y apellidos de personas** (p. ej. "NOMBRE APELLIDO - NOMBRE APELLIDO"). El repositorio es público (D3/D17) y el cierre del bloque exige subir sólo nombres de equipos y marcadores. Los ficheros se regeneran en local descargándolos del portal (URLs en la cabecera del script).
