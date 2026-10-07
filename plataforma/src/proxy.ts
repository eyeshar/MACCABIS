import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Refresca la sesion (cookies de Supabase Auth) en cada pagina: desde D89 la cabecera unica lee la sesion en toda la
// web, no solo en /gestion y /mi-zona. Sin cookie de sesion no hay nada que refrescar (la portada anonima no paga nada).
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let respuesta = NextResponse.next({ request });
  if (!url || !key) return respuesta;
  if (!request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) return respuesta;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        respuesta = NextResponse.next({ request });
        lista.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return respuesta;
}

// Todas las paginas; no los ficheros estaticos, las imagenes ni los ficheros servidos (iCal, manifiesto, robots...).
export const config = {
  matcher: ["/((?!_next/static|_next/image|iconos/|ropa/|auth/|.*\\.(?:png|jpg|jpeg|webp|svg|ico|ics|js|txt|xml|webmanifest)$).*)"],
};
