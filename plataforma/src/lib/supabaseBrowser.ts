"use client";

import { createBrowserClient } from "@supabase/ssr";

// Solo para "Entrar con Google": el redirect a Google lo hace el navegador.
// Todo lo demas (OTP, datos, pedidos) va por acciones de servidor.
export function clienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
