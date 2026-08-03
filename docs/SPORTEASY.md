# SPORTEASY — Conocimiento sobre la plataforma

> Todo lo que sabemos de SportEasy y cómo nos relacionamos con ella. Equivale a FEDERACION.md de TCPC.

## Qué es para Maccabis

Plataforma de gestión de equipo que Maccabis usa y paga (suscripción de equipo). Es el **registro oficial**: calendario/eventos, asistencia (partidos y entrenamientos), plantel.

## Limitación estructural: la doble ficha

SportEasy **no permite dividir un equipo en dos**. Como Maccabis juega con dos fichas (MdA y MdL), Iván crea **dos campeonatos cada año**, uno por ficha. Esto complica la gestión: hay que duplicar eventos, convocatorias, etc. Es una de las fuentes principales de trabajo manual.

## API: NO hay API pública

- SportEasy tiene una API **interna** que alimenta sus propias apps, pero **no es pública** ("contáctanos si tienes un club y quieres probarla").
- No hay forma limpia y estable de que una plataforma externa lea en tiempo real los datos de SportEasy (p. ej. quién ha confirmado un evento).
- **Conclusión:** NO se puede construir un panel que se sincronice en vivo con SportEasy. Prometerlo sería engañar.

## Lo que SÍ se puede: exportación / importación por Excel

- **Exportar (bajar datos):** con suscripción Premium/Club, desde el plantel del equipo (siendo entrenador/admin) se exporta a Excel. La asistencia se exporta desde la página de balance dentro de Asistencias. (Iván ya usa esto — el Excel de asistencia 25/26 salió de aquí.)
- **Importar (subir datos):** 
  - **Calendario de liga/campeonato:** la sección "Campeonatos" permite crear el campeonato con todas las jornadas de una vez. Si la liga JDM Moratalaz está en su base de datos, al vincular el equipo trae el calendario hecho (evita crear ~20 eventos a mano).
  - **Importación por Excel a nivel de equipo:** NO es autoservicio en el plan actual. Hay que contactar con su soporte, que envía una plantilla Excel para rellenar y devolver, y ellos la cargan.

## Estrategia acordada (ver DECISIONS D4, D5)

- La plataforma que construimos "bebe" de SportEasy vía **export Excel manual** (Iván exporta → sube a la plataforma → la plataforma hace el trabajo de cruce que hoy hace a mano).
- La plataforma **genera**: mensajes de WhatsApp listos para copiar/pegar, y archivos de importación de calendario/convocatoria para SportEasy. NO envía ni sincroniza sola.
- **Pendiente:** Iván quiere presionar por vías alternativas de sacar/subir datos (más allá del Excel) antes de darlo por definitivo. Investigar. Si no sale nada, Excel es el plan B.

## Tareas relacionadas

- Preparar el Excel del calendario de la temporada en formato importable (cuando salga el calendario 26/27).
- Investigar vincular la liga JDM en la sección "Campeonatos".
- Escribir a soporte de SportEasy para la plantilla de importación por Excel si hiciera falta.
