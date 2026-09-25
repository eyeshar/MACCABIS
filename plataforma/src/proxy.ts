import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Refresca la sesion de los gestores (cookies de Supabase Auth) en cada peticion a /gestion.
// La zona de jugadores (/j/...) no usa sesion: no pasa por aqui.
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let respuesta = NextResponse.next({ request });
  if (!url || !key) return respuesta;
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

export const config = { matcher: ["/gestion/:path*"] };
