# BACKLOG — Proyecto Maccabis

> Lo pendiente, por prioridad. Se reordena según urgencia y decisiones.
> _Reordenado el 25/09/2026 (D30–D34), actualizado el mismo día al cerrar el bloque "Cierre del sondeo y cimientos 26/27" (D35–D43), y reordenado el 02/10/2026 según `docs/PLAN_TRABAJO_2026-27.md`: la subida de actas desde la zona de gestión pasa a plan B (la rutina A por Enlace Móvil, D70 matiza D69, la sustituye)._

## ORDEN VIGENTE (26/09/2026, bloque "Plataforma v0", D44–D57)

> Manda sobre todo lo de abajo. SportEasy sale de la operativa desde la J2 (D44): las tareas antiguas de "cargar el calendario en SportEasy" (plantilla del soporte, agente) quedan **canceladas**.

**Visibilidad y dudas con hora límite (27/10/2026, `feat/visibilidad-y-dudas`, D141): hecho en la rama, SIN merge.**
- [x] Jugadores: nombres de quien no ha contestado; motivos solo gestores; `pruebas:dudas` lo comprueba en HTML y en la API.
- [x] Dudas: límite martes 20:00 (entreno miércoles y partido) o 24 h antes; aviso a las 12:00 juntado con otros; paso a «no va · no confirmó» con aviso; sin botón «Duda» desde el límite; «Dudas: N · límite…» en Panel, Eventos y Respuestas; «posibles» en la convocatoria.
- [ ] **Con el OK de Iván:** aplicar `20261028100000_dudas_limite.sql` en el Supabase real (D111: volcado, suites `-real` antes y después, cuentas de auth) y mergear. Hasta entonces la tarea de avisos funciona sin la función.
- [x] Banda roja movida del martes 10:00 al martes 20:00 (OK de Iván, 27/10); va en la migración 20261028100000.
- [ ] **Miércoles 28/10, con el OK de Iván:** merge y migración en el real (D111). No el 27: el cierre de esa noche saldría sin el aviso de las 12:00.
- [ ] **Vigilar** las primeras semanas: que el aviso de las 12:00 llega a la hora, que se junta bien con el de las 10:00 y que nadie se queja de que «Duda» desaparezca.

**Historia: la 26/27 en curso (26/10/2026, `feat/historia-2026-27`, D137):**
- [x] /historia: 26/27 «en curso» (plantilla con ficha + Barreiro; naranja quien ya ha jugado, amarillo el resto), sin columna «prevista» ni tramo «Llegan en 26/27»; cifras recalculadas (media y «De paso» sin la temporada en curso, con nota); ficha de persona con enlace a sus estadísticas de 26/27.
- [x] Se recalcula sola en `npm run jornada` y en la rutina A (`historia_en_curso.js` + `build_personas.js`; la rutina A pasa `check:historia`).
- [x] **OK de Iván y merge en `main` (`5d4f1e8`, 26/10/2026)**; `verificar_produccion` TODO OK y /historia comprobada en producción. La copia `Maccabis-rutina-a` ya tiene el script nuevo (`git pull` hecho el 26/10).
- [ ] Cuando cambie el cuerpo técnico, actualizar `CUERPO_TECNICO` en `scripts/historia_en_curso.js` (hoy solo Barreiro).
- [ ] Al empezar la 27/28: pasar `ANIO`/`TEMPORADA` de `historia_en_curso.js` y `EN_CURSO`/`ANIOS` de `plataforma/src/lib/estadisticas/historia.ts` a 2027 (la 26/27 pasa a terminada y entra en la plantilla media).

**Vista pública con la ubicación libre (26/10/2026, `fix/vista-pista-libre`, D138):**
- [x] Migración `20261027100000_vista_pista_libre` (solo aditiva) aplicada en el Supabase real con D111; la web la usa en la portada, `/club`, el calendario público y el `.ics`.
- [x] **Mergeada en `main` (`fc51d8e`, OK de Iván, 26/10/2026)**; `verificar_produccion` TODO OK y comprobado en producción como anónimo: el 28/10 sale «Ciudad de los Periodistas» en la portada, el calendario, `/club` y el `.ics`.
- [x] `pruebas:respuestas-real` al día (26/10/2026): vale con el interruptor encendido o apagado. Encendido, la base deja responder a lo suyo y para lo ajeno (`no_invitado`). Comprueba el responsable (D103) y que otro gestor no maneja el interruptor. Arreglada la comparación de fechas (`Date` frente a texto), que hacía que se probara con el uuid 0. 46 OK.

**Eventos y Panel (26/10/2026, `fix/eventos-respuestas-y-panel`):**
- [x] La celda «Respuestas» de `/gestion/eventos` (todas las pestañas), la tarjeta «Entreno del miércoles» y una columna nueva «Respuestas» en «Partidos del domingo» del Panel enlazan a `/gestion/eventos/<id>/respuestas`; en el móvil toda la celda es zona táctil. El nombre del evento sigue llevando a editar.
- [x] El Panel («Entreno del miércoles» y «Pendiente esta semana», también en la banda «Gestión esta semana» del inicio) lee el próximo entreno de la **tabla de eventos** con `pistaEfectiva` (`lib/gestion/entreno.ts`), no de la fuente pública: el entreno del 28/10 (ubicación libre «Ciudad de los Periodistas», D119) salía «pista por confirmar».
- [x] **Arreglado en `fix/vista-pista-libre` (D138, 26/10/2026; migración `20261027100000` aplicada en el real con D111). Falta el merge para que se vea en producción.** **La vista pública `v_eventos_publicos` no conoce la ubicación libre (D119):** a un entreno sin `pista_id` le pone la pista de la serie o «por confirmar». Por eso el entreno del 28/10 sale «pista por confirmar (Valdebernardo en obras)» en las páginas públicas que leen la fuente del calendario: portada, `/club`, calendario y `calendario.ics`. Arreglo: migración que añada `ubicacion_nombre` a la vista (y `pista_por_confirmar = false` si la hay), con D111. Pendiente del OK de Iván (cambio de esquema).
- [ ] Punto 4 tras el paso 2, lo que queda en el Panel: «A · Actas» (resultados jugados, de `liga_2026-27.json`, que es lo publicado por la rutina A) y los avisos de equipación (`equipaciones_2026-27.json`, configuración) siguen leyendo ficheros. Es lo correcto mientras esos datos no vivan en la tabla; no se migran.

**Limpieza de octubre y activación de «respuestas en la web» (26/10/2026, `fix/limpieza-octubre`, D136):**
- [x] Aviso de la **Media Maratón de Moratalaz** (domingo 08/11, meta en nuestro polideportivo) en `data/avisos.json`, del 02/11 al 08/11, para el MdL. Sale en el inicio y, desde esta rama, también en el **mensaje de WhatsApp de la convocatoria** (los avisos vigentes ese domingo para los equipos que juegan, una línea por aviso).
- [ ] **Rutina B del jueves 5/11: confirmar horarios y cortes oficiales de la media maratón 2026 y ajustar el texto si cambian.**
- [x] Importar → Respuestas preparada para la última importación: sin límite de fechas ni de líneas (lee por páginas), resumen por evento tras «Guardar» y, con el interruptor encendido, nunca pisa lo respondido en la web.
- [ ] **Activación (decisión de Iván, 26/10/2026), en este orden** (`RUTINAS/C_CONVOCATORIA.md`, apartado 6): (1) Claude importa las respuestas de TODOS los eventos abiertos de SportEasy; (2) Claude coteja evento a evento y pasa el resumen a Iván; (3) con su OK, Claude pone los eventos futuros de SportEasy a «Seleccionar 0 miembros» y comprueba que no piden respuesta (condición 4); (4) Iván marca la J3, la casilla de SportEasy y pulsa Activar; (5) Claude pausa la tarea «Maccabis · respuestas de SportEasy» y prepara el WhatsApp. SportEasy no se cierra; lo que se responda allí después no cuenta.
- [x] **Comprobado el 26/10/2026 en el real (solo lectura): el entreno del 28/10 está «copiado»** (sin cambio pendiente). Revisar que el **entreno del 28/10** no quede «pendiente de copiar» (el 26/10 se cambió primero en SportEasy y después en la web). Norma: los eventos se cambian **solo en la web** y Claude los copia a SportEasy (D136).
- [x] Ramas remotas: las 30 mergeadas, `feat/calendario-automatico` y `feat/inicio-y-planes` (decisión de Iván) y `fix/limpieza-octubre` (tras su merge) borradas de origin el 26/10/2026; solo queda `main`.

**Norma D134 (26/10/2026):**
- [x] `npm run check:datos` y el hook `commit-msg` (D134), activado en el repositorio principal.
- [x] (26/10/2026, al mergear D137) Activar el hook también en la copia `Maccabis-rutina-a` (`npm run hooks:instalar` tras su próximo `git pull`): allí publica en `main`, que no se comprueba, pero así queda igual en todos los clones. **Pendiente para la próxima vez que se toque la rutina** (26/10/2026; riesgo bajo: solo hace commits de datos).

**`feat/convocatoria-proyeccion` (D124–D129), EN PRODUCCIÓN (merge `c2ea98c`, 26/10/2026):**
- [x] Revisión de la vista previa por Claude y OK de Iván al merge (26/10/2026); `verificar_produccion` en TODO OK, con /liga enlazada, la página de partido sin sesión y «Aviso en la web» sin el interruptor.
- [x] Migración `20261025100000_convocados_domingo` aplicada en el Supabase real (25/10, D111: volcado, revertir ensayado en local, permisos en solo lectura antes y después, 25 cuentas de auth antes y después). `main` no la usa hasta el merge.
- [ ] Comprobar en la J4 (08/11; el MdA descansa) la proyección del MdL, el modo rápido y «Enviar ahora» de verdad.
- [x] J3 publicada: MdA 47 frente a 56 (error 9), MdL 42 frente a 61 (error 19); error medio 12 puntos en 6 partidos.
- [x] **La proyección se quedaba corta en los 6 partidos:** recalibrada en D133 (`fix/proyeccion-sesgo`, 26/10/2026): error medio de 12 a 5,2 y sesgo de −12 a −3,8 (dejando uno fuera).
- [ ] **J8: revisar la proyección con `npm run proyeccion:validar`** (desde ahí la corrección de sesgo ya es completa): ¿el sesgo baja de 3? ¿Los valores de la dificultad (±15 %) y el peso del historial siguen bien?
- [ ] **Recalibrar tras la J6** (ya estaba: umbral de anotación mínima de 45) y, con más jornadas, revisar los parámetros de la proyección (pesos, 60 minutos, 240/40, ±15/±10 %) con el error medio acumulado.
- [ ] «Cambiar en SportEasy» al evento exacto: sigue pendiente guardar el id de cada evento de SportEasy (el botón lleva al calendario; misma tarea que la del inicio, D117).
- [ ] D129: pista de los partidos entre rivales (el calendario que tenemos solo trae la de MdA y MdL); si se carga el calendario completo del Ayuntamiento, la página de partido la enseña.
- [ ] D129: páginas de partido en `sitemap.ts` si se quieren en Google (son públicas e indexables, pero no están en el sitemap); `verificar_produccion` ya mira una sin sesión (26/10).
- [ ] `index.html` (la web anterior, ya redirigida) sigue pintando «En casa / Fuera»: no se toca porque `pruebas:cuadre` la usa de referencia.

**`feat/inicio-y-planes` (D117–D122), mergeada en `main` el 25/10/2026:**
- [x] Revisión de la vista previa por Claude (25/10; de ahí, el arreglo de las respuestas por partido del domingo) y OK de Iván al merge.
- [x] `CALENDARIO_SECRETO` en Vercel, Production y Preview (confirmado por Iván con captura, 25/10). **No cambiarlo:** invalidaría todos los enlaces del calendario personal.
- [x] Sin planes de prueba en la base real antes del merge (0 el 25/10).
- [x] Tabla `gestores` del real: tenía solo a Iván. **Carlos Barreiro y Eduardo Martín-Ortega dados de alta el 25/10** con `db:gestor` y el correo de su ficha (D111: copia previa, recuentos y permisos en solo lectura antes y después).
- [ ] **Cuando Carlos entre por primera vez:** comprobar que su plaza se vinculó sola (`npm run db:estado`: 3 gestores vinculados) y que ve Gestión, el tablero y la banda del inicio. Aún no tiene cuenta (simulado en una transacción deshecha: se vincula y ve los niveles).
   - **26/10/2026:** Iván dice que Carlos ya ha entrado, pero `npm run db:estado` da **3 gestores y 2 vinculados** (Iván y Eduardo) y en `auth.users` **no hay ninguna cuenta con el correo de su ficha** (el mismo de su plaza de gestor; no es de Gmail). Hay que ver con Carlos con qué correo entró: con ese correo, «Entrar con Google» no sirve; la vía es «Recibir código por correo» a esa dirección.
- [ ] **«Responder en SportEasy» al evento exacto:** guardar el id de cada evento en SportEasy (columna nueva, la rellena Claude al copiar) para que el botón del inicio lleve al evento y no al calendario de SportEasy (D117).
- [ ] Más adelante: aviso al móvil del recordatorio de un plan también si el plan se crea con menos de un día de margen (hoy, sin «un día antes», no sale nada).
- [ ] Más adelante: los pedidos de ropa de campañas cerradas ya no se ven en el inicio (D117); si se echan de menos, una página «Mis pedidos».

**Inmediato (23/10/2026):**
- [x] **Gestión → Asistencia atrasada** (24/10/2026, D116, `fix/asistencia-resumen`): la pantalla lee `asistencia_motivos`; `asistencia_resumen` completada en real (de 48 a 58 en 2026/27) y sin uso; `pruebas:eventos-real` al día con el paso 3.
   - [ ] Más adelante, decisión de Iván: retirar `asistencia_resumen` (sin uso desde D116; tiene 6 filas de 2026/27 con valores viejos).
- [x] **Convocatoria: arreglo del reparto con rivales parejos (D112), sin fijo (D110), sin staging (D111) y nadie dobla por bases (D115) — `fix/convocatoria-reparto` (24/10/2026).**
   - [x] (a) Vista previa de la J3 y la J4 revisada por Iván: de ahí sale D115 (J3 real: 9/8, nadie dobla; J4: MdL 10, aviso 2.1).
   - [x] (b) OK de Iván al merge a `main`.
- [ ] **Convocatoria v1 (D107–D109), EN PRODUCCIÓN desde el 24/10/2026 — para usarla en la J4 (08/11/2026, solo juega el MdL a las 11:30):**
   - [x] Respuestas de Iván a la revisión (24/10/2026, D108): interiores (solo mínimos), dificultad con pocos datos, un mensaje sin disponibles, última importación, hoja `jugadores_2026-27.xlsx` con «Ataque (usar)».
   - [x] Migración `20261023100000_convocatoria` **aplicada en el Supabase real** el 24/10/2026 (excepción a staging, D108): volcado previo, prueba de permisos en real en verde, datos privados cargados desde la hoja (24 jugadores).
   - [x] OK de Iván y merge a `main` (24/10/2026); desplegada en producción.
   - [x] Bases de reserva marcados en `/gestion/convocatoria/datos` (24/10/2026, D109).
   - [x] **Regla del entrenador-jugador («fijo»): no aplica en 2026/27** (24/10/2026, D110). Ningún jugador fijo; motor y «Datos de los jugadores» probados sin ninguno.
   - [ ] Sanciones, si las hay (las pone un gestor en «Datos de los jugadores»).
   - [ ] **Recalibrar el umbral de anotación mínima (45 puntos esperados) tras la J6** (provisional, pestaña «Parametros» de la hoja privada).
   - [x] **Primera importación de respuestas de SportEasy** (24/10/2026, Claude): J3, entreno del 28/10 y J4, 92 respuestas, todas válidas. J3 con la regla puntual de D113. Desde entonces, tarea programada «Maccabis · respuestas de SportEasy» (lunes a miércoles 9:54; no importa partidos con «No seleccionados»).
   - [x] Rotación frente a nivel (D109): el nivel va antes; deuda de 2 domingos fuera (regla 4.2).
   - [x] ~~Deuda: crear staging~~ **Cerrada por D111 (24/10/2026):** no se crea; los cambios de esquema van al Supabase real con las protecciones obligatorias (volcado, migración aditiva con `.revertir.sql` probado en local, permisos en real en solo lectura antes y después, recuento de cuentas de auth). Si un cambio no puede ser aditivo, se para y se consulta a Iván (`NORMAS_DE_TRABAJO.md` §10).
   - [x] `fix/pruebas-datos-fijos` mergeada en `main` (24/10/2026); `feat/convocatoria` rebasada encima, todas las suites en verde.
   - [x] `pruebas:activacion` reescrita para el estado actual (redirecciones activas: los casos de `ACTIVAR_REDIRECCIONES.md` redirigen a su ruta); rama `fix/deuda-octubre` (24/10/2026).
   - [x] Panel: campaña de ropa «Abierta» con la fecha límite pasada → estado efectivo compartido con `/gestion/ropa` (`campanaAbiertaAhora`, `pruebas:campana`); tabla «Partidos del domingo» a tarjetas por debajo de 640 px. Rama `fix/deuda-octubre`, **sin merge** (pendiente de Iván; capturas en `privado/mockups_liga/deuda-octubre/`).
   - [ ] Probar la J4 de verdad (proponer, ajustar, aprobar, WhatsApp, SportEasy por Claude).
   - [x] **Pruebas antiguas que caducaron con el calendario:** comparadas de verdad en `main` y en la rama (mismos fallos); arregladas en `fix/pruebas-datos-fijos` (leen cifras y fechas de los datos; las de respuestas adelantan los eventos de la base de pruebas semanas enteras).
   - [ ] Más adelante: «partidos convocado» con las convocatorias aprobadas (hoy sale solo de las hojas cargadas); entrenos de 4 semanas con el pase de lista real cuando exista.
- [x] **Rutina A automática (`feat/rutina-a-auto`, 24/10/2026, D66): revisada por Iván y mergeada en `main` (24/10/2026).** `scripts/rutina_a_publicar.ps1` + `npm run jornada -- --no-interactivo`; la tarea de Windows («\Maccabis\Rutina A - publicar jornada», lunes y jueves 13:00) ejecuta el script desde la copia dedicada `Maccabis-rutina-a` (clon aparte, siempre en `main`; D114).
- [ ] **Borrar en SportEasy el evento «Prueba Claude - no responder» del 30/10** (lo hace Iván).
- [ ] **Explorar una tablet Android siempre encendida, vinculada a Enlace Móvil**, para automatizar también la descarga de las hojas de Afición FBM (hoy las baja Iván desde el móvil; D69/D70: la app no se instala en emuladores).
- [x] **Cerrado (26/10/2026, Iván: ya lo sabe todo el mundo).** **Normativa FBM de esta temporada: desde la J3 (25/10/2026) es obligatorio llevar dorsal en la camiseta de la primera equipación, del mismo color para todo el equipo.** Avisar a la plantilla antes del domingo y tenerlo en cuenta en la convocatoria y en los avisos de equipación (D75).
- [ ] **En espera, sin fecha (decisión de Iván, 26/10/2026).** **Decidir el alta de Iván Canario** (`rodriguez-perez-ivan`, ya en `personas.json`; responde en SportEasy como «Iván Rodríguez Pérez»): posible incorporación a la plantilla 26/27; **a 24/10/2026 sigue fuera de la plantilla 26/27** (`nombres_sporteasy.json` sin cambios). **Plazo de la FBM para un alta: antes de las 20:00 del jueves previo al partido** (para la J4 del 08/11, el jueves 05/11). Al darle de alta: ficha, plantilla, `nombres_sporteasy.json` (quitarlo de `ignorar["2026-27"]`), `personas` y plataforma.
- [ ] **Evaluar los CSV de gesdeportiva.fbm.es/clubes** (clasificación y listado completo de partidos, D106) para la **rutina B**: contraste de la clasificación calculada con la oficial (D74) y posible calendario de los dos grupos sin Deportes/web.
- [x] **Duplicados en Descargas (`npm run jornada`):** mergeado a `main` el 23/10/2026 con el OK de Iván (merge `--no-ff` `009ede4`): descarta por hash lo ya cargado en `fuentes_fbm/2026-27/` y para si una hoja no puede ser de la jornada a la que iría (`npm run test:duplicados`).
   - [ ] Mejora menor: la «fecha de descarga» de una hoja de liga se toma de la fecha de modificación del fichero. Si un fichero se copia conservando una fecha antigua (p. ej. una hoja bajada tarde pero con la fecha original), la comprobación «descargada antes de que se jugara la jornada» puede dar una **parada en falso** (también con `--jornada N`); la salida es actualizar la fecha del fichero (volver a guardarlo o bajarlo de nuevo). Si molesta, cambiar esa comprobación por un aviso o quitarla.

00. **Rediseño web en tres pasos (D76–D80, `docs/PLAN_TRABAJO_2026-27.md` → «Decisiones del 06/10/2026 (tarde)»)**
   - [x] **Paso 1 — Unificación web** (06/10/2026, rama `feat/rediseno-web`, **mergeado a `main` el 06/10/2026 con el OK de Iván, D88**): portada pública en `/`, sistema visual, calendario con entrenos y feed iCal, Acceso, Mi zona y Gestión con el aspecto nuevo, base instalable, inventario `docs/MIGRACION_WEB.md`. Pruebas: `pruebas:portada` + todas las anteriores.
   - [x] Respuestas de Iván al paso 1 (06/10/2026, noche, D81–D87): fundación 2013; entrenos sin Navidad, Reyes ni Semana Santa y último el 05/05/2027 (festivos comprobados en la fuente oficial); `datos:sync` dentro de `npm run jornada`; indexación de la web pública; página `/club`; motivos de ausencia fuera de los ficheros públicos (P1) y P3 borrado.
   - [x] OK a la vista previa y merge de `feat/rediseno-web` a `main` (06/10/2026, D88): `--no-ff`, push y producción verificada.
   - [x] `asistencia_motivos` aplicada en el Supabase real (06/10/2026, D88): `db:backup`, `db:migrar` y `db:asistencia` (43 + 48 filas); `verificar_real` ampliado: anon, jugadores y no gestores no la leen, los gestores sí, y las otras 8 tablas de `public` idénticas antes y después.
   - [x] **Paso 1b — Una sola navegación (D89, D90)** (07/10/2026, rama `feat/navegacion-unica`, **sin mergear**: espera el OK de Iván a la vista previa, que revisa Claude en su Chrome): cabecera única con sesión leída en el servidor, barra inferior y hoja «Más» en móvil, menú de Gestión con submenús y «paso 2», barras propias de Mi zona y Gestión, Gestión en tema oscuro, Mi zona a dos columnas en escritorio, `/cuenta` única (`/gestion/cuenta` redirige), barra de vuelta en GitHub Pages. `npm run pruebas:navegacion` (nueva).
   - [x] OK de Iván a la vista previa de `feat/navegacion-unica` (07/10/2026); el pie de la portada usa la misma sesión que la cabecera (sin sesión «Acceso jugadores y gestores»; con sesión «Mi zona» y, para gestores, «Gestión»).
   - [ ] **Panel de Gestión, móvil:** la tabla «Partidos del domingo» va apretada a 375 px; pasarla a tarjetas en móvil (como Scouting).
   - [ ] **«Partidos» sin estado activo** en la cabecera y la barra inferior: es un ancla de la portada (`/#calendario`); tendrá estado activo cuando tenga página propia.
   - [ ] Al migrar cada sección (Liga → Plantilla/Ficha → Historia, `PLAN_TRABAJO_2026-27.md`, 07/10): cambiar su entrada de `MENU` (`plataforma/src/lib/web.ts`) a la ruta de la plataforma y su enlace en la barra de GitHub Pages; dar de alta las entradas «paso 2» de `MENU_GESTION` (Eventos y pistas, Convocatoria, Asistencia y motivos) cuando existan sus pantallas.
   - [x] **Paso 2: pantalla de motivos para gestores** (D82/D88) — hecha el 08/10/2026 como `/gestion/asistencia` («Asistencia y motivos», D95). Original:: ver la asistencia con motivos (excusa, sin excusa, no convocado, lesión) desde `/gestion`, leyendo `asistencia_motivos` (RLS solo gestores). Hoy solo en la tabla y en `privado/asistencia/`.
   - [x] P2: **no se reescribe el historial** (decisión de Iván, D88).
   - [x] Instalaciones de partidos y de entrenos en `/club` y en `MEMORIA.md` (D88).
   - [x] **Paso 2 — Eventos y pistas en fase puente (D80, D94, D95)** (07–08/10/2026, rama `feat/eventos-puente`, pista E): hecho. `/gestion/eventos` (lista, filtros, aviso de entrenos sin pista, «Copia a SportEasy», últimas lecturas, pistas), crear/editar evento (solo este / este y los siguientes), `/gestion/eventos/<id>/respuestas`, `/gestion/eventos/importar` (calendario y respuestas), `/gestion/eventos/pistas` y `/gestion/asistencia`; calendario público, `.ics`, portada, `/club`, Mi zona y panel leen de la tabla. Rutinas B y C actualizadas (`docs/RUTINAS/`).
     - [ ] **Pendiente tras el paso 2:** (1) ~~comparar EventoRespuestas y EventoImportar con el lienzo~~ **revisado por Claude en producción el 08/10: coinciden (D98)**; (2) ~~27 entrenos y dirección de la Caja Mágica~~ **hechos el 08/10 (D97)**; (4) migrar a la tabla los últimos lectores de ficheros (resultados jugados, Scouting y avisos de equipación de `equipacion.ts`); (5) **Convocatoria** (sigue siendo «paso 2» en el menú), avisos push y respuestas de los jugadores en la web: paso 3; (6) retirar `asistencia_motivos` será otra decisión, más adelante. Original del paso 2: Requiere esquema nuevo en Supabase (eventos, series, excepciones, pistas con estado, estado de copia a SportEasy): **backup + staging antes de producción**. Pantallas según las maquetas `privado/mockups_liga/rediseno/`:
     - **Eventos** (gestión, entrada «Calendario y eventos» del menú lateral): cabecera «Temporada 26/27 · Calendario y eventos» con botones «Entreno semanal» (editar la serie) y «Nuevo evento»; **banner de pista** cuando la habitual está en obras («Valdebernardo está cerrado por obras. Hasta que reabra, cada miércoles hay que fijar pista. Sin pista todavía: miércoles 14» + «Elegir pista del día 14»); pestañas **Próximos · Entrenos · Partidos · Amistosos y torneos · Pasados**; tabla **Fecha · Evento · Pista · Respuestas · SportEasy**: hora y hora de encuentro de los partidos («10:15 · encuentro 9:55»), aviso de equipación, «Cambiado solo esta semana», respuestas «11 van · 8 ? · 5 no» (o «Se abre al fijar pista», «Convocatoria el martes»), estado de copia («Al día», «Pendiente de copiar», «Aún no»); los dos partidos del mismo domingo agrupados («09:00 y 14:00»). Lateral: **Pistas** (+ Añadir: Valdebernardo habitual · cerrada por obras; Caja Mágica provisional; Moratalaz pistas 1 a 3, partidos de liga) y **Copia a SportEasy** («1 cambio pendiente: entreno del 14, falta la pista. Cuando la fijes, Claude lo copia y avisa a la plantilla»). Nota de fase puente.
     - **EventoEditar**: tipo (Entreno · Partido de liga · Amistoso · Torneo · Entre nosotros); fecha, empieza, termina, quedada; pista (desplegable + «Nueva pista»; si la habitual sigue en obras y no se elige, sale «Pista por confirmar» y **no se piden respuestas**); si es de la serie «miércoles 20:30–22:30»: aplicar a **solo este miércoles** o **este y los siguientes**; quién (toda la plantilla · solo MdA · solo MdL); recordatorios (lunes 19:00 y el mismo día a las 12:00); «avisar a la plantilla al guardar» (llega en el paso 3); fase puente: al guardar, Claude prepara la copia en SportEasy y pide el OK; «Cancelar este entreno»; «Guardar sin avisar» / «Guardar y avisar».
     - Gestión → panel: el recuadro «Entreno del miércoles» se llena con las respuestas leídas de SportEasy (van / sin responder / no van) y «Recordar a los N que no han respondido» (lo propone Claude, lo envía Iván). Mi zona → «Tu agenda»: «Vas / No vas / Responde» y «Convocado» en lugar de «pendiente».
     - Rutina de navegador nueva (o ampliación de la B/C): copiar a SportEasy los eventos creados o cambiados, con OK.
     - Primera sección migrada: **Liga 26/27** (`docs/MIGRACION_WEB.md`).
   - [x] **Paso 3 EN PRODUCCIÓN desde el 09/10/2026 (merge `67d88f1`, D99–D105), interruptor APAGADO; tarea de avisos programada.** Pendiente: [ ] prueba de avisos en iPhone/Android reales; [ ] 3 jornadas limpias seguidas (**2/3 en el panel a 26/10**; falta marcar la J3); [x] 20 de 27 dentro de la web (**26/27 a 26/10**); [ ] casilla de SportEasy. **1/27 con avisos activados. Decisión de Iván (26/10/2026): activar ya, con el procedimiento de D136** (arriba, «Limpieza de octubre»). (Detalle de lo construido, 08/10:) Hecho: correcciones de D103; condición 4 resuelta (D104, SportEasy sin notificar); volcado completo + 2 migraciones aplicadas en el Supabase real + `pruebas:respuestas-real` en verde. Pendiente: (1) OK de Iván a la vista previa; (3) `SUPABASE_SERVICE_ROLE_KEY` en `.env.local` y las 5 variables en Vercel (`plataforma/LEEME.md` §8) + redeploy; (4) merge a `main`; (5) `npm run avisos:programar -- --aplicar`; (6) Iván prueba en iPhone y Android (`docs/PRUEBA_AVISOS_MOVILES.md`); (7) marcar jornadas limpias desde la J2 y, cuando se cumplan las condiciones, encender (D99.13). Lo de abajo es el detalle original.
   - [ ] **Paso 3 — El jugador responde en la plataforma y avisos (D78).**
     - **EventoMovil** (jugador, oscuro): bloque **«Activa los avisos»** (iPhone: Compartir → «Añadir a pantalla de inicio», abrir desde el icono, pulsar el botón y aceptar; Android: basta el botón) con ejemplo de aviso («Entreno del miércoles 14: será en [PISTA], de 20:30 a 22:30. ¿Vas?»); tarjeta del evento (tipo, fecha, hora y quedada, pista con «abrir en el mapa»); **«¿Vas?» Voy · No voy · Duda**; si no va, motivo **opcional** (solo lo ven los gestores, D46); contadores Van · No van · Sin responder (con nombres, D46).
     - Avisos push de la web instalada (service worker ya registrado, `public/sw.js`), recordatorios automáticos y aviso al cambiar pista u hora; SportEasy deja de ser la fuente de respuestas función a función (D64).
     - **«No voy» con motivo y periodos de no disponibilidad (D87):** al responder «no voy», el jugador **elige un motivo** de una lista (como en SportEasy). Además puede marcar **periodos de no disponibilidad** (viaje, vacaciones…) **de forma visual**: en un calendario elige el **desde** y el **hasta** y el motivo; eso pone «no voy» con ese motivo en **todos los eventos del periodo** y en **los que se creen después dentro de él** (al crear un evento se miran los periodos vigentes). Puede ver, editar y borrar sus periodos. **Gestores:** ven motivos y periodos de todos (en Eventos y en el detalle de cada evento). **Resto de jugadores:** solo «no va» (D46, D82). Esquema nuevo (respuestas con motivo, periodos de no disponibilidad), con RLS como `asistencia_motivos`, backup y staging antes de real.
     - **Fase puente (D80):** la rutina C lee de SportEasy tanto los motivos como los periodos de no disponibilidad, y Gestión los muestra; los jugadores siguen respondiendo en SportEasy hasta el cambio.
     - Resto de migraciones de `docs/MIGRACION_WEB.md`.

0. **[CERRADO] Avisos de choque de equipación (D75)** — con la regla oficial (Bases 47 JDM, 5.11), mergeado a `main` el 06/10/2026.
   - [x] Equipaciones, regla, módulo único, web, Mi zona, gestión, Scouting, migración en producción y pruebas.
   - [ ] Rutina C: añadir la línea `lineaEquipacion` a la convocatoria/WhatsApp.
   - [ ] Revisar cambios de equipación de los rivales y el orden local/visitante en cada revisión de calendario (rutina B, `equipacion:sync`).

1. **[CERRADO] Plataforma v0: identidad, zona personal y pedido de ropa** — mergeada a `main` el 02/10/2026 (merge `ad972df`).
   - [x] Esqueleto Next.js en `plataforma/` + migraciones con RLS en todas las tablas + semilla de la plantilla 26/27 y enlaces.
   - [x] Zona personal `/j/<enlace>`, pedido de ropa (VIVE), zona de gestión (jugadores y enlaces, pedidos, Excel para VIVE).
   - [x] Pruebas de extremo a extremo (`npm run pruebas`, 81 comprobaciones OK).
   - [x] Supabase real creado por Iván, migraciones y semilla aplicadas, Iván gestor; verificación de seguridad contra el proyecto real 42/42 OK (26/09/2026).
   - [x] Nombres visibles confirmados (D61). Dorsal libre en pedidos para familiares (D60).
   - [x] **Login único con Google o código por correo, con lista blanca** (D68, 02/10/2026) — sustituye a los enlaces `/j/<token>` (D45, derogada). Migración `20261002120000_login_google_lista_blanca.sql` aplicada en el proyecto real; `npm run pruebas` y `node pruebas/verificar_real.mjs` en TODO OK.
   - [x] **Google Cloud** (proyecto "Maccabis", pantalla de consentimiento, credenciales OAuth) **y proveedor Google activado en Supabase** — HECHO, verificado por Claude el 02/10/2026.
   - [x] **Hook "Before User Created"** (`public.antes_de_crear_usuario`) **y "Allow new users to sign up"** activado **en ese orden** (`plataforma/LEEME.md`, apartado 3) — HECHO por Iván el 02/10/2026.
   - [x] **Site URL y Redirect URLs** de Supabase (`plataforma/LEEME.md`, apartado 3, punto 5) — verificadas el 02/10/2026.
   - [x] `npm run db:correos` ejecutado (02/10/2026) con `SportEasy_maccabis (1).xlsx`: 8 correos casados por nombre exacto. Ampliado el mismo día: Edimil Feliz Gómez, Ignacio Mateos Aparicio y Nicolás Yamín Squicciarini dados de alta como jugadores `solo_entreno` (entrenan, sin ficha MdA/MdL, el motor no los convoca) con su correo. Total real: **28 jugadores, 11 con correo**.
   - [x] Las 17 correspondencias restantes (nombre de SportEasy ≠ nombre oficial exacto, p. ej. "Barrimelo Barreiro" = Carlos Barreiro), confirmadas por Iván (02/10/2026) y escritas. **28/28 jugadores con correo.**
   - [x] **Iván:** Vercel configurado (carpeta raíz `plataforma`, 2 variables públicas). **"OK vista previa"** dado el 02/10/2026, **después del merge** (`ad972df`): validado en el móvil sobre `maccabis.vercel.app` ya en producción, con "Entrar con Google" probado de verdad.
   - [x] Dar de alta como gestores a Carlos y Edu por correo (`npm run db:gestor`): hecho el 25/10/2026 (Edu ya vinculado; Carlos, ver arriba).
   - [x] **Abrir la campaña "Ropa 2026/27"** desde `/gestion`, fecha límite **domingo 18/10/2026** (decidido por Iván, 02/10/2026). Abierta por Claude (navegador).
   - [x] **Pedido de ropa 26/27 enviado a VIVE** (campaña cerrada, 9 pedidos; `db:estado` del 26/10/2026: 1 campaña, 9 pedidos).
   - [x] **Merge a `main`** (merge `--no-ff` `ad972df`, 02/10/2026) — verificado antes y después: `npm run pruebas` 93/93 OK, `node pruebas/verificar_real.mjs` 43/43 OK, en los dos casos. Empujado a origin.
   - [x] **Cambio de correo seguro** (03/10/2026, rama `feat/correo-seguro-jugadores`, sin mergear): `public.cambiar_correo_jugador` sincroniza `jugadores.email` con su cuenta de Auth (la renombra si ya existía, sin huérfanos ni duplicados) y con `gestores.email` si esa persona también es gestora. `npm run db:correo -- <person_id> <correo_nuevo>` para hacerlo desde local. Aplicados en real: Guillermo Galán Domingo → Gmail, David López Lucero → Gmail, Tomás Teruel → Gmail (confirmados por Iván el 03/10/2026). Marca "Entrará con código por correo" en Gestión → Jugadores para quien no tiene Gmail. `npm run pruebas` 107/107 OK, `node pruebas/verificar_real.mjs` TODO OK. Detalle en `docs/ESTADO.md`.
   - [x] ~~Pedir su Gmail a 6 jugadores~~ **Obsoleto (26/10/2026):** 26 de 27 ya han entrado en la web; solo falta Fernando M.
   - [x] **SMTP propio HECHO** (comprobado por Claude en Supabase el 26/10/2026: `smtp.gmail.com`, remitente eyeshar@gmail.com, nombre «Maccabis»). Los códigos ya no salen por el servicio compartido de Supabase. **Plantilla del código HECHA** (26/10/2026): `{{ .Token }}` en español (LEEME §3 y §7 cumplidos).
   - [x] **Google falla con el error genérico si el correo tiene una cuenta de Auth sin confirmar** (creada por un código pedido y nunca usado; caso Edwin, 26/10/2026). Hecho en `feat/numeros-desplegables`, sin cambios de base de datos: cuando Google falla, `/entrar` sugiere «Prueba con el código por correo: al entrar una vez así, Google funcionará después».
   - [x] **Longitud del código:** Supabase «Email OTP Length» **no se ha cambiado y sigue en 8**. La solución es que la casilla de `/entrar` acepte de 6 a 8 dígitos (`minLength 6`, `maxLength 8`) y se llame «Código del correo»; `pruebas:numeros` entra con un código de 6 y con uno de 8.
   - [x] **«Han entrado» por entrada real** (D140, `fix/panel-entrados`): cuenta solo quien tiene `last_sign_in_at`; quien pidió código y no entró sale en «Faltan» con su nota. Mergeada (`45e476e`) y migración `20261027110000` aplicada en el Supabase real con D111 (27/10/2026): Panel real 26/27, falta Fernando M.
   - [ ] **Pendiente de Iván:** si quiere el texto exacto de cada intento de acceso fallido, mirar **Authentication → Logs** en el panel de Supabase (no es accesible por SQL; Claude no tiene acceso).
   - [ ] **Pendiente de Iván:** decidir si la rama `feat/correo-seguro-jugadores` se mergea a `main` (el código ya está aplicado en el proyecto real independientemente del merge).
2. **Rutinas semanales, Fase 1 "Aprendizaje" (D63, `docs/PLAN_TRABAJO_2026-27.md`):**
   - [ ] **Lun 5/10:** aprendizaje de la rutina A con las actas de la J1 (Enlace Móvil de Windows + control del ordenador, D70 matiza D69; Iván solo tiene el móvil encendido, con wifi y cerca del PC).
   - [ ] **Jue 8/10, 20:15:** sesión de aprendizaje de la rutina B (calendario, por navegador) con Iván.
   - [ ] **Lun 12/10:** sesión de aprendizaje de la rutina C (disponibilidad y convocatoria, por navegador) con Iván, para la J2.
4. **J2 (18/10):** la disponibilidad y la convocatoria las cubre la **rutina C** (aprendizaje lunes 12/10, leyendo SportEasy — `docs/PLAN_TRABAJO_2026-27.md`), no la plataforma: ya no hace falta construir nada de esto para la J2.
   - **Movidas a la Fase 3 (noviembre, `docs/PLAN_TRABAJO_2026-27.md`)** — venían de este punto 4, "Bloque siguiente, para la J2 (18/10)": **calendario único** (carga inicial desde el Ayuntamiento o desde el calendario de los delegados subido una vez); eventos editables por gestores; entreno recurrente con todos los que entrenan convocados; **"Mi semana"** (disponibilidad por partido, plazo martes 22:00); lista de quién va (D46); panel de disponibilidad con recordatorio de WhatsApp; pase de lista posterior; detector de cambios con Aceptar/Ignorar (D47, ver `docs/SONDEO_CALENDARIO_AYTO.md`).
   - **Staging de Supabase (D53)** se mantiene como requisito previo a la Fase 3, antes de tocar esquema o datos en producción.
5. ~~**Motor de convocatoria v0.1 para la J3 (25/10):** solo restricciones duras (D48)~~ → **sustituido por la convocatoria v1 completa (D107, rama `feat/convocatoria`), para la J4.**
6. **Migración del dashboard** a la plataforma.
7. **Estadísticas de rivales** (`docs/SONDEO_RIVALES_STATS.md`; datos por jugador de otros equipos solo en gestión).
   - [x] **Liga 26/27 (06/10/2026, D73/D74):** pipeline, `data/liga_2026-27.json`, pestaña pública (en `main`), tablas privadas y pantallas de gestión Scouting rivales y Liga consolidada (rama `feat/plataforma-v0`), migraciones aplicadas al proyecto real y J1 cargada.
   - [x] **`feat/plataforma-v0` mergeada a `main`** (06/10/2026, `ae4f4cc`) y verificada en producción (Scouting rivales y Liga consolidada, solo gestores).
   - [x] **Tabla "Todos los jugadores", líderes por partido, fichas de dobladores filtradas y enlaces** en Liga consolidada (06/10/2026): OK de Iván y mergeado a `main`.
   - [ ] **Contrastar la clasificación calculada con la oficial** de Deportes/web (jueves 20:00) y, si hay incomparecencias, anotar sus puntos oficiales (D74).
   - [ ] Rutina A: bajar cada lunes las hojas de los dos grupos (`docs/RUTINAS/A_ACTAS.md`); la J2 es la primera vez.
8. **Tesorería** (solo registro de cuentas, D52).

**Plan B (02/10/2026, D69/D70; matizado el 23/10/2026, D106):** **subida de actas desde la zona de gestión** (hoy: actas desde la web gesdeportiva.fbm.es con la sesión de Iván en Chrome, D106; hojas con Claude controlando Afición FBM por Enlace Móvil, D70, `docs/PROCEDIMIENTO_JORNADA.md`). Solo se construye si esa vía deja de ser viable (p. ej. si Afición FBM bloquea el acceso remoto).

**Además:**
- [ ] **Exportar el balance de asistencias de SportEasy antes de apagarlo** (noviembre), para conservar los eventos de 26/27.
- [ ] **Una única consulta a Indalweb** (soporte@gesdeportiva.es) sobre una exportación oficial de actas y estadísticas; si dicen que no, se cierra (D49).
- [x] ~~Mergear `feat/pipeline-estadisticas`~~ — HECHO (26/09/2026, `f69a39f`), test de regresión OK en `main`. Listo para la J1 (5/10).
- [ ] `feat/calendario-automatico`: revisar y mergear como detector de cambios (D47), dentro del bloque de la J2.

**SportEasy 26/27 (02/10/2026, D62):**
- [x] ~~Decidir si se mantiene el apagado de SportEasy en noviembre o se usa toda la temporada.~~ — **RESUELTO:** `docs/NORMAS_DE_TRABAJO.md` §8 (D64) fija que se mantiene **completo como respaldo hasta septiembre de 2027**, sin apagarlo antes.
- [ ] **Borrar en SportEasy las 3 ubicaciones duplicadas "Moratalaz"** (dirección "Pista 1/2/3") que creó la carga en bloque; ya no las usa ningún partido.
- [ ] **Jornadas 2 (18/10/2026) y 13 (07/02/2027):** MdA y MdL juegan a la misma hora (10:15); esos domingos los de doble ficha no pueden estar en los dos partidos. Tenerlo en cuenta en el motor de convocatorias.
- [ ] **Pasar el calendario 26/27 a datos del repo** (p. ej. `data/calendario_2026-27.json`) para la futura web, si se mantiene el plan de calendario propio. Sin datos personales.

---

## Ahora — arranque de la temporada 2026/27 (jornada 1: domingo 4/10, D38) — _histórico; ver "Orden vigente" arriba_

### 0. Pendiente de Iván (desbloquea lo demás)
- [ ] **Verificar con Claude Code la rama `feat/pipeline-estadisticas`** y decidir si se mergea **antes del 4/10**. Es lo que procesa la jornada 1 (ver punto 2).
- [ ] **Verificar la rama `feat/calendario-automatico`** (se mergea después de la del pipeline).
- [ ] **Prueba de exportación de SportEasy:** ¿"Asistencias → Por eventos → exportar" incluye **eventos futuros con respuestas** (p. ej. el amistoso del 27/09)? Indicio: el export de hoy llega sólo hasta el 23/09 (`docs/SPORTEASY.md`). Decide la "Decisión pendiente" de abajo.
- [ ] **Pedir al soporte de SportEasy la plantilla Excel de importación del calendario** (vía principal, D36).
- [ ] **Leer la cláusula literal de SportEasy** (`docs/SPORTEASY.md`) y decidir si se mantiene el agente de carga como plan B (D36).
- [x] Tabla de posiciones, niveles A–E y Dobla/No dobla de 2026/27 guardada en `privado/plantilla_2026-27.csv` (con `person_id`) y criterios de reparto en `privado/criterios_convocatoria.md`, fuente de la rutina C. Ignorados por git; no se copian a `data/` ni a docs.
- [x] **Responder las preguntas abiertas** de `docs/REGLAS_CONVOCATORIA.md`: respondidas por Iván el 23/10/2026 (reglas v1, D107).
- [ ] **Corregir el delegado del MdA** en la organización (Varas → Barreiro; Barreiro también en el MdL).
- [ ] **Localizar las 40 hojas XLSX de 25/26** que faltan (sólo si se quiere regenerar la 25/26 con hora, pista y las 3 correcciones; ver ESTADO). No es urgente.
- [x] ~~Confirmar `docs/PLANTILLA_26-27.md`~~ — HECHO (25/09/2026): 3 personas nuevas creadas, `previsto_2627` actualizado, tabla de motes.
- [x] ~~Recuperar la hoja de Torneos 2018 del MdL~~ — **irrecuperable** (Iván): congelada como "sin PDF" con sus 17 nombres (D41).
- [x] ~~Decidir sobre el sondeo de actas~~ — HECHO: un solo gesto de Iván; sin permiso de la FBM (D35).

### Decisión pendiente — ¿sustituir YA la confirmación de disponibilidad de SportEasy?
**Si el Excel de SportEasy no trae eventos futuros** (prueba de Iván arriba), la disponibilidad semanal no se puede sacar de SportEasy y habría que adelantar a 26/27 lo que D30 dejaba para 27/28: una función propia de confirmación de disponibilidad. Dos opciones:
- **(a) Cuentas de usuario** para los ~22 jugadores (login real, Supabase Auth). Más robusto; más fricción para el jugador (registro y contraseña).
- **(b) Enlace personal sin contraseña** por jugador (un enlace secreto por persona, que se manda por WhatsApp). Cero fricción; si el enlace se reenvía, otro puede contestar por él.
- **Requisito en las dos:** **roles separados**. Un jugador **nunca** puede ver niveles ni datos de gestión (D39); sólo su propia disponibilidad (y como mucho, quién va).
- **Depende de** la prueba de exportación de Iván. No se construye nada hasta decidir.

### 1. Calendario 26/27 con horas + carga en SportEasy
- [x] **Tabla limpia del calendario y marcadores desde datos abiertos** — HECHO en rama `feat/calendario-automatico` (sin mergear): `data/calendario_2026-27.json` + `data/sporteasy_calendario_2026-27.csv`, por código de equipo, con margen entre las dos fichas del mismo domingo. Workflow gratuito (aviso semanal + descarga con botón). `docs/CALENDARIO.md`.
- [ ] **Cuando el portal publique la 26/27:** `--descubrir`, confirmar los códigos de MdA (G1) y MdL (G2) con el acta de la jornada 1 y escribirlos en `scripts/calendario/config_2026-27.json`.
- [ ] **Mientras no publique (probable en la jornada 1, D38):** transcribir el calendario que reciban los delegados a `data/calendario_manual_2026-27.csv`.
- [ ] **Carga en SportEasy con la plantilla del soporte** (D36). Plan B: agente supervisado (D31), si Iván lo mantiene.
- [x] ~~Arreglar la URL del 300257~~ — HECHO (25/09/2026): el portal renumeró los recursos; tabla nueva en `build_rivales_2026_27.py`, resultado idéntico.
- [ ] Refrescar la pestaña de rivales con los grupos definitivos cuando el 211549 publique la 26/27.

### 2. Actas y estadísticas (primera prioridad de construcción, D32)
- [x] **Pipeline local reproducible** — HECHO en rama `feat/pipeline-estadisticas` (sin mergear): `scripts/estadisticas/`, en Node, integrado en `build:datos`. Test de regresión contra 2025/26 superado (`npm run test:regresion`). Guarda además **hora y pista**.
- [x] **"Un solo gesto" semanal** — HECHO en la misma rama: `npm run jornada`. Iván descarga actas y hojas sin renombrar; el comando copia a `fuentes_fbm/2026-27/` (fuera de git), valida y resume.
- [ ] **Jornada 1 (4/10):** primera ejecución real de `npm run jornada` (requiere haber mergeado la rama).
- [ ] Probar la lectura del **export directo de SportEasy** con partidos de liga de 26/27 (hasta ahora sólo hay amistosos y entrenamientos).
- [ ] Opcional: sugerir al Ayuntamiento que publique los anotadores en datos abiertos (sondeo, apartado 6).
- [x] ~~Tabla 2026/27 del diccionario de nombres (dos "Eduardo")~~ — resuelto por la tabla de motes de `docs/PLANTILLA_26-27.md`; las hojas de la FBM traen nombre completo.

### 3. Convocatorias con doble ficha (estreno en la jornada 3, D34)
- [x] **Reglas de convocatoria v0** — DOCUMENTADAS (25/09/2026): `docs/REGLAS_CONVOCATORIA.md` (sin nombres ni niveles). Se validan en las jornadas 1 y 2, convocadas a mano con el chat de diseño (D40).
- [ ] **Flujo semanal objetivo** (sin cambios): lunes disponibilidad (recordatorios: SportEasy Premium, D37) · lunes-martes propuesta de reparto MdA/MdL · martes mensaje de WhatsApp · domingo noche actas y estadísticas (`npm run jornada`).
- [ ] **Reglas v1** tras las jornadas 1 y 2, con los ajustes anotados por Iván.
- [ ] Jornadas 1 y 2: se convocan como hasta ahora, aplicando las reglas v0 a mano (D34, D40).

### 4. Hacia 27/28: sustituir SportEasy (D30)
- [ ] **Confirmación de disponibilidad:** primera función candidata. Puede adelantarse a 26/27: ver "Decisión pendiente" arriba.

## Después — migración a Next.js (continúa, por detrás de lo anterior, D32)

- [ ] **Arrancar el proyecto en Claude Code** (repositorio, Next.js base, conectar Supabase + Vercel). Iván debe crear cuentas gratuitas de Supabase y Vercel (credenciales NUNCA por chat; se manejan en Claude Code).
- [ ] Elegir **nombre para la sesión de Claude Code** (TCPC usa "Fable").
- [ ] **Migrar el dashboard de estadísticas 25/26** (v1 web estática) a la zona pública del nuevo stack.
- [x] **Integrar estadísticas históricas** de Carlos — HECHO (rama `feat/historico-temporadas`, 04/08/2026).
  - Las **10 temporadas** con estadística (13/14, 14/15, 15/16, 17/18, 18/19, 19/20, 20/21, 21/22, 23/24, 24/25) más los MdA agregados de 23/24 y 24/25.
  - Resuelto con **selector de temporada en el mismo dashboard** (ver DECISIONS D8), no aparte.
  - Pipeline reproducible: `npm run build:datos`. Informe en `docs/INFORME_HISTORICO.md`.

### Pendiente del histórico (cabos sueltos, ninguno bloquea)

- [ ] **Verificar la ficha de Ignacio Mateos Aparicio** ("Nacho S.", 23/24 y 24/25): la tabla MdA confirma que jugaba en las dos fichas (36 puntos en el MdA de 23/24), pero sigue sin aparecer en las fichas de inscripción MdL. Falta localizar en qué ficha constaba.
- [x] **Ampliar el diccionario de nombres al MdA** — HECHO (04/08/2026). Iván cerró las tablas `### 2023/24 (MdA)` y `### 2024/25 (MdA)`; los 37 motes resuelven a persona real y no queda ninguno sin catalogar.
- [ ] **Resolver 3 motes sueltos del MdL**: `Paaco` y `Coach` (14/15, sin puntos) y `Víctor` (17/18, **6 puntos**). No se han deducido: hace falta una fila explícita en el diccionario.
- [x] **Unificar el `person_id` de Víctor Martínez** — HECHO (04/08/2026). Unificado a `martinez-martinez-victor` en todos los datos.
- [x] **4 personas con estadísticas ausentes de la matriz** — HECHO (04/08/2026): añadidas en los años que confirman las actas.
- [x] **Identificar los nombres de hojas de inscripción** — HECHO (04/08/2026): 5 personas creadas y el "Alejandro de Alicante" unificado.
- [x] **Confirmar las correspondencias dudosas** — HECHO (04/08/2026): dos eran erratas de nombre y tres se confirmaron como alias.
- [x] **Fijar el criterio de los "Torneos Municipales"** — HECHO (04/08/2026): pertenecen a la temporada que termina en ese año; liga y torneo se suman (D19).
- [x] **Aplicar de verdad las hojas de torneo a la matriz** — HECHO (04/08/2026): retirado el filtro obsoleto que las excluía todas; 2016/17 pasa de 20 a 24 personas (D23).
- [x] **Las dos hojas de Torneos Municipales 2017 (#119823 y #120202)** — **ACLARADO (04/08/2026), corrigiendo la descripción anterior.** Eran **DOS TORNEOS DISTINTOS**, no dos versiones de la misma inscripción: el dataset del Ayuntamiento demuestra que cada código tiene sus propios partidos, en sedes y distritos distintos y contra rivales distintos, los mismos tres días (23/04, 07/05 y 14/05 de 2017):
  - `#119823` → **Vicálvaro** (CDM Valdebernardo): vs Sáinz de Vicuña B, Amazonia y VBA.
  - `#120202` → **Moratalaz** (pabellones 1 y 2): vs Inmsershore, Mistery Men y Fontarrón.
  - **Para la MATRIZ DE PERSONAS la conclusión anterior sigue siendo válida**: la plantilla de la 120202 es un subconjunto de la de la 119823 (jugaron casi los mismos), así que **no entró nadie nuevo y la matriz de 2016/17 no cambia** (24 personas). Lo que estaba mal era la descripción: no era "la misma competición con una hoja más corta", eran dos torneos con plantilla solapada.
  - **Los 6 partidos SÍ constan** en `data/rivales_jdm.json`, etiquetados con `fase: "torneo"`.
  - Del PDF de la 120202 sigue sin haber copia (sólo una captura), pero ya no hace falta: sus partidos están en el portal.
- [ ] **Identificar a "Pupo" (2016/17)** — investigado el 04/08/2026 sin resultado: no aparece en ninguna estadística ni en ninguna hoja conservada. Se planteó que la hoja 120202 pudiera contenerlo; al resolverse que es un subconjunto de la 119823, **esa vía queda descartada**. Pupo y los otros tres con 2016 que no salen en ninguna hoja (Alan Venegas, Carlos Pérez Núñez y Juan Carlos Blázquez) siguen viniendo sólo del Excel de la Historia. La vía que queda es **localizar la hoja de inscripción de la liga 2016/17 (37 JDM)**, que falta en `docs/Fichas`; si aparece, el nombre que no esté en ninguna otra será Pupo. Alternativa: preguntar a Carlos o a quien jugara ese año.
- [ ] **Repasar las 4 hojas transcritas por visión** (2013/14 MdL, 2014/15 MdL y las dos de 2017/18): son escaneos sin texto, leídos de la imagen. En `docs/fichas_transcritas.json`.
- [ ] **Aclarar el caso de Adán Herrera Benzán**: jugó 3 partidos en 2017/18 sin constar en ninguna hoja de esa temporada.
- [ ] **Cabos del diccionario de la matriz** (`docs/HISTORIA_diccionario_matriz.md`): desambiguar 'Sam' (Rogaia vs Gruppo) por año, repartir 'Ignacio' entre Ferrando/Mileo/Mateos, y confirmar 'Jose' 2020 = Gil Fernández (confianza media).
- [ ] **Revisar 3 celdas del MdA 23/24** con decimales donde debería haber enteros (marcadas con "?" en el dashboard).
- [ ] **Recuperar, si existen, las actas de los partidos sin estadística individual**: 15/16 (5, 11, 18) y 21/22 (10 al 18).
- [ ] **Enriquecer las históricas** si aparecen las fuentes: fechas de partido, dorsales, parciales por cuarto del MdL y asistencia. Hoy no existen y por eso esas columnas y pestañas ni se muestran.

## Rivales y clasificaciones desde datos abiertos (JDM)

Fuente: dataset **300257** del portal de datos abiertos del Ayuntamiento de Madrid
(licencia CC BY 4.0, republicable citando la fuente). Cubre **10 temporadas**: 2014/15,
2015/16, 2016/17, 2017/18, 2018/19, 2020/21, 2021/22, 2022/23, 2023/24 y 2024/25.

- [x] **Criterio de identificación del club** — RESUELTO (04/08/2026): por **Nº EQUIPO de la hoja de inscripción**, que es el `Codigo_equipo` del dataset. Descarta solo el club rival `MACCABI` de 2014/15 y los homónimos.
- [x] **Partidos de rivales** — HECHO (04/08/2026): `data/rivales_jdm.json` con **328 partidos** de 10 temporadas, informe en `docs/RIVALES_JDM.md`. Fuente independiente, sin cruzar con el histórico propio.
- [x] **2020/21, el tercer equipo** — RESUELTO por ficha: nuestros son #149302 (MdL) y #149303 (MdA); **#149233 no es del club**.
- [ ] **Diccionario de nombres de rival** (bloque futuro, no ahora): decidir sobre 20 pares de nombres que podrían ser el mismo equipo escrito de dos formas (`SETTAS`/`CAFÉ HNOS. VELASCO SETTAS`, `CDCEBE`/`CD CEBE`, `SUIZA`/`SUIZA B.C`/`CARPASION SUIZA`…). **No se han fusionado**: la fuente guarda el nombre literal. Ver `docs/RIVALES_JDM.md`.
- [x] **Los 3 recuentos que no cuadraban** — **DIAGNOSTICADOS (04/08/2026)**, ver `docs/CONTRASTE_JDM_HISTORICO.md`. No hay error en ninguna de las dos fuentes: recogen cosas distintas. 2014/15 y 2015/16 → el portal **no publica la fase MARCA** (3 y 2 partidos) y añade una **incomparecencia 2-0** que el club no anotó. 2018/19 → el portal incluye 3 partidos de **torneo** que el histórico propio no recoge.
- [ ] **BLOQUE FUTURO — Corregir la etiqueta MdL/MdA de 2017/18, 2018/19 y 2020/21, y documentar los huecos.** **VERIFICADO con evidencia interna de los Excel** (04/08/2026, ver `docs/DIAGNOSTICO_MDL_MDA.md`): esas tres temporadas llevan etiqueta `equipo: "MDL"` pero contienen las estadísticas del equipo que compitió como **Maccabi de Acostar**. Pruebas: la hoja `Clasificaciones` de cada fichero sitúa al MdA en el grupo cuyos rivales anota el Excel, y en 2020/21 el Excel **anota partidos contra `MDL` y contra `MACCABI DE LEVANTAR`** — nadie juega contra sí mismo. Confirmado también en sentido inverso: 2014/15, 2015/16 y 2021/22 sí son MdL.
  - **Huecos reales**: del MdL oficial de esas tres temporadas **no hay estadísticas de jugadores** en ninguna fuente del club, sólo su clasificación final. Sus partidos y marcadores sí están en `data/rivales_jdm.json`.
  - **Pendiente de decidir por Iván**: (a) si se corrige la etiqueta o si el club usa la convención "MdL = el equipo del que llevamos estadísticas"; (b) qué hacer con los huecos. **El rendimiento de los jugadores no cambia en ningún caso**: sólo bajo qué ficha se cuenta.
- [x] ~~**Añadir a `rivales_jdm.json` el tercer equipo de 2020/21 (`#149233`).** El bloque de rivales lo descartó por 0 % de coincidencia de marcadores, pero eso sólo probaba que no era el equipo del Excel: **la clasificación interna del Excel lo lista junto a `MDL` y `MDA` en el mismo grupo, así que sí era del club**. Faltan sus 14 partidos.~~ **CANCELADO (25/09/2026):** #149233 **no es del club**, es un rival. Lo resuelve la regla del nombre confirmada por Iván (D26): en 2020/21 ya existe `MDL`, así que el `MACCABI DE LEVANTAR` de ese año es otro equipo. `rivales_jdm.json` ya estaba bien.
- [ ] **Confirmar 2022/23** (bloque futuro): es la única temporada que quedó **sin validar** —no hay `season_2022-23.json` con el que contrastar—, así que su código se aceptó sólo por nombre dentro de Moratalaz. La 2016/17 sí quedó respaldada por los códigos de ficha.
- [ ] **Clasificaciones**: no se han tocado en el sondeo. Criterio ya acordado: la clasificación
  **de la fase donde acabó Maccabi** cada año. Los recursos de clasificaciones del dataset son
  los n impares (1, 5, 9, 13, 16, 20, 24, 28, 32).
- [ ] **Cruzar la fuente JDM con el histórico propio** (`season_*.json`, `personas.json`, la
  matriz): bloque futuro, sólo cuando la fuente JDM esté cerrada.
- [ ] **Tapar 2013/14, 2019/20 y 2025/26 desde las actas propias**: no están en el histórico
  del portal (2025/26 vive en el dataset 211549 de temporada en curso).
- [ ] **Vía de cruce descubierta**: el `Nº EQUIPO` de las hojas de inscripción es el
  `Codigo_equipo` de este dataset (verificado con #119823 y #120202 de Torneos 2017). Sirve
  para enlazar hojas y partidos sin depender del nombre.

## Siguiente (bloque 2: historia del club)

- [x] **Datos de la Historia integrados, reconciliados y completados** — HECHO (04/08/2026, rama `feat/historia-club-datos`): `data/historia_club.json` (80 personas), `data/personas.json` (registro único de identidades) y `data/fichas_inscripcion.json` (21 hojas oficiales cruzadas).
- [x] **Sección visual "Historia de los Maccabis"** — HECHO (04/08/2026, rama `feat/historia-club-ui`): pestaña "El Club" con rejilla maestra, tira temporal y ficha de persona enlazada con las estadísticas.
- [ ] **Arreglar el desbordamiento horizontal en móvil** del dashboard (previo a la Historia: afecta también a las pestañas antiguas). — **Liga resuelto en la web nueva (D91, 07/10/2026):** 0 px a 375 px en todas las páginas de `/liga`; queda Plantilla/Ficha (entrega 2) e Historia (entrega 3).
- [x] **Migración de GitHub Pages a la web nueva (pista M, D91–D93):** entrega 1 Liga (hecha, pendiente del OK de Iván en producción) · entrega 2 Plantilla y Ficha (`/plantilla`, `/jugador/<person_id>`, hecha, pendiente de la revisión de Iván) · entrega 3 Historia (`/historia`, hecha, pendiente de la revisión de Iván). **CERRADA (07/10/2026):** Liga, Plantilla/Ficha e Historia migradas; redirecciones activadas y barra retirada en el commit `7a9b041` (reversible con `git revert`); GitHub Pages solo redirige.
- [ ] ~~Sección visual "Historia de los Maccabis"~~ — detalle original:
  - Matriz de 80 personas × 14 temporadas (2013→2026), con dorsal y nº de temporadas en activo por persona.
  - Idea: línea temporal del club, quién estuvo cada año, veteranía, "since 2013". Diseño visual y bonito.
  - Nota: el Excel tiene hojas "Equipo", "Copy of Equipo" (ordenada por dorsal) y "Sheet2". Usar la principal.

## Mejoras técnicas (prioridad baja, sin urgencia)

- [ ] **Agrupar las hojas de inscripción también por Nº de equipo** en `scripts/consolidar_fichas.js`. Hoy agrupa por año + equipo + competición y dentro de cada grupo se queda con la hoja de más jugadores; dos inscripciones distintas del mismo torneo caen en la misma clave y la más corta se descarta entera. Si algún año apareciera un caso donde la hoja corta tuviera a alguien que la larga no, se perdería en silencio. **Hoy no ocurre** —el único caso conocido, la 120202 de 2017, es subconjunto de la 119823 y no tiene exclusivos—, así que no corre prisa. El arreglo es incluir el Nº de equipo en la clave para que dos inscripciones **sumen**, igual que ya suman liga y torneo. No hay riesgo de doble conteo: la unión de nombres deduplica.

## Después (bloque 3: gestión — requiere login)

- [ ] Montar **login real** (Supabase Auth) y estructura de la zona de gestión (solo los 3 gestores).
- [ ] Diseñar la zona de gestión con pantallas reales (no en abstracto).
- [ ] **Tesorería / cuentas** (Eduardo). Datos sensibles → zona protegida.

## ~~Más adelante (bloque 4: convocatorias — esperar a octubre)~~ → subido a "Ahora", punto 3 (25/09/2026)

- [ ] **Convocatorias con doble ficha MdA/MdL** — el mayor dolor. _Ver el flujo semanal y las reglas en "Ahora", punto 3._
  - Cruzar disponibilidad (de export SportEasy) para decidir quién juega en cada ficha.
  - Generar mensaje de WhatsApp de convocatoria listo para copiar/pegar.
  - Generar recordatorio para quien no ha contestado.
- [ ] **Puente con SportEasy**:
  - ~~Generar el Excel del calendario de la temporada en formato importable (evita crear ~20 eventos a mano por equipo).~~ — **OBSOLETO (02/10/2026):** resuelto con la creación en bloque de SportEasy más el agente de navegador (D62).
  - ~~Investigar la sección "Campeonatos" de SportEasy para vincular la liga JDM y traer el calendario hecho.~~ — **OBSOLETO (02/10/2026):** resuelto con la creación en bloque más el agente (D62); la importación automática de calendario no cubre nuestra federación (ver SPORTEASY.md).
  - PRESIONAR por vías de sacar/subir datos de SportEasy más allá del Excel (deseo de Iván). Si no sale nada, Excel plan B.

## Temporada 26/27 (cuando arranque y se defina)

- [x] **Decidir los candidatos a mismo equipo** — HECHO en parte (25/09/2026): Iván confirmó 7 alias (D27) y descartó SPORTING DE VALLECAS (y variantes) y GSD VALLECAS como VALLEKAS BASKET.
- [ ] **Candidatos que siguen sin confirmar** (7, en `docs/RIVALES_2026-27.md`): ENFERMOS DEL BASKET, LITROS DE MAU, Litros de Pahou, JVK - Jugones ValleKas, THE RED BOYS, PONENOS, RH PROPERTIES PONENOS.
- [ ] **Regla del nombre del club fuera de Moratalaz** (D26): se ha aplicado dentro del distrito del club. Leída para todo Madrid chocaría con las fichas de 16/17, 17/18 y 18/19, porque había otro equipo "MDL" en Retiro. Confirmar que el ámbito es el distrito del club.
- [ ] **Pelota Naranja 08/03/2026 (MdL)**: el portal da 20-0 por incomparecencia y `season_2025-26.json` 0-0. Decidir si se corrige el histórico propio (bloque aparte, staging).
- [ ] **2019/20**: `season_2019-20.json` (etiqueta MDL) anota un partido contra "MDL" → probablemente es el MdA. Revisar junto con la decisión pendiente de DIAGNOSTICO_MDL_MDA (17/18, 18/19, 20/21).
- [ ] **Refrescar el 211549** cuando arranque la 26/27: el dataset "temporada en curso" pasará a la nueva temporada y la 2025/26 debería aparecer en el histórico 300257. Guardar antes otra copia bruta con fecha.
- [x] **Pestaña "Rivales 26/27"** — EN PRODUCCIÓN (25/09/2026): aprobada por Iván con los retoques de D29 y mergeada a `main`. https://eyeshar.github.io/MACCABIS/?p=rivales&g=MdL
- [ ] **Regenerar la pestaña de rivales cada temporada cuando salgan los grupos**: actualizar `RIVALES` en `scripts/build_rivales_2026_27.py` (y el nombre de la temporada), descargar el 211549 y el 300257, correr el script de Python y después `npm run build:rivales`.
- [ ] Añadir un `favicon.ico` (el único error de consola del sitio es su 404).

- [x] **`data/season_2026-27.json` creado vacío con la plantilla** (rama `feat/pipeline-estadisticas`). Se carga partido a partido con `npm run jornada`.
- [x] ~~Preparar calendario 26/27 para SportEasy.~~ — **HECHO (02/10/2026):** 40 partidos cargados en SportEasy con un agente de navegador (D62).
- [x] **Plantilla 26/27 confirmada** (25/09/2026): 24 deportistas, 22 en ambas fichas; 3 personas nuevas creadas. `docs/PLANTILLA_26-27.md`.
- [x] **`consolidar_fichas.js` adaptado a 26/27** (25/09/2026): sólo "Deportista", con grupo (la fecha de alta no se publica); falla si falta un PDF registrado; Torneos 2018 congelada (D41).

## Notas de datos disponibles (ya subidos por Iván en el chat de arranque)

- Hojas de inscripción oficiales MdA y MdL (con DNI, fecha nacimiento, teléfono, email, altas/bajas). DATOS SENSIBLES → zona protegida. Útiles para nombres completos oficiales y altas/bajas.
- `Historia_de_los_Maccabi.xlsx` (histórico del club 2013-2026).
- Estadísticas Carlos 23/24 y 24/25 (MdA .xlsx, MdL .xls).
- `Equipo_MdL_2025-2026_Claude.xlsx` (pendiente de revisar en detalle).

- [x] Tabla de posiciones, niveles A–E y Dobla/No dobla de 2026/27 guardada en `privado/plantilla_2026-27.csv` (con `person_id`) y criterios de reparto en `privado/criterios_convocatoria.md`, fuente de la rutina C. Ignorados por git; no se copian a `data/` ni a docs.
- [x] Limpieza menor hecha: quitados `URL_DASHBOARD`, `URL_ESTADISTICAS` y `estadisticas()` de `plataforma/src/lib`.
- [ ] `pruebas:cuadre` compara con la web antigua de GitHub Pages, que ahora redirige: si se vuelve a necesitar, ejecutarlo con las redirecciones desactivadas (copia temporal de `data/redireccion_web.js` con `ESTA_ACTIVA = false`).
