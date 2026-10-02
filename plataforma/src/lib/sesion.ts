import "server-only";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { clienteSesion, configurado } from "./supabase";

// Exige cualquier sesion (jugador o gestor). Redirige a /entrar si no hay.
export async function exigirSesion() {
  if (!configurado()) redirect("/");
  const supabase = await clienteSesion();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");
  return { supabase, user };
}

// Exige sesion de GESTOR. Un jugador sin permisos de gestion va a su zona.
export async function exigirGestor() {
  const { supabase, user } = await exigirSesion();
  const { data: esGestor } = await supabase.rpc("is_gestor");
  if (!esGestor) redirect("/mi-zona?no_gestor=1");
  const { data: g } = await supabase.from("gestores").select("nombre").eq("user_id", user.id).maybeSingle();
  return { supabase, user, nombre: (g?.nombre as string | undefined) ?? user.email ?? "gestor" };
}

// A donde va cada cual tras entrar: jugador -> su zona, gestor -> gestion,
// las dos cosas -> que elija, ninguna (no deberia pasar: lista blanca) -> aviso.
export async function destinoTrasEntrar(supabase: Awaited<ReturnType<typeof clienteSesion>>) {
  const [{ data: esGestor }, { data: zona }] = await Promise.all([
    supabase.rpc("is_gestor"),
    supabase.rpc("mi_zona"),
  ]);
  const esJugador = Boolean(zona);
  if (esGestor && esJugador) return "/entrar/elegir";
  if (esGestor) return "/gestion";
  if (esJugador) return "/mi-zona";
  return "/entrar?sin_zona=1";
}

// Origen publico de la web (para construir enlaces y mensajes).
export async function origen() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
