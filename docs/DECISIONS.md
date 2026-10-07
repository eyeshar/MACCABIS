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
**Matizada por D62 (02/10/2026):** para 26/27 SportEasy vuelve a usarse a pleno rendimiento (calendario, convocatorias y asistencia de liga), cargado con un agente de navegador. El apagado de noviembre sigue sin decidirse.
**Matizada también por `NORMAS_DE_TRABAJO.md` §8 / D64 (02/10/2026):** la pregunta de "si se apaga en noviembre" queda **cerrada**: SportEasy se mantiene **completo como respaldo hasta septiembre de 2027**, sin apagarlo antes; la plataforma lo sustituye función a función (3 jornadas seguidas sin arreglos a mano + aprobación de Iván).

## D45 — ~~Identidad: enlace personal secreto para jugadores; login real para los 3 gestores~~ (Iván, 26/09/2026) — DEROGADA por D68
**Decisión:** cada jugador tiene un **enlace personal secreto** (`/j/<token>`, token largo, revocable y regenerable) que hace de inicio de sesión: le da acceso a su zona personal y **solo le deja modificar lo suyo**. Los gestores (Iván, Carlos Barreiro, Eduardo Martín-Ortega) entran con **login real de Supabase Auth**. Cierra la "Decisión pendiente" del BACKLOG a favor de la opción (b).
**Por qué:** cero fricción para 24 adultos (sin contraseñas que olvidar) y control real para los gestores. El riesgo (si se reenvía, otro entra por él) se asume y se mitiga: el mensaje de bienvenida pide no reenviarlo y el botón "Regenerar" anula el viejo al momento.
**Derogada (02/10/2026, D68):** Iván decidió el 25/09/2026 sustituir los enlaces por un login único con Google (o código por correo), pero la decisión no llegó a escribirse en los docs a tiempo; D68 la recoge y la aplica. Los enlaces `/j/<token>` y la tabla `enlaces` se retiran del todo.

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

## D62 — SportEasy 26/27 se usa a pleno rendimiento y se alimenta con un agente de navegador (Iván, 02/10/2026) — MATIZA D44
**Decisión:** para la temporada 2026/27 SportEasy no queda como respaldo dormido. Calendario, convocatorias y asistencia de los partidos de liga viven en SportEasy, cargados por un agente de navegador que actúa con la sesión de Iván, y siempre con su aprobación explícita antes de crear o modificar nada. Se mantienen los dos campeonatos ("Temporada MdA" y "Temporada MdL").
**Por qué:** SportEasy ya está pagado para 26/27 y crear unos 40 partidos a mano era justo el trabajo manual que el proyecto quiere eliminar. El agente lo hizo en una sesión, verificando cada partido.
**Qué reabre:** el punto de D44 (26/09/2026) que sacaba a SportEasy de la operativa desde la jornada 2 y cancelaba la carga de calendario (D31/D36, agente y plantilla del soporte). El agente de navegador vuelve a estar en uso, esta vez ya ejecutado. **No queda derogado** el apagado de SportEasy en noviembre que planteaba D44: Iván no lo ha decidido; sigue pendiente (ver BACKLOG).

---
## Bloque "Normas de trabajo y plan 2026/27" (02/10/2026)

## D63 — Rutinas semanales por navegador en el Chrome de Iván, salvo las actas (Iván, 02/10/2026) — MATIZA D35 y D47
**Decisión:** de las tres tareas semanales de la temporada, **dos** se automatizan con **Claude navegando el Chrome de Iván**, con su sesión iniciada: calendario (jueves desde las 20:15, Deportes/web) y disponibilidad/convocatoria (lunes y martes, SportEasy). Cada una sigue el ciclo: aprendizaje con Iván → procedimiento escrito en `docs/RUTINAS/<rutina>.md` → 2 ejecuciones supervisadas → tarea programada.
**Riesgo asumido (B y C):** Deportes/web prohíbe en sus condiciones la extracción automatizada (ver D47, `docs/SONDEO_CALENDARIO_AYTO.md`). Iván asume el riesgo y lo mitiga con: su propia sesión (no una cuenta de servicio), ritmo humano, una ejecución semanal por rutina, y solo sobre documentos del club (nunca datos de terceros). **Matiza D47** (que dejaba las fuentes externas de calendario como meros detectores de cambios propuestos): la rutina B pasa a ejecutarse por navegador en vez de solo como propuesta, con el mismo riesgo ya asumido en D62 para el calendario de SportEasy.
**Corrección (02/10/2026): la rutina A (actas y estadísticas) NO va por Chrome.** La app **Afición FBM solo existe como app de móvil** (App Store/Indalweb), sin versión web que navegar (ver `docs/SONDEO_ACTAS_FASE0.md`, punto 1: "los PDF y XLSX sólo se obtienen desde la app"). Por eso no entra en este D63, que es específicamente sobre **navegador**. **Ver D69**, que fija cómo se automatiza la rutina A de verdad (emulador Android, no gesto manual ni Chrome).
**Por qué:** es el mismo mecanismo ya aprobado y ejecutado para la carga del calendario en SportEasy (D62), extendido a la rutina de calendario y a la de convocatoria, que sí son webs navegables. La de actas usa otro mecanismo (D69), porque Afición FBM no es una web. Detalle completo en `docs/NORMAS_DE_TRABAJO.md` §3 y `docs/PLAN_TRABAJO_2026-27.md`.

## D64 — SportEasy completo como respaldo hasta septiembre de 2027; sustitución función a función (Iván, 02/10/2026) — MATIZA D44 y D62
**Decisión:** SportEasy se mantiene **completo como respaldo** mientras dure la suscripción pagada, hasta **septiembre de 2027**. No se apaga ni se retira antes. La plataforma propia lo sustituye **función a función**: una función pasa a la plataforma cuando ha funcionado **3 jornadas seguidas sin arreglos a mano** y Iván lo aprueba. Mientras una función conviva en los dos sitios, **nunca se pide a los jugadores lo mismo en dos sitios** a la vez.
**Por qué:** matiza D44 (que planteaba apagar SportEasy desde la jornada 2 de 26/27, pendiente de decidir desde D62) y D62 (que lo devolvió a pleno rendimiento sin fijar fecha de salida): fija el criterio objetivo de sustitución —3 jornadas sin arreglos a mano— y una fecha límite de respaldo que coincide con el fin de la suscripción ya pagada, cerrando la ambigüedad sobre "cuándo se apaga" que D44 dejaba pendiente.

## D65 — Normas de trabajo y modelos (Iván, 02/10/2026)
**Decisión:** quedan fijadas en `docs/NORMAS_DE_TRABAJO.md` las normas de trato, actitud, reparto de papeles entre Iván / Claude (chat de diseño) / Code, y qué modelo de Claude usar en cada tipo de tarea (Opus 5.5 para decisiones, seguridad y arquitectura; Sonnet 5.5 para ejecución de rutinas ya escritas y trabajo con especificación cerrada; Haiku 4.5 para tareas menores; Fable 5.1 no se usa en este proyecto). También cuándo limpiar conversaciones (un chat por bloque o tema, `/clear` tras cada merge). El plan de trabajo de la temporada 2026/27 (fases, rutinas semanales, qué hay que diseñar) queda en `docs/PLAN_TRABAJO_2026-27.md`.
**Por qué:** fija por escrito cómo se colabora a partir de ahora, para no tener que repetir las mismas indicaciones cada bloque.

## D66 — Publicación automática de estadísticas si todo cuadra (Iván, 02/10/2026)
**Decisión:** la rutina de actas y estadísticas (`npm run jornada`) **publica sola** cuando los puntos del boxscore cuadran con el marcador del acta, y avisa a Iván de lo publicado. **Si algo no cuadra, no publica y avisa** a Iván del motivo, sin tocar los datos publicados, para que decida él.
**Por qué:** es la excepción escrita que ya preveía D35/D62 ("crear, modificar o enviar algo en nombre de Iván: con su OK explícito, salvo que una regla escrita lo autorice"). Publicar solo cuando la validación aritmética ya existente (D12, cuadre contra el marcador) da OK evita un visto bueno manual semanal para un dato que ya se verifica solo; cuando no cuadra, el riesgo de publicar un dato incorrecto es mayor que la espera, así que para y avisa.

## D67 — Claude puede configurar herramientas en el Chrome de Iván, solo dentro de Maccabis (Iván, 02/10/2026)
**Decisión:** Claude puede instalar y configurar herramientas en el Chrome de Iván (extensión, sesiones, tareas programadas) para las rutinas de este proyecto. **Siempre dentro del proyecto Maccabis; nunca toca nada del entorno de Tres Cantos (TCPC)**, aunque comparta el mismo navegador.
**Por qué:** Iván usa el mismo Chrome para los dos clubes. Separar el alcance evita que una configuración pensada para Maccabis (sesiones, extensiones, tareas programadas) interfiera con el trabajo de TCPC.

## D68 — Login único con Google (o código por correo) y lista blanca por correo; retira los enlaces (Iván, 02/10/2026) — SUSTITUYE a D45
**Decisión:** se tomó el 25/09/2026 en el chat de diseño pero no llegó a los docs a tiempo; queda registrada ahora, aplicada en el bloque del 02/10/2026.
1. **Login único con Google** (Supabase Auth) para jugadores y gestores, con un **código de un solo uso por correo** como respaldo para quien no usa Google. Según el rol: un jugador entra en `/mi-zona` y sus pedidos; un gestor entra además en `/gestion`; quien es las dos cosas (Iván, Edu) elige a dónde ir.
2. **Nada abierto:** se retiran los enlaces personales `/j/<token>` (D45), la tabla `enlaces` y las 4 funciones que antes podía llamar `anon` con un token. `anon` se queda **sin ningún permiso**, ni sobre tablas ni sobre funciones: todo exige una sesión real.
3. **Lista blanca:** solo entra quien tiene su correo dado de alta en `jugadores.email` o en `gestores.email` (los tres gestores también son jugadores de la plantilla, así que están en las dos). Un correo desconocido **nunca crea una cuenta**: lo bloquea el hook "Before User Created" de Supabase, que llama a la función `public.antes_de_crear_usuario`, registrada a mano en el panel (ver `plataforma/LEEME.md`).
4. Los jugadores y gestores se identifican **por correo**: `auth.users` se vincula con `jugadores`/`gestores` comparando el correo (nunca por nombre), y las políticas RLS y funciones usan `auth.uid()` en vez de un token.
**Consecuencia técnica:** migración `plataforma/supabase/migrations/20261002120000_login_google_lista_blanca.sql` (mantiene D58 — permisos explícitos y mínimos — y D59 — RLS automática). Aplicada directamente sobre el proyecto real sin staging, por D53 (no había pedidos que proteger). `npm run db:correos` (nuevo) importa los correos desde una exportación de SportEasy, casando por nombre exacto y listando aparte lo que no case, sin adivinar nunca.
**Por qué:** cero contraseñas que gestionar y cero enlaces secretos que reenviar por error; Google ya es la cuenta que casi todos usan, y el código por correo cubre a quien no quiere usarlo. La lista blanca evita que cualquier cuenta de Google pueda entrar: solo quien el club ya conoce.
**Registro de alta ("Allow new users to sign up"):** el 26/09/2026 este interruptor de Supabase estaba desactivado (nadie, ni con correo en la lista blanca, podía entrar la primera vez). **D68 exige activarlo**, pero solo **después** de tener puesto el hook "Before User Created" del punto 3: activarlo antes dejaría crear cuenta a cualquier correo de Google sin filtro. Procedimiento exacto en `plataforma/LEEME.md`, apartado 3.

## D69 — Rutina A (actas): emulador Android con control del ordenador, no gesto manual (Iván, 02/10/2026) — MATIZA D35
**Decisión:** la rutina A deja de ser un gesto manual de Iván. Claude descarga las actas y las hojas de estadística desde la app **Afición FBM instalada en un emulador Android** (Android Studio, oficial de Google) en el ordenador de Iván, manejado con **control del ordenador** (no depende del móvil de Iván ni de que esté disponible). Iván solo inicia sesión **una vez** en Google Play y en la app, en ese emulador.
**Matiza D35:** D35 fijaba la descarga como "un gesto manual de Iván sin pedir permiso a la FBM". La parte de "sin pedir permiso a la FBM" **sigue vigente**; la parte de "gesto manual de Iván" queda sustituida por la ejecución de Claude en el emulador. El riesgo de D35 (extracción fuera de las condiciones de la app, sin permiso de la FBM) se mantiene igual; lo único que cambia es quién pulsa los botones.
**Requisito técnico:** el ordenador de Iván encendido, con Android Studio y el emulador configurado, y la sesión de Google Play y de Afición FBM iniciada dentro del emulador (una vez, como en el Chrome de las rutinas B y C).
**Por qué:** quita de encima de Iván el único paso semanal que seguía siendo manual, sin depender de su móvil ni de su disponibilidad el lunes por la mañana. Un emulador oficial de Google (Android Studio) es más estable y auditable que automatizar el móvil real de Iván.

## D70 — Rutina A (actas): Enlace Móvil de Windows con el S22 Ultra, no emulador (Iván, 02/10/2026) — MATIZA D69
**Decisión:** la rutina A va por **Enlace Móvil de Windows** ("Aplicaciones"), que refleja el **Samsung S22 Ultra de Iván** en una ventana del PC. Claude abre **Afición FBM** del móvil ahí y la maneja con **control del ordenador**. Probado el 02/10/2026: la app carga y responde (menú, Buscador). **Condición:** el móvil encendido, con wifi y cerca del PC; puede estar bloqueado.
**Matiza D69:** el emulador Android queda **descartado por ahora**: Play Store no permite instalar Afición FBM en emuladores ("This app won't work for your device", probado en Android 15 y Android 17 con traducción ARM), y copiarla desde el móvil con adb no fue posible (el cable USB de Iván solo carga; la depuración inalámbrica falla en su red). Queda como **reserva**: Android Studio, el SDK y los dos móviles virtuales siguen instalados en F:; se retomaría solo con un cable de datos que sí transfiera.
**Por qué:** Enlace Móvil funciona y ya está probado, mientras el emulador choca con una restricción de Play Store ajena a Claude. El riesgo y el mecanismo de fondo (D35: sin pedir permiso a la FBM) no cambian; solo cambia el dispositivo donde corre la app.

## D71 — Jornada 1 de 2026/27: se publican las hojas sin esperar al acta (Iván, 05/10/2026) — EXCEPCIÓN PUNTUAL a D66
**Decisión:** como la FBM aún no ha publicado las actas de la jornada 1, Iván autoriza publicar ya `data/season_2026-27.json` con las hojas de estadística, marcando los dos partidos como **parciales pendientes de acta** (`pendiente_acta: true`; sin parciales por cuarto; hora y pista provisionales del calendario). Es una excepción **puntual** a D66 (que exige cuadre contra el acta antes de publicar), activada por `hojas_sin_acta` en `scripts/estadisticas/temporadas.json` solo para 2026-27.
**Cómo se cierra:** con las actas en Descargas, el siguiente `npm run jornada` enlaza cada hoja con su acta, completa parciales, hora y pista, y valida marcador y parciales; si algo no cuadra, **no escribe y avisa**. Un acta con otro marcador que la hoja es error, no se publica.
**Por qué:** la hoja trae los puntos de ambos equipos (se comprueba que la suma de jugadores = TOTALES), así que el riesgo de dato incorrecto es bajo y la web puede estrenar la temporada el mismo lunes.

## D72 — En los partidos de liga manda la hoja de la FBM sobre SportEasy (Iván, 05/10/2026)
**Decisión:** en los partidos de liga, **quién jugó lo decide la hoja oficial de la FBM**. SportEasy solo decide la asistencia a entrenos y a partidos sin hoja. Si SportEasy y la hoja no coinciden, **se corrige SportEasy en nuestros datos y se anota** (el pipeline lo hace solo y lo deja en los avisos): quien está en la hoja cuenta como asistente aunque SportEasy diga otra cosa; quien consta "A tiempo" y no está en la hoja cuenta como no asistente ("No convocado").
**Primera aplicación (MdA, 04/10/2026, confirmado por Iván):** jugó Jon Esteban en lugar de Alonso Romero. Jon: asistió (SportEasy decía "No convocado"). Alonso: no asistió (SportEasy decía "A tiempo"). El MdL de esa mañana no cambia.
**Mapa de nombres (misma fecha):** "Edimil Feliz Gomez" → `feliz-gomez-edimil` (solo entreno, alta del 02/10/2026) y "Luis Gomez Pradal" → `gomez-pradal-luis` (histórico del club; no juega en 26/27, solo vino a un amistoso de verano, que no cuenta). Barreiro, Pablo Ortega e Iván Rodríguez siguen fuera (no están en la plantilla 26/27).
**Por qué:** la hoja es el documento oficial del partido; SportEasy es una respuesta de disponibilidad que puede no reflejar quién acabó jugando.

## D73 — Liga 26/27: público por equipo, privado por jugador (06/10/2026) — CONCRETA D43 y el sondeo de rivales
**Decisión:** de cada jornada se bajan **todas** las hojas de estadística de los dos grupos (G1 de MdA, G2 de MdL), no solo las nuestras. Con ellas:
1. **Público (repositorio y GitHub Pages):** solo datos **por equipo**, en `data/liga_2026-27.json`: resultados, clasificación, puntos a favor y en contra, medias, racha y casa/fuera. La clasificación va marcada **"calculada; pendiente de contrastar con la oficial"** (las incomparecencias restan y no generan hoja, D29).
2. **Privado (Supabase, con RLS):** los datos **por jugador** de **todos** los equipos (los de terceros incluidos), en tablas que **solo leen los gestores**; `anon` y los jugadores no tienen acceso. **Nunca** van al repositorio ni a GitHub Pages. Las hojas originales quedan en `fuentes_fbm/2026-27/liga/` (fuera de git, D41).
3. **Puntuación (Bases de los 47 JDM, deportes de equipo, 2.10.1 Baloncesto):** 2 puntos por victoria y 1 por derrota; perder por sanción cuenta como 20-0. Desempate (2.9): puntos y diferencia en los partidos entre los empatados, diferencia general, cociente y puntos a favor. **Pendiente de Iván:** cuántos puntos resta una incomparecencia (las Bases no lo dicen); ver D74 (los puntos del que no se presenta salen de la clasificación oficial).
**Cómo se casa cada hoja:** la cabecera ("Estadísticas - A vs B") da los equipos; el grupo sale de `data/calendario_2026-27.json` (los rivales de MdA son del G1 y los de MdL del G2); en nuestros partidos la jornada sale del calendario y en los demás, del nombre de la copia (`liga_J01_G1_...`), que el pipeline calcula por fecha (última jornada ya jugada) o por `--jornada N`. Se valida que la suma por jugador sea el total del equipo (puntos, 2P, 3P, TL y faltas) y que 2P×2 + 3P×3 + TL = puntos.
**Por qué:** los datos por jugador de otros equipos son de terceros (D43, `docs/SONDEO_RIVALES_STATS.md`); los de equipo son resultados públicos de una competición municipal. Con las hojas de toda la jornada se puede tener la liga completa sin esperar a los datos abiertos (el 211549 sigue en la 2025/26).
**Prueba:** `npm run test:liga` (incluye que ningún nombre de jugador aparece en el JSON público).

## D74 — Incomparecencias en la liga: los puntos salen de la clasificación oficial (Iván, 06/10/2026) — CONCRETA D73 y D29
**Decisión:** no se inventa la penalización. Si un partido es una incomparecencia (no hay hoja), se **marca** en `temporadas.json` (`liga.incomparecencias`: grupo, jornada, local, visitante, no_presentado). El partido cuenta como **ganado** para el que se presentó y **perdido** para el otro, **sin puntos a favor ni en contra**, y los **puntos del equipo que no se presentó se toman de la clasificación oficial de Deportes/web** (rutina B de los jueves), anotados en `liga.puntos_oficiales`. Mientras esa clasificación no llegue, la casilla de puntos de ese equipo dice **"pendiente de la oficial"** y el orden de su grupo se marca como provisional. Sustituye a la parada del pipeline de D73 por `puntos_incomparecencia = null`.
**Nombres:** en la pestaña "Liga 26/27" y en "Rivales 26/27" los equipos van en formato Título (`nombreTitulo` en `scripts/estadisticas/util.js`: siglas TD, RIF y abreviaturas C.B., F.T. en mayúsculas), de modo que el enlace de la ficha por equipo a `?p=rivales&g=..&r=..` usa los mismos nombres e identificadores.
**Por qué:** las Bases no dicen cuánto resta una incomparecencia; la única fuente fiable es la clasificación oficial.

## D75 — Avisos de choque de equipación (Iván, 06/10/2026) — regla oficial incorporada
**Decisión:** nuestra 1.ª equipación es **negra** y la 2.ª **amarilla** (MdA y MdL). Hay **choque** cuando la camiseta de la 1.ª equipación del rival es **negro, azul oscuro o azul** (el «azul» de Nabuco TD cuenta, decisión de Iván). Los colores salen de la captura de Deportes/web del 06/10/2026 y viven en `data/equipaciones_2026-27.json` (texto original, color normalizado, fuente, fecha y la regla, configurable ahí mismo).
**Quién cambia — Bases Reguladoras del 47 JDM, art. 5.11 «Vestimenta»** (igual en la normativa del 46 JDM, art. 2.8): *«En caso de coincidencia de colores, deberá cambiarse obligatoriamente el equipo que figure en segundo lugar en el calendario de competición, si no lo hiciese se le dará el encuentro por perdido.»* Fuente: https://www.madrid.es/UnidadesDescentralizadas/Deportes/EspecialInformativo/47JDM/ficheros/BasesReguladoras47JDM_1Sp.pdf (la aportó Iván el 06/10; antes no estaba en el repo). En `regla_choque.quien_cambia` va `cambia: "segundo_en_calendario"` con la cita; el que figura en segundo lugar es el **visitante** de `data/calendario_2026-27.json` (`local: false`; el calendario lista primero al local).
**Dos avisos (un solo módulo, `data/avisos_equipacion.js`):**
- **NOS TOCA CAMBIAR** (vamos de visitantes): «⚠ Nos toca cambiar: equipación AMARILLA» + «Vamos en segundo lugar contra <rival> (<color>). Obligatorio: si no cambiamos, partido perdido (Bases 47 JDM, 5.11).» Estilo de alerta (amarillo intenso).
- **CAMBIAN ELLOS** (vamos de locales): «ℹ Coinciden colores: cambia <rival>» + «Jugamos de negro; <rival> (<color>) va en segundo lugar y debe cambiar. Llevad la amarilla por si acaso.» Estilo informativo (gris azulado). Lo de «por si acaso» es prudencia, no norma.
- Convocatoria/WhatsApp (rutina C), `lineaEquipacion`: «Llevad la equipación AMARILLA (nos toca cambiar).» o «Jugamos de negro; cambia <rival>. Llevad la amarilla por si acaso.»; `null` si no hay choque. Si no se sabe quién es local o el fichero no trae la regla, el aviso vuelve al texto prudente «Coincidencia de color… llevad la amarilla por si acaso».
- Si cambia el orden local/visitante del calendario (rutina B), el aviso cambia solo.
**Dónde:** web pública (tarjeta «Próximos partidos» en Liga 26/27, ficha de equipo y de Rivales) y plataforma (Mi zona, Inicio de gestión, Scouting; `plataforma/src/lib/equipacion.ts`).
**Datos en la plataforma:** se despliega con `plataforma/` como raíz, así que lleva **copias** de los tres ficheros en `plataforma/src/data/` (`npm run equipacion:sync`; `pruebas:equipacion` falla si están desfasadas). Mi zona necesita el equipo del jugador: migración `20261006210000_mi_zona_equipos.sql` (solo añade `ficha_mda`/`ficha_mdl` a `mi_zona()`), aplicada en producción el 06/10/2026 tras backup y prueba en la pila local con la copia restaurada.
**Por qué:** que ningún domingo se pierda un partido por no llevar la equipación obligatoria.
**Prueba:** `npm run pruebas:equipacion` (colores, mapeo, casos de control, lista de avisos) y `npm run pruebas:avisos` (pantallas reales; capturas `real_e_aviso_*`).

---
## Bloque «Unificación web (paso 1 del rediseño)» (06/10/2026, tarde)

## D76 — Rediseño y una sola web en maccabis.vercel.app (Iván, 06/10/2026)
**Decisión:** la web del club pasa a ser **una sola**, la de la plataforma (`plataforma/`, Next.js en Vercel), con el diseño aprobado en `privado/mockups_liga/rediseno/` (Main, PortadaMovil, Acceso, MiZona, Gestion). En `/` hay una **portada pública sin login**; `/entrar` es el Acceso (misma lógica de D68); `/mi-zona` y `/gestion` llevan el aspecto nuevo. Las secciones de estadísticas de GitHub Pages **no se reescriben en este paso**: el menú nuevo enlaza a ellas y se migran por orden (`docs/MIGRACION_WEB.md`).
**Sistema visual (un solo sitio: bloque de tokens al principio de `plataforma/src/app/globals.css`):** público y Mi zona en **oscuro** (fondo #0E0D12, paneles #17151F, línea #2A2733, texto #F2F0EA, secundario #C9C5D3 / #9A96A6); gestión en **claro** (fondo #F4F1EA, tinta #15130F); acentos amarillo #F3C519 (MdA), naranja #E8722C (MdL), verde #3FB98A. Tipos: Barlow Condensed (titulares), Barlow (texto), JetBrains Mono (cifras), servidos desde el propio dominio con `next/font` (la CSP sigue en `font-src 'self'`). Contraste AA; objetivos táctiles ≥ 44 px (lo comprueba `pruebas:portada`).
**Datos de la portada:** solo **públicos** y ya publicados en GitHub Pages: copias de `data/` en `plataforma/src/data/` (`npm run datos:sync`, antes `equipacion:sync`, que sigue funcionando): calendario, equipaciones y avisos (D75), liga por equipo (D73), temporada 26/27 de Maccabis (líderes) y un resumen generado de la historia (226 partidos con estadísticas, 137 victorias, 87 jugadores sin contar al entrenador). Nada por jugador de otros equipos (D73), ni correos, ni niveles (D39). **Sin cambios de esquema en Supabase.**
**«Desde 2013»:** el año vive en un solo sitio, `FUNDACION` en `plataforma/src/lib/web.ts`. **Pendiente de confirmar por Iván** (SportEasy dice 2012); el escudo, que es una imagen, también dice «since 2013».
**Por qué:** dos webs con aspectos distintos confunden; la plataforma ya tiene login, datos y despliegue, y es donde llegarán eventos y avisos (pasos 2 y 3).

## D77 — Entrenos: miércoles 20:30–22:30; Valdebernardo en obras (Iván, 06/10/2026)
**Decisión:** el entreno semanal vive en `data/entrenos_2026-27.json` (serie + excepciones + pistas): **miércoles de 20:30 a 22:30**, pista habitual **Valdebernardo (Faustina Valladolid)** con estado **«en obras»**: mientras dure, cada miércoles sale **«Pista por confirmar (Valdebernardo en obras)»**. Excepción: **07/10/2026, de 20:00 a 21:00 en la Caja Mágica**. La serie no tiene fecha de fin confirmada: se corta en el día de la última jornada de liga. Los miércoles sin entreno (Navidad, Semana Santa…) están **pendientes de Iván** y se añadirán como excepciones con `"cancelado": true`. El formato (serie, excepciones y catálogo de pistas con estado) es el de las pantallas Eventos/EventoEditar del paso 2.
**Calendario público:** portada (`/#calendario`) con partidos de MdA y MdL (con su aviso de equipación) y entrenos, filtros Todo / Partidos / Entrenamientos / MdA / MdL, y **«Añadir a mi calendario»** = feed iCal público `/calendario.ics` (suscripción webcal para iPhone/Mac, Google Calendar y descarga). El feed solo lleva partidos y entrenos (fecha, hora, pista, línea de equipación): **ningún dato personal**. Los partidos ocupan la franja de 1 h 15 min del calendario oficial.
**Por qué:** que todo el equipo sepa cuándo y dónde se entrena sin preguntar por WhatsApp, y que el cambio de pista se vea en un solo sitio.

## D78 — Los avisos llegarán por la web instalada (Iván, 06/10/2026)
**Decisión:** los avisos a los jugadores (cambio de pista u hora, recordatorio de responder, convocatoria) llegarán en el **paso 3** como **notificaciones de la web instalada** («Añadir a pantalla de inicio»), no por una app nativa. En este paso solo se deja la **base instalable**: manifiesto (`/manifest.webmanifest`, nombre «Maccabis», `theme-color` #0E0D12, iconos 192/512/maskable y de Apple generados del escudo con `npm run iconos`) y un service worker mínimo (`public/sw.js`) **sin caché ni manejador de peticiones**: no cambia cómo carga la web. Mi zona tiene su propio manifiesto (misma app, empieza en `/mi-zona`). **Sin notificaciones todavía.**
**Por qué:** cero instalación desde tiendas y un solo código; en iPhone los avisos web exigen que la web esté añadida a la pantalla de inicio (de ahí el paso de «Activa los avisos» de la maqueta EventoMovil).

## D79 — (no se usa)
Varios comentarios del código y `data/avisos_equipacion.js` llaman «D79» a la decisión de los avisos de equipación, que en este documento es **D75**. Para no confundir, el número D79 queda sin usar.

## D80 — Eventos en fase puente con SportEasy (Iván, 06/10/2026) — CONCRETA D64
**Decisión:** en el paso 2 los eventos (entrenos, partidos, amistosos, torneos) **se crean y editan en la plataforma** (pantallas Eventos y EventoEditar) y **Claude los copia a SportEasy con el OK de Iván** (rutina por navegador). Las respuestas de los jugadores **se siguen leyendo de SportEasy** hasta que pasen a responder en la plataforma (EventoMovil), función a función y con el criterio de D64 (3 jornadas sin arreglos a mano). Mientras tanto, Mi zona y Gestión muestran disponibilidad y convocatoria como **«pendiente»** y el recuadro del entreno con las respuestas de SportEasy queda como **hueco** visible.
**Por qué:** nunca pedir a los jugadores lo mismo en dos sitios (NORMAS §8) y no perder SportEasy como respaldo hasta septiembre de 2027.

---
## Bloque «Respuestas de Iván al paso 1 del rediseño» (06/10/2026)

## D81 — Fundación: 2013 (temporada 2013/14) (Iván, 06/10/2026) — CIERRA la duda de D76
**Decisión:** el club se fundó en **2013** (temporada 2013/14): «Desde 2013» se queda. Vive en un solo sitio, `FUNDACION` en `plataforma/src/lib/web.ts` (el escudo también dice «since 2013»). Lo de SportEasy (2012) no cuenta. En la plataforma no había ningún «2012» referido al club (solo el nombre del rival «Mejorada 2012», que no se toca).

## D82 — Los motivos de ausencia, solo para los gestores; nunca en ficheros públicos (Iván, 06/10/2026) — CONCRETA D46 (hallazgos P1 y P3)
**Decisión:** los motivos de ausencia (con excusa, sin excusa, no convocado, lesión y los porcentajes que salen de ellos: % disponible, % jugados, % no seleccionado) **no se borran** —los gestores los necesitan— pero **no pueden estar en ningún fichero público** del repositorio.
- **Público** (`data/season_*.json`, sus copias en `plataforma/src/data/` y la pestaña Asistencia de GitHub Pages): por jugador solo `{ fueron, total, pct }` de partidos y de entrenos, con `pct = fueron / total`. El porcentaje de entrenos antiguo (fueron / (fueron + excusa)) dejaba deducir las excusas: se sustituye.
- **Privado:** el detalle se genera en `privado/asistencia/asistencia_<temporada>.json` (fuera de git; lo escribe `npm run jornada` y, una sola vez, `node scripts/separar_asistencia.js`, con copia previa en `privado/backups/`) y se carga en Supabase en `public.asistencia_motivos` (migración `20261006220000_asistencia_motivos.sql`), con **RLS: solo leen los gestores**; anon y jugadores, nada; nadie escribe por la API (`npm run db:asistencia`). **Probado en local** (`pruebas:asistencia`); **en real, pendiente del OK de Iván** (backup + `db:migrar` + `db:asistencia`).
- `npm run jornada` mantiene la separación y **falla** si un JSON público vuelve a llevar motivos; `npm run test:privacidad` lo comprueba (JSON de `data/` y de `plataforma/src/data/`, y la pestaña de `index.html`).
- **P3:** borrado `docs/dashboard-maccabis-25-26-v1.html` (copia antigua con la asistencia embebida). **P2** (correos en el historial de git): no se reescribe el historial; decisión pendiente de Iván (recomendación: asumirlo).
- El historial de git conserva las versiones antiguas de los JSON con motivos (igual que P2).

## D83 — Entrenos 26/27 sin festivos; último, el 05/05/2027 (Iván, 06/10/2026) — CONCRETA D77
**Decisión:** no hay entreno el **23/12/2026, 30/12/2026, 06/01/2027 y 24/03/2027**, ni ningún otro miércoles festivo de la ciudad de Madrid; el **último entreno es el 05/05/2027**. Comprobado en la fuente oficial (06/10/2026): entre el 07/10/2026 y el 05/05/2027 el único miércoles festivo es el 06/01/2027 (2026: Decreto 75/2025 y fiestas locales 15/05 y 09/11, según madrid.es; 2027: Decreto 82/2026, BOCM 01/10/2026, núm. 234; fiestas locales de 2027 aprobadas por el Pleno: sábado 15/05 y martes 09/11). Las cuatro fechas van como excepciones `"cancelado": true` en `data/entrenos_2026-27.json`, con las fuentes. Quedan 27 entrenos; se refleja en la portada, en `/club` y en `/calendario.ics` (`pruebas:portada`).

## D84 — `datos:sync` dentro de `npm run jornada` (Iván, 06/10/2026) — CONCRETA D76
**Decisión:** al final de `npm run jornada`, **solo si la jornada cuadra** (si algo falla el proceso para antes y no escribe nada), se comprueba que ningún JSON público lleve motivos (D82) y se sincronizan las copias de `plataforma/src/data/` (lo que hacía `npm run datos:sync` a mano). Publicar = commit de `data/` **y** de `plataforma/src/data/`. Para cambios de calendario o de entrenos sin jornada (rutina B) se sigue usando `npm run datos:sync` en `plataforma/`.

## D85 — Indexación: la web pública sí; lo privado y las vistas previas, no (Iván, 06/10/2026) — MODIFICA el «noindex en todo» de la plataforma v0
**Decisión:** la portada y las páginas públicas (`/`, `/club`, `/privacidad`…) **se indexan** (meta robots `index, follow`, `sitemap.xml`). `/entrar`, `/mi-zona`, `/gestion` y `/auth` (todo lo que exige login) llevan **noindex** (cabecera `X-Robots-Tag` y meta robots) y están en **Disallow** de `robots.txt`. Las **vistas previas de Vercel** (`VERCEL_ENV` distinto de `production`) llevan noindex en todo y `robots.txt` con `Disallow: /`. Lista de rutas privadas en `plataforma/src/lib/indexacion.ts` (y repetida en `next.config.ts`; `pruebas:portada` comprueba que coinciden).

## D86 — Página «El club» en /club (Iván, 06/10/2026)
**Decisión:** `/club` con el diseño nuevo: qué es el club, desde 2013, MdA (Maccabi de Acostar, G1) y MdL (Maccabi de Levantar, el original, G2), cifras de historia (las mismas de la portada, desde los datos), entrenos (miércoles 20:30–22:30, Valdebernardo en obras) y dónde jugamos (Liga Municipal de Moratalaz, pistas 1 a 3; **nombre y dirección de la instalación: hueco que D88 rellena**), y enlace a la rejilla completa de Historia en GitHub Pages hasta que se migre (no se migra en este bloque). El menú y el pie enlazan a `/club`. Sin datos personales.

## D87 — «No voy» con motivo y periodos de no disponibilidad (Iván, 06/10/2026) — requisito de los pasos 2 y 3
**Decisión:** cuando la plataforma recoja respuestas (paso 3, EventoMovil): al responder **«no voy»** el jugador **elige un motivo** (como en SportEasy); y puede marcar **periodos de no disponibilidad** (viaje, vacaciones…) **de forma visual**, eligiendo en un calendario el **desde** y el **hasta**: eso pone «no voy» con ese motivo en todos los eventos del periodo **y en los que se creen después dentro de él**. Los **gestores** ven motivos y periodos; los **demás jugadores** solo ven «no va» (D46, D82). En la **fase puente** (D80), la rutina C lee de SportEasy tanto los motivos como los periodos. Detalle en `docs/BACKLOG.md`. No se construye ahora.

## D88 — Instalaciones, P2 y paso del rediseño a producción (Iván, 06/10/2026)
**Decisión:** (1) `/club` distingue **dos instalaciones**: los **partidos** (Liga Municipal de Moratalaz, JDM) son en el **Centro Deportivo Municipal Moratalaz**, calle de Valdebernardo, 2, 28030 Madrid (metro Pavones, L9); los **entrenos** (miércoles 20:30–22:30) son en **Valdebernardo (Faustina Valladolid)**, ahora en obras, con la pista de cada semana en el calendario. Son sitios distintos y el texto lo dice. Quedan en `MEMORIA.md`. (2) **P2: no se reescribe el historial de git** por los correos antiguos de `docs/ESTADO.md` (ya sustituidos por `<correo>` en la versión actual). (3) Iván da el OK a la vista previa: la tabla `asistencia_motivos` (D82) se aplica en el Supabase real y `feat/rediseno-web` se mergea a `main`. (4) La **pantalla de motivos para gestores** no se construye ahora: va al **paso 2** (`BACKLOG.md`); mientras tanto los gestores tienen los motivos en `privado/asistencia/` y en la tabla.
**Por qué:** los dos sitios se confunden por el nombre (Valdebernardo); reescribir el historial compartido para ocultar datos que ya no están en la versión actual tiene más riesgo que beneficio.

## D89 — Una sola navegación en toda la web: cabecera única y barra inferior en móvil (Iván, 07/10/2026) — paso 1b del rediseño, CONCRETA D76
**Decisión:** una **cabecera única** en el layout raíz de la plataforma, la misma en la portada, `/club`, `/privacidad`, Acceso, Mi zona, Mi cuenta y Gestión (desaparecen las cabeceras propias de Mi zona y de Gestión). Diseño aprobado por Iván el 07/10/2026 (lienzo «Maccabis · Rediseño web», fila «Paso 1b»: NavCabecera, NavMovil, MiZonaEscritorio, GestionEscritorio).
- **Menú:** escudo + MACCABIS → `/`; Inicio · Partidos · Liga · Plantilla · Historia · El club, con el activo marcado (`aria-current`). Liga, Plantilla e Historia siguen en GitHub Pages hasta su migración: **misma pestaña, sin icono de «externo»**.
- **La sesión se lee en el servidor** (`src/lib/usuario.ts`): sin sesión, botón amarillo «Acceso»; jugador, «Mi zona» en el menú y botón con su inicial y nombre que abre el **menú de usuario** (nombre completo, «Jugador · MdA y MdL» según sus fichas, Mi cuenta, Instalar en el móvil, Salir); gestor, además el botón **GESTIÓN ▾** (D90). La portada ya reconoce la sesión. El proxy refresca la sesión en todas las páginas, y solo si hay cookie de Supabase.
- **Móvil (≤ 768 px):** arriba escudo, MACCABIS y el avatar (o «Acceso»); **barra inferior fija de 5**: Inicio · Partidos · Liga · Mi zona (o «Acceso» sin sesión; «Gestión» para un gestor sin ficha de jugador) · Más. «Más» abre una **hoja desde abajo**: LA WEB (Plantilla, Historia, El club), GESTIÓN (solo gestores), Mi cuenta y Salir. El contenido no queda tapado por la barra.
- **Barras propias de cada zona**, debajo de la cabecera y fijas al hacer scroll: Mi zona (Resumen · Mi agenda · Mis estadísticas · Pedido de ropa, anclas de la misma página con la sección visible marcada) y Gestión (D90).
- **Desplegables accesibles:** `<button aria-expanded>`, Esc (devuelve el foco), clic fuera, flechas/Inicio/Fin, objetivos de al menos 44 px; la hoja «Más» es un diálogo modal que encierra el foco.
- **Un solo tema oscuro** (tokens de la portada en `globals.css`): Gestión deja el tema claro (tablas, formularios, avisos y estados). **Mi zona en escritorio (≥ 1024 px) a dos columnas** dentro del ancho de la portada (ancha: saludo con chips de ficha, Tu agenda, Tu temporada; estrecha: próximo domingo con equipación y pedido de ropa); en móvil, una columna como antes. Solo datos reales; el botón «Marcar días que no estoy» (paso 3) **no** se construye.
- **Web de estadísticas (GitHub Pages) mientras se migra:** barra fija arriba en todas las pestañas con «← Volver a Maccabis» (→ `https://maccabis.vercel.app/`), el mismo menú (Inicio y Partidos a la plataforma, Liga/Plantilla/Historia a sus pestañas con la activa marcada, El club → `/club`) y el texto «Estadísticas · versión anterior de la web»; en móvil, botón de volver y menú desplegable. Nada más de esa web cambia.
**Por qué:** había cuatro «webs» con menús distintos (portada, Mi zona, Gestión y GitHub Pages sin vuelta) y la portada no reconocía la sesión. Desde cualquier pantalla se llega a cualquier otra en uno o dos clics y nunca se queda uno sin vuelta.
**Pruebas:** `npm run pruebas:navegacion` (nueva). El pie de la portada usa la misma sesión que la cabecera (sin sesión, «Acceso jugadores y gestores»; con sesión, «Mi zona» y, para gestores, «Gestión»).
**Estado:** OK de Iván el 07/10/2026; **en producción** desde el merge `1d4068d` (D89 y D90), verificada.

## D90 — Menú de Gestión con submenús; «Mi cuenta» solo en el menú de usuario (Iván, 07/10/2026) — paso 1b del rediseño
**Decisión:** el botón **GESTIÓN ▾** de la cabecera (amarillo con borde; relleno amarillo dentro de `/gestion`) abre un desplegable de **tres columnas** con título de grupo y una línea de descripción por entrada: **LA SEMANA** (Panel de la semana, Eventos y pistas, Convocatoria), **PLANTILLA** (Jugadores, Asistencia y motivos, Pedido de ropa) y **COMPETICIÓN** (Scouting rivales, Liga consolidada). Lo que aún no existe (Eventos, Convocatoria, Asistencia) sale en gris con la etiqueta **«paso 2»**, sin enlace (`aria-disabled`). Debajo de la cabecera, en `/gestion`, una **barra propia** con fondo amarillo oscuro **#2A2410**, la etiqueta GESTIÓN y los mismos submenús en tres grupos separados (fila con scroll horizontal en móvil). La hoja «Más» del móvil repite el mismo menú. Un solo sitio para las entradas: `MENU_GESTION` en `plataforma/src/lib/web.ts`.
- **«Mi cuenta»** sale del menú de Gestión y queda solo en el menú de usuario: **una sola página `/cuenta`** para jugadores y gestores (quién eres, con qué correo entras, Mi zona/Gestión, instalar en el móvil y Salir). `/gestion/cuenta` redirige a `/cuenta` (308) y la sección «Mi cuenta» de Mi zona desaparece. `/cuenta` exige sesión y lleva noindex (D85: está en `RUTAS_PRIVADAS` y en `next.config.ts`).
**Por qué:** el menú lateral de Gestión mezclaba lo que existe con lo que llegará y duplicaba la cuenta; así el gestor ve de un vistazo todo lo que hay, agrupado como se trabaja la semana.
