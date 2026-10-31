import { NextResponse, type NextRequest } from "next/server";
import { clienteSesion } from "@/lib/supabase";
import { destinoTrasEntrar, origen } from "@/lib/sesion";
import { tipoDeEnlace } from "../tipos";

// Canje del enlace del correo (D157), solo por POST desde el boton de /auth/confirm: verifyOtp({ type, token_hash }) en el
// servidor; la sesion se fija en cookies. Sin code_verifier (no es PKCE): vale aunque el enlace se abra en otro navegador.
// 303: tras un POST el navegador sigue con GET.
export async function POST(request: NextRequest) {
  // El origen que ve el navegador (cabecera Host / x-forwarded-host), no el de request.url: detras de un proxy o en local puede ser otro.
  const base = await origen();
  const form = await request.formData();
  const token_hash = String(form.get("token_hash") ?? "");
  const type = tipoDeEnlace(String(form.get("type") ?? ""));
  if (!token_hash || !type) return NextResponse.redirect(`${base}/entrar?enlace=invalido`, 303);
  const supabase = await clienteSesion();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error) return NextResponse.redirect(`${base}/entrar?enlace=caducado`, 303);
  return NextResponse.redirect(`${base}${await destinoTrasEntrar(supabase)}`, 303);
}
