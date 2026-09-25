import "server-only";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { clienteGestor, configurado } from "./supabase";

// Exige sesion de gestor. Devuelve el cliente con su sesion (todo pasa por RLS).
export async function exigirGestor() {
  if (!configurado()) redirect("/");
  const supabase = await clienteGestor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/gestion/entrar");
  const { data: esGestor } = await supabase.rpc("is_gestor");
  if (!esGestor) redirect("/gestion/entrar?sin_permiso=1");
  const { data: g } = await supabase.from("gestores").select("nombre").eq("user_id", user.id).maybeSingle();
  return { supabase, user, nombre: (g?.nombre as string | undefined) ?? user.email ?? "gestor" };
}

// Origen publico de la web (para construir los enlaces personales que se envian).
export async function origen() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
