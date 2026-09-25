import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const configurado = () => Boolean(URL && ANON);

// Cliente sin sesion para la zona del jugador: solo puede llamar a las funciones
// del enlace personal (zona_jugador, guardar_pedido...). Las tablas no le dejan.
export function clienteAnonimo() {
  return createClient(URL!, ANON!, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Cliente con la sesion del gestor (cookies). Todo lo que lee o escribe pasa por RLS.
export async function clienteGestor() {
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
