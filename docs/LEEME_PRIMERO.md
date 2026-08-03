# Proyecto Maccabis — documentos de arranque

Estos son los documentos de memoria del proyecto, generados al cerrar la conversación inicial de diseño. Replican la metodología del proyecto Tres Cantos (TCPC).

## Qué es cada archivo

- **MEMORIA.md** — contexto estable: el club, las personas, el ecosistema, el stack, la metodología. Lo que no cambia.
- **ESTADO.md** — qué está hecho hoy. Se actualiza cada sesión.
- **DECISIONS.md** — decisiones tomadas y su porqué. Para no re-discutir.
- **BACKLOG.md** — lo pendiente, por prioridad.
- **SPORTEASY.md** — todo sobre SportEasy y cómo nos relacionamos con ella.
- **PRIMER_PROMPT_CLAUDE_CODE.md** — el bloque listo para pegar en Claude Code al arrancar.

## Cómo seguir (pasos para Iván)

1. **Abre un Proyecto nuevo en Claude** (o una conversación nueva) para Maccabis. Sube estos documentos como base. Así no arrastramos el peso de la conversación de arranque (que se saturó) y tenemos continuidad limpia.
2. Cuando quieras trabajar con Claude Code, crea la carpeta `docs/` en el repositorio del proyecto y pon ahí los 5 .md (MEMORIA, ESTADO, DECISIONS, BACKLOG, SPORTEASY).
3. Pega en Claude Code el bloque de PRIMER_PROMPT_CLAUDE_CODE.md.
4. Tras cada sesión de Claude Code, descarga los docs/ actualizados y vuelve a subirlos al Proyecto de Claude (el de diseño), para mantener la continuidad.

## Pendiente inmediato

- Elegir **nombre** para la sesión de Claude Code (TCPC usa "Fable").
- Crear cuentas gratuitas de **Supabase** y **Vercel** cuando Claude Code lo pida.
- Subir al proyecto nuevo los archivos de estadísticas históricas (23/24, 24/25) y demás Excel para integrarlos.

## Estado del dashboard actual

Ya hay un dashboard de estadísticas 25/26 **publicado y funcionando** en `https://eyeshar.github.io/MACCABIS/` (web estática, v1). Se migrará a la plataforma nueva como zona pública. Los datos ya están procesados y verificados.
