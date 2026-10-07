# ESTADO — Proyecto Maccabis

> Foto de qué está hecho HOY. Se actualiza en cada sesión.

_Última actualización: 08/10/2026 (**paso 2: eventos y pistas en fase puente**, D94–D95). Antes, 07/10/2026 (**paso 1b del rediseño: una sola navegación, en producción**, D89–D90, merge `1d4068d`). Antes, 06/10/2026 (noche, después: **paso 1 del rediseño en producción**, D88: `asistencia_motivos` en el Supabase real y `feat/rediseno-web` mergeada a `main`). Antes, 06/10/2026 (noche: **respuestas de Iván al paso 1 del rediseño**, D81–D87). Antes, 06/10/2026 (tarde: **rediseño y web única**, paso 1, D76–D80). Antes, 05/10/2026 (tarde: D72, la hoja manda sobre SportEasy en partidos de liga) — **Jornada 1 de 2026/27 procesada** (MdL 59–38 Mejorada 2012; Enfermos del Aro 14–62 MdA), publicada como **parcial pendiente de acta** (excepción puntual a D66, ver D71); 2026/27 ya es la temporada por defecto de la web. Antes (02/10/2026): **`feat/plataforma-v0` mergeada a `main`** (merge `--no-ff` `ad972df`): login único con Google/código por correo (D68), rutina A por Enlace Móvil de Windows con el S22 Ultra de Iván (D70, matiza D69), calendario oficial 26/27 en `data/calendario_2026-27.json`. **La plataforma (`plataforma/`) ya vive en `main` y en producción**; la web de GitHub Pages (estadísticas) no cambia._

## Paso 2: eventos y pistas en fase puente (07–08/10/2026, D94–D95) — pista E
- **Qué hay (gestores):** `/gestion/eventos` (lista con filtros Próximos · Entrenos · Liga · Amistosos y torneos · Pendientes de SportEasy · Pasados, aviso de entrenos sin pista, tarjeta «Copia a SportEasy» con «Marcar como copiado», últimas lecturas, catálogo de pistas), crear y editar evento (en los partidos del Ayuntamiento solo quedada y notas; entrenos: solo este / este y los siguientes; cancelar), `/gestion/eventos/<id>/respuestas` (no van → dudan → sin responder → van, motivos, franja de ausencias por periodo, «Pedir recordatorio a Claude»), `/gestion/eventos/importar` (pestañas Calendario y Respuestas, con registro de importaciones), `/gestion/eventos/pistas` y `/gestion/asistencia`. «Eventos» y «Asistencia y motivos» ya no llevan «paso 2» en el menú (solo Convocatoria).
- **Supabase real (sin entorno de pruebas, D94):** volcado previo `privado/backups/2026-10-07_pre-eventos.sql` (497.463 bytes); 3 migraciones **solo aditivas** con su `.revertir.sql` (`20261007230000`, `…231000`, `…232000`); `asistencia_motivos` intacta y copiada a `asistencia_resumen` (91 = 91). Carga: **40 partidos, 4 descansos, 27 entrenos, 3 pistas, 32 nombres del diccionario**. `npm run eventos:cuadre`: **137 comprobaciones, 0 fallos** (idénticos a `data/calendario_2026-27.json` y `entrenos_2026-27.json`, y a `liga_calendario` salvo tipografía del rival). `pruebas:eventos-real` (RLS en solo lectura): todo OK; 16 cuentas de auth antes y después.
- **Cambio de fuente (commit aparte):** calendario público, `.ics`, portada, `/club`, Mi zona y panel leen de la tabla. `/calendario.ics` **idéntico** al de producción del 07/10 (67 eventos, salvo DTSTAMP). Con Supabase caído o lento (8 s), vuelven los ficheros del repo.
- **Pruebas en verde (08/10/2026):** `typecheck`, `pruebas` (107), `pruebas:eventos` (RLS local, reversibilidad, copia de asistencia, carga y cuadre), `pruebas:eventos-logica` (importador: bloque oficial = **0 cambios**; una línea cambiada = **1 cambio**; nombre desconocido = línea bloqueada), `pruebas:eventos-pantallas` (flujo completo y 375 px), `pruebas:fuente-eventos`, `pruebas:portada`, `pruebas:navegacion`, `pruebas:pantallas`, `pruebas:liga`, `pruebas:orden`, `pruebas:equipacion`, `pruebas:asistencia`, `test:privacidad` (ampliado a lo nuevo), `test:liga`, `test:regresion`. **Fallo anterior a este bloque, sin tocar:** `pruebas:avisos` abre `index.html?p=liga` de GitHub Pages, que desde `7a9b041` redirige a la web nueva (hay que reescribir esa parte para `/liga`).
- **Pendiente:** comparar EventoRespuestas e EventoImportar con el lienzo (no estaban en la carpeta de maquetas; se construyeron con la descripción del encargo); los 27 entrenos entran como «pendiente de copiar» hasta que Claude compruebe la serie en SportEasy; dirección de la Caja Mágica; los avisos de equipación del próximo partido, Scouting y resultados siguen leyendo ficheros. Rutinas B y C actualizadas (`docs/RUTINAS/`).

## MIGRACIÓN DE GITHUB PAGES CERRADA (07/10/2026, D91–D93) — GitHub Pages solo redirige
- **OK final de Iván** (Liga, Plantilla/Ficha e Historia revisadas por Claude en su Chrome). Un único commit `7a9b041` activa `ESTA_ACTIVA = true` en `data/redireccion_web.js` y retira la barra «← Volver a Maccabis» de `index.html`; se deshace con `git revert 7a9b041` (`docs/ACTIVAR_REDIRECCIONES.md`).
- **Verificado en producción** (Chrome, desde eyeshar.github.io): `?p=liga` → `/liga`; `?p=jugadores` → `/plantilla?t=2026-27`; `?p=jugador&j=esteban-jon&t=2025-26` → `/jugador/esteban-jon?t=2025-26`; `?p=historia` → `/historia`; `?p=rivales` → `/liga/rivales`; `?t=2023-24&p=rankings` → `/liga/2023-24/rankings`; un alias antiguo (`?p=jugador&j=mar-calvo-borja`, y `castro-mayo-henry-luis`) llega a la ficha canónica (si la persona no tiene estadísticas en la temporada pedida, abre su temporada más reciente). Nota: GitHub Pages cachea sus ficheros 10 minutos (`max-age=600`), así que justo tras publicar puede tardar en saltar.
- **Web nueva:** ninguna página enlaza ya a GitHub Pages (cabecera, pie, `/club`, portada, Mi zona). Limpieza hecha: quitados `URL_DASHBOARD`, `URL_ESTADISTICAS` y `estadisticas()`. La comprobación de Asistencia de `pruebas:portada` ahora mira `/liga/<t>/asistencia`.
- **Rutina C:** la plantilla 2026/27 (posición, nivel, dobla) y sus criterios están en `privado/` (ignorado por git); no se copian aquí.

## Migración de Historia a la web nueva (07/10/2026, D93) — entrega 3 de 3, EN PRODUCCIÓN (merge `179a943`), pendiente de la revisión de Iván
- **Qué hay:** `/historia` (rejilla, dos modos de orden excluyentes, cuerpo técnico en su sección, tira temporal y ficha de persona); alias antiguos redirigen a la ficha canónica; menú, `/club` y portada sin enlaces a GitHub Pages. **Las redirecciones siguen DESACTIVADAS** (`ESTA_ACTIVA = false`); el último paso está preparado en `docs/ACTIVAR_REDIRECCIONES.md` (`scripts/activar_redirecciones.js`, un commit, reversible con `git revert`).
- **Cuadre con GitHub Pages** (`npm run pruebas:cuadre`): 812 comprobaciones, 3.051 filas o bloques idénticos y 0 fallos: rejilla completa (88 filas, filas, cifra dorada y color de cada celda) en los dos modos de orden y con cada filtro y el buscador, tira temporal, las 88 fichas de persona y los boxscores de 2019/20 con Lonchas, más las entregas 1 y 2. 375 px: la página no se desborda y la rejilla hace scroll en su caja. `test:privacidad` sobre 294 páginas.

## Migración de Plantilla y Ficha a la web nueva (07/10/2026, D92) — entrega 2 de 3, EN PRODUCCIÓN (merge `c20ce51`), pendiente de la revisión de Iván
- **Qué hay:** `/plantilla` (`?t=`) y `/jugador/<person_id>?t=`; el menú «Plantilla» ya es de la web (solo Historia sigue en GitHub Pages). Los nombres de Plantilla y Rankings enlazan con la ficha.
- **Cuadre con GitHub Pages** (`npm run pruebas:cuadre`): 506 comprobaciones, 2.654 filas o bloques idénticos, sin fallos; **las 195 fichas** (todos los jugadores de las 12 temporadas: cabecera, indicadores, desglose de tiro y partido a partido) más todo lo de la entrega 1. 375 px sin desbordamiento; sin errores de consola; `test:privacidad` sobre 291 páginas.

## Migración de Liga a la web nueva (07/10/2026, D91) — entrega 1 de 3, EN PRODUCCIÓN (merge `a2cb0df`), pendiente de la revisión de Iván
- **Qué hay:** `/liga` (Liga 26/27), `/liga/rivales` y `/liga/<temporada>/<equipo|jugadores|rankings|cuartos|asistencia|mda>` con el selector 2013/14 → 2026/27, con los datos de siempre (`data/season_*.json`, copiados por `npm run datos:sync`). El menú «Liga» y el pie apuntan ya a `/liga`; Plantilla e Historia siguen en GitHub Pages hasta las entregas 2 y 3.
- **Cuadre con GitHub Pages** (`npm run pruebas:cuadre`, abre las dos webs con Chrome): 288 comprobaciones, 1.874 filas o bloques idénticos, 12 temporadas (2016/17 y 2022/23 no existen en la fuente), todas las pestañas, filtros, orden, boxscore, clasificación, todas las jornadas, fichas de equipo y de rival. 375 px sin desbordamiento en todas las páginas; sin errores de consola. `test:privacidad` ampliado a las páginas nuevas.
- **Revisión de Iván y limpieza (07/10/2026):** entrega 1 revisada y aprobada. Las 16 cuentas de auth están explicadas (la 16.ª es de un jugador dado de alta hoy; el hook «Before User Created» está activo). **Comprobación de solo lectura de la lista blanca** (transacción `read only`, nada borrado): 16 cuentas en `auth.users`, **0 fuera de la lista blanca** (todas coinciden con un correo de `jugadores` o `gestores`). Los cuatro `audit*.js` sueltos eran scripts de auditoría de solo lectura de una sesión anterior (leían `SUPABASE_DB_URL` de `.env.local` y uno llevaba un correo de ejemplo): movidos a `privado/auditorias/` (ignorado por git), y `pg` quitado de las dependencias directas. `plataforma/src/data/estadisticas/` queda como copia generada (`LEEME.md`; `npm run check:copias` y `pruebas:cuadre` fallan si difiere de `data/`; `npm run jornada` y `build:datos` ejecutan `datos:sync`). `pruebas` (107) y `pruebas:pantallas` en verde sobre `main`.
- **GitHub Pages** sigue publicada como antes (con su barra «← Volver a Maccabis»); `data/redireccion_web.js` está listo pero desactivado hasta el OK final.

## Paso 1b: una sola navegación (07/10/2026, D89–D90) — EN PRODUCCIÓN (merge `--no-ff` `1d4068d` a `main`, con el OK de Iván)
- **Antes del merge:** el pie de la portada usa la misma sesión que la cabecera (sin sesión «Acceso jugadores y gestores» → `/entrar`; con sesión «Mi zona» → `/mi-zona` y, para gestores, «Gestión» → `/gestion`), probado para los cuatro tipos de usuario. Todas las pruebas en verde: `pruebas:navegacion` 280, `pruebas` 107, `pruebas:portada` 177, `pruebas:pantallas` 131, `pruebas:avisos` 79, `pruebas:liga` 56, `pruebas:orden` 49, `pruebas:equipacion` 43, `pruebas:asistencia` 16, `test:privacidad`, `test:liga`, `test:regresion` y `typecheck`.
- **Producción verificada** (`verificar_produccion` en **TODO OK**, ampliado con la web pública sin sesión y la barra de GitHub Pages): `/`, `/club`, `/privacidad` y `/entrar` 200 con la cabecera única; `/mi-zona`, `/cuenta` y `/gestion` (y Scouting y Liga) sin sesión → `/entrar`; `/calendario.ics` 67 eventos, **idéntico** al de antes salvo `DTSTAMP`; `sitemap.xml` idéntico; `robots.txt` igual más `Disallow: /cuenta` (nuevo, D90). Gestor temporal a 375 px y escritorio: Gestión, Scouting y Liga consolidada sin desbordamiento ni errores de JS; borrado al final (15 cuentas de auth, las mismas que antes). **GitHub Pages:** «← Volver a Maccabis» en las 10 pestañas, fija, a `https://maccabis.vercel.app/`, sin errores de JS.
- **Cabecera única** en el layout raíz (`plataforma/src/components/nav/`), la misma en `/`, `/club`, `/privacidad`, Acceso, `/mi-zona`, `/cuenta` y todas las páginas de `/gestion`; desaparecen la cabecera mínima de Mi zona, la cabecera y el menú lateral de Gestión y el menú `<details>` de la portada. Lee la sesión en el servidor (`src/lib/usuario.ts`): sin sesión «Acceso»; jugador «Mi zona» + menú de usuario (nombre completo, «Jugador · MdA y MdL», Mi cuenta, Instalar en el móvil, Salir); gestor, además **GESTIÓN ▾** con tres columnas y «paso 2» en Eventos y pistas, Convocatoria y Asistencia y motivos (sin enlace, `aria-disabled`). **La portada ya reconoce la sesión.** Liga, Plantilla e Historia a GitHub Pages en la misma pestaña y sin icono de externo.
- **Móvil:** barra inferior fija de 5 (Inicio · Partidos · Liga · Mi zona/Acceso · Más; «Gestión» para un gestor sin ficha) y hoja «Más» (LA WEB, GESTIÓN para gestores, Mi cuenta, Salir). El contenido no queda tapado.
- **Barras de zona** fijas debajo de la cabecera: Mi zona (Resumen · Mi agenda · Mis estadísticas · Pedido de ropa; anclas con la sección visible marcada) y Gestión (#2A2410, GESTIÓN, tres grupos; scroll horizontal en móvil).
- **Un solo tema oscuro** (tokens de `globals.css`); Gestión ya no es clara (tablas, filtros, tarjetas, avisos). **Mi zona a dos columnas en escritorio** (≥ 1024 px) dentro del ancho de la portada; en móvil, una columna como antes. Sin «Marcar días que no estoy» y solo datos reales.
- **`/cuenta`**, una página de cuenta para todos (quién eres, correo, instalar en el móvil, Salir); `/gestion/cuenta` → `/cuenta` (308); `/cuenta` con noindex y en `Disallow`. El proxy refresca la sesión en todas las páginas, solo si hay cookie de Supabase.
- **GitHub Pages (`index.html`):** barra fija en todas las pestañas con «← Volver a Maccabis» (→ `https://maccabis.vercel.app/`), el mismo menú (Liga, Plantilla e Historia a sus pestañas con la activa marcada) y «Estadísticas · versión anterior de la web»; en móvil, volver + menú desplegable. Nada más cambia. Se publica al mergear a `main`.
- **Pruebas en verde (07/10/2026):** nueva `pruebas:navegacion` **273** (cabecera idéntica en todas las páginas por rol, anon/jugador/gestor y gestor sin ficha, portada a un clic, sin `target=_blank`, desplegables con teclado y Esc, hoja «Más», barra inferior que no tapa, barras de zona fijas, Mi zona a dos columnas, Gestión sin fondos claros, `/cuenta` y Salir, barra de GitHub Pages en las 10 pestañas a 375 px y escritorio, sin desbordamiento ni errores de JS); `pruebas` 107, `pruebas:portada` 177, `pruebas:pantallas` 131, `pruebas:avisos` 79, `pruebas:liga` 56, `pruebas:orden` 49, `pruebas:equipacion` 43, `pruebas:asistencia` 16, `test:privacidad`, `test:liga`, `test:regresion` y `typecheck`. Adaptadas: `portada` y `pantallas` (la comprobación «el menú de gestión no se corta» acepta la fila con scroll horizontal; selector de la barra inferior en las capturas).
- **Capturas** (fuera de git): `privado/mockups_liga/rediseno/nav1b/` (cabecera en los 3 roles, menús de usuario y de Gestión abiertos, hoja «Más», Mi zona y Gestión a 375 px y escritorio, Mi cuenta, barra de GitHub Pages).
- **Sin cambios** de esquema ni de datos en Supabase.

## Rediseño paso 1 en producción (06/10/2026, noche, D88) — `main` (merge `8681727`)
- **`/club`:** dos instalaciones sin mezclar: **partidos** en el Centro Deportivo Municipal Moratalaz, calle de Valdebernardo, 2, 28030 Madrid (metro Pavones, L9); **entrenos** en Valdebernardo (Faustina Valladolid), en obras, pista de cada semana en el calendario. Capturas: `privado/mockups_liga/rediseno/real_club_{375,escritorio}.png`. Añadido a `MEMORIA.md`.
- **Supabase real:** `db:backup` (`privado/backups/backup_public_2026-10-06-21-15.json`), `db:migrar` (1 migración: `20261006220000_asistencia_motivos`) y `db:asistencia` (2025-26: 43 filas; 2026-27: 48). `pruebas/verificar_real.mjs` ampliado y en **TODO OK**: anon, jugador y no gestor **no** leen `asistencia_motivos`; el gestor e Iván **sí**; nadie escribe por la API; las 8 tablas de `public` (sin contar `asistencia_motivos`) idénticas antes y después (`jugadores`, `gestores`, `campanas_ropa` y `pedidos_ropa` sin contar `actualizado_en`, que toca la propia prueba); 15 cuentas de auth antes y después.
- **Merge a `main`** (`--no-ff`, `8681727`) y push.
- **Producción verificada** (https://maccabis.vercel.app): `/`, `/club`, `/privacidad`, `/calendario.ics` (67 eventos), `robots.txt` y `sitemap.xml` según D85 (sitemap solo `/`, `/club`, `/privacidad`; `/entrar`, `/mi-zona`, `/gestion` y `/auth` en `Disallow` y con `X-Robots-Tag: noindex`); `/gestion` y `/mi-zona` sin sesión redirigen a `/entrar`. `verificar_produccion` en OK (su aserción de `/entrar` buscaba la palabra «Entrar» del diseño antiguo; ahora comprueba «Continuar con Google» y «Enviarme el código»).
- **GitHub Pages** (descargado lo publicado, no solo en local): `index.html` publicado = el de `main`; **35 JSON publicados descargados, ninguno con `excusa`, `lesion`, `no_conv`, `sin_excusa` ni `pct_nosel`**, todos idénticos a los locales; la pestaña Asistencia muestra solo «Partidos · De · % Asist.».
- **P2:** el historial de git **no se reescribe** (D88). Los motivos anteriores a D82 siguen en commits antiguos de `data/season_2025-26.json` y `2026-27`; es lo asumido.
- **Pendiente:** pantalla de motivos para gestores, en el paso 2 (`BACKLOG.md`).

## Rediseño, respuestas de Iván al paso 1 (06/10/2026, noche, D81–D87) — ya en `main` (D88)
- **Fundación 2013** confirmada (D81): «Desde 2013» se queda; no había ningún «2012» del club en la plataforma.
- **Entrenos (D83):** sin entreno el 23/12/2026, 30/12/2026, 06/01/2027 y 24/03/2027; último el **05/05/2027** (27 entrenos). Festivos comprobados en la fuente oficial (madrid.es para 2026; Decreto 82/2026, BOCM 01/10/2026, para 2027; fiestas locales de 2027: 15/05 y 09/11): ningún otro miércoles festivo. Se ve en la portada, en `/club` y en `/calendario.ics`.
- **`npm run jornada` sincroniza la plataforma (D84):** si la jornada cuadra, comprueba la privacidad de la asistencia y copia `plataforma/src/data/`; si no cuadra, no sincroniza. Rutinas A y B y `PROCEDIMIENTO_JORNADA.md` actualizados.
- **Indexación (D85):** `/`, `/club` y `/privacidad` indexables (meta robots `index`, `sitemap.xml`); `/entrar`, `/mi-zona`, `/gestion` y `/auth` con noindex y en `Disallow`; las vistas previas de Vercel, noindex en todo.
- **`/club` (D86):** qué es el club, MdA y MdL, cifras de historia (226 · 137 · 87, de los datos), entrenos y dónde jugamos (las dos instalaciones, D88), enlace a la rejilla de Historia de GitHub Pages. Menú y pie enlazan a `/club`.
- **Asistencia sin motivos en público (D82, P1):** `data/season_2025-26.json` y `2026-27` (y sus copias) solo con `{fueron, total, pct}`; copia previa en `privado/backups/season_antes_D82_*`; el detalle con motivos, en `privado/asistencia/` (fuera de git). Pestaña Asistencia de GitHub Pages: Partidos/Entrenos, «De» y «% Asist.», de mayor a menor. La regresión de la 2025/26 sigue en OK. **Supabase:** tabla `asistencia_motivos` (migración `20261006220000`), RLS solo gestores, cargador `npm run db:asistencia`, **probada en local** (`pruebas:asistencia`); **aplicada en el Supabase real (D88)**. Hasta entonces los gestores tienen los motivos en `privado/asistencia/`. **P3:** borrado `docs/dashboard-maccabis-25-26-v1.html`. **P2:** historial de git sin reescribir (decidido, D88).
- **Pruebas:** `ab@gmail.com` en lugar del correo de prueba anterior; ningún test usa correos reales (todos `.local`). Nuevas: `test:privacidad` (falla si un JSON público vuelve a llevar motivos) y `pruebas:asistencia`; `pruebas:portada` ampliada (festivos, último entreno, indexación, `/club`, Asistencia pública).
- **Capturas** (fuera de git): `privado/mockups_liga/rediseno/real_club_{375,escritorio}.png` y `real_asistencia_publica_{375,escritorio}.png`.
- **Requisito nuevo para los pasos 2 y 3 (D87):** «no voy» con motivo y periodos de no disponibilidad, en `BACKLOG.md`.

## Rediseño: una sola web en maccabis.vercel.app — paso 1 (06/10/2026, D76–D80) — ya en `main` (D88)
- **Qué hay:** portada pública **sin login** en `/` (maquetas Main y PortadaMovil): cabecera con escudo y menú (Inicio, Partidos, Liga, Plantilla, Historia, El club) + Acceso; héroe «Dos equipos. Una plantilla.»; próxima jornada de MdA y MdL con su aviso de equipación (J2: MdA–Litros de Mahou **cambian ellos**; Quinto Tiempo–MdL sin choque); últimos resultados (J1, pendientes de acta); clasificación G1 y G2 (top 5 + enlace; conmutador en móvil); líderes Maccabis (puntos, triples, tiros libres, mejor partido); calendario público con entrenos y filtros; bloque de historia (226 partidos, 137 victorias, 87 jugadores, generados de los datos); pie; barra inferior de secciones en móvil. Liga, Plantilla e Historia enlazan a GitHub Pages (sin cambios).
- **Acceso** (`/entrar`) con la maqueta Acceso: «Continuar con Google» y código por correo; la lógica de D68 no cambia (jugador → `/mi-zona`, gestor → `/gestion`, ambos → `/entrar/elegir`).
- **Mi zona** (oscuro, maqueta MiZona): saludo con MdA/MdL, dorsal y «doblas»; **Tu agenda** con los próximos entrenos y partidos de sus equipos y la última jornada jugada (respuesta y convocatoria «pendiente» hasta el paso 2); próximo partido con «no se puede doblar» si coinciden a la misma hora, color del rival y **Equipación del domingo** (avisos D75); pedido de ropa; **Tu temporada** (sus estadísticas públicas); Mi cuenta; barra inferior.
- **Gestión** (claro, maqueta Gestion): cabecera oscura y menú lateral (Convocatoria, Calendario y eventos y Tesorería marcados «pronto»); **panel de la semana**: «Jornada N», rutinas A/B/C con su estado, partidos del domingo con equipación y scouting del próximo rival, entreno del miércoles con el **hueco** de las respuestas de SportEasy (paso 2), pendientes de la semana calculados de los datos, plantilla y pedido de ropa. El resto de pantallas de gestión no cambia de contenido, solo de aspecto.
- **Sistema visual:** tokens en un solo bloque al principio de `plataforma/src/app/globals.css` (tema claro de gestión y `.tema-oscuro`); Barlow Condensed, Barlow y JetBrains Mono servidas desde el propio dominio.
- **Entrenos (D77):** `data/entrenos_2026-27.json`: miércoles 20:30–22:30, Valdebernardo (Faustina Valladolid) en obras → «Pista por confirmar (Valdebernardo en obras)»; 07/10 de 20:00 a 21:00 en la Caja Mágica.
- **Feed iCal** `/calendario.ics`: 41 partidos + 27 entrenos (31 antes de quitar Navidad, Reyes y Semana Santa, D83), horas de Madrid, línea de equipación en la descripción, sin datos personales; «Añadir a mi calendario» ofrece suscripción (iPhone/Mac y Google Calendar) y descarga.
- **Web instalable (D78):** `/manifest.webmanifest` («Maccabis», `theme-color` #0E0D12, iconos del escudo 192/512/maskable y de Apple: `npm run iconos`), service worker mínimo sin caché ni avisos. Sin notificaciones todavía.
- **Datos:** `npm run datos:sync` (alias de `equipacion:sync`) copia a `plataforma/src/data/` calendario, equipaciones, avisos, liga, temporada 26/27 y entrenos, y genera el resumen de la historia. **Tras cada jornada (rutina A) y cada cambio de calendario (rutina B) hay que correrlo** para que la portada se actualice; las pruebas fallan si las copias están desfasadas. **Sin cambios de esquema en Supabase**; Vercel y Supabase sin tocar.
- **Inventario de migración y revisión de privacidad:** `docs/MIGRACION_WEB.md`. Dos hallazgos altos en la web actual, **sin cambiar** (decide Iván): P1, la pestaña Asistencia publica por jugador las ausencias «con excusa» y por «lesión» (D46); P2, `docs/ESTADO.md` tenía correos personales de 3 jugadores (**ya sustituidos por `<correo>`** en la versión actual; siguen en el historial de git; decidido no reescribirlo, D88).
- **Pruebas en verde (06/10/2026):** `pruebas` 107, `pruebas:pantallas` 131, `pruebas:avisos` 79, `pruebas:liga` 56, `pruebas:orden` 49, `pruebas:equipacion` 43, `test:liga`, `test:regresion`, `typecheck` y la nueva **`pruebas:portada`** 131 (portada sin login 200; `/mi-zona`, `/gestion` y `/gestion/liga` redirigen a `/entrar` sin sesión; sin desbordamiento a 375 px ni a 1440 px; sin errores de JS; avisos J2 MdA = cambian ellos y J6 MdL = nos toca; entrenos y filtros; feed iCal válido —CRLF, plegado a 75 octetos, BEGIN/END, UID únicos, horas de Madrid—; manifiesto e iconos; objetivos táctiles ≥ 44 px). Las pruebas antiguas se adaptaron solo en los textos nuevos del acceso y del panel.
- **Capturas reales** (fuera de git): `privado/mockups_liga/rediseno/real_{portada,acceso,mizona,gestion}_{375,escritorio}.png`.

## Avisos de choque de equipación con la regla oficial (06/10/2026, D75)
- Regla: Bases 47 JDM, art. 5.11: cambia el equipo que figure en **segundo lugar** del calendario (el visitante). Dos avisos: **NOS TOCA CAMBIAR** (alerta amarilla intensa, «partido perdido» si no se cambia) y **CAMBIAN ELLOS** (informativo). Datos en `data/equipaciones_2026-27.json`, cálculo único en `data/avisos_equipacion.js`, línea para la convocatoria en `lineaEquipacion`.
- 18 partidos con aviso: 9 nos toca cambiar (todos de visitantes) y 9 cambian ellos. J2 MdA–Litros de Mahou y J1 MdL–Mejorada: cambian ellos; MdL–Quinto Tiempo, sin aviso.
- Migración `20261006210000_mi_zona_equipos.sql` aplicada en producción (backup `privado/backups/backup_public_2026-10-06-13-01.json`, restaurado y probado en local antes).
- Si cambia el calendario o un color: `npm run equipacion:sync` (rutina B).

## Liga consolidada: líderes por partido, fichas de dobladores filtradas y enlaces (06/10/2026, tras el OK a "Todos los jugadores")
- **Líderes con interruptor Totales / Por partido** (independiente del de la tabla). Totales: Puntos, Triples, Tiros libres y Faltas (desaparece "Media de puntos"). Por partido: Puntos, 2P, 3P, TL anotados, TL% (≥3 intentados), Faltas y Minutos por partido, con una decimal y mínimo "Automático" (la mitad de los partidos de su equipo, al menos 1; nota al pie). Desempate determinista en `ordenLideres.ts` (valor por partido → total → menos partidos → nombre → equipo); los dobladores promedian sobre los partidos sumados de sus dos fichas. `pruebas:orden` cubre cada lista.
- **Dobladores y filtros en la tabla:** con filtro de Grupo o de Equipo (sin «Solo Maccabis») la fila del doblador muestra solo la ficha de ese grupo/equipo («dobla» + "solo ficha MdA" / "solo ficha MdL"); sin filtros o con «Solo Maccabis», fichas sumadas. Comprobado: con equipo MdA la suma de PTS de la tabla = 62 = puntos a favor de MdA, y con MdL 59 (`pruebas:liga` y `pruebas:pantallas`).
- **Móvil (≤ 600 px):** filtros plegados tras "Filtros (n activos)"; Totales/Por partido y "Ordenar por" siempre visibles. Escritorio igual. Mínimo de partidos de la tabla: "Automático" por defecto.
- **Enlaces:** Scouting rivales → botón "Ver todos los jugadores de la liga" (`/gestion/liga#todos`) y nota "solo aparecen los jugadores que figuran en las hojas de la FBM"; Liga consolidada con índice de anclas (Líderes · Todos los jugadores · Ranking de equipos).
- **Capturas** (fuera de git, `privado/mockups_liga/`): `real_d_tabla_375.png`, `real_d_tabla_375_filtro_g1.png`, `real_c_lideres_por_partido_375.png`, `real_c_lideres_por_partido_escritorio.png`, `real_b_scouting_escritorio.png` (y `real_d_tabla_375_desplegada.png`, `real_d_tabla_escritorio.png`).

## Liga consolidada: sección "Todos los jugadores" (06/10/2026, OK de Iván)
- **Qué es:** tabla con todas las personas de la liga (175: G1+G2, con MdA y MdL), debajo de los líderes y encima del ranking de equipos. Solo gestores (D73). Columnas: Jugador (#dorsal), Equipo + grupo, PJ, MIN, PTS, Media, 2P, 3P, TL (a/i), TL%, Faltas, F/P. **Solo lo que trae la hoja de la FBM** (no hay faltas recibidas ni intentos de campo; la nota al pie lo dice); nada estimado. Sin cambios de esquema: usa `v_liga_jugadores` y `liga_clasificacion`.
- **Comportamiento:** ordenar por cualquier columna (por defecto PTS desc), interruptor Totales / Por partido (minutos, 2P, 3P, TL y faltas entre PJ), filtros de grupo, equipo, "Solo Maccabis", buscador por nombre y mínimo de partidos (automático = criterio de los líderes: al ordenar por una media, la mitad de los partidos de su equipo y 3 TL intentados para el %; "todos", 2, 3 o 5). Los dobladores salen en una sola fila "MdA + MdL" con la etiqueta «dobla» y las fichas sumadas; MdA/MdL resaltados; clic en jugador o equipo abre `/gestion/scouting?e=…`. Escritorio: cabeceras pulsables y cabecera fija; móvil (375 px): selector "Ordenar por" y filas compactas que se despliegan; "ver 25 más".
- **Código:** `src/app/gestion/(panel)/liga/TablaJugadores.tsx`; lógica pura y probada en `src/lib/ordenLideres.ts` (`comparadorTabla`, `pasaMinimo`, `valorColumna`, desempate fijo por puntos, media, nombre y equipo) y `src/lib/jugadoresLiga.ts` (`filasTabla`, `unirDoblan`).
- **Pruebas en verde:** `pruebas` 107, `pruebas:liga` (incluye: la suma de PTS por jugador de cada equipo = sus puntos a favor en la clasificación calculada, 850 en toda la liga, y los 3 dobladores no se cuentan dos veces), `pruebas:orden` (12 columnas × asc/desc × totales/por partido deterministas, mínimo de partidos), `pruebas:pantallas` (86 comprobaciones: orden, paginación, filtros, por partido, móvil sin desbordamiento, filas desplegables, enlaces), `test:regresion` y `test:liga`.
- **Capturas** (fuera de git): `privado/mockups_liga/real_d_tabla_escritorio.png`, `real_d_tabla_375.png`, `real_d_tabla_375_desplegada.png`.

## Plataforma con las pantallas de liga, en producción (06/10/2026)
- **Merge a `main`** (`ae4f4cc`, `--no-ff`) de `feat/plataforma-v0`: Scouting rivales y Liga consolidada (solo gestores), migraciones de liga y cambio de correo seguro (`20261003090000`). Las 6 migraciones del repo coinciden con las aplicadas en el proyecto real; no se reaplicó ninguna.
- **Faltas en Liga consolidada:** el orden no era un fallo. A igualdad de faltas va primero quien las hizo en **menos partidos** (más faltas por partido); por eso Jon Esteban (4 faltas sumadas MdA+MdL en 2 partidos) queda detrás de quienes hicieron 4 en 1 partido. Ahora está explícito en `ordenLideres.ts`, en la nota al pie de la lista y en `pruebas:orden`.
- **Producción verificada** (`https://maccabis.vercel.app`, `plataforma/pruebas/verificar_produccion.mjs`, con un gestor temporal ya borrado): `/entrar` 200; `/gestion`, Scouting y Liga consolidada mandan a `/entrar` sin sesión y cargan con sesión de gestor a 375 px y escritorio, sin desbordamiento ni errores de JS. Pruebas en verde antes del merge: `pruebas` 107, `pruebas:liga`, `pruebas:pantallas`, `pruebas:orden`, `test:regresion`, `test:liga` y `verificar_real`.
- **Vercel, solo estado (no se ha cambiado nada):** los despliegues *preview* piden login de Vercel (Deployment Protection / Vercel Authentication activa: redirigen a `vercel.com/sso-api`); producción es pública. El proyecto "maccabis" cuelga del equipo de Vercel `web-tcpc` (así sale en la URL de preview).

## Liga 26/27: resultados y clasificación de los dos grupos (06/10/2026, D73 y D74)
- **Pulido de la liga e higiene de ramas (06/10/2026, tarde):** `feat/correo-seguro-jugadores` unida en `feat/plataforma-v0` (la migración `20261003090000` ya está en el repo; **no se reaplicó** en real). Las 6 migraciones del repo coinciden exactamente con las aplicadas en el proyecto real. Liga consolidada: el ranking de equipos a 375 px muestra solo #, Equipo+grupo, G-P, %V y Dif/p sin scroll (el resto, en escritorio); líderes de tiros libres ordenados por anotados, porcentaje, menos intentados y nombre (casos de control OK, `npm run pruebas:orden`); todas las listas de líderes con desempate determinista (`src/lib/ordenLideres.ts`); el texto "N personas de los M equipos" usa los equipos con partidos jugados (20), el mismo recuento que el ranking. Pruebas en verde: `pruebas` 107/107, `pruebas:liga`, `pruebas:pantallas`, `pruebas:orden`, `test:regresion`, `test:liga` y `verificar_real` (75 OK). **Sigue sin mergear a `main`**: espera el "OK vista previa" de Iván.
- **Datos de la J1:** las 8 hojas de partidos ajenos (4 de G1 y 4 de G2) más las 2 nuestras = los 10 partidos. Todas cuadran (suma por jugador = total del equipo; 2P×2 + 3P×3 + TL = puntos). Descansan **RIF** (G1) y **28500** (G2).
- **Web pública (`main`, ya publicada):** pestaña **Liga 26/27** (selector G1/G2, clasificación, resultados por jornada, ficha por equipo con enlace a su ficha de Rivales 26/27). Solo datos por equipo, en `data/liga_2026-27.json`, marcada "calculada; pendiente de contrastar con la oficial". Nombres de equipo en formato Título, también en `rivales_2026-27_web.json`. Comprobada en local: sin errores de JS, sin desbordamiento a 375 px y escritorio, `test:regresion` y `test:liga` OK.
- **Incomparecencias (D74):** no se inventa la penalización. Se anotan en `temporadas.json` (`liga.incomparecencias`), el partido se marca, y los puntos del equipo que no se presenta salen de la clasificación oficial de Deportes/web (rutina B del jueves, `liga.puntos_oficiales`); mientras no lleguen, "pendiente de la oficial".
- **Gestión (rama `feat/plataforma-v0`, SIN mergear a `main`):** `/gestion/scouting` (abre con el próximo rival del MdA o del MdL, desplegable de todos los equipos; tarjetas por jugador en móvil, tabla en escritorio; 3 máximos anotadores; próximo partido contra nosotros) y `/gestion/liga` (líderes individuales primero, ranking conjunto plegado; marca «dobla»; quien dobla cuenta una vez). Menú de gestión que salta de línea. `npm run pruebas:pantallas` (acceso, contenido, móvil/escritorio, sin desbordamiento ni errores de JS) y `npm run pruebas:liga` (RLS) OK.
- **Supabase real (proyecto `pqbjnxmknhawlkszwmln`):** copia de seguridad previa en `privado/backups/` (fuera de git; restaurable en Postgres local, `node pruebas/restaurar_backup.mjs <fichero>`); aplicadas `20261006100000_liga_estadisticas.sql` y `20261006200000_liga_calendario_clasificacion.sql`; J1 cargada con `npm run db:liga` (10 partidos, 178 filas de jugador, 44 de calendario, 22 de clasificación). `verificar_real.mjs` ampliado: anon, jugadores y no gestores no leen nada de liga; los gestores sí; los 28 jugadores con su correo y todas las tablas de `public` idénticas antes y después (solo cambia `actualizado_en` de los 2 jugadores que la propia prueba toca y restaura). TODO OK.
- **Capturas** (sin publicar, `privado/mockups_liga/real_*.png`): a, pública; b, scouting; c, liga consolidada plegada y desplegada; a 375 px y escritorio.

## Jornada 1 de 2026/27 procesada (05/10/2026)
- **Resultados (de las hojas de la FBM):** MdL (local, 04/10, 09:00, pista 3) **59–38** Mejorada 2012 · MdA (visitante, 04/10, 14:00, pista 2) **62–14** Enfermos del Aro. Suma de puntos de los jugadores = total de cada equipo. 24 personas de la plantilla en `players` (15 con minutos; el resto entra con estadísticas a cero para que salga su asistencia). Doblaron Jon Esteban, Manuel Calahorro y Adriano Gianatti: cuentan en los dos partidos. Carlos Barreiro fuera de las estadísticas.
- **Sin actas todavía** (la FBM no las ha publicado): los dos partidos van marcados `pendiente_acta: true` (la web muestra "pend. acta"), sin parciales por cuarto; fecha, hora y pista salen del calendario (`data/calendario_2026-27.json`). **Excepción puntual a D66, autorizada por Iván el 05/10/2026 (D71).** En cuanto Iván deje las actas en Descargas, el siguiente `npm run jornada` las enlaza, completa parciales/hora/pista y **valida el marcador contra el acta**: si no cuadra, no escribe nada y avisa.
- **Pipeline:** las hojas de la FBM ya no llevan jornada ni equipo en el nombre (`estadisticaPartido_<fechaDescarga>.xlsx`, con sufijos " 1", "_1", " (1)"). Equipo, rival y local/visitante salen de la cabecera "Estadísticas - X vs Y - ..." y se casan con el calendario; la copia a `fuentes_fbm/2026-27/hojas/` se renombra `estadisticaPartido_J01_<EQ>_vs_<rival>_<md5>.xlsx` (copia segura, D41). Nombres con espacios sobrantes se recortan.
- **Asistencia 26/27 integrada** (export de SportEasy del 05/10/2026, copiado a `fuentes_fbm/2026-27/asistencia/`): cuentan "Partido", "Campeonato" (liga) y "Entrenamiento"; amistosos/torneos no, y los entrenos de septiembre sí. Los dos "Campeonato" del 04/10 se asignan por cruce con las hojas: el 1.º = **MdL** (9 de 9 coinciden), el 2.º = **MdA** (8 de 9). **Regla D72:** en partidos de liga manda la hoja sobre SportEasy. Corregido en nuestros datos: Jon Esteban asistió al MdA (SportEasy decía "No convocado") y Alonso Romero no (decía "A tiempo"); quedan Jon 2 partidos y Alonso 1 asistido.
- **Nombres de SportEasy resueltos:** "Edimil Feliz Gomez" → `feliz-gomez-edimil` y "Luis Gomez Pradal" → `gomez-pradal-luis` (ninguno está en la plantilla 26/27, así que no salen en la web). Barreiro, Pablo Ortega e Iván Rodríguez siguen fuera.

## Cambio de correo seguro, aviso de "código por correo" y diagnóstico de acceso (03/10/2026)
> Rama `feat/correo-seguro-jugadores`, **sin mergear a `main`** (instrucción explícita de Iván). La migración y los
> dos cambios de correo de más abajo **sí están aplicados en el proyecto real** (D53, sin pedidos que proteger),
> independientemente del merge.

- **El fallo de origen:** en Gestión → Jugadores, cambiar el correo de un jugador solo tocaba `jugadores.email`.
  Si esa persona ya tenía cuenta de Supabase Auth con el correo viejo, quedaba huérfana (nadie la referenciaba
  ya) y el correo nuevo, sin vincular hasta su primer login. Corregido con una función nueva en la base de datos.
- **`public.cambiar_correo_jugador(jugador_id, correo)`** (migración
  `plataforma/supabase/migrations/20261003090000_cambiar_correo_jugador_sincroniza_auth.sql`): actualiza
  `jugadores.email` y, si ya existía una cuenta de Auth con el correo viejo, la **renombra** al correo nuevo (misma
  cuenta: Google la enlaza por el "sub" del usuario, no por el correo, así que renombrar no rompe esa sesión;
  comprobado contra el proyecto real). Si el correo nuevo ya pertenece a una cuenta de Auth de **otra** persona,
  rechaza el cambio (`correo_en_uso_auth`) en vez de fusionar dos identidades a lo tonto. Si esa persona es además
  gestora con ese mismo correo (caso Carlos o Edu), actualiza también `gestores.email`. Se usa desde la web
  (`guardarJugador`, solo gestores) y desde `npm run db:correo -- <person_id> <correo_nuevo>` (scripts locales,
  conexión directa sin sesión: mismo modelo de confianza que `db:gestor`).
- **Aplicados en el proyecto real (confirmado por Iván, 03/10/2026):**
  `galan-domingo-guillermo` → `<correo>`, `lopez-lucero-alfredo-david` →
  `<correo>` y `teruel-fernandez-tomas` → `<correo>`. Verificado: los correos viejos
  ya no pasan `correo_permitido`, los nuevos sí; los 28 jugadores siguen con correo (`npm run db:estado`); ninguno
  tenía cuenta de Auth todavía (nunca habían entrado), así que no hay nada que renombrar — se creará sola en su
  primer login, como siempre.
- **Gestión → Jugadores marca en amarillo "Entrará con código por correo"** junto al correo de quien no es de
  Gmail, para que Iván sepa a quién pedirle su Gmail. **Pendientes de dar su Gmail (si lo tienen):** Manuel
  Calahorro Sánchez (su Gmail de jugadores probablemente no es el que usa de verdad en Google), Carlos Barreiro
  (Hotmail), Víctor Pérez Núñez (Hotmail), Fernando Tejeiro (Hotmail), Edwin Villa Guerrero
  (Hotmail) y Eduardo Martín-Ortega (correo de empresa).
- **Diagnóstico de los que no podían entrar (David, Guillermo, Manu), con evidencia, no por suposición:**
  - `auth.audit_log_entries` (donde GoTrue registraría el detalle de cada intento) tiene **0 filas** en el proyecto
    real: Supabase hospedado no vuelca ahí el log de cada intento; vive en su propio panel
    (**Authentication → Logs**), que no es accesible por SQL ni por esta sesión. **No puedo darte el texto exacto
    del error de cada intento** sin que lo mires tú ahí; si quieres que lo haga por API hace falta un token de
    gestión de Supabase (Personal Access Token), que no tengo.
  - Lo que sí confirma la base de datos: **ninguno de los correos de David, Guillermo ni los otros 7 ha tenido
    nunca una fila en `auth.users`** (antes del cambio de hoy): ningún intento llegó a completarse. Es coherente
    con que "Entrar con Google" exige una cuenta de Google con **ese correo exacto**, y el suyo era Yahoo/Hotmail;
    lo normal es que no exista tal cuenta de Google, así que la pantalla de Google nunca llega a ofrecer ese
    correo como opción (no es un rechazo del hook: ni siquiera arranca con el correo correcto). La vía que sí
    debería funcionarles siempre es "Recibir código por correo" a su dirección real.
  - `auth.flow_state` (intentos de "Entrar con Google" sin terminar) tiene 2 filas del 02/10/2026 sin usuario
    vinculado; coinciden con el día en que Iván probó el login real, no se puede atribuir a una persona concreta.
  - **SMTP de los códigos:** hoy se envían con el servicio compartido por defecto de Supabase. **No he dado por
    supuesto su límite exacto** (no es consultable por SQL ni sin entrar al panel): Iván debe mirar
    **Authentication → Rate Limits** para ver la cifra real de su proyecto. Lo que sí es comportamiento documentado
    de Supabase en general: ese servicio compartido está pensado solo para pruebas (bajo volumen, sin garantía de
    entrega a bandejas externas). Guía para poner SMTP propio con Gmail del club: `plataforma/LEEME.md`, apartado
    "7. Correo propio para los códigos".
- **Pruebas:** `npm run pruebas` (pila local): **107/107 OK**, con un bloque nuevo para
  `cambiar_correo_jugador` (renombrado de una cuenta existente, sincronía con gestores, rechazo de correo ya usado
  por otra cuenta, solo gestores desde la web, permitido sin sesión desde un script local) y el aviso de "Entrará
  con código". `node pruebas/verificar_real.mjs`: **TODO OK**, incluida la misma función contra el proyecto real
  (correo renombrado con la sesión de gestor real, la sesión del jugador afectado sigue entrando tras el cambio),
  con limpieza completa (estado final igual al de antes de empezar, no a cifras fijas: el club ya tiene uso real).

## Login único: Google o código por correo, con lista blanca (02/10/2026, D68)
- **Sustituye a los enlaces personales `/j/<token>` (D45, derogada).** Ahora: `/entrar` (Google o código de un solo uso por correo) → `/mi-zona` (jugador), `/gestion` (gestor) o `/entrar/elegir` si es las dos cosas. `anon` se queda sin ningún permiso (ni tablas ni funciones): todo exige sesión real.
- **Lista blanca por correo:** solo entra quien tiene su correo en `jugadores.email` o `gestores.email`. Un correo desconocido nunca crea cuenta: lo bloquea el hook "Before User Created" de Supabase (`public.antes_de_crear_usuario`, **registrado por Iván el 02/10/2026** en el panel, ver `plataforma/LEEME.md`). El registro de alta ("Allow new users to sign up") estaba desactivado desde el 26/09/2026; activado por Iván el 02/10/2026 **después** del hook, como exige D68.
- **Migración** `plataforma/supabase/migrations/20261002120000_login_google_lista_blanca.sql`, aplicada directamente en el proyecto real (D53, sin pedidos que proteger). Durante la verificación se encontró y corrigió un fallo real de permisos (funciones nuevas heredaban `EXECUTE` del pseudo-rol `PUBLIC` porque el `revoke` solo decía `from anon`, no `from public, anon, authenticated`); quedó corregido en el propio fichero de migración y re-sincronizado en el proyecto real.
- **Resultados reales de la verificación:**
  - `npm run pruebas` (plataforma, pila local sin Docker): **93/93 OK**, incluye lista blanca (`correo_permitido`, `antes_de_crear_usuario`, `POST /otp`), un gestor reservado solo por correo que se vincula solo al entrar (trigger), sesión sin jugador ni gestor, RLS, pedidos (propio y familiar), dorsal repetido, Excel para VIVE celda a celda igual a la plantilla.
  - `node pruebas/verificar_real.mjs` (proyecto Supabase real): **TODO OK**, con limpieza completa.
- **Página pública `/privacidad`** (sin login): qué datos se guardan, para qué, quién los ve y cómo pedir el borrado.
- **La Redirect URL `https://maccabis-*-web-tcpc.vercel.app/**` es correcta** (confirmado por Iván): "web-tcpc" es el slug del **equipo de Vercel**, no del proyecto de Tres Cantos. Verificado con la vista previa real `https://maccabis-git-feat-plataforma-v0-web-tcpc.vercel.app`. El aviso ⚠️ se ha quitado de `plataforma/LEEME.md`.
- **Hecho** (`plataforma/LEEME.md`, apartados 2 y 3): proyecto de Google Cloud "Maccabis" (nunca el de TCPC) y proveedor Google activado en Supabase — verificado por Claude el 02/10/2026; hook "Before User Created" y "Allow new users to sign up" activados por Iván el 02/10/2026; Site URL y Redirect URLs verificadas el 02/10/2026.

### `npm run db:correos` — ejecutado (02/10/2026)
- Fichero: `SportEasy_maccabis (1).xlsx` de Descargas (exportación de SportEasy del 02/10/2026; el `(1)` porque ya había una copia antigua de agosto).
- Columnas detectadas solas: correo = "Correo electrónico", nombre = "Nombre" + "Apellido(s)".
- **8 correos casados y escritos** (nombre exacto, sin adivinar).
- **3 personas nuevas dadas de alta** (corrección de Iván: no se ignoran) como jugadores **`solo_entreno`** (entrenan, sin ficha MdA/MdL — el motor nunca los convoca), con su correo: **Edimil Feliz Gómez**, **Ignacio Mateos Aparicio** y **Nicolás Yamín Squicciarini**. Identidades en `data/personas.json`: las dos últimas ya existían (`mateos-aparicio-ignacio`, `yamin-squicciarini-nicolas`); Edimil Feliz Gómez es identidad nueva (`feliz-gomez-edimil`), añadida a `data/historia_club.json` (sin temporadas jugadas, `previsto_2627: true`) y regenerada con `npm run personas` (88 identidades, `check:personas` 0 problemas). Añadidos también a `plataforma/scripts/plantilla_2026_27.mjs` para que una resiembra futura (`db:semilla`) no los pierda.
- **Estado real tras todo lo anterior: `{"jugadores":28,"jugadores_con_correo":11,...}`.**
- **17 correspondencias de nombre** (SportEasy ≠ nombre oficial exacto: motes, orden nombre/apellido, apellidos incompletos) propuestas a Iván en el chat y **confirmadas "tal cual" (02/10/2026)**: escritas en el proyecto real. **Resultado: 28/28 jugadores con correo**, verificado con `npm run db:estado` y `node pruebas/verificar_real.mjs` (TODO OK).
- Corregido en el camino: el detector de columnas no reconocía la cabecera real "Apellido(s)" (el patrón exigía "Apellido" o "Apellidos" exactos); ahora acepta cualquier cabecera que empiece por "apellido". `pruebas/verificar_real.mjs` y `pruebas/ejecutar.mjs` ya no asumen "25 jugadores" a pelo: comparan contra el total real / el de la semilla (28).

## Rutina A (actas): Enlace Móvil de Windows, no emulador (02/10/2026, D70 — matiza D69, que a su vez matiza D35)
- Corrige el bloque anterior: D63 (rutinas por navegador) **nunca incluyó la rutina A** porque Afición FBM no tiene web. D69 proponía un emulador Android, pero Play Store no deja instalar Afición FBM en emuladores (probado en Android 15 y 17) y copiarla con adb no fue posible (cable solo carga, depuración inalámbrica falla en la red de Iván); queda como reserva en F:. **D70 fija cómo se automatiza de verdad:** Claude abre Afición FBM del Samsung S22 Ultra de Iván por **Enlace Móvil de Windows** y la maneja con control del ordenador. Probado el 02/10/2026: la app carga y responde. Condición: móvil encendido, con wifi, cerca del PC (puede estar bloqueado). Procedimiento en `docs/RUTINAS/A_ACTAS.md`; `docs/PLAN_TRABAJO_2026-27.md` y `docs/BACKLOG.md` actualizados para reflejarlo.

## Calendario oficial 2026/27 (02/10/2026)
- `data/calendario_2026-27.json` creado con los 44 partidos (22 jornadas × 2 fichas) leídos en Deportes/web el 02/10/2026 (fuente: `fuente.origen`, sin datos personales). Esquema compatible con el que generará `feat/calendario-automatico` (`scripts/calendario/actualizar_calendario.js`, sin mergear) cuando el portal 211549 publique la 26/27.
- Verificado por contraste cruzado: 2 descansos por equipo (MdA en J4 y J15, MdL en J11 y J22) y los dos domingos con las dos fichas a la misma hora (18/10 y 07/02, 10:15) coinciden exactamente con lo ya registrado en D62/ESTADO sobre la carga en SportEasy.
- `docs/RUTINAS/B_CALENDARIO.md` escrito con el procedimiento de la rutina B (pasos en Deportes/web, comparación con SportEasy, hallazgos del 02/10).

## Normas de trabajo y plan 2026/27 (02/10/2026)
- `docs/NORMAS_DE_TRABAJO.md`, `docs/PLAN_TRABAJO_2026-27.md` y `docs/RUTINAS/` creados en su ubicación definitiva (antes vivían como copias provisionales fuera de `docs/`). D63-D67 registradas en `DECISIONS.md`. BACKLOG reordenado: la subida de actas desde la zona de gestión pasa a plan B.
- Traído con `merge --no-ff` de `docs/sporteasy-calendario-2627` a `feat/plataforma-v0` (commit `589f9ae`) y empujado a origin para refrescar la vista previa de Vercel.
- **Verificación de la rama, resultados reales:**
  - `npm run pruebas` (plataforma, Postgres + PostgREST + Chrome locales, sin Docker): **84/84 OK**, incluye `next build`, RLS y permisos, enlaces personales, pedido de ropa (jugador y familiar), dorsal repetido, campaña cerrada, Excel para VIVE celda a celda igual a la plantilla, sin errores de JS.
  - `node pruebas/verificar_real.mjs` (contra el proyecto Supabase real, HTTPS con la clave pública): **TODO OK** (47 comprobaciones), con limpieza completa al final (estado: 1 usuario, 1 gestor, 25 jugadores, 25 enlaces, 1 campaña cerrada, 0 pedidos — igual que antes de la verificación).
- **"OK vista previa" dado por Iván (02/10/2026), después del merge a `main` (`ad972df`):** validado en el móvil sobre la plataforma ya en producción (`maccabis.vercel.app`), con "Entrar con Google" probado de verdad.

## Temporada 2026/27 en SportEasy (02/10/2026)
- **40 partidos de liga JDM cargados** con un agente de navegador (D62): **20 MdA** en el campeonato "Temporada MdA" (grupo G1) y **20 MdL** en "Temporada MdL" (grupo G2), 22 jornadas por equipo con 2 descansos cada uno (MdA en J4 y J15, MdL en J11 y J22).
- **Todos con las inscripciones abiertas.**
- **Verificados** contra el Excel `calendarios_maccabis.xlsx` de Iván (fecha, hora, jornada, rival, local/visitante, pista). El Excel **no está en el repositorio**.

## Supabase real — CARGADO (26/09/2026)
- Proyecto de Iván (región Europa), con "Automatically expose new tables" **desmarcado**, sin "Enable automatic RLS" y con el registro libre **desactivado**. Migraciones aplicadas: `20260926100000_plataforma_v0` y `20260926110000_permisos_rls_automatica_dorsal_familiar` (permisos explícitos D58, RLS automática D59, dorsal libre para familiares D60).
- Semilla: **25 jugadores, 25 enlaces vivos, 1 campaña "Ropa 2026/27" cerrada, 0 pedidos.** Nombres visibles según D61.
- **Gestores: solo Iván** (su único usuario, confirmado). Carlos y Edu, más adelante: `npm run db:gestor -- <correo> <nombre>` después de crearlos en Supabase.
- **Verificación contra el proyecto real (`node pruebas/verificar_real.mjs`): 42/42 OK.** Todas las tablas con RLS; tabla de prueba creada y borrada nace con RLS; `anon` sin permisos sobre tablas y solo con las 4 funciones de enlace; por HTTPS con la clave pública un anónimo no lee ni escribe nada; con la identidad de Iván la base le reconoce como gestor y le deja ver los 25; login real de Supabase Auth con dos usuarios temporales (un gestor ve todo, uno que no lo es no ve nada); un jugador solo ve y toca lo suyo; familiar con dorsal repetido aceptado; campaña cerrada y enlace anulado rechazados. Todo lo temporal se borró (estado final: 1 usuario, 1 gestor, 25/25, 1 campaña cerrada, 0 pedidos).
- `.env.local`: la URL del proyecto venía con `/rest/v1/` al final; se quitó (la app necesita la URL base). **En Vercel, la URL sin `/rest/v1/`.**

## Pipeline de estadísticas — EN PRODUCCIÓN (26/09/2026)
- `feat/pipeline-estadisticas` mergeada a `main` con `--no-ff` (merge `f69a39f`) por orden de Iván. `npm run test:regresion` en `main`: **"RESULTADO: OK"**. La web publicada no cambia (mismo `index.html`, `data/index.json` y `season_2025-26.json`; solo se añade `season_2026-27.json`, que no está en el índice). Lista para la jornada 1 (`docs/PROCEDIMIENTO_JORNADA.md`).
- `main` se ha traído a `feat/plataforma-v0` (merge `92de691`), sin conflictos. `feat/calendario-automatico` sigue sin mergear.


## Plataforma v0 — EN PRODUCCIÓN desde el 02/10/2026 (mergeada a `main`, merge `ad972df`)
> Bloque original del 26/09/2026, cuando aún vivía solo en `feat/plataforma-v0`; el login y las pruebas descritos abajo quedaron luego ampliados por D68 (ver más arriba). Mergeada a `main` el 02/10/2026 (verificación antes del merge: `npm run pruebas` 93/93 OK, `node pruebas/verificar_real.mjs` 43/43 OK; y después del merge en `main`: mismos resultados, 93/93 y 43/43 OK). El **"OK vista previa" de Iván llegó después**, validado en el móvil sobre `maccabis.vercel.app` ya en producción, con "Entrar con Google" probado de verdad.
- **Qué hay:** app Next.js 16 en `plataforma/` (la web de GitHub Pages no cambia). Base de datos Supabase definida en `plataforma/supabase/migrations/20260926100000_plataforma_v0.sql`: `jugadores`, `enlaces`, `gestores`, `campanas_ropa`, `pedidos_ropa`, RLS en todas, sin políticas para anónimos; los jugadores solo usan 4 funciones que reciben su enlace (D55). Guía de puesta en marcha en `plataforma/LEEME.md`.
- **Zona personal `/j/<enlace>`:** saludo con su nombre visible; pedido de ropa activo con su estado; mis pedidos (modificar y anular mientras esté abierto); enlace a su ficha del dashboard; "Mi semana" y "Próximos partidos" como próximamente. Manifiesto propio para guardarla en la pantalla de inicio.
- **Pedido de ropa (VIVE):** para mí o para un familiar; nombre completo, nombre en la ropa (mayúsculas, máx. 15), dorsal 0–99; camiseta, pantalón, cubre (con la nota de la equipación amarilla) y sudadera, cada una con su imagen (extraídas del PDF de `privado/`, publicadas en `plataforma/public/ropa/`), lo que lleva impreso, precio orientativo "por confirmar" y talla VIVE. Resumen en tabla siempre visible; no se envía si falta una talla. Dorsal cogido: "Ese dorsal ya está cogido", sin nombres (D56). Guía de tallas en `/guia-tallas`.
- **Gestión `/gestion` (login):** jugadores y enlaces (copiar mensaje de bienvenida, WhatsApp si hay teléfono, regenerar, anular, editar nombre visible, teléfono, fichas, rol, entrena, activo); pedido de ropa (abrir/cerrar, fecha límite, precios, dorsales repetidos con nombres, recuento por prenda y talla, pedidos editables y borrables, alta manual) y **"Descargar Excel para VIVE"**, idéntico en estructura a la plantilla 24/25 (D57).
- **Semilla:** 25 personas (24 de la plantilla confirmada + Carlos Barreiro como entrenador), con los motes de `PLANTILLA_26-27.md` ("Fernando T." y "Fernando M."); quien no tenía mote lleva su nombre de pila. Sin niveles ni posiciones. Sin teléfonos. Campaña "Ropa 2026/27" creada **cerrada**.
- **Pruebas locales (`npm run pruebas`): 84/84 OK** (con la misma configuración de permisos que el proyecto real) contra Postgres 17 y PostgREST reales con las migraciones, la app compilada y Chrome a 375 px: enlace válido, anulado e inventado; RLS explícita (anónimo, usuario no gestor, jugador contra jugador); pedido válido, talla inválida, campaña cerrada y fecha pasada, dorsal repetido sin nombre, modificar, familiar; Excel celda a celda "IGUAL" con la plantilla. El login de gestores se prueba con un doble de Supabase Auth.
- **Vercel:** lo configura Iván (carpeta raíz `plataforma`, 2 variables públicas). Pasos en `plataforma/LEEME.md`.
- **Decisiones:** D44–D61. SportEasy sale de la operativa desde la J2 (D44).

---

_Actualización anterior: 25/09/2026 (noche) — **bloque "Cierre del sondeo y cimientos 26/27"**: plantilla confirmada, protección de las fuentes, URL de rivales, pipeline de estadísticas y calendario automático (en ramas sin mergear), sondeo de datos por jugador, cláusula de SportEasy, reglas de convocatoria v0 y decisiones D35–D43. La liga empieza el **4/10/2026** (D38)._

### Ramas pendientes de verificar con Iván (NO mergeadas)
| Rama | Qué trae | Cómo se comprueba |
|---|---|---|
| **`feat/pipeline-estadisticas`** | `scripts/estadisticas/` (Node): actas + hojas XLSX + asistencia → `data/season_<t>.json`; `npm run jornada` (comando semanal); `npm run test:regresion`; `data/season_2026-27.json` vacío con la plantilla; paso `estadisticas` en `build:datos`. | `npm run test:regresion` → "RESULTADO: OK". Es lo que hace falta para la **jornada 1 (4/10)**. |
| **`feat/calendario-automatico`** (sale de la anterior) | `scripts/calendario/actualizar_calendario.js`, workflow `.github/workflows/calendario.yml`, `data/calendario_2026-27.json` y `data/sporteasy_calendario_2026-27.csv` (vacíos hasta que el portal publique), plan B manual. `docs/CALENDARIO.md`. | Probado con 2025/26. Se mergea después del pipeline. |

### Test de regresión del pipeline (25/09/2026)
- **Fuentes de 2025/26 en el equipo de Iván:** las **42 actas** (Descargas), la **asistencia** (Excel montado por Iván con SportEasy) y **sólo 1 de las 41 hojas XLSX** (`estadisticaPartido_21_mda.xlsx`). Las otras 40 se subieron al chat de Claude en su día y no hay copia en ninguna unidad (búsqueda en C:, D: y E:). Copiadas a `fuentes_fbm/2025-26/` (fuera de git).
- **A. 42 actas reales:** partidos y parciales medios idénticos, salvo 42 × hora y 42 × pista (datos nuevos) y 2 correcciones de jornada.
- **B. Hoja real (jornada 21 MdA):** boxscore idéntico, 0 diferencias.
- **C. JSON completo** (41 hojas reconstruidas desde el boxscore publicado): **idéntico** en jugadores, medias, porcentajes, redondeos, asistencia, boxscores y orden. Diferencias, todas explicadas: hora y pista; **329781** (incomparecencia Pelota Naranja) es la jornada **16**, no `null`; **329814** (MdL–Chavalitros 10/05) es la jornada **22**, no la 11; la fila con la errata "DE CARVLHO" ahora lleva `person_id`.
- **Hallazgo:** la hoja que faltaba en 25/26 no era la de la incomparecencia (esa existe, con 0 puntos) sino la del **MdL–Chavalitros del 10/05/2026**.
- La 2025/26 publicada **no se ha regenerado** (D43). Para aplicar las 3 correcciones y añadir hora y pista hacen falta las 40 hojas.

### Plantilla 2026/27 — **CONFIRMADA** (25/09/2026)
- 24 deportistas (22 en las dos fichas; Galán Domingo y Varas García sólo en el MdA). MdA en **G1**, MdL en **G2**.
- **3 personas nuevas creadas**: García Gijón, Santos Artiles y Teruel Fernández (`historia_club.json` → `personas.json`, 87 identidades). `previsto_2627`: salen Rausse, Mateos y Rodríguez Pérez; entran Galán, Vallesi, Villa Guerrero y los 3 nuevos. En "El Club" salen en un tramo propio ("Llegan en 26/27").
- Tabla de motes → nombre oficial → `person_id` en `docs/PLANTILLA_26-27.md`. Yamin, Perchín y Mateos siguen en SportEasy pero se ignoran en los cruces.

### Protección de las fuentes (D41)
- **Torneos 2018 del MdL** (antiguo `MDL.pdf`): irrecuperable; **congelada** en `docs/fichas_sin_pdf.json` con sus 17 nombres (recuperados del commit `63229e6`) y `sin_pdf: true`.
- `consolidar_fichas.js` procesa ya el 47 JDM y **falla sin escribir** si falta un PDF registrado o si un PDF ya es otra hoja (probado en los dos casos).
- `scripts/lib/copia_segura.js`: copias sin sobrescribir nunca (sin distinguir mayúsculas).
- La **fecha de alta** de las hojas de 26/27 ya no se publica (D17).
- `build_historico.js` lee los Excel de Carlos de `docs/estadisticas/`. Se copiaron allí (sin pisar nada) 4 ficheros de Descargas con el nombre exacto: dos de las copias que había en `docs/estadisticas/` (`Estadisticas_2017_2018 (1).xls` y `Estadisticas_2023_2024_MDL (1).xls`) son **versiones distintas** que no reproducen los datos publicados. No se han borrado.
- **`npm run build:datos` no altera ningún dato** (dos ejecuciones seguidas, ficheros idénticos) y `check:personas` da 87 identidades sin problemas.
- `.gitignore`: `docs/estadisticas/`, `privado/` y `fuentes_fbm/` (verificado con `git check-ignore`).

### Rivales
- El portal **renumeró** los recursos del 300257 (y ya trae la 2025/26). Tabla nueva en `build_rivales_2026_27.py`; `rivales_2026-27.json`, `RIVALES_2026-27.md` y `rivales_2026-27_web.json` se regeneran **idénticos**.

### Sondeos y SportEasy
- **Datos abiertos por jugador: no existen** (`docs/SONDEO_ACTAS_FASE0.md`, apartado 6). Se mantiene el gesto manual de Iván sin pedir permiso a la FBM (D35).
- El **211549 sigue con la 2025/26** a 25/09/2026. Su robots.txt veta a los bots las descargas: calendario programado sólo con metadatos, descarga con botón (D42).
- **SportEasy:** cláusula literal copiada; plantilla del soporte como vía principal y agente como plan B (D36); recordatorios cubiertos por Premium (D37). **Indicio:** el export de hoy termina el 23/09 (sin eventos futuros); pendiente de la prueba de Iván.

### Convocatoria
- `docs/REGLAS_CONVOCATORIA.md` v0, sin nombres ni niveles (D40). Niveles confidenciales en `privado/` (D39). Nada construido.

### Decisiones del bloque
D35 (actas: un gesto, sin permiso FBM) · D36 (SportEasy: plantilla del soporte; agente plan B) · D37 (recordatorios Premium) · D38 (liga desde el 4/10) · D39 (niveles confidenciales) · D40 (reglas v0) · D41 (protección de fuentes) · D42 (calendario por código, descarga con botón) · D43 (pipeline en Node; 25/26 no se regenera).

### Bloque anterior (25/09/2026, tarde): "Arranque 26/27"
Repositorio verificado (todo en `main`), plantilla extraída, sondeos de actas y SportEasy, D30–D34. Sus cambios, que estaban sin commit, se subieron en este bloque.

### Pestaña "Rivales 26/27" — **EN PRODUCCIÓN desde el 25/09/2026**
- **Publicada en** https://eyeshar.github.io/MACCABIS/?p=rivales&g=MdL (y `&g=MdA`, `&r=<id-rival>`). Iván aprobó las capturas; merge `--no-ff` de `feat/rivales-2026-27` a `main`, que arrastra `feat/rivales-jdm`. Ramas conservadas. Comprobado en producción con Chrome a 375 px: carga la pestaña con el grupo MdL, sin errores de JS y sin desbordamiento.
- **Retoques de la aprobación (D29):** "N incomparecencias" junto al puesto cuando explican PJ ≠ G+P (el ⚠ queda para lo que no explican); tarjetas ordenadas por % de victorias en partidos jugados en 2025/26 (28500 pasa de último a 3º del MdL); el selector de temporada se oculta mientras la pestaña está activa.

#### Historial de la construcción
- En `index.html`. Capturas aprobadas en `docs/capturas/rivales/`.
- Selector Grupo MdA / Grupo MdL, "Lo esencial", tarjetas por rival ordenadas por puesto relativo 2025/26 y ficha con gráfico de trayectoria (SVG propio, D28), tabla temporada a temporada y cara a cara. Enlace `?p=rivales&g=MdA&r=<id>`.
- Datos: `data/rivales_2026-27_web.json` (74 KB) con `npm run build:rivales`, generado de `data/rivales_2026-27.json`.
- Probado con Chrome sin interfaz: sin errores de JS (sólo el 404 de `favicon.ico`, que no existe en el sitio), 70/70 combinaciones temporada×pestaña correctas, **sin desbordamiento horizontal a 375 px**, y los números cuadran con `docs/RIVALES_2026-27.md` en los 18 rivales con rastro.

### Datos del scouting 2026/27 — CERRADOS (25/09/2026)
- **Regla del nombre del club (D26):** #149233 "MACCABI DE LEVANTAR" (2020/21) es un **rival**, no un tercer equipo. `DIAGNOSTICO_MDL_MDA.md` marcado como corregido.
- **7 alias confirmados (D27)** aplicados a todo; SPORTING DE VALLECAS y GSD VALLECAS descartados; quedan 7 candidatos sin confirmar.
- Cara a cara: 410 partidos, **0 contados dos veces**; las 5 cifras que esperaba Iván cuadran (Suanzes Motor 11G-2P, LOS KHINKIS RUSOS 15G-6P, NABUCO TD 0G-2P, VALLEKAS BASKET y F.T. FLOPPERS nunca).
- `feat/rivales-jdm` está mergeada en esta rama (no en `main`).

### Scouting de rivales 2026/27 — rama `feat/rivales-2026-27` (25/09/2026, NO mergeada) — primera versión
- **Qué hay:** `data/rivales_2026-27.json` + `docs/RIVALES_2026-27.md`, generados por `scripts/build_rivales_2026_27.py` (Python). Trayectoria en los JDM de los **20 rivales** de 2026/27 (baloncesto sénior masculino, **todos los distritos**, 2014/15–2025/26, liga, segundas fases, fase de distrito, fase final de Madrid y torneos municipales) y **cara a cara** con el club.
- **Fuente:** portal de datos abiertos del Ayuntamiento de Madrid (CC BY 4.0). 300257 (histórico) + **211549 descargado el 25/09/2026, que aún trae la 2025/26 completa** (no la 26/27). Copias brutas en `data/raw/` y `.cache-jdm/`, **no versionadas** (D25).
- **Resultado:** 17 rivales con rastro en los JDM; **sin rastro: Craps, F.T. FLOPPERS y Quinto Tiempo**. Alias confirmados aplicados (D24). **23 candidatos** a mismo equipo pendientes de Iván, sin fusionar.
- **Cara a cara:** 423 partidos del club combinados (portal 300257 vía `rivales_jdm.json` de `feat/rivales-jdm`, 14 del tercer equipo 2020/21 #149233 aparte, portal 211549 para 2025/26 y los `season_*.json`), deduplicados por fecha+marcador o temporada+marcador.
- **Verificación:** 2025/26 portal vs `season_2025-26.json`: **41/42** casan; el que no, **Pelota Naranja 08/03/2026**: portal 20-0 (incomparecencia), histórico propio 0-0. Clasificaciones: 528 filas con PJ ≠ G+P (418 son incomparecencias que el portal cuenta en PJ pero no en G/P; 56 sin explicar) y 48 grupos con ΣPF ≠ ΣPC. Informado, no corregido.
- **Hallazgos:** `season_2019-20.json` (etiqueta MDL) anota un partido **contra "MDL"** → probablemente es el MdA, como 17/18, 18/19 y 20/21 (no se ha tocado). Codificación CP850 en los CSV antiguos reparada (`CASTA¥AZO` → CASTAÑAZO). En 2025/26 hay 13 grupos con clasificación pero sin partidos en el portal (Hortaleza, Retiro, Vicálvaro…). Homónimo no incluido: #179099 "Maccabi de levantar" (Vicálvaro, 2025/26).
- **Depende de** `feat/rivales-jdm` (lee `data/rivales_jdm.json` de esa rama con `git show` si no está en local). Ambas ramas publicadas en origin, ninguna mergeada.


### Interfaz de la Historia: pestaña "El Club" — **EN PRODUCCIÓN desde el 04/08/2026**
- **Publicada en** https://eyeshar.github.io/MACCABIS/?p=historia — mergeada a `main` (merge `--no-ff`, conservando el histórico de los 17 commits de la rama).
- **Qué incluye:**
  - **Rejilla maestra de 84 personas** × 13 temporadas (2013/14 → 2025/26) más la 26/27 prevista, con la trayectoria de cada una como barra continua: naranja donde hay estadísticas, morado donde sólo consta presencia.
  - **Ficha de trayectoria** al pinchar una fila, con **puente a las estadísticas por `person_id`**: las temporadas con datos abren la vista de jugador de ese año.
  - **Dos modos de orden excluyentes**: veteranía (agrupada en tramos) o año de incorporación (lista plana).
  - **Tira temporal** con plantilla, altas y bajas de cada temporada.
  - **2016/17 completa con 24 personas**, recuperada de la hoja de Torneos 2017: era el único año sin estadísticas ni hoja propia.
- **Verificado antes del merge**: `check:personas` 84 identidades sin incidencias, cuadre de actas 171/171, `build:datos` idempotente y las dos suites de pruebas sin errores de JS.
- **Transversal a las temporadas**: se carga una vez desde `data/personas.json` y `data/historia_club.json`; no depende del selector ni lo altera.
- **Dos modos de orden excluyentes en la rejilla** (decisión de Iván, ver D22): por **veteranía** (con agrupación en tramos, es el de por defecto) o por **año de incorporación** (lista plana, sin tramos). La cifra dorada de cada fila cambia en consecuencia: nº de temporadas o temporada de debut.
- **Rejilla maestra**: 84 personas × 13 temporadas + la 26/27 prevista. Cada trayectoria es una barra continua; naranja = temporada con estadísticas, morado = sólo presencia. Cabecera y columna de nombre fijas, agrupación por tramos de veteranía, buscador y filtro con/sin estadísticas. Entrenador en sección propia.
- **Tira temporal**: una tarjeta por temporada con plantilla, altas y bajas. La 26/27 aparte, marcada como no empezada.
- **Ficha de persona**: al pinchar una fila. Temporadas, debut, veteranía y presencia año a año.
- **Puente con las estadísticas**: desde la ficha, las temporadas con datos cargan esa temporada y abren la ficha de jugador de esa persona (enlace por `person_id`). También por URL: `?t=2023-24&p=jugador&j=<person_id>`.
- Sin librerías nuevas y sin almacenamiento del navegador. Las demás pestañas quedan intactas.
- **Pendiente conocido**: el dashboard tiene desbordamiento horizontal en pantallas estrechas. **Es previo a este bloque** (se reproduce igual en la versión anterior); la rejilla de la Historia lleva su propio scroll contenido.

## Repositorio y publicación

- **Remoto:** `https://github.com/eyeshar/MACCABIS.git` (público). Conectado el 04/08/2026.
- **Ramas publicadas:** `main` (es la que sirve GitHub Pages), `feat/rivales-jdm` y `feat/rivales-2026-27` (mergeadas a `main` el 25/09/2026; se conservan).
- El repositorio local **no estaba bajo git**; se inicializó en este bloque. El remoto tenía un único commit de subida manual (`45b31d9`) con una versión anterior del proyecto. Las dos historias estaban desconectadas y se unieron con `--allow-unrelated-histories`: **el commit `45b31d9` se conserva** como segundo padre del merge `b42576b`. Ningún archivo suyo se perdió.
- Hay una etiqueta local `pre-merge-remoto` (= `99e52d3`) como punto de retorno anterior a esa unión.
- **URL pública:** https://eyeshar.github.io/MACCABIS/

## Hecho y funcionando

### Historia del club: matriz de presencia 2013→2026 (rama `feat/historia-club-datos`)
- **84 personas** con sus temporadas de presencia en el club, en `data/historia_club.json`. **Cubre 2013-2025 sin huecos.**
- **2016/17 completada de verdad (04/08/2026).** El bloque anterior dio esa temporada por integrada, pero un filtro obsoleto en `completar_historia.js` impedía aplicar las hojas: los 4 jugadores que aportaba la hoja de Torneos 2017 nunca llegaron a la matriz. Corregido y verificado: **24 personas** constan ya en 2016/17, entre ellas las 20 de la hoja. (cerrado por Iván el 04/08/2026 a partir de `Historia_de_los_Maccabi.xlsx` + SportEasy).
- **Sólo datos**: la interfaz visual (rejilla, tira temporal, fichas) es el bloque siguiente y NO está construida.
- **Registro único de identidades** en `data/personas.json` (80 personas): fuente de verdad de los `person_id` que comparten la Historia y las estadísticas. Ver DECISIONS D13-D15.
- **Completada y verificada (04/08/2026)** contra las otras dos fuentes, con esta jerarquía: estadísticas (actas) > hojas de inscripción > matriz. La matriz sólo se completa; nunca se quita a nadie ni se recorta un año.
  - **4 personas añadidas** desde las estadísticas: Javier Páez García, Daniele Vallesi, Ramón Mora-Gil Jiménez e Ignacio Ferrando del Rincón. Ya no queda nadie con estadísticas fuera de la matriz.
  - **43 pares persona-año añadidos** sobre 22 personas. El caso mayor: Santiago Pazo Pascual, que tenía 3 temporadas y las actas confirman 4 más (2017, 2018, 2019 y 2024) — probable resto de la fila "Santi" fundida con Calvo González en el Excel original.
  - **21 hojas de inscripción oficiales** procesadas (`data/fichas_inscripcion.json`), de 12 temporadas. Informe en `docs/INFORME_FICHAS.md`.
- **Cierre de datos (04/08/2026)**, con las decisiones de Iván aplicadas:
  - **Dos nombres canónicos corregidos**: "Castro Mayo" → **"Castro Moya, Henry Luis"** y "Mar Calvo" → **"Martín Calvo, Borja"**. Cambian su `person_id`; los antiguos quedan en `alias_ids`.
  - **5 personas identificadas** desde hojas oficiales: Iván Álvarez Márquez (2018), Carlos Puertas Domingo (2019), Jorge Ranz Casado (2022), Hugo García Jiménez (2014) y **Alejandro Hernández Gómez (2017)**, que era el solo_mote "Alejandro, el de Alicante". Sólo quedan 2 solo_mote: Pupo y Eric.
  - **Regla de los Torneos Municipales**: eran copas del final de temporada, así que "Torneos AAAA" es la temporada que **termina** en AAAA. Liga y torneo del mismo periodo son una temporada y sus plantillas se suman.
  - **Temporada 2016/17 recuperada** de la hoja de Torneos 2017 (20 personas). Era el único año sin hoja propia ni estadísticas.
  - **Revisión de 2017/18**: ningún nombre se había resuelto contra la hoja equivocada.
- Validado contra sus propias reglas: `n_temporadas` cuadra con los años jugados 2013-2025 en las 76; ninguna tiene 2026 como jugada (22 la tienen como **prevista** 26/27, que no cuenta en veteranía); sin ids duplicados.
- `npm run check:personas` valida las identidades y las reglas sin escribir nada.

#### Reconciliación de identidades (04/08/2026)
- **55** personas coincidían de id exactamente entre Historia y estadísticas.
- **3 unificadas**, cada una confirmada por apellidos Y coincidencia de temporadas:
  | Antes | Después | Dónde se corrigió |
  |---|---|---|
  | `martinez-victor` | `martinez-martinez-victor` | `.md` del diccionario (21/22) + temporadas regeneradas |
  | `ballesteros-fuentes-robert` | `ballesteros-fuentes-roberto` | `data/historia_club.json` |
  | `mendez-escandon-fernando-antonio` | `mendez-escandon-fernando` | alias; el acta 25/26 trae el nombre legal completo |
- **21** personas sólo en la Historia, sin estadísticas: es lo esperado (el entrenador, los 3 `solo_mote` y quienes jugaron años sin actas o sólo en el MdA).
- **4** personas con estadísticas que **no aparecen en la matriz** — pendientes de revisión humana, ver cabos sueltos.
- La 25/26 era la única temporada sin `person_id` (venía del pipeline antiguo): estampado en sus 24 jugadores y 382 filas de boxscore, sin alterar ningún dato deportivo.

### Histórico completo: 10 temporadas 2013/14 → 2024/25 (rama `feat/historico-temporadas`)
- **11 temporadas en el dashboard** (13/14 → 25/26) con selector operativo. La 25/26 sigue siendo la temporada por defecto y **no ha cambiado**.
- Un `data/season_YYYY-YY.json` por temporada, con el **mismo esquema** que 25/26 (`season`, `label`, `partidos`, `players`, `box`, `qstats`) más claves nuevas donde el esquema no llegaba: `metrics`, `validacion`, `mda_resumen`.
- **Fuente:** los Excel de estadísticas de Carlos (`Estadisticas_YYYY_YYYY.xls` + los MdA `.xlsx` de 23/24 y 24/25). Están en `~/Downloads`, **no** en el repositorio.
- **Pipeline reproducible en Node** (`npm run build:datos`): `scripts/parse_diccionario.js` + `scripts/build_historico.js`.
- **Validación:** los 171 partidos con estadística individual disponible cuadran con el marcador del acta. Además, el total por jugador se contrasta con la columna TOTAL de la propia hoja: 0 discrepancias.
- **Nombres del MdA cerrados** (04/08/2026): el diccionario tiene tabla propia por ficha (`### 2023/24 (MdA)`), con clave `2023-24-MdA` en el JSON. Ningún mote queda sin catalogar en el MdA.
- Informe completo en `docs/INFORME_HISTORICO.md`.

| Temporada | Partidos | Balance | Jugadores | Minutos | MdA agregado |
|---|---|---|---|---|---|
| 2013/14 | 19 | 7-12 | 13 | no | — |
| 2014/15 | 20 | 10-10 | 12 | no | — |
| 2015/16 | 20 (3 sin stats) | 10-10 | 13 | no | — |
| 2017/18 | 21 | 11-10 | 18 | no | — |
| 2018/19 | 16 | 6-10 | 17 | no | — |
| 2019/20 | 16 | 8-8 | 12 | no | — |
| 2020/21 | 13 | 2-11 | 12 | no | — |
| 2021/22 | 18 (9 sin stats) | 12-6 | 14 | no | — |
| 2023/24 | 20 | 16-4 | 19 | **sí** | 18 jugadores (todos identificados) |
| 2024/25 | 20 | 17-3 | 17 | **sí** | 19 jugadores (todos identificados) |

> No hay estadísticas de 2016/17 ni de 2022/23: no existen en la fuente, no se han inventado.

### Dashboard de estadísticas 25/26 (v1, web estática)
- **Publicado y en vivo** en GitHub Pages: `https://eyeshar.github.io/MACCABIS/`
- Repositorio GitHub: `eyeshar/MACCABIS` (público).
- Arquitectura actual: web estática de un solo archivo (`index.html`) que carga datos por `fetch` desde `data/`. Estructura multitemporada ya preparada (selector de temporada, `data/index.json` + `data/season_2025-26.json`).
- **Esta v1 será migrada** al nuevo stack (Next.js+Supabase) como zona pública. La web estática fue el punto de partida; el proyecto real es la plataforma.

### Datos procesados y verificados de la temporada 25/26
- **42 actas PDF** de la FBM procesadas (MdA 22 partidos = 20 liga + 2 playoff; MdL 20 = 19 + 1 incomparecencia 0-0 sin stats).
- **41 hojas de estadística** oficiales (App Afición FBM) procesadas y **verificadas contra el marcador de cada acta** (la suma de puntos por jugador cuadra con el tanteo). MdA 20 hojas, MdL 19 (falta la del 0-0 por incomparecencia, que no genera hoja).
- **24 jugadores** reales consolidados (plantilla combinada MdA+MdL).
- Parciales por cuarto extraídos de las 42 actas y verificados (suma = marcador), 42/42 OK.
- Datos de asistencia (partidos y entrenamientos) de SportEasy vinculados por jugador.

### Contenido del dashboard v1 (pestañas)
Equipo (balance, racha, tabla de partidos con boxscore desplegable al clic) · Jugadores (ranking ordenable por columna) · Ficha de jugador (tarjetas, desglose de tiro, partido a partido con DNP) · Rankings (Top 5/10 de cada métrica) · Por cuartos (rendimiento del equipo por periodo) · Asistencia (partidos y entrenamientos) · Comparativa (radar jugador vs jugador, vs media, evolución — con Chart.js) · Gestión (zona privada con contraseña — SOLO placeholder, notas en localStorage; se reemplazará por la zona de gestión real con login).

## Cabos sueltos del histórico (pendientes de Iván, ninguno bloquea)

1. **Ignacio Mateos Aparicio ("Nacho S.", 23/24 y 24/25)** — incluido como jugador normal (107 y 87 puntos en MdL, 36 en el MdA de 23/24). La tabla MdA del diccionario confirma que **jugaba en las dos fichas**, pero sigue sin constar en las fichas de inscripción MdL disponibles. Queda pendiente localizar su ficha.
2. ~~**Diccionario de nombres del MdA**~~ — **RESUELTO (04/08/2026).** Iván cerró las tablas `### 2023/24 (MdA)` y `### 2024/25 (MdA)`. Los 18 motes de 23/24 y los 19 de 24/25 resuelven a persona real; **no queda ninguno sin catalogar**. Cada ficha tiene su propia tabla y no se usa una como respaldo de la otra, porque un mismo mote puede ser otra persona según el equipo (p.ej. "Santi" o "Jorge").
3. **Motes sueltos sin entrada en el diccionario** (tratados como "sin catalogar", sus puntos siguen contando en el equipo):
   - 14/15: `Paaco` y `Coach` — sin puntos, sólo aparecen en faltas/tiros libres. Probables erratas de `Paco` y de la etiqueta de entrenador.
   - 17/18: `Víctor` — **6 puntos**. La regla 4 del diccionario dice que "Víctor" = Víctor Martínez, pero la tabla de 17/18 no lo lista, así que no se ha aplicado.
4. ~~**Dos `person_id` para Víctor Martínez**~~ — **RESUELTO (04/08/2026).** Unificado a `martinez-martinez-victor` en el `.md` fuente y en las cuatro temporadas donde aparece (20/21, 21/22, 23/24, 24/25). El id retirado queda anotado en `alias_ids`.
5. **Tres celdas corruptas en el MdA 23/24** — valores decimales donde debería haber enteros (Jon/triples = 1,875; Edwin/TL = 1,875; J. Perchín/TL = 1,43). Se transcriben tal cual y salen marcadas con "?" en el dashboard.
6. **Dos jugadores con 2P no derivables en 20/21** (partido 10: Heriberto Gil 11 puntos y Alfredo David López 3, ambos sin triples ni tiros libres registrados). El dato de la fuente es incompleto; se deja ausente.
7. ~~**Cuatro personas con estadísticas que no están en la matriz**~~ — **RESUELTO (04/08/2026)**: añadidas a la matriz en los años que confirman las actas.
8. ~~**Seis nombres en hojas sin identificar**~~ — **RESUELTO (04/08/2026)**: los 5 confirmados por Iván se crearon como personas; ya no queda ningún nombre de hoja oficial sin identificar.
9. ~~**Cinco correspondencias dudosas en fichas**~~ — **RESUELTO (04/08/2026)**: dos eran erratas de nombre (corregidas) y las otras tres se confirmaron como alias.
10. ~~**Cinco hojas de "Torneos Municipales" sin aplicar**~~ — **RESUELTO (04/08/2026)**: Iván fijó la regla y las cinco están aplicadas.
11. **"Pupo" (2016/17) sigue sin identificar** — investigado el 04/08/2026 y **no resuelto a propósito**: su única traza es la fila del Excel de la Historia. No aparece en ninguno de los 17 Excel de estadísticas (2016/17 es la única temporada sin ellos) ni en ninguna hoja de inscripción. Los 20 nombres de la hoja de Torneos 2017 están todos identificados y cada uno tiene su propia fila en la matriz. **Falta la hoja de la liga de 2016/17 (37 JDM)**, que no está entre los PDF: es la vía con más recorrido para identificarlo.
12. **Adán Herrera Benzán jugó 3 partidos en 2017/18 sin constar en ninguna hoja de esa temporada** (sí en 2018/19, 2021/22 y 2022/23). O falta su hoja, o se inscribió fuera de plazo. Anomalía de la fuente.
13. **Las 4 hojas transcritas por visión conviene repasarlas** (2013/14 MdL, 2014/15 MdL y las dos de 2017/18): son escaneos sin capa de texto, leídos de la imagen. Están en `docs/fichas_transcritas.json`.
14. ~~**Cuatro personas con estadísticas que no están en la matriz de historia**~~ — Ignacio Ferrando del Rincón (23/24), Ramón Mora-Gil Jiménez (21/22 y 23/24), Javier Páez García (20/21) y Daniele Vallesi (21/22, 23/24, 24/25). **No se han fusionado con nadie**: había parecidos superficiales (otro Ramón, otro Javier, otro Ignacio) que son personas distintas. Falta decidir si se añaden a la matriz o si su ausencia es intencionada. `npm run check:personas` los avisa en cada ejecución.
15. **Partidos sin estadística individual**: 3 en 15/16 (5, 11 y 18) y 9 en 21/22 (10 al 18). El marcador sí consta; el boxscore no se ha fabricado y salen marcados como "sin stats".

## En curso / decidido pero no empezado

- **Migración al stack Next.js + Supabase + Vercel.** Arquitectura aprobada. No iniciada.
- ~~**Orden acordado:** (1) zona pública (estadísticas + histórico) primero; (2) histórico del club; (3) login + zona de gestión; (4) convocatorias (esperan a octubre, inicio de liga — lo menos urgente).~~
- **Orden vigente (25/09/2026, D32):** (1) calendario 26/27 con horas y carga en SportEasy; (2) actas y estadísticas automáticas; (3) convocatorias con doble ficha (estreno en la jornada 3, D34); después, la migración a Next.js y la zona de gestión.

## Reglas de negocio ya establecidas (de las estadísticas)

- Columnas siempre a cero se descartan (rebotes, asistencias, robos, pérdidas, tapones, faltas recibidas). La liga solo registra: puntos, tiros de 2, de 3, tiros libres, faltas cometidas (FC), valoración (VAL), +/−.
- Las medias se calculan SOLO sobre partidos con minutos jugados. Los DNP (0 minutos) cuentan como convocatoria/asistencia, pero NO entran en el denominador de las medias.
- Notación de las actas: canasta normal = 2 puntos; con círculo = triple (3); precedida de paréntesis = tiro libre (1). Formato "tanteo arrastrado".
- El entrenador **Carlos Barreiro** se excluye de las estadísticas de jugadores.
- Errata "DE CARVLHO" (acta partido 1 MdL) fusionada con "DE CARVALHO RODRIGUES, JULIO CESAR".
- Nombres display: completos y en formato Título (Nombre + Apellidos). Mapa de nombres coloquiales (SportEasy) → formales (FBM) confirmado: Nacho Mileo=Ignacio Mileo, Manu Cala=Calahorro, Edu=Martín-Ortega Eduardo.

## Datos importantes de fiabilidad

- Los puntos por jugador NO se extraen de las actas PDF (formato "tanteo arrastrado" no fiable a ojo ni por parsing). Se usan las **hojas de estadística XLSX** de la app, que sí son limpias y verificables.
- Los parciales por cuarto SÍ se extraen bien del pie de las actas ("Tanteos: Cuarto n A:x B:y").
