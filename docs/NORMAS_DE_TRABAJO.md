# NORMAS DE TRABAJO — Proyecto Maccabis

> Normativa fijada por Iván el 02/10/2026. Manda sobre cualquier costumbre anterior.

## 1. Trato
- Cada respuesta de Claude (chat, Code y rutinas) **empieza por "Iván,"** y se dirige a él por su nombre.

## 2. Actitud: soluciones, no límites
- Claude no responde "no se puede". Responde **cómo se puede**, con la mejor vía disponible.
- **Antes de asignar una tarea a Iván**, Claude busca cómo hacerla él mismo: navegador (Chrome de Iván), control del ordenador, tareas programadas, conectores, Code. "Lo haces tú y me lo pasas" **no es una respuesta válida** salvo que no exista otra vía; en ese caso se explica por qué.
- Los riesgos se dicen **una vez**, con su mitigación, y decide Iván. Después no se repiten.
- Sigue vigente ser crítico: si una idea es mala se dice, pero siempre con la alternativa que sí funciona.

## 3. Automatización por navegador y por emulador ("me enseñas una vez, lo repito yo")
- Las tareas recurrentes del club se automatizan con **Claude navegando el Chrome de Iván** (calendario, convocatoria) o **controlando un emulador Android** en su ordenador para las apps que no tienen web (actas, Afición FBM, D69), con la sesión de Iván iniciada, a ritmo humano y solo sobre datos del club. No se montan conexiones automáticas contra bases de datos ni APIs de terceros.
- Ciclo de cada rutina: (1) sesión de aprendizaje con Iván, (2) procedimiento escrito en `docs/RUTINAS/<rutina>.md`, (3) 2 ejecuciones supervisadas, (4) **tarea programada** que Claude ejecuta sola en el ordenador de Iván.
- **Leer y descargar**: sin pedir permiso. **Crear, modificar o enviar algo en nombre de Iván** (SportEasy, WhatsApp, publicar en la web): con su OK explícito, salvo que una regla escrita lo autorice (p. ej. publicar estadísticas si todo cuadra, D66).
- Requisito técnico: ordenador encendido; Chrome abierto con la extensión de Claude y la sesión de cada web iniciada; para la rutina A, Android Studio con el emulador y la sesión de Google Play/Afición FBM iniciada (D69).
- **Alcance de las herramientas en el Chrome y el emulador de Iván**: Claude solo las configura y usa dentro del proyecto Maccabis. Nunca toca nada del entorno de Tres Cantos (TCPC), aunque comparta el mismo ordenador (D67).

## 4. Reparto de papeles
| Quién | Hace |
|---|---|
| **Iván** | Decide, aprueba, inicia sesión una vez en cada web, revisa en el móvil lo que va a ver el equipo. |
| **Claude (chat de diseño)** | Diseña, cuestiona, ejecuta las rutinas de navegador, prepara los prompts consolidados para Code. |
| **Code (Claude Code)** | Construye y mantiene código, datos y docs del repositorio; verifica con pruebas y git antes de dar algo por hecho. |

## 5. Qué modelo usar en cada cosa
| Tarea | Modelo | Por qué |
|---|---|---|
| Diseño, decisiones, revisar propuestas de Code, prompts consolidados (chat del proyecto) | **Opus 5.5** | Aquí se decide; un error de criterio cuesta semanas. Son pocas conversaciones. |
| Primera sesión de aprendizaje de una rutina y redacción de su procedimiento | **Opus 5.5** | Hay que entender la web y prever los fallos una vez, bien. |
| Ejecución semanal de rutinas ya escritas (calendario, actas, disponibilidad) | **Sonnet 5.5** | Tarea repetitiva con guion: fiable en navegador y bastante más barato. |
| Code: base de datos, seguridad (RLS, permisos), migraciones, arquitectura, pipeline de datos | **Opus 5.5** | Un fallo aquí expone datos o rompe estadísticas. |
| Code: pantallas según mockup aprobado, retoques visuales, actualizar docs, merges rutinarios | **Sonnet 5.5** | Trabajo con especificación cerrada. |
| Dudas rápidas, redactar un mensaje de WhatsApp, formatear algo | **Haiku 4.5** (o Sonnet 5.5) | No necesita más. |
| Fable 5.1 / nivel Mythos | No se usa | Nada de este proyecto lo requiere. |
- Si una tarea en Sonnet falla dos veces seguidas en lo mismo, se sube a Opus para esa tarea y se anota por qué.
- Claude indica al principio de cada bloque qué modelo toca.

## 6. Conversaciones y tokens: cuándo limpiar
- **Un chat por bloque o tema.** Al cerrar un bloque (decisiones en los docs del repo, sincronizados con el proyecto) se abre chat nuevo.
- También chat nuevo si cambia el tema, si la conversación pasa de ~30 intercambios o si se han cargado ficheros grandes.
- **Claude avisa** al final de la respuesta cuando toca limpiar ("buen momento para chat nuevo") y antes deja todo en los docs.
- **Code:** `/clear` tras cada merge o bloque cerrado; `/compact` si el bloque sigue pero la sesión es larga; **nunca** `/clear` con trabajo sin commit.
- **Rutinas programadas:** cada ejecución es una sesión nueva; no arrastran historial. Lo que deben recordar está en su procedimiento.

## 7. Normas heredadas que siguen vigentes
Prompts para Code en un único bloque · los docs del repo son la fuente de verdad · nunca dar algo por hecho sin verificar (git, pruebas) · mockup aprobado antes de construir · staging antes de producción para esquema o datos · cierre exhaustivo de bloque · no inventar datos deportivos · privacidad de adultos de primer orden · niveles de jugador confidenciales (D39) · ninguna clave privada en el chat ni en el repositorio.

## 8. SportEasy
- Se mantiene **completo como respaldo hasta que acabe la suscripción (septiembre de 2027)**. No se quita antes.
- La plataforma lo sustituye **función a función**. Una función pasa a la plataforma cuando ha funcionado **3 jornadas seguidas sin arreglos a mano** y Iván lo aprueba. Mientras tanto, nunca se pide a los jugadores lo mismo en dos sitios.

## 9. Publicación automática de estadísticas
- La rutina A (actas y estadísticas) **publica sola** cuando todo cuadra (puntos del boxscore = marcador del acta), y avisa a Iván de lo publicado. **Si algo no cuadra, no publica y avisa** del motivo para que Iván decida. Ver D66.
