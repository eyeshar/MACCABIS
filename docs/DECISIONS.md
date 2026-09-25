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
**Matiz (25/09/2026, ver D30):** vale para la temporada 2026/27. Para 2027/28 la plataforma se construye como **sustituto de SportEasy**; WhatsApp sigue sin tocarse.

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

## D24 — Alias de rivales confirmados por Iván (25/09/2026) — AMPLIADA por D27
**Decisión:** a todos los efectos (trayectoria en los JDM y cara a cara) se tratan como el mismo equipo:
- **Suanzes Motor = SUIZA**
- **VANNER = VANNER PONENOS**

Ninguna otra variante está confirmada. En particular **no** lo están `CARPASION SUIZA`, `CARPASION`, `SUIZA B.C` ni `PONENOS` a secas: van a la tabla "Candidatos a mismo equipo — decide Iván" de `docs/RIVALES_2026-27.md`, con su trayectoria y su cara a cara por separado.
**Por qué:** el emparejamiento de nombres del portal es sólo exacto (tras normalizar mayúsculas, tildes y signos). Un parecido de nombre no demuestra que sea el mismo equipo, y hay homónimos en otros distritos; sólo Iván sabe qué equipos han cambiado de nombre. Los alias viven en `ALIAS_CONFIRMADOS` de `scripts/build_rivales_2026_27.py` y en `alias_confirmados` de `data/rivales_2026-27.json`.

## D25 — La copia bruta del 211549 no se versiona
**Decisión:** `data/raw/` (copias brutas con fecha del dataset 211549) y `.cache-jdm/` (CSV del 300257) quedan en `.gitignore`. Al repositorio sólo va lo que se extrae: nombres de equipo, clasificaciones y marcadores de baloncesto sénior masculino.
**Por qué:** el CSV completo del 211549 incluye todos los deportes, y en pádel los "equipos" se llaman con **nombre y apellidos de personas** (p. ej. "NOMBRE APELLIDO - NOMBRE APELLIDO"). El repositorio es público (D3/D17) y el cierre del bloque exige subir sólo nombres de equipos y marcadores. Los ficheros se regeneran en local descargándolos del portal (URLs en la cabecera del script).

## D26 — Regla del nombre del club (confirmada por Iván, 25/09/2026)
**Decisión:** "El club compitió como MACCABI DE LEVANTAR hasta que otro grupo se quedó con ese nombre. En cuanto aparece MDL en una temporada, el equipo llamado MACCABI DE LEVANTAR de esa temporada NO es el club. MdL y MdA son el mismo club: el cara a cara siempre suma las dos fichas."
**Consecuencia:** `#149233` "MACCABI DE LEVANTAR" (2020/21) **no es del club: es un rival**. La hipótesis del "tercer equipo" de `DIAGNOSTICO_MDL_MDA.md` queda superada, y la conclusión original del bloque de rivales ("#149233 no es del club") era la correcta. Sus partidos contra MdL/MdA cuentan como partidos contra un rival llamado MACCABI DE LEVANTAR.
**Ámbito aplicado:** el distrito del club (Moratalaz), donde "MDL" aparece por primera vez en 2020/21. Leída para todo Madrid, la regla chocaría con las fichas de 2016/17, 2017/18 y 2018/19, porque esas temporadas ya existía otro equipo llamado "MDL" en Retiro. No se ha cambiado nada por eso; queda anotado en Huecos de `docs/RIVALES_2026-27.md` para que Iván lo confirme.
**Por qué:** es conocimiento del club que no está en ninguna fuente de datos. El 0 % de marcadores coincidentes de #149233 con el histórico propio ya apuntaba a lo mismo; la clasificación interna del Excel sólo demostraba que jugaba en el mismo grupo.

## D27 — Alias de rivales ampliados (confirmados por Iván, 25/09/2026)
**Decisión:** amplía D24. Son el mismo equipo a todos los efectos (trayectoria, temporadas en los JDM, mejor resultado y cara a cara):
- **Suanzes Motor** = SUIZA = CARPASION SUIZA = CARPASION = SUIZA B.C. (y SUIZA B. C., SUIZA B.C)
- **VANNER** = VANNER PONENOS (ya estaba en D24)
- **NABUCO TD** = NABUCO
- **LOS KHINKIS RUSOS** = LOS KINKIS RUSOS = KHINKIS RUSOS, más el apodo "KINKIS" del histórico propio (sólo para el cara a cara: no se busca en el portal, donde podría ser otro equipo)
- **F.T. FLOPPERS** = FLOPPERS (y Floppers)
- **CASTAÑAZO** = EL CASTAÑAZO
- **VALLEKAS BASKET** = VALLEKAS BASKET THUNDERS

**Descartados por Iván:** SPORTING DE VALLECAS (y todas sus variantes: SPORTING DE VALLEKAS, SPORTING VALLECAS, SPORT. DE VALLECAS, SPORTING) y GSD VALLECAS **no** son VALLEKAS BASKET.
**Siguen sin confirmar:** ENFERMOS DEL BASKET, LITROS DE MAU, Litros de Pahou, JVK - Jugones ValleKas, THE RED BOYS, PONENOS y RH PROPERTIES PONENOS.
**Corrección:** el informe anterior etiquetaba algunos candidatos como "señalado por Iván como posible". Era falso: Iván no señaló ninguno; los propuso el asistente en el chat. La etiqueta pasa a "propuesto en el chat".

## D28 — La pestaña de rivales dibuja su gráfico sin librerías
**Decisión:** el gráfico de trayectoria de "Rivales 26/27" es un SVG generado en el propio `index.html`. No se añade Chart.js ni ninguna otra librería.
**Por qué:** el bloque decía "sin librerías nuevas (Chart.js ya está)", pero **Chart.js no está** en el dashboard: los gráficos existentes (por cuartos, rejilla de la Historia) son CSS. Añadirlo habría sido una librería nueva. Un SVG basta para un gráfico de puntos con huecos sin interpolar, y funciona sin conexión.

## D29 — Incomparecencias: la clasificación es real, pero el scouting ordena por balance en pista (Iván, 25/09/2026)
**Decisión:** no presentarse a un partido **resta puntos** en la clasificación de los JDM, así que la clasificación oficial es **real** aunque PJ ≠ G + P. Para el scouting importa más el balance de los partidos jugados:
- Si en 2025/26 un rival tiene derrotas por incomparecencia (estado "N" en el portal) y explican exactamente la diferencia PJ − (G + P), la tarjeta dice **"N incomparecencias"** junto al puesto, con el aviso *"No presentarse resta puntos: la clasificación oficial es real, pero su balance en pista es G-P"*. El ⚠ de "clasificación que no cuadra" se reserva para lo que las incomparecencias **no** explican (p. ej. MEJORADA 2012 C.B., de un grupo sin partidos en el portal con el que contrastar).
- Las tarjetas de la pestaña se ordenan por **% de victorias en partidos jugados, G/(G+P), en 2025/26**; si empatan, por el puesto oficial; los que no tienen rastro, al final. El puesto que se muestra sigue siendo el oficial.
**Caso de control:** 28500, 13-5 en pista y 11º/11 oficial por 2 incomparecencias, pasa a 3º del grupo del MdL en el orden de la pestaña.

## D30 — SportEasy se mantiene en 26/27; la plataforma se construye para sustituirlo en 27/28 (Iván, 25/09/2026)
**Decisión:** la suscripción de SportEasy de 2026/27 ya está pagada, así que esta temporada **se mantiene y se aprovecha al máximo** (calendario, disponibilidad, asistencia). En paralelo, la plataforma se construye con el objetivo de **sustituir a SportEasy en 2027/28**. **Matiza D5** a partir de esa fecha: D5 ("WhatsApp y SportEasy se mantienen") sigue vigente durante 26/27; WhatsApp no se sustituye nunca.
**Por qué:** SportEasy no resuelve la doble ficha (dos campeonatos por año), no tiene API pública y obliga a Iván a hacer de pegamento manual. Pagar una temporada más y exprimirla da tiempo a construir el sustituto con pantallas reales delante, sin dejar al equipo sin herramienta a mitad de curso.
**Primera función candidata a sustituir:** la confirmación de disponibilidad (ver BACKLOG).

## D31 — Carga masiva del calendario en SportEasy con un agente supervisado (Iván, 25/09/2026)
**Decisión:** se aprueba usar un **agente supervisado** (control del navegador) para la carga **única** del calendario de 26/27 en SportEasy: ~44 partidos en **dos campeonatos** (uno por ficha). Condiciones:
1. **Antes**, Iván comprueba si la liga JDM Moratalaz está en la sección **"Campeonatos"** de SportEasy. Si está y trae el calendario, el agente no hace falta.
2. **Piloto previo de 2 partidos** (uno por campeonato) revisado por Iván antes de cargar el resto.
3. El agente trabaja sobre una **tabla limpia preparada por Code** (fecha, hora, pista, rival, local/visitante, campeonato). **No interpreta el calendario**: sólo transcribe filas ya validadas.
**Por qué:** crear ~44 eventos a mano es exactamente el trabajo de pegamento que se quiere quitar a Iván, y la importación por Excel de SportEasy no es autoservicio (hay que pedir plantilla a soporte). Un agente que transcribe una tabla ya revisada es auditable fila a fila; uno que interpreta un calendario no lo es.
**Riesgo anotado:** las condiciones de uso de SportEasy sobre acceso automatizado se revisaron en el sondeo de `docs/SPORTEASY.md`; el agente actúa en la sesión de Iván, a ritmo humano y una sola vez.
**Matizada por D36 (25/09/2026):** el agente pasa a **plan B**; la vía principal es la plantilla Excel del soporte de SportEasy.

## D32 — La migración a Next.js sigue, por detrás de actas automáticas y convocatorias (Iván, 25/09/2026)
**Decisión:** la migración del dashboard a Next.js + Supabase + Vercel **continúa**, pero con prioridad **por detrás** de (1) la descarga automática de actas y estadísticas y (2) las convocatorias con doble ficha. Modifica el orden de D6 para la temporada 26/27.
**Por qué:** con la liga a punto de empezar, lo que ahorra horas a Iván cada semana son las actas y las convocatorias. La web estática actual sigue funcionando y publicada.

## D33 — Regla de negocio de la doble ficha en 26/27 (Iván, 25/09/2026)
**Decisión:** un jugador inscrito en las dos fichas **puede jugar con el MdA y con el MdL el mismo domingo sólo si los horarios de los dos partidos no se solapan**. La convocatoria la decide Iván con criterios propios, que **se documentarán como reglas explícitas** antes de automatizar nada (ver BACKLOG, "Reglas de convocatoria").
**Consecuencia técnica:** la hora de cada partido es un dato **imprescindible**; sin ella no se puede aplicar la regla. El calendario que se prepare para 26/27 tiene que traer fecha, **hora** y pista de cada partido. Qué se considera "solapar" (duración de un partido, margen entre pistas) es una de las reglas que Iván tiene que fijar.
**Contexto:** 22 de los 24 deportistas de 26/27 están inscritos en las dos fichas (ver `docs/PLANTILLA_26-27.md`).

## D34 — La convocatoria nueva entra en la jornada 3 (Iván, 25/09/2026)
**Decisión:** el flujo nuevo de convocatoria se estrena en la **jornada 3 (aprox. 18/10/2026)**. Las jornadas 1 y 2 se convocan **como hasta ahora**.
**Por qué:** da margen para fijar las reglas de convocatoria, tener el calendario con horas y probar el flujo sin arriesgar el arranque de la liga.

## D35 — Actas y estadísticas: descarga manual de Iván con un solo gesto; no se pide permiso a la FBM (Iván, 25/09/2026)
**Decisión:** las actas (PDF) y las hojas de estadística (XLSX) las descarga Iván desde la app Afición FBM, **sin renombrar nada**, y el pipeline hace el resto (`npm run jornada`: copia a `fuentes_fbm/`, valida contra el marcador, genera y resume). **No se pedirá permiso a la FBM por ahora.** Se investigó la vía de datos abiertos por jugador: **no existe** (ver `docs/SONDEO_ACTAS_FASE0.md`, apartado 6).
**Por qué:** Iván no quiere depender de un permiso de la FBM. La descarga automática de la app va contra el robots.txt y los avisos legales de la FBM, y los datos abiertos del Ayuntamiento no traen estadística individual. Un gesto semanal de Iván es la única vía legal y autónoma para los puntos por jugador.

## D36 — Calendario en SportEasy: plantilla del soporte como vía principal; agente supervisado como plan B (Iván, 25/09/2026)
**Decisión:** el calendario de 26/27 se carga en SportEasy con **la plantilla Excel que da su soporte**, rellenada con la tabla limpia que genera Code (`data/sporteasy_calendario_2026-27.csv`). El **agente supervisado** de D31 queda como **plan B**, pendiente de que Iván lea el texto literal de la cláusula (copiado en `docs/SPORTEASY.md`) y decida si lo mantiene. Matiza D31.
**Por qué:** la plantilla del soporte no tiene ningún riesgo con las condiciones de uso; el agente sí tiene uno discrecional (9.2, "actions contrary to SportEasy's commercial interests").

## D37 — Los recordatorios a quien no contesta los cubre SportEasy Premium (Iván, 25/09/2026)
**Decisión:** Iván tiene SportEasy **Premium**, que incluye la relance automática y el recordatorio manual. **No se construyen recordatorios propios.**
**Por qué:** ya están pagados y funcionan; duplicarlos sólo daría dos avisos al mismo jugador.

## D38 — La liga de Moratalaz empieza el 4/10/2026 (Iván, 25/09/2026)
**Decisión:** la jornada 1 de 2026/27 es el **domingo 4/10/2026**, antes que el resto de la competición sénior (17/10). Todo lo necesario para la jornada 1 (plantilla, pipeline de estadísticas) tiene que estar listo antes.
**Consecuencia:** es probable que el dataset abierto 211549 no publique nuestro grupo a tiempo. El calendario tiene un plan B manual (`data/calendario_manual_2026-27.csv`) y el pipeline no depende del calendario para funcionar.

## D39 — Los niveles A/B/C son confidenciales (Iván, 25/09/2026)
**Decisión:** los niveles de jugador (A titular / B / C) sólo los ven **Iván, Carlos Barreiro y Eduardo Martín-Ortega**. Hasta que exista la zona de gestión con login real (D1), viven **sólo en `privado/`**, fuera de git. Nunca entran en el repositorio público ni se copian a `data/`. Lo mismo para posición, base secundario, si dobla y si entrena.
**Por qué:** es información sobre personas que puede herir y que un jugador no debe ver. El repositorio es público y la web estática no puede proteger nada (D1).

## D40 — Reglas de convocatoria v0 documentadas; se validan con las jornadas 1 y 2 (Iván, 25/09/2026)
**Decisión:** las reglas de convocatoria quedan escritas en `docs/REGLAS_CONVOCATORIA.md` (v0, sin nombres ni niveles). Las jornadas 1 y 2 las convoca Iván **con ayuda del chat de diseño, aplicando estas reglas a mano**; lo que falle o falte se anota para la v1. No se construye nada hasta entonces (la convocatoria nueva entra en la jornada 3, D34).
**Por qué:** automatizar reglas que nadie ha probado sólo automatiza errores. Dos jornadas reales dicen qué regla se queda corta.

## D41 — Las fuentes nunca se sobrescriben y el pipeline de fichas falla antes que perder una hoja (25/09/2026)
**Decisión:** (1) Nada copia a una carpeta de fuentes (`docs/Fichas/`, `docs/estadisticas/`, `fuentes_fbm/`) sin comprobar antes, **sin distinguir mayúsculas**, si ya existe el nombre: si existe y es distinto, se para (`scripts/lib/copia_segura.js`). (2) `consolidar_fichas.js` **falla sin escribir** si falta el PDF de una hoja registrada o si el PDF con ese nombre ya es otra hoja. (3) Las hojas cuyo PDF se perdió de verdad se **congelan** en `docs/fichas_sin_pdf.json` (decisión de Iván, nunca un apaño): así la de **Torneos 2018 del MdL**, sobrescrita el 25/09/2026, con sus 17 nombres recuperados del historial de git. (4) La **fecha de alta** de las hojas de 26/27 no se publica (D17).
**Por qué:** Windows no distingue mayúsculas, y copiar `MdL.pdf` borró `MDL.pdf` sin avisar. Un script que borra en silencio lo que ya no encuentra convierte un despiste en pérdida de datos.

## D42 — Calendario desde datos abiertos: por código de equipo y con descarga a botón (25/09/2026)
**Decisión:** el calendario y los marcadores salen del dataset 211549 identificando MdA y MdL **por `Codigo_equipo`**, que se confirma cada temporada (con `--descubrir` y el acta de la jornada 1). El workflow de GitHub **programado sólo lee metadatos** (permitido por el robots.txt) y avisa si hay datos nuevos; **la descarga del CSV la lanza una persona** con un botón. Rama `feat/calendario-automatico`, sin mergear.
**Por qué:** el robots.txt de datos.madrid.es veta a los bots la ruta de descarga; una descarga semanal programada lo incumpliría. Los nombres no sirven de identificador (homónimos, D26).

## D43 — Pipeline de estadísticas en Node; la 2025/26 publicada no se regenera (25/09/2026)
**Decisión:** el pipeline vive en `scripts/estadisticas/` (Node), lee de `fuentes_fbm/<temporada>/` (fuera de git) y forma parte de `npm run build:datos`. Reproduce `data/season_2025-26.json` (test de regresión: sólo difiere en hora y pista, nuevas, y en tres correcciones del pipeline antiguo). **La 2025/26 publicada no se regenera**: de sus 41 hojas XLSX sólo queda una en el equipo (las demás se subieron al chat); el generador se niega a dejar una temporada con menos partidos o boxscores de los que tiene. Rama `feat/pipeline-estadisticas`, sin mergear.
**Por qué:** el pipeline de 25/26 leía de una carpeta del chat de Claude y no era reproducible. Los ficheros de la FBM traen datos de terceros (rivales, árbitros) y nunca van al repositorio público.

---
## Bloque "Plataforma v0: identidad, zona personal y pedido de ropa" (26/09/2026)
_D44–D54: decisiones (a)–(k) de Iván en el chat de diseño, tras contrastarlas con otras dos IA. D55–D57: decisiones técnicas de Code en este bloque._

## D44 — SportEasy sale de la operativa desde la jornada 2 (Iván, 26/09/2026) — SUSTITUYE a D30 y deja sin efecto D31 y D36
**Decisión:** desde la **jornada 2 (11/10/2026)** la disponibilidad (partidos y entrenos) y la convocatoria van **solo por nuestra web**. En SportEasy **no se crean los partidos de liga ni se pide respuesta**; queda como **respaldo dormido hasta noviembre**, cuando se decide si se apaga. No se carga el calendario en SportEasy: ni plantilla del soporte (D36) ni agente supervisado (D31).
**Por qué:** dos sistemas pidiendo lo mismo al jugador duplican el trabajo de Iván, que es justo lo que se quiere quitar; y la doble ficha no encaja en SportEasy.
**Consecuencia:** D37 (recordatorios de SportEasy Premium) deja de aplicarse cuando SportEasy se duerma; el recordatorio pasa a ser un mensaje de WhatsApp que prepara la plataforma (bloque siguiente). Antes de apagarlo hay que exportar el balance de asistencias (BACKLOG).

## D45 — Identidad: enlace personal secreto para jugadores; login real para los 3 gestores (Iván, 26/09/2026)
**Decisión:** cada jugador tiene un **enlace personal secreto** (`/j/<token>`, token largo, revocable y regenerable) que hace de inicio de sesión: le da acceso a su zona personal y **solo le deja modificar lo suyo**. Los gestores (Iván, Carlos Barreiro, Eduardo Martín-Ortega) entran con **login real de Supabase Auth**. Cierra la "Decisión pendiente" del BACKLOG a favor de la opción (b).
**Por qué:** cero fricción para 24 adultos (sin contraseñas que olvidar) y control real para los gestores. El riesgo (si se reenvía, otro entra por él) se asume y se mitiga: el mensaje de bienvenida pide no reenviarlo y el botón "Regenerar" anula el viejo al momento.

## D46 — Qué ven los jugadores (Iván, 26/09/2026)
**Decisión:** en cada evento los jugadores ven **quién va, quién no va y quién falta por contestar**, solo con nombres. **Nunca** niveles, posiciones, motivos de ausencia ni nada del motor de convocatoria. **Disponibilidad y convocatoria son conceptos distintos** (estar disponible no es estar convocado).

## D47 — El calendario propio es la fuente de verdad (Iván, 26/09/2026)
**Decisión:** el calendario lo cargan los gestores en la plataforma. Las fuentes externas (Ayuntamiento, datos abiertos) **solo detectan cambios y los proponen** con Aceptar/Ignorar. **Ningún cambio externo se aplica solo** y todo cambio queda registrado (qué, fuente, quién lo aceptó y cuándo). Matiza D42: el calendario de datos abiertos pasa a ser un **detector de cambios**, no la fuente.

## D48 — Motor de convocatoria determinista y por fases (Iván, 26/09/2026)
**Decisión:** en la **J3** el motor aplica **solo restricciones duras** (fichas, doblaje sin solapes, mínimos por posición, topes). **Nivel frente al rival y rotación** entran entre la **J4 y la J6**. Cada ajuste manual del gestor queda registrado con su motivo. Mismas entradas, misma propuesta.

## D49 — SportMember descartado; una sola consulta a Indalweb (Iván, 26/09/2026)
**Decisión:** SportMember queda descartado (salvo que se echen mucho de menos los recordatorios automáticos). Se hace **una única consulta** a Indalweb (soporte@gesdeportiva.es) sobre una exportación oficial; si dicen que no, el tema se cierra y sigue D35.

## D50 — Qué se replica de SportEasy y qué no (Iván, 26/09/2026)
**No se replica:** alineación en pista, tareas, foro, mensaje del entrenador y sus estadísticas.
**Sí se replica:** calendario **único** para MdA y MdL (una sola competición con la etiqueta de equipo en cada partido); eventos (entreno recurrente, liga, amistoso, torneo, otro) con rival, jornada, hora, hora y lugar de quedada, pista y casa/fuera; disponibilidad con estado "sin responder"; **pase de lista** posterior (a tiempo, retraso, con excusa, sin excusa, lesionado; por defecto se copia la respuesta); balance de asistencia; plantilla con roles; iCal. Los gestores crean y editan eventos.

## D51 — Sanciones: estado manual del jugador (Iván, 26/09/2026)
**Decisión:** "sancionado hasta la jornada X" es un estado manual que pone un gestor; el motor no convoca a un sancionado. Salvo que aparezca una fuente fija (ver `docs/SONDEO_CALENDARIO_AYTO.md`).

## D52 — Tesorería futura: solo registro de cuentas (Iván, 26/09/2026)
**Decisión:** sin cobros por la web. Tampoco en el pedido de ropa: el precio se muestra como orientativo, "por confirmar".

## D53 — Excepción temporal a "staging antes de producción" (Iván, 26/09/2026)
**Decisión:** mientras no haya datos que romper, **un solo proyecto de Supabase**. El staging se crea con el bloque de calendario y disponibilidad (J2).

## D54 — El pedido de ropa es el primer uso real de la plataforma (Iván, 26/09/2026)
**Decisión:** el pedido de ropa (proveedor VIVE) estrena la plataforma y sirve para **repartir los enlaces personales**. Prendas y lo que llevan impreso (confirmado por Iván): camiseta de juego (nombre + dorsal + talla), pantalón (dorsal + talla), cubre (nombre + dorsal + talla; vale como segunda camiseta de juego), sudadera/chaqueta (nombre + talla).

## D55 — Arquitectura de la plataforma v0 (Code, 26/09/2026)
1. La app Next.js vive en **`plataforma/`**, dentro del mismo repositorio. La web de GitHub Pages (raíz: `index.html` + `data/`) **no cambia**. Vercel apunta a `plataforma/` (Root Directory).
2. **RLS en todas las tablas y ninguna política para anónimos.** Los jugadores no tocan tablas: usan 4 funciones de la base de datos (`zona_jugador`, `guardar_pedido`, `anular_pedido`, `dorsal_cogido`) que reciben el token, localizan a SU jugador y solo devuelven o cambian lo suyo. El aislamiento entre jugadores lo garantiza la base de datos, no el código de la web.
3. Los gestores trabajan con su sesión y políticas `is_gestor()`. **La service role key no se usa en la app** (ni está en Vercel); los scripts locales usan la cadena de conexión de `plataforma/.env.local`, fuera de git.
4. Token de 64 caracteres hexadecimales (244 bits aleatorios), guardado en claro porque los gestores tienen que poder copiar el mensaje en cualquier momento; solo ellos pueden leerlo (RLS).
5. Cabeceras `Referrer-Policy: no-referrer` (el enlace no viaja a otras webs, p. ej. al pulsar "Ver mi ficha") y `noindex` en todo.
6. Migraciones versionadas en `plataforma/supabase/migrations/`, registradas en la misma tabla que usa la CLI de Supabase.
**Por qué:** así "un jugador solo toca lo suyo" es verificable con pruebas contra la base de datos real (`npm run pruebas`).

## D56 — Dorsal repetido: el jugador no puede; el gestor sí, con aviso (Code, 26/09/2026)
**Decisión:** dentro de una campaña, si un dorsal ya está en otro pedido que lleva número (camiseta, pantalón o cubre), al **jugador** se le dice solo "Ese dorsal ya está cogido" y **no puede enviar** con él (la base de datos lo rechaza, sin decir de quién). Los **gestores** pueden guardar un dorsal repetido (con aviso) y ven la lista de repetidos **con nombres**. Un pedido solo de sudadera no lleva dorsal.
**Pendiente de Iván:** si quiere que un familiar pueda llevar el mismo dorsal que el jugador (p. ej. un hijo con el número del padre), hoy tiene que añadirlo un gestor.

## D57 — Excel para VIVE idéntico a la plantilla 24/25 (Code, 26/09/2026)
**Decisión:** el Excel reproduce celda a celda el formato de `privado/LISTADO MACCABIS 2024 (revisado).xlsx` (comparador automático: 196 celdas, "IGUAL"), incluidas la fila vacía con bordes del final y el relleno blanco de las celdas vacías de la columna E, restos de edición a mano. La talla se escribe como en la lista de VIVE ("3XL"), aunque la plantilla antigua ponía "XXXL". De la plantilla solo se copia el formato; nunca sus datos, y no entra en git.

## D58 — Proyecto Supabase sin permisos automáticos: todo explícito y mínimo (Iván + Code, 26/09/2026)
**Contexto:** Iván creó el proyecto (región Europa) **desmarcando "Automatically expose new tables"** y **sin "Enable automatic RLS"**, con el registro libre de usuarios desactivado.
**Decisión:** la migración `20260926110000_…` da los permisos a mano y solo los necesarios: `authenticated` lee y escribe `jugadores`, `campanas_ropa` y `pedidos_ropa` y lee `enlaces`, `gestores` y la vista de dorsales repetidos (siempre filtrado por RLS + `is_gestor()`); `anon` **no tiene ningún permiso sobre tablas** y solo puede ejecutar las 4 funciones que exigen enlace (`zona_jugador`, `guardar_pedido`, `anular_pedido`, `dorsal_cogido`). Las funciones nuevas de `public` ya no nacen ejecutables por cualquiera (`alter default privileges`).
**Evidencia (proyecto real, 26/09/2026):** `information_schema.role_table_grants` no devuelve nada para `anon`; `has_function_privilege('anon', …)` solo es cierto para esas 4.

## D59 — RLS automática con un event trigger (Iván + Code, 26/09/2026)
**Decisión:** equivalente propio de "Enable automatic RLS": el event trigger `rls_automatica` activa RLS en cualquier tabla que se cree en `public` (`CREATE TABLE`, `CREATE TABLE AS`, `SELECT INTO`). Así una tabla futura nunca nace abierta aunque alguien olvide activarla.
**Evidencia:** en el proyecto real se creó y se borró `public.prueba_rls_automatica`: nació con RLS.

## D60 — Dorsal: único solo entre pedidos de jugadores; el del familiar es libre (Iván, 26/09/2026) — MODIFICA D56
**Decisión:** los dorsales solo tienen que ser únicos entre los pedidos **para el propio jugador** (`para = 'yo'`). En un pedido **para un familiar** el dorsal es libre: no se comprueba, no avisa y no aparece en "Dorsales repetidos" de los gestores. Lo demás de D56 sigue: al jugador, "Ese dorsal ya está cogido" sin decir de quién; el gestor puede forzarlo con aviso.

## D61 — Nombres visibles confirmados (Iván, 26/09/2026)
**Decisión:** "Julio" (De Carvalho), "Luis" (Varas) y "Carlos (entrenador)" (Barreiro). El resto, los motes de `docs/PLANTILLA_26-27.md`; quien no tiene mote, su nombre de pila (Carlos Baños queda como "Carlos"). Se cambian desde "Jugadores y enlaces".
