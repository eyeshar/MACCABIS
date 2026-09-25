# MEMORIA — Proyecto Maccabis

> Memoria estable del proyecto. Contexto que no cambia (o cambia poco). Equivale a la memoria de contexto del proyecto TCPC (Tres Cantos), adaptada.

## El club

**Maccabis** — club de baloncesto amateur, fundado en 2013 ("since 2013"). Un solo equipo humano dividido en **dos fichas** para que pueda jugar todo el mundo:
- **MdL** — Maccabi de Levantar (el equipo original). Grupo G1 (3 JDM MOR DOM MAÑ BC SEN MAS G1).
- **MdA** — Maccabi de Acostar (creado después). Grupo G3 (6 JDM MOR DOM MAÑ BC SEN MAS G3).
- **En 2026/27 (47 JDM) cambian los grupos:** MdA en **G1** (`3 JDM MOR DOM MAÑ BC SEN MAS G1`) y MdL en **G2** (`4 JDM MOR DOM MAÑ BC SEN MAS G2`). Confirmado por Iván; el histórico no cambia.
- **Doble ficha 26/27 (D33):** se puede jugar con los dos equipos el mismo domingo sólo si los horarios no se solapan. Delegado de ambos equipos en 26/27: Carlos Barreiro.
- **2026/27 empieza el domingo 4/10/2026** en Moratalaz (D38), antes que el resto de la competición sénior (17/10). Plantilla confirmada de 24 (`docs/PLANTILLA_26-27.md`).

Mucha gente tiene **doble ficha** (juega en los dos equipos); algunos solo en uno. La plantilla combinada es de ~24 jugadores por temporada.

- **Liga:** Liga Municipal de Moratalaz (Juegos Deportivos Municipales, JDM), categoría Sénior Masculino. Distrito Moratalaz, Madrid.
- **Partidos:** domingos por la mañana.
- **Entrenamientos:** miércoles 20:30–22:30 en Valdebernardo.
- **SportEasy:** sale de la operativa desde la J2 (11/10/2026, D44); respaldo dormido hasta noviembre. Disponibilidad y convocatoria, por la plataforma propia.
- **Plataforma propia** (`plataforma/`, D55): cada jugador entra con su **enlace personal secreto** (`/j/<enlace>`); los 3 gestores con login real (D45). Los jugadores nunca ven niveles, posiciones ni motivos (D46).
- **Federación / plataforma de actas:** Afición FBM / Gesdeportiva (Indalweb). Cambió en 25/26; antes (24/25) usaban SWISH.

## Las personas (organización — los 3 gestores)

- **Iván (Villaescusa Silva, Iván)** — coordinador, capitán y responsable general. Usuario GitHub: `eyeshar`. Email: eyeshar@gmail.com. Mantenedor único del proyecto. NO es programador (más allá de lo aprendido en este proyecto).
- **Carlos (Barreiro Carballal, Carlos José)** — entrenador/delegado. Genera las estadísticas históricas. (Nota: aparecía por error como jugador en algún acta; excluido de stats de jugadores.)
- **Eduardo (Martín-Ortega Rico, Eduardo)** — tesorero. También delegado y jugador.

## Ecosistema actual (lo que hay que respetar y mejorar, no sustituir)

Tres herramientas + mucho trabajo manual de Iván como "pegamento":
1. **WhatsApp** — día a día, convocatorias, confirmaciones. Insustituible. NO se toca.
2. **SportEasy** — registro oficial (calendario, asistencia, plantel). Suscripción de equipo de pago. Rígido: no permite dividir un equipo en dos, por eso Iván crea **dos campeonatos cada año** (uno por ficha), lo que complica la gestión.
3. **Excel** — el pegamento manual de Iván: convocatorias, control de asistencia, cuentas. Donde se le va el tiempo.

**El dolor real:** Iván es el pegamento humano entre las tres cosas. Todo manual.

## Qué estamos construyendo

Una plataforma que **profesionalice y reduzca la manualidad**, con dos zonas de público distinto:

- **Zona pública** (todo el equipo, sin login): estadísticas + histórico del club. Información para consultar.
- **Zona de gestión** (solo los 3 gestores, con login real): convocatorias con doble ficha, tesorería/cuentas, herramientas para trabajar con SportEasy.

**Filosofía acordada (Opción A "realista"):** la plataforma es el **centro de mando** que sustituye los Excel. WhatsApp y SportEasy siguen en su sitio. El puente con SportEasy es por **exportación/importación de Excel** (no en tiempo real, porque SportEasy no tiene API pública — ver SPORTEASY.md). La plataforma genera mensajes de WhatsApp listos para copiar/pegar y archivos listos para importar a SportEasy. NO envía sola, NO sincroniza sola. Objetivo: que Iván pase de "ser el ordenador que cruza datos a mano" a "tomar decisiones y dar un clic".

> Pendiente de explorar: presionar por vías de sacar/subir datos de SportEasy más allá del Excel. Si no sale nada, Excel es el plan B confirmado.

## Stack técnico (decidido)

Igual que TCPC (ahora justificado por la necesidad de login real):
- **Next.js** (App Router)
- **Supabase** (Postgres + Auth + RLS) — la zona de gestión va protegida de verdad con Row Level Security, no con contraseña en el código.
- **Vercel** (hosting)
- **GitHub** (repositorio + control de versiones)

**Coste:** CERO adicional sobre lo que Iván ya paga (suscripción Max de Claude + suscripción SportEasy). Supabase y Vercel en plan gratuito.

### Diferencias clave con el stack TCPC
- **NO hay menores.** Todos los jugadores son adultos. Se elimina toda la capa de privacidad de menores que en TCPC es criterio de primer orden.
- **SÍ hay datos personales sensibles** (DNIs, teléfonos, fechas de nacimiento en las hojas de inscripción; datos de tesorería). Van SIEMPRE en la zona protegida, NUNCA en la pública.
- Mucho más pequeño que TCPC (~24 jugadores vs 140), sin APIs de federación en vivo.

## Metodología de trabajo (heredada de TCPC)

- Iván diseña los prompts CONMIGO (Claude en el chat/proyecto), y se los pasa a **Claude Code**, que ejecuta.
- **Claude Code opera con autonomía total**: no pregunta si acepta o no cada cosa; desarrolla lo acordado y sigue adelante. Todo lo que Iván y Claude decidan juntos, va hacia adelante.
- **Prompts consolidados**: siempre en UN bloque, no goteando instrucciones.
- Los `docs/` son el canal de continuidad entre sesiones. Recordar a Iván descargar/re-subir los docs actualizados tras cada sesión.
- Nunca asumir "hecho" sin verificar (git log/status).
- Ser crítico y cuestionar; señalar fricciones antes de construir.
- Diseño/mockup aprobado antes de construir.
- Staging antes de producción para cambios de esquema/datos.
- Cierre de bloque exhaustivo: nada flotando en el chat, todo a los docs.
- Privacidad (de adultos, aquí) como criterio de primer orden. No pasar credenciales por el chat.
- **Niveles A/B/C confidenciales** (D39): sólo Iván, Carlos y Eduardo; viven en `privado/` (fuera de git) hasta que haya zona de gestión con login.
- **Nunca sobrescribir una fuente** (D41): copiar siempre con `scripts/lib/copia_segura.js`. Carpetas fuera de git: `docs/Fichas/`, `docs/estadisticas/`, `fuentes_fbm/`, `privado/`, `data/raw/`.
- No inventar datos deportivos.

## Nombre de la sesión de Claude Code

TCPC usa "Fable". Para Maccabis: **[PENDIENTE — Iván elige nombre]**.
