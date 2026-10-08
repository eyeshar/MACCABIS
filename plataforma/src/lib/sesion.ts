import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { URL_PRODUCCION } from "./indexacion";
import { clienteSesion, configurado } from "./supabase";

// Sesion de la peticion (una sola llamada a Auth aunque la pidan la cabecera, el layout y la pagina). Sin configurar o
// sin sesion: user null.
export const sesionActual = cache(async () => {
  if (!configurado()) return { supabase: null, user: null };
  const supabase = await clienteSesion();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
});

/** is_gestor() de la sesion actual, una vez por peticion. */
export const esGestorActual = cache(async () => {
  const { supabase, user } = await sesionActual();
  if (!supabase || !user) return false;
  const { data } = await supabase.rpc("is_gestor");
  return Boolean(data);
});

// Exige cualquier sesion (jugador o gestor). Redirige a /entrar si no hay.
export async function exigirSesion() {
  if (!configurado()) redirect("/");
  const { supabase, user } = await sesionActual();
  if (!supabase || !user) redirect("/entrar");
  return { supabase, user };
}

// Exige sesion de GESTOR. Un jugador sin permisos de gestion va a su zona.
export async function exigirGestor() {
  const { supabase, user } = await exigirSesion();
  if (!(await esGestorActual())) redirect("/mi-zona?no_gestor=1");
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

/** Direccion que llevan los enlaces de los mensajes de WhatsApp (D105): SIEMPRE la de produccion, aunque el gestor
 *  este mirando una vista previa de Vercel o su ordenador (la plantilla no debe recibir un enlace que caduca). */
export const origenMensajes = async () => URL_PRODUCCION;

// Origen publico de la web de ESTA ejecucion (enlaces propios de la pantalla, no mensajes).
export async function origen() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
