# Plataforma Maccabis (v0)

App Next.js + Supabase: zona personal de cada jugador (`/mi-zona`) y zona de gestión (`/gestion`). Login único con
Google o, de respaldo, un código de un solo uso por correo (D68): nada de contraseñas ni de enlaces secretos.
Vive en esta carpeta; la web de estadísticas de GitHub Pages (raíz del repositorio) no depende de ella.

**Regla de oro:** esta app es del proyecto **Maccabis**. Nunca se toca ni se reutiliza nada del proyecto "web" de
Tres Cantos (TCPC): ni su proyecto de Google Cloud, ni su organización de Supabase, ni su proyecto de Vercel.

## Estructura

```
plataforma/
  src/app/page.tsx          portada pública sin login (D76): próxima jornada, resultados, clasificación, líderes, calendario, historia
  src/app/calendario.ics/   feed iCal público (partidos y entrenos, sin datos personales, D77)
  src/app/manifest.ts       web instalable (D78); iconos en public/iconos/ y src/app/{icon,apple-icon}.png (npm run iconos)
  src/components/nav/       navegacion unica (D89, D90): Cabecera (lee la sesion en el servidor), Navegacion (menu, menu de
                            usuario, menu de Gestion, barra inferior y hoja "Mas" del movil), BarrasZona (Mi zona y Gestion)
  src/lib/usuario.ts        quien mira la pagina (sin sesion, jugador, gestor) para la cabecera
  src/app/cuenta/           Mi cuenta: una pagina para jugadores y gestores (/gestion/cuenta redirige aqui)
  src/app/entrar/           acceso: Google + código por correo, y el reparto a /mi-zona o /gestion
  src/app/auth/callback/    vuelta de "Entrar con Google"
  src/app/mi-zona/          zona personal del jugador (pedido de ropa, mis pedidos, estadísticas)
  src/app/gestion/          zona de gestión: jugadores, pedido de ropa, Excel para VIVE
  src/lib/                  prendas y tallas, Excel, mensajes, sesión, clientes de Supabase; web.ts (FUNDACION, menú, enlaces
                            a GitHub Pages), publico.ts (datos de la portada), dias.ts, ical.ts
  src/data/                 COPIAS de ../data (npm run datos:sync): calendario, equipaciones, avisos, liga, temporada 26/27,
                            entrenos y resumen de la historia. No se editan a mano; pruebas:portada falla si están desfasadas
  src/app/globals.css       sistema visual: TODOS los tokens (colores, tipos, tamaños) en el bloque del principio
  supabase/migrations/      esquema de la base de datos (tablas, RLS, funciones, lista blanca)
  scripts/db.mjs            migrar, semilla (plantilla 26/27 + campaña), reservar/vincular gestores
  scripts/cargar_liga.mjs   npm run db:liga: liga de todos los equipos (por jugador, calendario, clasificacion) a Supabase (D73)
  scripts/backup_public.mjs npm run db:backup: copia de los datos de public a privado/backups/ (fuera de git)
  scripts/importar_correos.mjs   npm run db:correos: correos de SportEasy -> jugadores.email
  scripts/cargar_asistencia.mjs  npm run db:asistencia: privado/asistencia/*.json -> asistencia_motivos (motivos de
                            ausencia, solo gestores, D82)
  scripts/extraer_imagenes_ropa.py   imágenes de las prendas desde el PDF de VIVE (privado/)
  pruebas/                  pruebas de extremo a extremo con Postgres y PostgREST reales (sin Docker)
                            npm run pruebas:liga (RLS de la liga), pruebas:pantallas (Scouting y Liga consolidada),
                            node pruebas/restaurar_backup.mjs <copia> (prueba que una copia se restaura),
                            pruebas:asistencia (RLS de los motivos de ausencia: solo gestores),
                            pruebas:navegacion (cabecera unica por rol, desplegables, barra inferior, barras de zona,
                            barra de GitHub Pages; capturas en privado/mockups_liga/rediseno/nav1b/),
                            pruebas:portada (portada, /club, indexación, acceso, Mi zona y gestión nuevos, iCal y web instalable; capturas
                            reales en privado/mockups_liga/rediseno/)
  public/ropa/              imágenes de las prendas y tablas de tallas (sí se publican)
```

## Puesta en marcha (lo que hace Iván, una vez)

Las claves **nunca** se escriben en el chat ni se suben a git: van en `plataforma/.env.local` (en tu ordenador) y
en los paneles de Supabase y Vercel.

### 1. Supabase (base de datos y login)
1. Entra en https://supabase.com con la cuenta/organización **Maccabis** (proyecto `pqbjnxmknhawlkszwmln`). Nunca la
   organización de Tres Cantos.
2. **Project Settings → API**: copia la *Project URL* (sin `/rest/v1/` al final) y la clave **publishable** (o *anon*).
3. **Database → Connection string → Session pooler**: copia la URI y sustituye `[YOUR-PASSWORD]` por tu contraseña.
4. En el ordenador, copia `plataforma/.env.example` como `plataforma/.env.local` y pega ahí los tres valores.

### 2. Google Cloud (para "Entrar con Google")
1. Entra en https://console.cloud.google.com con tu cuenta. **Crea un proyecto NUEVO llamado "Maccabis"** — nunca
   reutilices el proyecto de Google Cloud de Tres Cantos, aunque sea más rápido.
2. **APIs y servicios → Pantalla de consentimiento de OAuth**: tipo **Externo**. Nombre de la app "Maccabis", tu
   correo de soporte. En **Alcances**, añade solo `.../auth/userinfo.email` y `.../auth/userinfo.profile` (los
   mínimos: correo y nombre). No hace falta verificación de Google para un club pequeño con usuarios concretos.
3. **Credenciales → Crear credenciales → ID de cliente de OAuth** → tipo **Aplicación web**, nombre "Maccabis".
   - **URI de redirección autorizado**: `https://pqbjnxmknhawlkszwmln.supabase.co/auth/v1/callback`
     (es la URL fija de callback de Supabase para este proyecto; no la de Vercel).
4. Copia el **Client ID** y el **Client Secret** — van directos al paso siguiente, **nunca por el chat**.

### 3. Supabase: activar Google y el candado de la lista blanca
1. **Authentication → Providers → Google**: actívalo, pega el Client ID y el Client Secret del paso anterior.
   Guarda.
2. **Authentication → Hooks**: busca **"Before User Created"** (o el hook más parecido en tu versión del panel;
   el nombre puede variar) y selecciónalo como **Postgres Hook**, apuntando a la función
   `public.antes_de_crear_usuario`, que ya trae la migración. Sin este paso, cualquier correo de Google podría
   crear una cuenta: el hook es quien aplica la lista blanca (D68).
3. **Authentication → Sign In / Providers: activa "Allow new users to sign up"** — pero **solo después** de tener
   el hook del paso 2 ya puesto, nunca antes. El orden importa en los dos sentidos: sin el hook, activar este
   interruptor dejaría crear cuenta a cualquier correo de Google (ningún filtro de por medio); sin el interruptor,
   aunque el hook ya esté puesto, **no entra nadie nuevo**, ni siquiera quien ya tiene su correo en la lista
   blanca. El 26/09/2026 este registro estaba desactivado; D68 exige activarlo, con el hook ya puesto.
4. **Authentication → Sign In / Providers → Email**: dentro, activa el envío por **OTP** (código de un solo uso),
   no el enlace mágico. Si tu panel solo deja elegir la plantilla de correo, edita **Authentication → Emails →
   Magic Link** para que muestre bien visible el código `{{ .Token }}` (6 dígitos): es lo que el jugador va a
   teclear en "Recibir código por correo".
5. **Authentication → URL Configuration**:
   - **Site URL**: `https://maccabis.vercel.app`
   - **Redirect URLs**: añade `https://maccabis.vercel.app/**` y `https://maccabis-*-web-tcpc.vercel.app/**` (el
     segundo es el patrón de las vistas previas: "web-tcpc" es el **slug del equipo de Vercel** de Iván, no del
     proyecto "web" de Tres Cantos — comprobado con la vista previa real
     `https://maccabis-git-feat-plataforma-v0-web-tcpc.vercel.app`).

### 4. Cargar la base de datos (me lo pides a mí, o lo haces tú)
Desde `plataforma/`:
```
npm install
npm run db:migrar
npm run db:semilla
npm run db:gestor -- correo-de-ivan@... Iván
npm run db:gestor -- correo-de-carlos@... Carlos
npm run db:gestor -- correo-de-edu@... Edu
npm run db:correos -- "C:\ruta\al\export-sporteasy.csv"
npm run db:estado
```
La semilla crea los 25 de la plantilla (24 jugadores + Carlos) y la campaña "Ropa 2026/27" **cerrada**, sin
correos. `db:gestor` reserva la plaza de cada gestor por correo (se vincula sola la primera vez que entra).
`db:correos` lee un fichero exportado de SportEasy (CSV o XLSX, con una columna de correo y una de nombre) y
rellena `jugadores.email` casando por nombre exacto; lo que no case se lista para revisarlo a mano, nunca se
adivina. **El fichero no entra en git**: pásalo desde Descargas o `privado/`.

### 5. Vercel (la web)
1. Entra en https://vercel.com con tu cuenta de GitHub → **Add New… → Project** → importa `eyeshar/MACCABIS`.
   El proyecto de Vercel debe llamarse `maccabis` (o algo que no choque con el `web` de Tres Cantos).
2. **Root Directory: `plataforma`** (importante). Framework: Next.js (lo detecta solo).
3. **Environment Variables**: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (los mismos valores),
   marcadas para **Production y Preview**. **No pongas** `SUPABASE_DB_URL` ni ninguna clave secreta.
4. **Deploy**. Mientras esta rama no esté en `main`, el despliegue de producción de `main` **fallará** (en `main`
   aún no existe la carpeta `plataforma/`): es normal. Lo que se revisa es el **Preview** de la rama
   `feat/plataforma-v0` (Vercel → Deployments), con su propia URL.

### 6. Revisar antes de compartir nada
Entra en `/entrar` con tu Google o con un código a tu correo, y comprueba que te lleva a `/gestion`. Abre la
campaña (Estado: Abierta, fecha límite), mira "Jugadores" (los correos que importaste), y haz un pedido de prueba
desde `/mi-zona`. Hasta que lo apruebes, no se avisa a nadie de que ya puede entrar.

### 7. Correo propio para los códigos (SMTP con Gmail del club) — hazlo antes de avisar a todos
**Por qué:** hasta que no actives esto, Supabase manda los códigos de un solo uso (y cualquier otro correo de
Auth) con su servicio compartido, que solo está pensado para pruebas: pocos envíos por hora y sin garantía de que
lleguen a una bandeja ajena (puede acabar en spam, o no enviarse si se supera el límite). Todo el que no tiene
Gmail (ve "Entrará con código por correo" en Gestión → Jugadores) depende de que este correo llegue de verdad, así
que conviene ponerlo antes de avisar al equipo. Revisa en tu panel **Authentication → Rate Limits** cuál es hoy el
límite de envíos de tu proyecto: no se puede saber desde fuera del panel, y varía según el plan.

1. En la cuenta de Gmail del club (o la tuya), activa la verificación en dos pasos si no la tienes
   (**Cuenta de Google → Seguridad**) y genera una **contraseña de aplicación**
   (**Cuenta de Google → Seguridad → Verificación en dos pasos → Contraseñas de aplicaciones**). Cópiala: son 16
   caracteres, sin espacios. Esto **no es tu contraseña normal de Gmail**: es una clave aparte, solo para esto.
2. Supabase → tu proyecto → **Authentication → Emails → SMTP Settings** (en paneles más nuevos puede llamarse
   **Authentication → Settings → SMTP Provider**): activa **"Enable Custom SMTP"** y rellena:
   - **Host:** `smtp.gmail.com`
   - **Port:** `465`
   - **Username:** la cuenta de Gmail del club completa (`tu-cuenta@gmail.com`)
   - **Password:** la contraseña de aplicación del paso 1. **Pégala tú mismo directamente en el panel de
     Supabase: nunca por el chat, ni a Claude ni a nadie.**
   - **Sender email:** la misma cuenta de Gmail.
   - **Sender name:** `Maccabis`
3. Guarda. El panel deja mandar un correo de prueba desde ahí mismo: compruébalo antes de avisar a nadie.
4. Revisa la plantilla del código (**Authentication → Emails → Magic Link**, es la que usa el código OTP de
   "Recibir código por correo"): que el texto esté en español, que dentro se vea bien claro el código
   `{{ .Token }}` (los 6 dígitos) y que quede claro que el correo viene del club (el remitente ya lo dice con el
   "Sender name" del paso 2, pero conviene que el cuerpo también lo diga, p. ej. "Tu código de Maccabis es:").
   Gmail SMTP admite unos 500 correos al día por cuenta: de sobra para un club de este tamaño.

## Pruebas

```
npm run pruebas
```
Levanta en local un Postgres 17 y un PostgREST reales con estas migraciones, compila la app y la maneja con
Chrome: RLS y lista blanca, código por correo, pedidos (propio y de familiar), campaña cerrada, dorsal repetido,
Excel celda a celda con la plantilla de `privado/`. Informe y capturas en `pruebas/resultados/` (fuera de git).
"Entrar con Google" no se puede probar en local (exige una cuenta real de Google): el código por correo cubre la
misma lógica de sesión y lista blanca; Google se revisa a mano en la vista previa de Vercel.

```
node pruebas/verificar_real.mjs
```
Verifica contra el proyecto real de Supabase (lee `.env.local`): la lista blanca (`correo_permitido`, el hook),
RLS, quién puede entrar y quién no, y que un jugador solo ve lo suyo. Crea datos temporales y los borra al final.

## Imágenes de las prendas
`npm run imagenes:ropa` las vuelve a extraer del PDF de VIVE de `privado/` (el PDF nunca se publica).
