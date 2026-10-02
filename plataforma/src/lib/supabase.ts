import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const configurado = () => Boolean(URL && ANON);

// Cliente con la sesion de quien ha entrado (jugador o gestor, por cookies).
// Sin sesion, anon no tiene ningun permiso (D68): todo pasa por aqui.
export async function clienteSesion() {
  const almacen = await cookies();
  return createServerClient(URL!, ANON!, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => almacen.set(name, value, options));
        } catch {
          // Desde un Server Component no se pueden escribir cookies; el proxy las refresca.
        }
      },
    },
  });
}
