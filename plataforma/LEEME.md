# Plataforma Maccabis (v0)

App Next.js + Supabase: zona personal de cada jugador (`/mi-zona`) y zona de gestión (`/gestion`). Login único con
Google o, de respaldo, un código de un solo uso por correo (D68): nada de contraseñas ni de enlaces secretos.
Vive en esta carpeta; la web de estadísticas de GitHub Pages (raíz del repositorio) no depende de ella.

**Regla de oro:** esta app es del proyecto **Maccabis**. Nunca se toca ni se reutiliza nada del proyecto "web" de
Tres Cantos (TCPC): ni su proyecto de Google Cloud, ni su organización de Supabase, ni su proyecto de Vercel.

## Estructura

```
plataforma/
  src/app/entrar/           login: Google + código por correo, y el reparto a /mi-zona o /gestion
  src/app/auth/callback/    vuelta de "Entrar con Google"
  src/app/mi-zona/          zona personal del jugador (pedido de ropa, mis pedidos, estadísticas)
  src/app/gestion/          zona de gestión: jugadores, pedido de ropa, Excel para VIVE
  src/lib/                  prendas y tallas, Excel, mensajes, sesión, clientes de Supabase
  supabase/migrations/      esquema de la base de datos (tablas, RLS, funciones, lista blanca)
  scripts/db.mjs            migrar, semilla (plantilla 26/27 + campaña), reservar/vincular gestores
  scripts/importar_correos.mjs   npm run db:correos: correos de SportEasy -> jugadores.email
  scripts/extraer_imagenes_ropa.py   imágenes de las prendas desde el PDF de VIVE (privado/)
  pruebas/                  pruebas de extremo a extremo con Postgres y PostgREST reales (sin Docker)
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
3. **Authentication → Sign In / Providers → Email**: dentro, activa el envío por **OTP** (código de un solo uso),
   no el enlace mágico. Si tu panel solo deja elegir la plantilla de correo, edita **Authentication → Emails →
   Magic Link** para que muestre bien visible el código `{{ .Token }}` (6 dígitos): es lo que el jugador va a
   teclear en "Recibir código por correo".
4. **Authentication → URL Configuration**:
   - **Site URL**: `https://maccabis.vercel.app`
   - **Redirect URLs**: añade `https://maccabis.vercel.app/**` y `https://maccabis-*-web-tcpc.vercel.app/**`.
     ⚠️ **Revisa este segundo patrón antes de guardarlo**: el nombre contiene "web-tcpc", que es el otro proyecto.
     Compruébalo contra la URL real de tus despliegues de vista previa de Vercel para "maccabis" (Vercel →
     proyecto `maccabis` → Deployments → copia una URL de Preview) y corrígelo si no coincide con el patrón real.

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
