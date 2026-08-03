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
