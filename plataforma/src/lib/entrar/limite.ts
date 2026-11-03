import "server-only";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Límite de intentos del código de Entrar (revisión de seguridad, 03/11/2026; migración 20261103200000): 5 fallos por
// correo en 15 min y 20 en 24 h. El límite de Supabase es por IP y ve la de Vercel, no la de quien prueba. Con la clave de
// servicio y un HMAC del correo (nunca el correo). Si algo falla (sin clave, sin la migración, base caída), DEJA PASAR:
// el límite nunca puede impedir entrar a nadie por un error nuestro; queda el de Supabase.

const servicio = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && clave ? { sb: createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } }), clave } : null;
};

/** El límite para un correo, o null si el servidor no tiene la clave de servicio. */
export function limiteCodigo(email: string) {
  const s = servicio();
  if (!s) return null;
  const p_clave = createHmac("sha256", s.clave).update(`maccabis:codigo:${email.trim().toLowerCase()}`).digest("hex");
  return {
    async permitido(): Promise<boolean> {
      const { data, error } = await s.sb.rpc("codigo_permitido", { p_clave });
      return error ? true : data !== false;
    },
    async apuntar(ok: boolean) {
      await s.sb.rpc("codigo_resultado", { p_clave, p_ok: ok });
    },
  };
}
