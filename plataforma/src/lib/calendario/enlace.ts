import "server-only";
import crypto from "node:crypto";
import type { clienteSesion } from "@/lib/supabase";

// Enlace secreto del calendario personal (D119, excepcion acotada a D68): /cal/<token>.ics. El token lo calcula el
// servidor (HMAC con un secreto del servidor, la persona y la version); la base solo guarda su hash. «Cambiar mi
// enlace» sube la version: el anterior deja de funcionar. El secreto: CALENDARIO_SECRETO (o, si no esta, uno derivado de
// la clave de servicio). Cambiar el secreto invalida todos los enlaces.
type Cliente = Awaited<ReturnType<typeof clienteSesion>>;

function secreto(): string | null {
  if (process.env.CALENDARIO_SECRETO) return process.env.CALENDARIO_SECRETO;
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.AVISOS_SECRETO;
  return base ? crypto.createHmac("sha256", base).update("maccabis:calendario-personal").digest("hex") : null;
}

export const calendarioConfigurado = () => Boolean(secreto());

export function tokenPara(personId: string, version: number) {
  const s = secreto();
  if (!s) throw new Error("calendario_sin_secreto");
  return crypto.createHmac("sha256", s).update(`cal:${personId}:${version}`).digest("base64url");
}

/** Su enlace (lo registra en la base si hace falta). null si el servidor no tiene secreto o no hay ficha de jugador. */
export async function miEnlace(sb: Cliente, personId: string, origen: string) {
  if (!calendarioConfigurado()) return null;
  const { data: version, error } = await sb.rpc("mi_calendario_version");
  if (error || typeof version !== "number") return null;
  const token = tokenPara(personId, version);
  const r = await sb.rpc("mi_calendario_registrar", { p_token: token, p_version: version });
  if (r.error) return null;
  const https = `${origen}/cal/${token}.ics`;
  return { https, webcal: https.replace(/^https?:/, "webcal:") };
}

/** «Cambiar mi enlace»: version nueva y su hash; el anterior deja de valer en ese momento. */
export async function nuevoEnlace(sb: Cliente, personId: string) {
  if (!calendarioConfigurado()) return false;
  const { data: version, error } = await sb.rpc("mi_calendario_regenerar");
  if (error || typeof version !== "number") return false;
  const r = await sb.rpc("mi_calendario_registrar", { p_token: tokenPara(personId, version), p_version: version });
  return !r.error;
}
