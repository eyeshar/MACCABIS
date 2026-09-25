# Sondeo: actas, estadísticas y calendario automáticos — Fase 0

_25/09/2026. Sólo investigación: no se ha montado nada, no se ha iniciado sesión en ningún sitio y no se ha descargado ningún acta ni ninguna hoja de estadística de internet (~30 peticiones web en total, respetando robots.txt)._

**Pregunta:** ¿podemos descargar automáticamente, tras cada partido, el acta y la hoja de estadística de nuestros partidos sin que Iván intervenga? ¿Y el calendario con fechas, **horas** y pistas?

## Veredicto

| Recurso | Veredicto | Por qué, en una línea |
|---|---|---|
| **Actas PDF** | **No viable** de forma automática y legítima | Sólo existen en la app Afición FBM (Indalweb). `fbm.es/robots.txt` prohíbe todos los bots, los avisos legales prohíben reproducir el contenido y no hay URL ni API pública. |
| **Hojas de estadística XLSX** | **No viable** | Mismos motivos. Los datos abiertos del Ayuntamiento no traen estadística individual. |
| **Calendario (fecha, hora, pista) y marcadores** | **Viable sin login**, con salvedades | CSV CC BY 4.0 del dataset 211549 de datos.madrid.es, actualizado cada semana, con `Fecha`, `Hora` y `Campo`. La 2026/27 **aún no está publicada**. |

**Recomendación:** automatizar **sólo el calendario y los marcadores** desde datos abiertos. Las actas y las estadísticas siguen siendo una descarga manual de Iván desde la app, pero **reducida a un solo gesto**: dejar los ficheros en un sitio fijo, y que el pipeline haga el resto (ver "Qué se puede automatizar de verdad"). En paralelo, si compensa, **pedir permiso por escrito a la FBM**: es la única vía para automatizar las actas sin romper sus condiciones.

"Viable con login" no es una opción real: habría que guardar las credenciales de Iván como secreto de un repositorio público y automatizar una app cuyas condiciones prohíben reproducir su contenido. Queda descartado.

## 1. De dónde salieron las actas y estadísticas de 2025/26 (reconstrucción desde el repositorio)

### Actas PDF — plataforma de acta digital de Indalweb, instancia "JDM Madrid"
- **Nombre de fichero:** `Acta-Partido-<nº de partido>.pdf` (nombre que pone la propia plataforma al descargar). En `~/Downloads` están las **42 de 2025/26**: `Acta-Partido-329690.pdf` … `Acta-Partido-330077.pdf` más `371648` y `371650` (playoff), casi todas bajadas el 31/07/2026; la `329955` es del 02/02/2026. También hay 23 de 2022/23 (`1526xx–1527xx`, bajadas en mayo de 2023), de antes del cambio de plataforma.
- **Metadatos del PDF** (`Acta-Partido-329955.pdf`): `Title: Acta Digital`, `Author: Acta Digital Gestión Deportiva`, `Subject: Acta digital generada con gestion deportiva de Indalweb`, `Keywords: Acta, Digital, Gestión, Deportiva, Indalweb`, `Producer: Select.Pdf for .NET`, creado el 12/10/2025 10:08 (al acabar el partido). Protegido con cifrado estándar (sólo permisos, se lee sin contraseña).
- **Cabecera del acta:** `JDM Madrid` · `Competición: Competiciones JDM,SenMas JDM` · `Fecha: 12/10/2025 Hora: 09:00` · `Partido nº: 329955` · `Localidad: MORATALAZ P3` · árbitro · equipos A/B · tanteo final · "TANTEO ARRASTRADO" · plantillas con licencia, dorsal y apellido abreviado (`MILEO, I.A.`) · pie `Tanteos: Cuarto n A:x B:y`.
- **Coincide con lo que procesamos:** el nº de partido es el `num` de `data/season_2025-26.json` (329955 MdA vs Litros de Mahou 72-33; 329690 MdL vs Fakin Panzas 65-38), y los parciales por cuarto (`q_us`/`q_them`) salen del pie del acta. **El acta trae también la hora y la pista**, que no guardamos en `season_2025-26.json`.
- El acta **no** es buena fuente de puntos por jugador (tanteo arrastrado, ver ESTADO): para eso están las XLSX.

### Hojas de estadística XLSX — app "Afición FBM"
- **Nombre de fichero:** `estadisticaPartido_<nº de jornada>_<mda|mdl>.xlsx`, con `PO` delante de la jornada en el playoff (`estadisticaPartido_PO1_mda.xlsx`). Es el patrón que espera `scripts/parse_stats.py`. En `~/Downloads` sólo queda una (`estadisticaPartido_21_mda.xlsx`): las 41 se subieron al chat de Claude para procesarlas.
- **Metadatos:** `Author: Ivan Villaescusa Silva`, `Application: Excel Android`. Es decir: **Iván las descargaba en el móvil desde la app y las guardaba con Excel de Android**; el sufijo de jornada y equipo lo pone él (o se renombra al guardar).
- **Contenido:** hoja `Estadísticas-`; cabecera `FEDERACIÓN DE BALONCESTO DE MADRID` · `Estadísticas - MDA vs GUERREROS MASTER - SenMas JDM - Competiciones JDM - FBM - 25/26`; un bloque por equipo con `Num., Nombre, MIN, PTS, 2P A/I, %, 3P A/I, %, TL A/I, %, DEF, OF, Tot., AST, REC, PER, TC, TR, FC, FR, VAL, +/-`. Nombres completos en formato `APELLIDOS, NOMBRE` (los mismos que la hoja de inscripción, lo que facilita casar identidades).
- **No lleva el nº de partido** dentro: se relaciona con el acta por jornada + equipo + rival.

### El pipeline de 2025/26 no es reproducible hoy desde el repositorio
- `scripts/parse_stats.py` lee de `/mnt/user-data/uploads` (el entorno del chat de Claude, no el PC de Iván) y escribe `stats_raw.json`; `scripts/consolidate.py` consume ese fichero. **Falta** el paso de las actas (parciales por cuarto con `pdfplumber`) y el de la asistencia de SportEasy.
- `scripts/generar_temporada.py` es **un esqueleto**: sólo imprime "Ver README.md". El README describe el flujo manual, no un script.
- **Consecuencia:** antes de automatizar nada hay que convertir ese pipeline en un script local de verdad (`generar_temporada`), probado contra las 42 actas y 41 hojas de 2025/26 para que reproduzca exactamente `season_2025-26.json`. Es el primer trabajo del bloque de actas, con o sin descarga automática.

## 2. Cómo publica cada organismo (investigación web sin login)

**Verificado:**
- **FBM + Gesdeportiva (Indalweb):** desde 2025/26 la FBM usa el acta digital de Indalweb y en las JDM pone árbitros, auxiliares de mesa y acta digital (antes SWISH). Noticia: gesdeportiva.es/es/noticia-7611 (HTTP 200). Se consultan en la app **Afición FBM** (App Store id1460651614, desarrollador Indalweb Internet S.L.; registro opcional, plan premium sin anuncios 0,99 €/mes).
- **Web del Ayuntamiento** ("Competiciones deportivas municipales 2026-2027" en madrid.es): sólo inscripciones, bases, FAQ y oficinas. Sin resultados, actas ni estadísticas.
- **Datos abiertos, dataset 211549** ("temporada en curso"), https://datos.madrid.es/dataset/211549-0-juegos-deportivos-actual: actualización **semanal**, última el 11/09/2026, CC BY 4.0. Hoy sólo publica los PDF de estructura; aviso literal: *"La información de la próxima temporada 2026/2027 47.º JDM, estará disponible en la web municipal"*.
- **Campos del CSV de partidos** (verificados en nuestro sondeo del 300257, `docs/SONDEO_JDM_FASE0.md`): `Codigo_equipo1/2`, `Resultado1/2`, `Codigo_campo`, `Fecha`, **`Hora`**, **`Campo`** (p. ej. "Baloncesto 2 Moratalaz"), coordenadas, `Estado`, jornada y grupo. Sin actas ni estadística individual. Ojo: `Campo` venía vacío en temporadas antiguas.
- **jdmmadrid.es y munimad.es** (no oficiales) se alimentan de esos datos abiertos; ninguna ofrece actas.
- **URL por partido (329955 / 329690):** buscar los números no da ningún resultado público. No se probaron URLs de fbm.es porque su robots.txt lo prohíbe. La web de Gesdeportiva no tiene páginas públicas de partidos (su robots.txt sólo permite `/es/`, `/en/` e `/index.aspx`). No hay API JSON documentada ni visible para Afición FBM.

**Inferido:** los PDF y XLSX sólo se obtienen desde la app o desde enlaces que genera. Podría haber URLs directas sin login, pero encontrarlas exigiría ingeniería inversa de la app (fuera de las reglas del sondeo) y usarlas iría contra sus condiciones.

## 3. robots.txt y condiciones de uso

- **https://www.fbm.es/robots.txt:** `User-agent: *` → `Disallow: /` (sólo permite bingbot, googlebot y duckduckgo). **Cualquier descarga automática de fbm.es va contra su robots.txt.**
- **Aviso legal FBM** (fbm.es/aviso-legal): prohíbe la *"reproducción, distribución… y cualquier otra forma de explotación"* de sus contenidos.
- **Aviso legal de la app Afición FBM** (gesdeportiva.es/avisos-legales-app-aficion/fbm/aviso-legal-fbm.html): contenidos de *"titularidad exclusiva"*, sin reproducción sin autorización.
- **https://datos.madrid.es/robots.txt:** para `*` prohíbe `/api/`, `/dataset/*/resource/*/download/*`, `/resource/*` y `/*?`, con `Crawl-delay: 10`. **Contradicción:** la licencia CC BY 4.0 (Ley 37/2007 de reutilización) invita a reutilizar, pero la ruta de descarga real a la que redirigen los enlaces `/egob/catalogo/…csv` está vetada a bots. La ruta `/egob/` no está vetada. **Inferido:** la regla apunta a rastreadores masivos, no a una descarga semanal de un fichero con licencia abierta; aun así es interpretación, y lo limpio es preguntar al portal (tienen FAQ y contacto de reutilización).
- **madrid.es:** con curl devolvió **403 de Akamai** (con el lector web sí se pudo leer).

## 4. Calendario con horas (imprescindible para la regla de doblaje, D33)

- **Sí se publica con hora y pista**, en el CSV del 211549, en cuanto el Ayuntamiento cargue la 2026/27. Según madrid.es, la competición sénior empieza el **17/10/2026**; es de esperar que el CSV aparezca antes o esa semana. No hay iCal ni JSON.
- **El acta también trae hora y pista**, así que para partidos ya jugados hay doble fuente.
- **Plan B si el CSV llega tarde:** el calendario que el Ayuntamiento/FBM comunique a los delegados (PDF o correo) se transcribe a la tabla limpia de D31. La tabla limpia es la misma en los dos casos; sólo cambia de dónde sale.
- **Aviso para nuestro script:** `https://datos.madrid.es/egob/catalogo/300257-38-deportes-colectivos-historico.csv` ahora responde **302** a `…/dataset/300257-0-…/resource/300257-14-…/download/…`: la numeración de recursos ha cambiado. `scripts/build_rivales_2026_27.py` usa el patrón antiguo `300257-{n}` y **hay que revisarlo** antes de refrescar los rivales (no se ha comprobado a qué temporada corresponde el recurso 14).

## 5. Tarea programada gratuita (GitHub Actions) — evaluación, sin montarla

**Qué podría hacer cada lunes (cron del domingo noche/lunes):**
1. Descargar el CSV del 211549 (una petición, sin login, sin secretos).
2. Filtrar baloncesto sénior masculino de nuestros dos grupos → calendario con fecha, hora y pista + marcadores de la jornada.
3. Actualizar `data/season_2026-27.json` (partidos y resultados) y los rivales; commit a `main`; GitHub Pages se redespliega solo.

**Coste:** cero (Actions es gratis en repositorios públicos).

**Riesgos:**
- El robots.txt de datos.madrid.es veta la ruta de descarga para bots (ver 3). Mitigación: preguntar al portal, o que la Action no corra sola y la lance Iván con un botón (`workflow_dispatch`), que es una descarga iniciada por persona.
- El WAF (Akamai) del Ayuntamiento podría bloquear IPs de centros de datos como las de GitHub (madrid.es dio 403 a curl; datos.madrid.es no). Sólo se sabrá probando.
- La numeración de recursos cambia (ya pasó con el 300257): el script tiene que localizar el CSV desde la página del dataset, no con una URL fija.
- La actualización es **semanal**: un resultado del domingo puede tardar días en aparecer. No sirve para un "domingo noche" inmediato.
- **No trae boxscore:** la Action actualizaría marcadores y calendario, nunca las estadísticas de jugadores.

**Actas y estadísticas en la Action:** no. Ver veredicto.

## Qué se puede automatizar de verdad (propuesta para el bloque de actas)

1. **Script local reproducible** (`generar_temporada`) que, dada una carpeta con `Acta-Partido-*.pdf` y `estadisticaPartido_*.xlsx`, genere `season_2026-27.json` con las mismas verificaciones de 25/26 (suma de puntos = marcador del acta, parciales = marcador) y además guarde **hora y pista** del acta. Probado primero contra 2025/26.
2. **Un solo gesto para Iván tras cada jornada:** descargar las 2 actas y las 2 hojas desde la app en el móvil y dejarlas en una carpeta fija (p. ej. una carpeta sincronizada o subiéndolas a una ruta del repositorio no publicada). Si se suben a GitHub, una Action lanza el script, verifica y publica. **Cuidado:** las actas llevan nombres, licencias y dorsales de jugadores rivales y árbitros; no deben quedar en un repositorio público. Las XLSX sólo con nuestro bloque, o procesadas en local.
3. **Calendario y marcadores** desde el 211549 (semanal o con botón), que además sirve de control cruzado del marcador del acta.
4. **Opcional:** escribir a la FBM (o a Gesdeportiva) pidiendo permiso o un acceso tipo feed para los partidos del club. Si lo dan, el paso 2 se automatiza entero.

## 6. Sondeo complementario: ¿datos abiertos POR JUGADOR? (25/09/2026)

**Pregunta:** ¿algún dataset del portal de datos abiertos del Ayuntamiento sobre los Juegos Deportivos Municipales trae datos por jugador de baloncesto (anotadores, puntos individuales)? Sería la vía 100 % automática y legal para las estadísticas individuales.

**Método:** sólo rutas que el `robots.txt` permite (el `sitemap.xml`, la página de cada dataset y sus metadatos `.rdf`), con 10 s entre peticiones, y un buscador web. No se ha descargado ningún fichero de datos para esto: la ruta de descarga está vetada a bots.

**Datasets de deporte que existen** (sitemap, 25/09/2026): 211549 (competiciones colectivas, temporada en curso), 300257 (ídem, temporadas anteriores), **300043 (inscripción de participantes en JDM colectivos e individuales, temporada en curso)** y 300534 (su histórico), escuelas de promoción deportiva (300042, 300258), carreras urbanas (300261, 300302, 300305), instalaciones, tarifas, ocupación, encuestas y listas de espera. Otros cuatro (208734, 208743, 217479, 300085) respondían "En mantenimiento".

| Dataset | ¿Datos por jugador? | Qué trae | Cobertura | Actualización | Licencia |
|---|---|---|---|---|---|
| **211549** / **300257** | **No** | Partidos (fecha, hora, pista, equipos, resultado, estado, jornada, grupo) y clasificaciones | Todos los distritos, **incluido JDM Moratalaz sénior** (2014/15 → 2025/26; la 26/27 aún no está) | 211549 semanal en teoría (la última es del 11/09 y sigue siendo la 25/26); 300257 anual | CC BY 4.0 |
| **300043** (+ 300534) | **No, en lo que se puede ver** | "Participantes inscritos en juegos colectivos" y "…individuales" (CSV `deportes_colectivos_AAAAMMDD.csv`) | Toda la ciudad | Mensual (última: 02/09/2026) | CC BY 4.0 |

- **Ninguno trae anotadores, puntos individuales ni estadística por jugador.** 211549 y 300257 sólo recogen partidos y clasificaciones (su estructura ya se revisó en `SONDEO_JDM_FASE0.md`).
- **300043 es de inscripciones**, no de competición: aunque tuviera una fila por persona, no llevaría puntos. Su documento de estructura está en la ruta de descarga vetada a bots y **no se ha abierto**; por la escala (~120.000 participantes) y la protección de datos, lo esperable son recuentos por deporte, categoría y distrito. Si algún día interesa, Iván puede abrirlo en el navegador.
- **Webs no oficiales** (jdmmadrid.es, munimad.es) se alimentan de estos mismos datos abiertos: tampoco tienen estadística individual.

**Conclusión y recomendación:** la vía 100 % automática y legal **no existe hoy** para las estadísticas individuales. Lo que sí es automático y legal (calendario, horas, pistas y marcadores) queda preparado en la rama `feat/calendario-automatico`. Para los puntos por jugador se mantiene la **descarga manual de Iván en un solo gesto** (actas y hojas desde la app, sin renombrar) y el pipeline hace el resto (`npm run jornada`, rama `feat/pipeline-estadisticas`). **No se pide permiso a la FBM** (D35). Alternativa legal y autónoma que queda abierta: sugerir al Ayuntamiento, por su buzón de datos abiertos, que publique los anotadores de las actas digitales. Es una sugerencia ciudadana, no una dependencia.

## 7. Novedades del portal detectadas el 25/09/2026

- **El 300257 migró a CKAN y renumeró todos sus recursos**, y ya incluye la **2025/26** (recursos 42-45). `scripts/build_rivales_2026_27.py` tiene la tabla nueva (`PORTAL_300257`) y regenera exactamente lo mismo: los tamaños de los 20 ficheros coinciden con los que declara el portal, y uno descargado de la URL nueva tiene el mismo MD5 que la copia local.
- **El 211549 sigue con la 2025/26** (`partidos_20260629.csv`, modificado el 11/09/2026). El nombre del CSV cambia en cada actualización: hay que leerlo de los metadatos.
- **El robots.txt de datos.madrid.es** permite páginas y metadatos (`.rdf`) y veta a bots `/api/`, `/dataset/*/resource/*` (las descargas) y cualquier URL con `?`, con `Crawl-delay: 10`. Por eso el workflow del calendario sólo mira metadatos de forma programada, y la descarga va con botón (`docs/CALENDARIO.md`, en su rama).

## Qué tiene que confirmar Iván
- ¿Acepta el "un solo gesto" semanal (descargar 4 ficheros desde la app) como solución para actas y estadísticas?
- ¿Dónde prefiere dejar los ficheros (carpeta local / Drive / subida a GitHub)?
- ~~¿Escribimos a la FBM y/o al portal de datos abiertos pidiendo permiso?~~ **Decidido (25/09/2026, D35): no se pide permiso a la FBM por ahora.** Descarga manual de Iván con un solo gesto.
- La Action de datos abiertos: ¿automática cada lunes, o con botón?

## Fuentes
- Gesdeportiva, acta digital FBM 2025/26: https://www.gesdeportiva.es/es/noticia-7611/la-federacion-de-baloncesto-de-madrid-usara-nuestra-acta-digital-a-partir-de-la-proxima-temporada-20252f2026
- Afición FBM en App Store: https://apps.apple.com/es/app/afici%C3%B3n-fbm/id1460651614
- Aviso legal de la app: https://www.gesdeportiva.es/avisos-legales-app-aficion/fbm/aviso-legal-fbm.html
- Aviso legal FBM: https://fbm.es/aviso-legal · robots: https://www.fbm.es/robots.txt
- FBM y JDM (árbitros y acta digital): https://www.fbm.es/noticias-125/En-Juego/Juegos-Deportivos-Municipales
- Dataset 211549: https://datos.madrid.es/dataset/211549-0-juegos-deportivos-actual · robots: https://datos.madrid.es/robots.txt
- FAQ de reutilización: https://datos.madrid.es/pages/preguntas-frecuentes-sobre-reutilizacion
- madrid.es, Competiciones deportivas municipales 2026-2027 (portal munimadrid, Cultura-ocio-y-deporte › Deporte)
- Metadatos locales: `~/Downloads/Acta-Partido-329955.pdf`, `~/Downloads/estadisticaPartido_21_mda.xlsx` (no versionados)
