import { NextResponse, type NextRequest } from "next/server";
import { clienteSesion } from "@/lib/supabase";
import { destinoTrasEntrar } from "@/lib/sesion";

// Vuelta de "Entrar con Google" (flujo PKCE de Supabase): llega con ?code=...
// Si Google no completo el login (cancelado, o el correo no esta en la lista
// blanca y el hook "Before User Created" lo rechazo) llega con ?error=...
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await clienteSesion();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${await destinoTrasEntrar(supabase)}`);
  }
  return NextResponse.redirect(`${origin}/entrar?error_google=1`);
}
