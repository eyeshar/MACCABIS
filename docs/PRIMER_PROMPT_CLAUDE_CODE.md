# Primer prompt para Claude Code — Proyecto Maccabis

> Cómo usar esto: cuando arranques la sesión de Claude Code en la carpeta del proyecto, pega el bloque de abajo como PRIMER mensaje. Antes, coloca los 5 documentos de memoria (MEMORIA.md, ESTADO.md, DECISIONS.md, BACKLOG.md, SPORTEASY.md) en una carpeta `docs/` dentro del proyecto.
>
> Recuerda la metodología: prompts consolidados en un bloque, Claude Code trabaja con autonomía total sin pedir confirmación, y al terminar cada sesión hay que actualizar los docs/.

---

## BLOQUE PARA PEGAR EN CLAUDE CODE

```
Hola. Vas a trabajar en el proyecto Maccabis, un club de baloncesto amateur de Madrid. Antes de hacer nada, lee TODOS los documentos de la carpeta docs/ (MEMORIA.md, ESTADO.md, DECISIONS.md, BACKLOG.md, SPORTEASY.md). Contienen todo el contexto, las decisiones ya tomadas y su porqué, y lo pendiente. Son tu fuente de verdad.

Reglas de trabajo (importantes):
- Trabaja con autonomía total. NO me preguntes si acepto cada cambio; desarrolla lo acordado y sigue adelante. Todo lo que esté en los docs o acordemos, va hacia adelante.
- Soy Iván, coordinador del club. NO soy programador. Explícame lo justo, en lenguaje sencillo, y encárgate tú de lo técnico.
- Nunca asumas que algo está "hecho" sin verificarlo (git status/log, que arranque, etc.).
- Sé crítico: si algo que te pido es mala idea o hay una fricción, dímelo antes de construir.
- Nunca me pidas contraseñas ni credenciales por el chat. Si necesitas que configure algo (Supabase, Vercel), dime los pasos para hacerlo yo.
- Al terminar la sesión, actualiza los docs/ (sobre todo ESTADO.md y BACKLOG.md) para no perder continuidad.

Contexto rápido (el detalle está en docs/): estamos construyendo una plataforma con Next.js + Supabase + Vercel. Tiene una zona pública (estadísticas + histórico del club, sin login) y una zona de gestión (solo 3 gestores, con login real). Coste cero adicional. Empezamos por la zona pública; las convocatorias esperan a octubre.

TAREA DE ESTE PRIMER BLOQUE — arranque del proyecto:
1. Inicializa un proyecto Next.js (App Router) limpio en este repositorio, con la estructura base.
2. Prepara la integración con Supabase (cliente, variables de entorno) y déjame indicadas por escrito, paso a paso, las cuentas/claves que tengo que crear yo (Supabase y Vercel), sin pedírmelas por aquí.
3. Deja lista la estructura de carpetas para: zona pública (estadísticas, histórico) y zona de gestión (con login, de momento vacía).
4. Configura el despliegue en Vercel conectado al repositorio de GitHub.
5. Cuando termines, dime exactamente qué has hecho, qué has verificado, y qué tengo que hacer yo (crear cuentas, pegar claves, etc.) para que quede funcionando. Actualiza ESTADO.md y BACKLOG.md.

No migres todavía los datos de estadísticas ni construyas pantallas de contenido: este bloque es solo dejar el esqueleto del proyecto en pie y desplegado. En el siguiente bloque migraremos el dashboard de estadísticas 25/26.
```

---

## Notas para Iván (no pegar, para ti)

- **Antes de arrancar Claude Code**, necesitarás: una cuenta de GitHub (ya la tienes: `eyeshar`), una de Supabase (crear, gratis) y una de Vercel (crear, gratis; se puede entrar con la cuenta de GitHub).
- Cuando Claude Code te pida crear cuentas o pegar claves de entorno (las "environment variables"), lo haces tú directamente donde te diga. Nunca me las pegues a mí ni a Claude en el chat de diseño.
- Tras la sesión, descarga los docs/ actualizados y vuelve a subirlos al proyecto de Claude (el de diseño) para que sigamos con continuidad.
- El siguiente prompt (bloque 2) lo diseñamos juntos cuando este esté hecho: será migrar el dashboard de estadísticas 25/26 a la zona pública.
