# Sondeo: calendario, horarios y cambios de los JDM en las webs del Ayuntamiento

_25/09/2026. Sólo investigación: no se ha montado nada, no se ha iniciado sesión en ningún sitio y no se ha descargado ningún fichero de datos. Unas 25 peticiones web, casi todas con el lector web; a datos.madrid.es sólo se consultó la página del dataset (permitida por su robots.txt)._

**Pregunta:** ¿dónde y cómo publica el Ayuntamiento el calendario de JDM Moratalaz sénior masculino de baloncesto (y sus cambios de fecha, hora y pista), y se puede montar una revisión automática los jueves que proponga los cambios a los gestores?

Leyenda: **[V]** = verificado hoy en la fuente · **[I]** = inferido (razonable, pero no comprobado).

## Veredicto

| Pregunta | Respuesta corta |
|---|---|
| ¿Dónde está el calendario oficial? | En **Deportes/web** (deportesweb.madrid.es) y en la **app Madrid Móvil**. Lo dicen las Bases del 47 JDM. **[V]** |
| ¿Cuándo es oficial? | **Jueves a las 20:00** previo a cada jornada. Las sanciones, también los jueves. **[V]** |
| ¿Hace falta login? | Para las **sanciones, sí** (lo dicen las Bases). Para calendario y resultados, **casi seguro** (la web municipal enlaza directamente a la pantalla de login). **[V]** sanciones / **[I]** calendario |
| ¿Formato? | Aplicación web (pantallas tras login), sin CSV, PDF ni iCal públicos. **[V]** |
| ¿Es más fresca que el dataset 211549? | **Sí, mucho.** Deportes/web es la fuente oficial al momento; el 211549 se actualiza los miércoles y a 25/09 sigue con la 2025/26. **[V]** |
| ¿Aparece ya la 2026/27 y nuestros grupos? | En la web pública de madrid.es, **no**. Dentro de Deportes/web **no se ha podido mirar** (hace falta login). **[V]** / pendiente |
| ¿Se puede leer Deportes/web con un robot? | **No es recomendable**: exige usuario y contraseña de una persona, y las condiciones que se aceptan al darse de alta no se han podido leer. |
| **Recomendación** | Revisión de los jueves **semiautomática**: un gestor mira la app a partir de las 20:00 y pega o fotografía la programación; la plataforma la compara con el calendario guardado y propone los cambios con Aceptar/Ignorar. El dataset 211549 queda como **segunda fuente automática** que detecta cambios en jornadas posteriores. |

## 1. Qué hay y dónde

### Página municipal "Competiciones deportivas municipales 2026/2027" (madrid.es) **[V]**
URL: `https://www.madrid.es/portales/munimadrid/es/Inicio/Cultura-ocio-y-deporte/Deporte/Competiciones-deportivas-municipales-2026-2027/?vgnextfmt=default&vgnextoid=1ccee074c856f910VgnVCM200000f921e388RCRD&vgnextchannel=c7a8efff228fe410VgnVCM2000000c205a0aRCRD`

Apartados: Portada · Bases reguladoras 47 JDM · Inscripciones (sede.madrid.es) · Preguntas frecuentes · Oficinas de Promoción Deportiva · **Aplazamientos e incidencias** (enlace a un trámite de sede.madrid.es, que dio 403 al lector) · "Para la violencia no hay entradas".

**No publica calendarios, horarios, resultados, clasificaciones ni sanciones.** Sólo informa y remite a Deportes/web y Madrid Móvil. (En temporadas antiguas hubo un apartado "Consulta de encuentros y clasificaciones"; hoy da 404.)

### Bases reguladoras del 47 JDM (PDF en madrid.es) **[V]**
`https://www.madrid.es/UnidadesDescentralizadas/Deportes/EspecialInformativo/47JDM/ficheros/BasesReguladoras47JDM_1Sp.pdf` (y las de deportes de equipo: `.../47JDM/normativas/BasesDeportesEquipo47jdm_1Sp.pdf`). Citas literales:

- **4.2 Programación:** *"En deportes colectivos, los calendarios podrán consultarse en el Deportes/web y en la aplicación Madrid Móvil, siendo oficial la programación de encuentros a las 20 horas del jueves previo a cada jornada. Es responsabilidad de las personas delegadas de los equipos conocer los posibles cambios en la programación a través de estos medios."*
- **Encuentros suspendidos:** *"serán confirmados los jueves de cada semana, a partir de las 20 horas, a través de la aplicación Madrid Móvil y Deportes/web."*
- **Sanciones:** *"Los fallos emitidos por los Comités de Disciplina Deportiva y de Competición deberán ser consultados a través de la aplicación Madrid Móvil o del portal Deportes/web, previa identificación del usuario. Una vez autenticado, deberá acceder a la sección "Juegos Deportivos Municipales-Equipos", seleccionar el equipo correspondiente y hacer clic en "más opciones" y posteriormente en "sanciones"."* y *"La información relativa a disciplina deportiva será oficial los jueves de la semana en que se han celebrado los encuentros a que se refiera."*
- **5.9 Aplazamientos:** los pide la persona delegada con el formulario "Comunicación y aplazamientos" de "Competiciones municipales" (Madrid Móvil o Deportes/web, identificándose), *"antes de las 20:00 horas del jueves de la semana anterior"*, uno por temporada y con conformidad previa del rival.
- **Fechas:** *"comenzarán el día 17 de octubre para las categorías sénior y veterana"* … *"(Estas fechas pueden sufrir modificaciones en algún distrito, deporte o categoría…)"*. Inscripción sénior del 15 al 28/09/2026.

> **Ojo con la fecha de inicio.** Las Bases y la FAQ dicen 17/10/2026; en el proyecto tenemos que Moratalaz empieza el **4/10/2026**. Las Bases permiten cambios por distrito, así que puede ser correcto, pero **no lo he encontrado publicado en ninguna web abierta**. Conviene que Iván confirme de dónde sale el 4/10.

### Preguntas frecuentes 47 JDM → "Competición y Calendario" (madrid.es) **[V]**
`https://www.madrid.es/portales/munimadrid/es/Inicio/Cultura-ocio-y-deporte/Deporte/Competicion-y-Calendario-47-JDM/?vgnextfmt=default&vgnextoid=19c876694f39f910VgnVCM200000f921e388RCRD&vgnextchannel=c7a8efff228fe410VgnVCM2000000c205a0aRCRD`

Repite lo de las Bases: calendarios en Madrid Móvil y en Deportes/web, y enlaza **directamente a `https://deportesweb.madrid.es/DeportesWeb/Login`**. Literal: *"La programación será oficial a partir de las 20:00 horas del jueves previo a cada jornada. Será responsabilidad del equipo consultarla."*

### Deportes/web (deportesweb.madrid.es) **[V]**
- Es el portal de reservas y servicios deportivos del Ayuntamiento, hecho con un producto comercial de gestión de centros deportivos (el pie enlaza a la empresa i2a).
- Según la FAQ municipal de Deportes/web, en su sección **"Competiciones municipales"** se pueden *"consultar los partidos, las clasificaciones, las comunicaciones y los aplazamientos, además de gestionar la inscripción"*.
- Acceso: *"identificándose con correo y contraseña o con sede electrónica"*. Al darse de alta hay que aceptar unas condiciones (el formulario avisa "Debe aceptar las condiciones"); **no las he podido leer** porque sólo se muestran dentro del alta.
- No he encontrado páginas públicas de competiciones (sin login) ni en la web ni en buscadores. **[I]** El calendario sólo se ve identificado.

### App Madrid Móvil **[V]**
App oficial del Ayuntamiento (Android e iOS). Mismo contenido que Deportes/web para competiciones, también identificándose. Es la vía más cómoda para un gestor desde el móvil.

### Datos abiertos, dataset 211549 (para comparar) **[V]**
Última actualización **11/09/2026**, frecuencia **semanal (miércoles)**, sigue con la **2025/26** y avisa de que la 2026/27 *"estará disponible en la web municipal"*. En su CSV, un partido sin programar aparece con `Programado = 0` y **sin hora ni pista**; al programarse pasa a `Programado = 1` con `Hora` y `Campo` (comprobado en la copia local de 2025/26). **[I]** Los códigos de `Estado` parecen F = finalizado, R = descanso, N = no presentado, S = suspendido, A = aplazado; no hay documento que lo confirme a mano.

### Webs no oficiales **[V]**
jdmmadrid.es (particular, *"no oficial"*, revisa los datos abiertos cada noche; hoy muestra la 2025/26), munimad.es y madridcompite.com. Todas beben de los datos abiertos: **no son más frescas** que el 211549.

## 2. Formato y frescura

| Fuente | Qué trae | Formato | Login | Frescura |
|---|---|---|---|---|
| Deportes/web | Calendario, horarios, pistas, resultados, clasificaciones, comunicaciones, aplazamientos, sanciones | Pantallas web | Sí | Oficial el **jueves a las 20:00** de cada semana |
| Madrid Móvil | Lo mismo | App | Sí | Igual |
| Bases / FAQ (madrid.es) | Normas y fechas generales | HTML y PDF | No | Por temporada |
| Dataset 211549 | Partidos (fecha, hora, pista, resultado, estado) y clasificaciones | CSV (CC BY 4.0) | No | Semanal, miércoles; hoy aún 2025/26 |
| Actas (app Afición FBM) | Fecha, hora, pista y marcador de partidos jugados | PDF | Sí | Al acabar el partido (ver `SONDEO_ACTAS_FASE0.md`) |

**Consecuencia importante [I]:** como el CSV se publica los miércoles y la programación se cierra el jueves a las 20:00, **un cambio para el domingo inmediato nunca llegará a tiempo por datos abiertos**. El 211549 sirve para vigilar las jornadas siguientes y para contrastar después, no para el aviso de última hora.

**Sanciones:** sólo en Deportes/web y Madrid Móvil, con login, en la ficha del equipo. No hay publicación abierta. (Las Bases hablan de "comunicación de la resolución … en la página electrónica del Ayuntamiento", pero lo que describen es esa sección con login.)

## 3. robots.txt y condiciones

- **deportesweb.madrid.es/robots.txt:** **no existe (404)** [V]. No hay reglas escritas, pero lo que interesa está tras login y eso manda más que el robots.txt.
- **www.madrid.es/robots.txt** [V]: prohíbe a todos los bots, entre otras, `/portales/munimadrid/es/Inicio/El-Ayuntamiento/Deportes/*`, `.../Cultura-y-Ocio/*` y `/portales/munimadrid/es/Inicio/Ayuntamiento/*`. **No veta** la rama `/Inicio/Cultura-ocio-y-deporte/` donde están hoy las páginas de los 47 JDM, ni los PDF de `/UnidadesDescentralizadas/`. Sin `Crawl-delay`. Además, madrid.es responde **403 (Akamai) a curl**; con el lector web sí se lee.
- **datos.madrid.es/robots.txt** (ya conocido): permite páginas y metadatos; veta descargas (`/dataset/*/resource/*`), `/api/` y URLs con `?`; `Crawl-delay: 10`.
- **Aviso legal de madrid.es** [V]: *"Las informaciones que contiene son de titularidad del Ayuntamiento de Madrid"* y, según la Ley de Propiedad Intelectual, *"pueden ser utilizadas libremente, indicando la fuente"*; no se aplica a imágenes, vídeos ni contenidos de terceros firmados. Para dudas remite al "Procedimiento para la reutilización de documentos".
- **Condiciones de Deportes/web:** **no verificadas** (sólo visibles al darse de alta). **[I]** Lo normal es que la cuenta sea personal e intransferible y para uso propio.
- **Datos personales:** las pantallas de sanciones y de equipos pueden mostrar nombres de personas. Nada de eso debe ir a la web pública.

## 4. Recomendación para la revisión de los jueves

**Objetivo:** que el jueves por la noche (o el viernes por la mañana) la plataforma **detecte** si ha cambiado fecha, hora o pista de algún partido de MdA o MdL y lo **proponga** a los gestores con Aceptar/Ignorar. Nunca se aplica solo.

### Opción recomendada: "foto del jueves" + comparación automática
1. **Jueves, a partir de las 20:00:** un gestor con cuenta propia abre Madrid Móvil o Deportes/web, entra en los partidos de MdA y de MdL y **copia el texto** de la programación (o hace una captura) y lo pega o sube en la zona de gestión de la plataforma. Es una consulta humana, con su propia cuenta, como la que ya le exigen las Bases al delegado.
2. **La plataforma lo lee** (texto pegado; o captura leída por Claude) y lo convierte en filas `equipo · jornada · fecha · hora · pista · rival`.
3. **Compara** con el calendario guardado (`data/calendario_2026-27.json`) por equipo + jornada + rival, y genera una lista de **propuestas**: "J3 MdL: hora 10:15 → 11:30", "J5 MdA: pista Baloncesto 1 → Pabellón 3". Si no cambia nada, lo dice.
4. **Los gestores deciden** en la zona de gestión: Aceptar (se actualiza el calendario y, si hace falta, se avisa por SportEasy) o Ignorar (queda registrado).
5. **Aviso de "no se ha hecho":** si el viernes a las 12:00 nadie ha subido la foto del jueves, la plataforma avisa a los gestores. Es la parte que sí puede ser 100 % automática.

### Segunda fuente automática: dataset 211549
- **Cada jueves por la noche**, el workflow ya previsto en `feat/calendario-automatico` mira sólo los **metadatos** (permitido). Si hay CSV nuevo, se descarga **con botón** (o en local) y se compara igual que arriba: propone cambios de **jornadas futuras** y marca discrepancias con la foto del jueves.
- Además sirve de control: si la foto y el CSV discrepan, se avisa.
- Cuando el 211549 publique la 2026/27, detectará también los partidos que pasan a `Programado = 1` (se les asigna hora y pista).

### Qué NO recomiendo
- **Robot que inicie sesión en Deportes/web o en Madrid Móvil** con la cuenta de un gestor: obliga a guardar credenciales personales, las condiciones de uso no se conocen, cualquier cambio de pantalla lo rompe y el Ayuntamiento podría bloquear la cuenta. Descartado, igual que se descartó con la app de la FBM (D35).
- **Leer madrid.es a diario**: no publica calendarios; sólo cambian las normas.

### Riesgos
- **Legales:** bajos con la opción recomendada (consulta humana + datos abiertos CC BY 4.0 citando la fuente). No publicar en la web nada que venga de sanciones ni nombres de personas.
- **Técnicos:** depende de que un gestor haga la foto cada jueves (mitigado con el aviso del viernes); el formato de lo que se pega puede variar entre app y web (la lectura debe ser tolerante, y ante la duda propone en lugar de callar); el 211549 llega tarde y a veces sin la temporada nueva (ya pasa hoy); Akamai puede bloquear descargas desde GitHub (plan: descarga en local).

### Plan B
Si nadie puede hacer la foto del jueves: el viernes, el gestor que vaya a convocar mira la app a mano (lo que ya obligan las Bases al delegado) y, si ve un cambio, lo mete como propuesta manual en la zona de gestión. El 211549, cuando exista, sigue detectando cambios de jornadas futuras. Mientras el 211549 no publique la 2026/27, el calendario se carga a mano (`data/calendario_manual_2026-27.csv`, ya previsto en `docs/CALENDARIO.md` de la rama `feat/calendario-automatico`).

## 5. Qué tiene que hacer Iván
1. **Entrar en Madrid Móvil o Deportes/web** con su cuenta y comprobar si ya aparecen **"3 JDM MOR DOM MAÑ BC SEN MAS G1"** (MdA) y **"4 JDM MOR DOM MAÑ BC SEN MAS G2"** (MdL) y el calendario de la jornada 1. Anotar la **ruta exacta de menús** (p. ej. "Competiciones municipales › Equipos › MdL › Partidos") y hacer **una captura** de la pantalla de partidos, para diseñar la lectura con el formato real.
2. **Confirmar la fecha de inicio 4/10** y de dónde sale (la web municipal dice 17/10 con carácter general).
3. **Leer y guardar las condiciones** que aceptó al darse de alta en Deportes/web (o decirnos dónde están) para cerrar el punto legal.
4. **Decidir quién hace la foto del jueves** (uno o dos gestores con cuenta propia) y a qué hora se quiere el aviso si falta.
5. Opcional: mirar si la sección de sanciones de su equipo está visible y cómo se presenta (sólo para la zona de gestión).

## Fuentes
- Competiciones deportivas municipales 2026/2027 (madrid.es): enlace en el apartado 1.
- Bases reguladoras 47 JDM: https://www.madrid.es/UnidadesDescentralizadas/Deportes/EspecialInformativo/47JDM/ficheros/BasesReguladoras47JDM_1Sp.pdf
- Bases deportes de equipo 47 JDM: https://www.madrid.es/UnidadesDescentralizadas/Deportes/EspecialInformativo/47JDM/normativas/BasesDeportesEquipo47jdm_1Sp.pdf
- FAQ "Competición y Calendario 47 JDM" e "Incidencias y Normas 47 JDM" (madrid.es, rama Cultura-ocio-y-deporte/Deporte)
- FAQ del portal Deportes/web: https://www.madrid.es/portales/munimadrid/es/Inicio/Cultura-ocio-y-deporte/Deportes/Cartas-de-servicios/Preguntas-frecuentes-sobre-el-portal-Deportes-Web/?vgnextfmt=default&vgnextoid=8be6d87727e6f710VgnVCM2000001f4a900aRCRD&vgnextchannel=91c7efff228fe410VgnVCM2000000c205a0aRCRD
- Deportes/web: https://deportesweb.madrid.es/DeportesWeb/Login · robots: https://deportesweb.madrid.es/robots.txt (404)
- robots de madrid.es: https://www.madrid.es/robots.txt
- Aviso legal de madrid.es: https://www.madrid.es/portales/munimadrid/es/Inicio/Aviso-Legal/Aviso-legal/?vgnextfmt=default&vgnextoid=ce3e1e7b0f578010VgnVCM100000dc0ca8c0RCRD&vgnextchannel=8a0f43db40317010VgnVCM100000dc0ca8c0RCRD
- Dataset 211549: https://datos.madrid.es/dataset/211549-0-juegos-deportivos-actual
- jdmmadrid.es, munimad.es, madridcompite.com (no oficiales)
- Copia local del CSV de 2025/26: `data/raw/211549_partidos_20260925.csv` (fuera de git)
