import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Refresca la sesion (cookies de Supabase Auth) en cada pagina de quien ha entrado y, desde D175, lleva «/» al inicio
// personal. Sin cookie de sesion ni siquiera se ejecuta (ver el matcher): la web publica se sirve ya hecha desde la cache
// sin pasar por ninguna funcion.
const AUTH = /^sb-.*-auth-token(?:\.\d+)?$/;

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // D117: «/» con sesion es el inicio personal, que es una pagina propia (app/inicio); sin sesion, la portada publica,
  // estatica. La direccion que se ve sigue siendo «/».
  const inicio = request.nextUrl.pathname === "/" && request.cookies.getAll().some((c) => AUTH.test(c.name));
  const nueva = () => {
    if (!inicio) return NextResponse.next({ request });
    const destino = request.nextUrl.clone();
    destino.pathname = "/inicio";
    return NextResponse.rewrite(destino, { request });
  };
  let respuesta = nueva();
  if (!url || !key) return respuesta;
  if (!request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) return respuesta;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        respuesta = nueva();
        lista.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return respuesta;
}

// Todas las paginas de quien tiene cookie de sesion; no los ficheros estaticos, las imagenes ni los ficheros servidos
// (iCal, manifiesto, robots...). El nombre de la cookie es sb-<proyecto>-auth-token (a trozos, «.0», si es grande): el
// matcher tiene que ser literal, asi que lleva el proyecto de produccion y «127» (la pila local de las pruebas).
// Si cambia el proyecto de Supabase, hay que cambiarlo aqui tambien: pruebas:cache-publica lo comprueba contra .env.local.
export const config = {
  matcher: [
    { source: "/((?!_next/static|_next/image|iconos/|ropa/|auth/|.*\\.(?:png|jpg|jpeg|webp|svg|ico|ics|js|txt|xml|webmanifest)$).*)", has: [{ type: "cookie", key: "sb-pqbjnxmknhawlkszwmln-auth-token" }] },
    { source: "/((?!_next/static|_next/image|iconos/|ropa/|auth/|.*\\.(?:png|jpg|jpeg|webp|svg|ico|ics|js|txt|xml|webmanifest)$).*)", has: [{ type: "cookie", key: "sb-pqbjnxmknhawlkszwmln-auth-token.0" }] },
    { source: "/((?!_next/static|_next/image|iconos/|ropa/|auth/|.*\\.(?:png|jpg|jpeg|webp|svg|ico|ics|js|txt|xml|webmanifest)$).*)", has: [{ type: "cookie", key: "sb-127-auth-token" }] },
    { source: "/((?!_next/static|_next/image|iconos/|ropa/|auth/|.*\\.(?:png|jpg|jpeg|webp|svg|ico|ics|js|txt|xml|webmanifest)$).*)", has: [{ type: "cookie", key: "sb-127-auth-token.0" }] },
  ],
};
