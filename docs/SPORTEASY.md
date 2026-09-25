# SPORTEASY — Conocimiento sobre la plataforma

> Todo lo que sabemos de SportEasy y cómo nos relacionamos con ella. Equivale a FEDERACION.md de TCPC.
> _Última actualización: 25/09/2026 (bloque "Cierre del sondeo y cimientos 26/27"): cláusula literal de acceso automatizado, Premium y prueba de exportación._

## Qué es para Maccabis

Plataforma de gestión de equipo que Maccabis usa y paga (suscripción de equipo). Es el **registro oficial**: calendario/eventos, asistencia (partidos y entrenamientos), plantel.

**Horizonte (D30, 25/09/2026):** se mantiene en 2026/27 (ya pagado) y se aprovecha al máximo; la plataforma se construye para **sustituirlo en 2027/28**. Primera función candidata: la confirmación de disponibilidad.

## Limitación estructural: la doble ficha

SportEasy **no permite dividir un equipo en dos**. Como Maccabis juega con dos fichas (MdA y MdL), Iván crea **dos campeonatos cada año**, uno por ficha. Esto complica la gestión: hay que duplicar eventos, convocatorias, etc. Es una de las fuentes principales de trabajo manual.

## API: NO hay API pública

- SportEasy tiene una API **interna** que alimenta sus propias apps, pero **no es pública** ("contáctanos si tienes un club y quieres probarla").
- No hay forma limpia y estable de que una plataforma externa lea en tiempo real los datos de SportEasy (p. ej. quién ha confirmado un evento).
- **Conclusión:** NO se puede construir un panel que se sincronice en vivo con SportEasy. Prometerlo sería engañar. _(Confirmado por el sondeo del 25/09/2026.)_

## Lo que SÍ se puede: exportación / importación por Excel

- **Exportar (bajar datos):** con suscripción Premium/Club, desde el plantel del equipo (siendo entrenador/admin) se exporta a Excel. La asistencia se exporta desde la página de balance dentro de Asistencias. (Iván ya usa esto — el Excel de asistencia 25/26 salió de aquí.) **No está documentado si ese Excel trae los eventos futuros ni el estado "sin respuesta"** (ver sondeo).
- **Importar (subir datos):**
  - **Calendario de liga/campeonato:** la sección "Campeonatos" permite crear el campeonato con todas las jornadas. ~~Si la liga JDM Moratalaz está en su base de datos, al vincular el equipo trae el calendario hecho.~~ **Corregido (25/09/2026):** la importación automática de calendario sólo cubre federaciones **francesas** (FFF, FFR, FFBB, FFVB); para el resto se crean las jornadas a mano. Iván lo comprueba igualmente antes de la carga (D31).
  - **Importación por Excel:** la de **miembros** **sí es autoservicio** para administradores de club (corregido el 25/09/2026). La de **calendario** por Excel sólo existe para datos de Footclubs (fútbol francés): no nos sirve.

## Estrategia acordada (ver DECISIONS D4, D5, D30, D31)

- La plataforma que construimos "bebe" de SportEasy vía **export Excel manual** (Iván exporta → sube a la plataforma → la plataforma hace el trabajo de cruce que hoy hace a mano).
- La plataforma **genera**: mensajes de WhatsApp listos para copiar/pegar. NO envía ni sincroniza sola.
- **Carga del calendario 26/27 — vía principal: la plantilla Excel que da el soporte de SportEasy** (D36). Code prepara la tabla limpia (`data/sporteasy_calendario_2026-27.csv`, rama `feat/calendario-automatico`) y se copian las columnas a su plantilla. **Plan B:** el agente supervisado de D31, **pendiente de que Iván lea la cláusula de abajo** y decida si lo mantiene.
- **Recordatorios a quien no ha contestado: los cubre SportEasy.** Iván tiene **Premium**, que incluye la relance automática y el recordatorio manual (silbato). **No los construimos** (D37).
- **Extracción automatizada (scraping o API interna): descartada** por las condiciones de uso (ver sondeo).

## Tareas relacionadas

- **Iván — prueba pendiente:** comprobar si **"Asistencias → Por eventos → exportar"** incluye **eventos futuros con sus respuestas** (por ejemplo, el amistoso del 27/09). Ver "Indicio del 25/09/2026" más abajo.
- **Iván:** pedir al soporte de SportEasy la **plantilla Excel de importación del calendario** (vía principal, D36).
- **Iván:** comprobar en "Campeonatos" si aparece la liga JDM Moratalaz (casi seguro que no).
- **Code:** preparar la tabla limpia del calendario 26/27 (fecha, hora, pista, rival, local/visitante, campeonato) cuando se publique.

## Sondeo de documentación pública (25/09/2026)

Sin iniciar sesión: sólo centro de ayuda (FR/ES/EN), condiciones de uso, página de precios y blog. Lo **verificado** lleva cita; lo **inferido** va marcado. Las citas se tomaron del resumen que devuelve la herramienta de lectura web, no de una descarga en bruto de cada página.

### Pregunta clave: ¿se pueden exportar las confirmaciones de eventos FUTUROS? — **No consta en la documentación pública**
- **Verificado:** la exportación a Excel de presencias/ausencias sale de la **página de balance** de la temporada: *"vous pouvez exporter les données de présences/absences de vos membres depuis la page de bilan"*; *"Fonctionnalité disponible en abonnement PREMIUM ou CLUB"* [1][2]. El balance cubre *"toute la saison"* [2], sin decir si incluye eventos futuros ni el estado "sin respuesta".
- **Verificado:** hay una tabla de presencias evento a evento (Premium/Club) [3], cuyo ejemplo muestra *"les 10 derniers matchs"*; el artículo **no menciona exportación**. La página de precios lista *"Players availability event by event"* en Premium [4].
- **Verificado:** los estados de respuesta son *"en attente"*, *"présents par défaut"*, *"absents par défaut"*, y las respuestas *"Présent ou Absent"* [5]. No se documenta ningún export ni resumen por email de las respuestas.
- **iCal no sirve para esto** (ver abajo): no trae el estado de respuesta del equipo.
- **Inferido:** el export está pensado para estadística de asistencia. Si trae o no los eventos futuros y el estado "en espera" **sólo se puede saber probándolo dentro de la app**.
- **Prueba que tiene que hacer Iván (cuenta Premium):** (1) con algún evento futuro creado y con respuestas, exportar el Excel desde la página de balance de Asistencias; (2) mirar si aparecen columnas de eventos futuros y un valor "en espera / sin respuesta"; (3) ver si la tabla evento a evento muestra eventos futuros y tiene icono de exportación; (4) probar filtros por fecha o tipo de evento.
- **De esta prueba depende el lunes del flujo semanal:** si el Excel trae el futuro, el flujo empieza con "Iván exporta y sube un Excel"; si no, la disponibilidad habrá que copiarla a mano de la pantalla o recogerla fuera de SportEasy, lo que refuerza que sea la primera función a sustituir (D30).

### Condiciones de uso (versión del 18/09/2025) [6][7]
- 2.4: *"Toute demande d'inscription générée automatiquement par un robot, ou par toute autre méthode, sera refusée."*
- 11.2: el usuario no debe *"sell, resell, or exploit in any way and for any purpose whatsoever all or part of the content available on the Platform"*.
- 11.7, prohibido: *"de créer des fichiers d'archives à partir des contenus figurant sur la Plateforme"* y reproducir, usar o referenciar todo o parte del contenido.
- 17.1: contenidos, *"data, databases, software"* protegidos, incluido el derecho del productor de bases de datos.
- 9.2: pueden cerrar la cuenta *"without notice or compensation"* por incumplir las condiciones o por *"actions contrary to SportEasy's commercial interests"*.
- **No hay** ninguna cláusula que nombre expresamente scraping, crawlers, ingeniería inversa ni la API interna.
- **Inferido:** una **extracción automatizada** (scraping, API interna) chocaría con 11.7 y 17.1, con riesgo de cierre de cuenta (9.2). **Descartada.** La carga supervisada del calendario (D31) es distinta: introduce datos del propio club, una sola vez, desde la sesión de Iván y a ritmo humano; no extrae ni archiva contenido. Es la única automatización prevista sobre SportEasy.

### Calendarios (iCal / Google / Outlook) [8][9]
- **Verificado:** sincronización **de un solo sentido** por URL de suscripción (*"Copier le lien"*) o acceso directo a Google, iOS u Outlook: *"SportEasy est la source et les agendas personnels sont en lecture seule."* Apple casi al instante; Google y Outlook, de unas horas a 12 h.
- **Verificado:** para jugadores, *"Seuls les événements futurs auxquels vous avez répondu présent sont synchronisés"*. Entrenadores y administradores reciben todos los eventos futuros.
- **Conclusión:** el feed del entrenador trae los eventos pero **no** el estado de respuesta del equipo. No sirve para obtener disponibilidad.

### Importación y Campeonatos
- **Verificado:** importación de **miembros** por Excel (.csv/.xls/.xlsx) en autoservicio para administradores de club; nombre y apellido obligatorios [1].
- **Verificado:** la importación de **calendario** por Excel funciona *"seulement pour les données provenant de Footclubs"* [1].
- **Verificado:** Campeonatos → *"Créer un championnat"*. La importación automática del calendario sólo cubre federaciones francesas: *"Copiez collez les données issues du calendrier remis par votre fédération"* [10]. La versión española del artículo es igual y **no nombra ninguna federación española** [11]. *"ce module de championnat ne permet pas encore de partager le classement"* [10].
- **Inferido:** es muy improbable que la liga JDM Moratalaz esté en su base.

### API e integraciones
- **Verificado:** blog de 2017: la API sirve *"à diffuser les données de SportEasy depuis nos serveurs vers les applications mobiles"*; *"Contactez-nous si vous avez un club et que vous voulez tester !"* [12]. `api2.sporteasy.net` es una página de equipo llamada "api", no documentación [13].
- **No encontrado:** documentación de API pública actual, webhooks ni conector de Zapier. Cualquier acceso pasa por soporte [14].

### Recordatorios automáticos — sí, de serie (Premium)
- **Verificado:** *"Lorsque vous créez un événement, l'option Relance automatique est activée par défaut."* Se envía *"à mi-chemin entre l'envoi de l'inscription et le début de l'événement"*. Hay también recordatorio manual en cualquier momento a quien no ha contestado (icono del silbato) [5]. En precios, "automatic reminders" figura sólo en Premium [4].

### Dividir el equipo en dos
- **Verificado:** en cada evento se puede convocar a un subgrupo, a mano o por criterios (*"rôle dans l'équipe… poste, le niveau, la date de naissance ou le statut de cotisation"*), que se combinan con Y [15]. *"Après l'ouverture, ces paramètres sont figés : seul un ajout manuel reste possible."* Un equipo puede tener varios campeonatos [10].
- **Inferido:** no hay grupos guardados. Con 22 de 24 jugadores en las dos fichas, marcar la ficha en un campo de miembro no ayuda mucho: los dos campeonatos siguen siendo la solución.

### Fuentes
1. https://sporteasy.zendesk.com/hc/fr/articles/115005437369
2. https://sporteasy.zendesk.com/hc/fr/articles/205421592
3. https://sporteasy.zendesk.com/hc/fr/articles/205421572
4. https://www.sporteasy.net/en/teams/team-offers/
5. https://sporteasy.zendesk.com/hc/fr/articles/205420662
6. https://www.sporteasy.net/en/terms-of-use/
7. https://www.sporteasy.net/fr/terms-of-use/
8. https://sporteasy.zendesk.com/hc/fr/articles/13673096392092
9. https://sporteasy.zendesk.com/hc/fr/articles/15221682637724
10. https://sporteasy.zendesk.com/hc/fr/articles/205418692
11. https://sporteasy.zendesk.com/hc/es/articles/205418692
12. https://www.sporteasy.net/fr/blog/sporteasy/mise-a-jour-site-12-juin-2017/
13. https://api2.sporteasy.net/
14. https://sporteasy.zendesk.com/hc/en-gb/requests/new
15. https://www.sporteasy.net/fr/blog/lappli/choisissez-exactement-qui-est-convoque-a-chaque-evenement-sur-sporteasy/

## Cláusula sobre acceso automatizado — texto literal (25/09/2026)

Condiciones de uso de SportEasy, versión en vigor desde el **18/09/2025**: https://www.sporteasy.net/en/terms-of-use/ (la versión francesa, original: https://www.sporteasy.net/fr/terms-of-use/). Texto copiado de la versión inglesa.

**No hay ninguna cláusula que hable de scraping, de bots que naveguen, de scripts ni de acceso automatizado a la plataforma en general.** La única que nombra a los robots es sobre el **registro de cuentas**:

> **2.4.** "Any registration request generated automatically by a robot, or by any other method, will be refused."

Las que más se acercan a un agente que maneja la web son las de uso del contenido y la de cierre de cuenta:

> **11.2.** "The User must not in any way sell, resell, or exploit in any way and for any purpose whatsoever all or part of the content available on the Platform."

> **11.7.** "The User shall also refrain, without SportEasy's prior written authorization and without limitation, from the following:
> - using the Platform for promotional purposes and in general to offer products and services remunerating it directly or indirectly;
> - creating archive files from the content shown on the Platform;
> - reproducing, representing, using, referencing (particularly in search engine metawords), all or part of the content, brands, logos, and distinctive signs appearing on the Platform."

> **17.2.** "Any copy, reproduction, representation, adaptation, alteration, modification, unauthorized dissemination, in whole or in part, of the services and/or the content of the Platform, whether it concerns the content belonging to SportEasy, a User, an Organization or a third party, is unlawful and may incur the criminal and civil liability of the offender."

> **9.2.** "Without prejudice to any damages that SportEasy may request, SportEasy reserves the right to close, without notice or compensation, temporarily or permanently, a User's account in the event, in particular, of:
> - a breach of these ToU;
> - providing false information at the time of registration;
> - actions contrary to SportEasy's commercial interests."

**Lectura (para que Iván decida):** un agente que **introduce** los partidos del propio club, una vez, desde la sesión de Iván y a ritmo humano, no vende, no archiva ni reproduce contenido de SportEasy: no choca con la letra de 11.2, 11.7 ni 17.2. El riesgo que queda es 9.2 ("actions contrary to SportEasy's commercial interests"), que es discrecional. Con la plantilla del soporte ese riesgo desaparece; por eso es la vía principal. _(La numeración cambió respecto al sondeo anterior: la cláusula de robots aparece ahora como 2.4.)_

## Indicio del 25/09/2026 sobre eventos futuros en el export

En Descargas hay un export de hoy, `bilan_presence_maccabis (10).xlsx` (hojas de julio, agosto y septiembre de 2026). **El último evento que trae es del 23/09/2026** (un entrenamiento): no aparece ningún evento posterior al día del export. Si el amistoso del 27/09 ya estaba creado y con respuestas al descargarlo, esto indica que **el export del balance no incluye eventos futuros**. Falta que Iván lo confirme y pruebe la exportación "Por eventos". De ello depende la decisión pendiente del BACKLOG sobre sustituir ya la confirmación de disponibilidad.

Formato del export (útil para el pipeline): una hoja por mes; fila 1 = fechas, fila 2 = tipo de evento ("Entrenamiento", "Partido amistoso", "Torneo", "Partido entre nosotros"…), después una fila por miembro con "A tiempo", "Con excusa", "Sin excusa", "No convocado" o "Lesionado", y los totales al final. El pipeline de estadísticas (rama `feat/pipeline-estadisticas`) ya lo lee.
