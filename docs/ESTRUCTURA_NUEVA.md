# ESTRUCTURA NUEVA DE LA WEB — especificación

> Diseño **aprobado por Iván el 05/11/2026** en un lienzo de 10 pantallas de móvil. Escrita el 06/11/2026 (fase 1,
> `chore/guardia-y-analitica`) a partir del prompt original de la reestructuración, **con las correcciones de Iván del
> 06/11/2026** (marcadas «Corrección»). **Solo especificación: nada de esto está construido** salvo el bloque 0
> (analítica, hecha en la fase 1 y **sin activar**, D188). Calendario de fases: `BACKLOG.md`, «Orden vigente».
> Cuando se construya cada bloque, su decisión va a `DECISIONS.md` (la navegación nueva sustituye a D89 y D90).
>
> **Construida el 06/11/2026 (D189, `feat/estructura-nueva`): bloques 1 a 6 y «Yo».** Merge sin el OK de Iván, con las barreras (a)–(h) (norma de Iván de ese día). Lo que no se hizo de la especificación está en D189 («No se ha hecho») y en `BACKLOG.md`: el «Pase de lista» del evento y «Mensaje a los que faltan» para los que siguen en duda. **Hechos el 10/11/2026** (PR #72 a #76, D192), con las respuestas compactas en el móvil, el historial del calendario y `pruebas:gestion` a 412 px y en escritorio.

## Cómo se trabaja

- **Por bloques, un commit por bloque**, en el orden 1 → 6 dentro de su fase (bloque 0 ya hecho).
- **Cada fase se mergea con el OK de Iván.** _Corrección: la norma «merge sin OK» del prompt original **no se aplica**._
  El día del merge de cada fase se sigue este protocolo (las barreras (a)–(h) del prompt original, sin la autonomía):
  - **(a)** Antes de mergear: las pruebas de lo tocado en verde en local, la batería completa en verde en GitHub Actions,
    `typecheck` y `build`.
  - **(b)** Cambios de esquema solo si hacen falta, con D111 (`NORMAS_DE_TRABAJO.md` §10): copia de seguridad antes;
    migraciones solo aditivas, con su `.revertir.sql` (probado con `db:revertir --pila`); RLS solo gestores; ningún
    `DROP`, `DELETE`, `TRUNCATE` ni `ALTER` de lo existente; si algo se puede calcular de las tablas que ya hay, no se
    crea tabla.
  - **(c)** Prohibido enviar avisos push, correos o mensajes a jugadores reales durante el trabajo, las pruebas o las
    migraciones.
  - **(d)** Merge a `main` con `--no-ff`, en un solo merge commit.
  - **(e)** Tras el despliegue, **una sola carga de cada ruta principal** en producción (`/`, `/calendario`,
    `/evento/<uno>`, `/liga`, `/club`, `/gestion`, `/gestion/convocatoria`, `/yo`), a mano o con `curl`. Es la excepción
    mínima a D179: nada de recorrer más páginas ni medir velocidad en producción (eso, en local).
  - **(f)** Si algo falla en (e) o el despliegue da error: `git revert` del merge commit, empujar y comprobar que vuelve
    la versión anterior. Si una migración aplicada da problemas, su `.revertir.sql` con `npm run db:revertir --
    <migración> --confirmar <ref>` (D187). Nunca se deja producción rota.
  - **(g)** Si una parte no se termina, se mergea solo lo completo y probado; lo demás queda en la rama y en `BACKLOG.md`.
  - **(h)** Ningún dato de niveles, motivos o contadores de no convocados puede verse con sesión de jugador ni sin sesión.
- **Comprobación en local** (`next build` + `next start`) a 360, 390 y 412 px y en escritorio, con los cuatro tipos de
  usuario: sin sesión, jugador, gestor con ficha, gestor sin ficha. Capturas a 390 px de cada pantalla nueva y de la
  barra de cada rol en `privado/mockups_liga/rediseno/estructura_nueva/` (fuera de git), **antes** de pedir el OK.

## Sistema visual

Se mantiene (tokens de `globals.css`, Barlow Condensed / Barlow / JetBrains Mono, tema oscuro), con estos cambios:
- títulos de frase en minúscula normal;
- el color se reserva para estados (va, duda, no va, aviso) y para MdA (amarillo) / MdL (naranja);
- textos cortos para escanear: fuera los párrafos explicativos y los códigos «(Dnn)» del texto visible;
- objetivos táctiles de al menos 44 px.

## Bloque 0 · Analítica — HECHO en la fase 1, sin activar

- `@vercel/analytics` (versión exacta) con `<Analytics />` de `@vercel/analytics/next` en el layout raíz.
- `beforeSend` quita de la URL la consulta, el fragmento y el enlace secreto del calendario personal (`/cal/[enlace]`);
  ningún evento propio: sin datos personales.
- La CSP no cambia (mismo dominio, `/_vercel/insights`).
- **Sin activar**: el layout solo la monta si la compilación lleva `NEXT_PUBLIC_ANALITICA=1`, y además hay que activar
  Web Analytics en el proyecto de Vercel. Coste y plan en D188; decide Iván.

## Bloque 1 · Navegación (sustituye a D89 y D90)

- **Barra inferior en móvil:**
  - Jugador: Semana · Calendario · Liga · Club.
  - Gestor (con o sin ficha): Semana · Calendario · Liga · Club · Gestión.
  - Sin sesión: Inicio (la portada pública actual) · Liga · Club · Acceso.
  - El activo, marcado con color + raya superior y `aria-current`.
- **Cabecera en móvil:** título de la sección en una línea, icono del asistente (mismas reglas de visibilidad que hoy,
  D142) y avatar con la inicial, que abre «Yo».
- **Fuera:** el botón flotante del asistente, la hoja «Más», la barra horizontal de subsecciones de Gestión y los
  «← volver» dinámicos. En fichas y eventos, un único «‹» a su sección (matiza la norma 13.4: «volver» a la sección,
  con pestaña, filtro y jornada en la URL como hasta ahora).
- **Escritorio:** la misma estructura en la cabecera.
- **Todas las rutas viejas redirigen con 308** a su sitio nuevo; los enlaces profundos (partido, equipo, jugador,
  evento) siguen funcionando.
- Lo público sigue siendo estático (D175): la barra y la cabecera salen de la sesión del navegador (`useSesion()`), nunca
  de cookies en el servidor; `pruebas:cache-publica` tiene que seguir en verde.

## Bloque 2 · Semana (portada con sesión, «/» → `/inicio`)

- «Esta semana» y el rango de fechas.
- **Respuestas pendientes** de una en una, con desplazamiento lateral y contador. Si no falta nada, UNA línea:
  «✓ Lo tienes todo respondido».
- Gestores: bloque «Gestión · N pendientes» con enlace a `/gestion`.
- **Tarjetas de los próximos 7–10 días:**
  - fecha y hora + quedada, etiqueta MdA/MdL y jornada, rival o tipo, pista;
  - equipación en una línea («negra con tu dorsal 4», o el aviso de cambio; D160);
  - avisos del día plegados en una línea («⚠ Media Maratón… · ver»);
  - «Convocado» si lo está;
  - Voy · Duda · No voy en la propia tarjeta. «No voy» pide motivo (una sola vez, D181). _Corrección:_ las dudas, con
    **el límite de D173: el martes a las 12:00 en los partidos y el miércoles a las 12:00 en el entreno** (otros
    eventos, 24 h antes), no «martes 20:00».
- Gestores: en cada tarjeta, franja «GESTIÓN» con «N van · N dudan · N no van · N convocados» (contadores pulsables,
  norma 13) y «Preparar ›» (partido) o «Grupos ›» (entreno).
- **Gestor sin ficha:** las mismas tarjetas SIN botones de respuesta, con la barra de respuestas y el estado de la
  convocatoria o de los grupos en primer plano.
- Abajo: «Calendario completo», «+ Proponer un plan» y una línea «Tu temporada: +/- · min · pts · entrenos ›».
- Tarjeta del pedido de ropa SOLO si un gestor lo ha abierto (bloque 5).

## Bloque 3 · Calendario (`/calendario`) y Evento (`/evento/<id>`)

**Calendario**
- Arriba, «Tenlo en el calendario de tu móvil · se actualiza solo» con Google, iPhone y Copiar enlace (el calendario
  personal que ya existe, `/cal/<enlace>.ics`).
- Botones «+ Proponer un plan» y **«Días que no estoy»**. _Corrección:_ reutiliza las **ausencias de D87** (la tabla
  `ausencias_periodo` y la pantalla «Mis ausencias», `/mi-zona/ausencias`, D99 3.6): desde, hasta y motivo; ver, editar
  y borrar los suyos. No se crea otra tabla.
- Chips Todo · Partidos · Entrenos · Planes, filtro MdA y MdL, y «Pasados» aparte (en la URL).
- Lista compacta por meses con cabecera de mes fija. Fila: día, evento, hora y pista, y su estado.

**Evento, vista de jugador** (`/mi-zona/evento/<id>` redirige con 308), una sola pantalla:
- quedada y hora grandes;
- pista con dirección y «Cómo llegar»;
- equipación;
- avisos plegados;
- Voy · Duda · No voy;
- «Quién va» con contadores pulsables y nombres (D46: sin motivos para jugadores; norma 13.2);
- «El rival»: colores, líneas de scouting (D174) y «Scouting completo ›».

**Evento, pestañas SOLO para gestores**
- **Respuestas** (por defecto):
  - 4 contadores pulsables;
  - «Mensaje a los que faltan»: aviso al móvil + Copiar WhatsApp (D178), para quien no ha respondido o sigue en duda,
    **sin contar a quien tiene un periodo de no disponibilidad ese día**;
  - listas No van (con motivo o periodo), Dudan, Sin responder y Van;
  - cada persona con un botón para **cambiar su respuesta** (va / duda / no va + motivo). _Corrección:_ parte de
    **`gestor_responder` (D159)**, que ya guarda la respuesta a mano; queda registrado quién lo cambió y cuándo, y se
    avisa al jugador (salvo de 22:30 a 08:00, como siempre).
- **Convocatoria** (partidos): resumen y enlace a la del domingo.
- **Grupos** (entrenos): el reparto actual (nivelado con 1 base + 2 exteriores + 2 interiores, y la vista para el equipo
  que oculta niveles).
- **Pase de lista:** se abre al terminar el evento (D50: a tiempo, retraso, con excusa, sin excusa, lesionado; por
  defecto copia la respuesta). _Corrección:_ guarda en **`asistencia_eventos` (D170)** con `origen = 'plataforma'` si
  encaja: sus estados son `fue`, `con_excusa`, `sin_excusa`, `no_convocado` y `lesion`, así que «a tiempo» y «retraso»
  son `fue` y el retraso necesitaría un dato más (columna aditiva o el `motivo`): se decide al construirlo. Alimenta
  «Asistencia y motivos» y el desempate por entrenos de las últimas 4 semanas.
- **WhatsApp:** mensajes listos (convocatoria con equipación y «llevad la amarilla por si acaso», cambio de hora o pista,
  recordatorio) y «Editar el evento».
- **Mi respuesta:** la del propio gestor si es jugador.

## Bloque 4 · Gestión (`/gestion`), ordenada por lo que se hace cada semana

- **«1 · Quién va esta semana»:** cada evento con su barra de respuestas, pulsable, más «Avisar a los que faltan» y
  «Copiar WhatsApp».
- **«2 · Convocatoria del domingo»:** tarjeta con estado (propuesta / aprobada / enviada), convocados y cuántos se quedan
  fuera. Debajo, «Grupos del miércoles» con su estado.
- **«3 · Pendiente»:** contrastar la clasificación oficial (D74), últimos cambios del calendario, planes propuestos por
  jugadores, **avisos sin activar «N de M» + mensaje** y el estado de las rutinas A/B/C. _Corrección:_ «N de M» y
  cualquier recuento de cuentas o de jugadores **se calcula sobre el real en el momento**, nunca escrito en el código
  ni en los textos (se añade y se quita gente; el prompt original decía «de 27»).
- **«Plantilla y club»:**
  - Jugadores: lista compacta con buscador y fila desplegable, con posición, niveles A–E global/ataque/defensa, fichas,
    dobla, solo entreno, no suele entrenar, sancionado hasta la jornada X (D51), accesos y teléfonos; «Importar
    teléfonos» dentro.
  - No convocados (bloque 5).
  - Asistencia y motivos (filtros plegados).
  - Pedido de ropa.
  - Todos los eventos (próximos, pasados, entrenos, liga, amistosos y torneos, planes).
  - Pistas.
  - Importar calendario.
  - Tesorería (fila desactivada «por construir»).
  - Botones «+ Nuevo evento» y «Entreno semanal».
- _Corrección:_ **la cola «Copia a SportEasy» ya no existe** (D172; comprobado en el código de `main` el 06/11/2026):
  queda fuera de la especificación.

## Bloque 5 · Convocatoria del domingo (`/gestion/convocatoria`) y pedido de ropa

**Convocatoria** (una por jornada, MdA y MdL juntos)
- Chips de jornada y contadores de disponibles / no van / sin responder (pulsables).
- Por cada partido: rival y hora; dificultad (la propone la web, la corrige Iván); líneas Bases (con reserva, D158),
  Exteriores e Interiores, con cada jugador como botón grande con su nivel A–E y si dobla; proyección y su acierto;
  avisos.
- Botón «Ocultar niveles» para pantallazos.
- «Ajustar en el tablero» (el actual) y registro de cambios con motivo.
- «Enviar avisos + copiar WhatsApp», con los mensajes: convocado; no convocado en este equipo (normalmente lo está en el
  otro); no convocado en ninguno: más suave, y diciendo que la próxima tiene prioridad.
- Se mantienen el motor y los criterios de Iván (`REGLAS_CONVOCATORIA.md`, D173): aprobación siempre manual, tardíos que
  solo avisan, tras una baja elige Iván quién entra.

**Registro de no convocados** (nuevo)
- Suma 1 cuando un jugador CON FICHA para ese partido dijo «voy» a tiempo y no entró en ningún equipo esa jornada.
- Guarda la racha seguida (vuelve a 0 al convocarle) y el total de la temporada; si se puede calcular de las tablas que
  ya hay (convocatorias aprobadas y respuestas), no se crea tabla (barrera (b)).
- En el motor solo **desempata** a igual posición y nivel (entra antes quien más racha lleva). _Corrección:_ ese
  desempate va **detrás de un interruptor apagado**, que Iván enciende tras ver la primera propuesta automática real
  (martes 10/11/2026, D173). Con el interruptor apagado, el motor propone igual que hoy.
- Los de solo entreno NO suman y van siempre detrás de los demás disponibles.
- El contador lo ven SOLO los gestores (barrera (h)).
- Sección «Quién lleva más tiempo fuera» en la convocatoria y en Gestión › No convocados.
- Se recalcula desde la J1 con los datos que haya y se anota de dónde sale cada número.
- Regla nueva en `REGLAS_CONVOCATORIA.md`.

**Pedido de ropa activable**
- Interruptor «Abrir el pedido a los jugadores», APAGADO por defecto (y apagado al terminar el trabajo).
- Solo encendido lo ven los jugadores.
- Arreglar la contradicción entre «Cerrada: ha pasado la fecha límite» y «Estado: Abierta»: un solo estado real con su
  causa.
- La edición, plegada; primero el recuento y los pedidos.

## Bloque 6 · Yo, Liga y Club

**Yo** (`/yo`; `/cuenta` y `/mis-numeros` redirigen con 308)
- Nombre, posición, equipos, dorsal (y «gestor»).
- «Tu temporada» en 4 cifras y «Tu ficha completa ›».
- Días que no estoy (bloque 3), Avisos en este móvil, Tu calendario en el móvil, Instalar en el móvil, Mi cuenta, Salir.
- Sin pedido de ropa.

**Liga** (`/liga`)
- En móvil, título de una línea, sin el bloque «MACCABIS · DESDE 2013 · … ESTADÍSTICAS MACCABIS».
- 4 pestañas en una fila fija: Clasificación · Rivales · Jugadores de la liga · Temporadas.
- **Clasificación:** G1 · MdA / G2 · MdL; aviso de 1 línea desplegable «Calculada con las hojas de la FBM · pendiente
  de contrastar con la oficial ⓘ»; sin la cadena «JDM MOR DOM MAÑ BC SEN MAS G1»; nuestra fila resaltada y la fila
  entera pulsable; debajo, Resultados por jornada (D186) y Próximos ordenados por fecha.
- **Rivales:** «Lo esencial» y lista de rivales con su scouting (todos con sesión, D162); el scouting abre en el partido
  más cercano.
- **Jugadores de la liga** (la actual Liga consolidada, D184/D186): UNA lista con chips de estadística (Puntos, 2P, 3P,
  TL, TL%, Faltas, Minutos) y Totales/Por partido, buscador, Maccabis resaltados y la tabla completa debajo.
- **Temporadas:** temporada y equipo en una fila, subpestañas Equipo · Jugadores · Rankings · Por cuartos · Asistencia,
  desde 2013/14.
- El primer dato se ve sin desplazar en 390×844.
- Partido y equipo: título compacto, marcador primero.

**Club** (`/club`)
- Pestañas Plantilla · Historia · El club (`/plantilla` y `/historia` redirigen con 308; siguen estáticas, D175).
- Plantilla: ranking a 4 columnas y «Más columnas».
- Historia: 2 cifras, buscador y «Filtros» plegados, rejilla con nombres fijos.
- El club: compacto, con las dos instalaciones sin mezclar (D88).

**En TODAS las tablas anchas**, la primera columna fija al desplazar en horizontal.

## Pruebas de cada fase

- Adaptar (no borrar) `pruebas:navegacion`, `portada`, `pantallas`, `liga`, `avisos`, `eventos` y `asistencia`.
- Comprobaciones automáticas a 360 y 390 px, para los cuatro roles: barra de cada rol; nada tapado por la barra ni la
  cabecera; objetivos de al menos 44 px en `main`; ningún «(D» seguido de número en el HTML; redirecciones 308; primer
  dato sin desplazar en Liga y Temporadas; columnas fijas; cifras de Liga, Plantilla e Historia idénticas a las actuales.
- RLS y privacidad: jugador y anónimo sin acceso a niveles, motivos, contador de no convocados ni pestañas de gestor.
- Registro de no convocados: disponible y fuera = +1; convocado = racha 0; solo entreno = no suma; tardío = no suma;
  desempate solo a igual posición y nivel, y solo con el interruptor encendido.
- Cambio de respuesta por gestor registrado (quién y cuándo).
- Pedido de ropa invisible con el interruptor apagado.
- Las pruebas, con el calendario y el reloj de prueba (D185), y la base siempre la pila local (norma 19, D187).

## Entrega de cada fase (para el OK de Iván)

- Capturas a 390 px (ver «Cómo se trabaja»).
- `DECISIONS.md` (la decisión del bloque; la de la navegación sustituye a D89 y D90), `ESTADO.md`, `BACKLOG.md` (lo que
  quede) y, en la fase 3, `REGLAS_CONVOCATORIA.md`.
- Informe al principio de `ESTADO.md`, en lenguaje sencillo: qué está en producción y qué no; si hubo revert y por qué;
  migraciones aplicadas y cómo deshacerlas; qué tiene que mirar Iván primero en el móvil.
