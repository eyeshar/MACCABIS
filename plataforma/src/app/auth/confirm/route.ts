import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { clienteGestor } from "@/lib/supabase";

// Enlaces de invitacion y de "contrasena olvidada" de Supabase Auth.
// Plantilla de correo en Supabase: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery (o invite)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const supabase = await clienteGestor();
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(`${origin}/gestion/cuenta?nueva=1`);
  } else if (code) {
    // Plantilla de correo por defecto de Supabase (flujo PKCE): llega ?code=...
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/gestion/cuenta?nueva=1`);
  }
  return NextResponse.redirect(`${origin}/gestion/entrar`);
}
