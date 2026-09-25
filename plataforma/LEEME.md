# Plataforma Maccabis (v0)

App Next.js + Supabase: zona personal de cada jugador (`/j/<enlace>`) y zona de gestión (`/gestion`, con login).
Vive en esta carpeta; la web de estadísticas de GitHub Pages (raíz del repositorio) no depende de ella.

## Estructura

```
plataforma/
  src/app/j/[token]/        zona personal del jugador (pedido de ropa, mis pedidos, estadísticas)
  src/app/gestion/          zona de gestión: jugadores y enlaces, pedido de ropa, Excel para VIVE
  src/lib/                  prendas y tallas, Excel, mensajes, clientes de Supabase
  supabase/migrations/      esquema de la base de datos (tablas, RLS, funciones)
  scripts/db.mjs            migrar, semilla (plantilla 26/27 + enlaces + campaña), alta de gestores
  scripts/extraer_imagenes_ropa.py   imágenes de las prendas desde el PDF de VIVE (privado/)
  pruebas/                  pruebas de extremo a extremo con Postgres y PostgREST reales (sin Docker)
  public/ropa/              imágenes de las prendas y tablas de tallas (sí se publican)
```

## Puesta en marcha (lo que hace Iván, una vez)

Las claves **nunca** se escriben en el chat ni se suben a git: van en `plataforma/.env.local` (en tu ordenador) y en el panel de Vercel.

### 1. Supabase (base de datos y logins)
1. Entra en https://supabase.com con la cuenta que quieras usar para el club.
   Ojo: el plan gratuito permite **2 proyectos activos**. Si tu cuenta ya tiene los dos de Tres Cantos, crea una cuenta nueva para el club (por ejemplo con un correo del club); así además tendrás sitio para el staging del bloque siguiente (D53).
2. **New project** → nombre `maccabis`, región **West EU (Ireland)** o la más cercana, y una contraseña de base de datos larga (guárdala en tu gestor de contraseñas).
3. Cuando termine de crearse, ve a **Project Settings**:
   - **API**: copia la *Project URL* y la clave **publishable** (o *anon*, según cómo la llame tu panel).
   - **Database → Connection string → Session pooler**: copia la URI y sustituye `[YOUR-PASSWORD]` por tu contraseña.
4. En el ordenador, copia `plataforma/.env.example` como `plataforma/.env.local` y pega ahí los tres valores.
5. **Authentication → Sign In / Providers → Email**: deja activado el correo y **desactiva "Allow new users to sign up"** (nadie se puede registrar solo).
6. **Authentication → Users → Add user → Create new user**, tres veces (Iván, Carlos, Edu), con su correo, una contraseña provisional y **"Auto Confirm User"** marcado. Cada uno la cambia luego en "Mi cuenta".

### 2. Cargar la base de datos (me lo pides a mí, o lo haces tú)
Desde `plataforma/`:
```
npm install
npm run db:migrar
npm run db:semilla
npm run db:gestor -- correo-de-ivan@... Iván
npm run db:gestor -- correo-de-carlos@... Carlos
npm run db:gestor -- correo-de-edu@... Edu
npm run db:estado
```
La semilla crea los 25 de la plantilla (24 jugadores + Carlos), un enlace para cada uno y la campaña "Ropa 2026/27" **cerrada**.

### 3. Vercel (la web)
1. Entra en https://vercel.com con tu cuenta de GitHub → **Add New… → Project** → importa `eyeshar/MACCABIS`.
2. **Root Directory: `plataforma`** (importante). Framework: Next.js (lo detecta solo).
3. **Environment Variables**: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (los mismos valores), marcadas para **Production y Preview**. **No pongas** `SUPABASE_DB_URL` ni ninguna clave secreta.
4. **Deploy**. Mientras esta rama no esté en `main`, el despliegue de producción de `main` **fallará** (en `main` aún no existe la carpeta `plataforma/`): es normal. Lo que se revisa es el **Preview** de la rama `feat/plataforma-v0` (Vercel → Deployments), con su propia URL.
5. Copia la URL de Vercel y ponla en Supabase: **Authentication → URL Configuration → Site URL** (sirve para el enlace de "He olvidado la contraseña").

### 4. Revisar antes de compartir nada
Entra en `/gestion`, abre la campaña (Estado: Abierta, fecha límite), mira "Jugadores y enlaces", abre **tu** enlace y haz un pedido de prueba. Hasta que lo apruebes, no se manda ningún enlace a nadie.

## Pruebas

```
npm run pruebas
```
Levanta en local un Postgres 17 y un PostgREST reales con estas migraciones, compila la app y la maneja con Chrome (81 comprobaciones: enlaces, RLS, pedidos, campaña cerrada, dorsal repetido, familiar, Excel celda a celda con la plantilla de `privado/`). Informe y capturas en `pruebas/resultados/` (fuera de git). El login de gestores usa un doble de Supabase Auth; todo lo demás es el motor real.

## Imágenes de las prendas
`npm run imagenes:ropa` las vuelve a extraer del PDF de VIVE de `privado/` (el PDF nunca se publica).
