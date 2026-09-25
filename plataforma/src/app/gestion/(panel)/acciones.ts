"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirGestor } from "@/lib/gestor";
import { finDeDiaMadrid } from "@/lib/fechas";
import { PRENDAS, TALLAS, type PrendaId } from "@/lib/ropa";
import type { DatosPedido, Resultado } from "@/components/FormularioPedido";

// Todas las acciones de gestion usan la sesion del gestor: la base de datos
// (RLS + is_gestor) es quien decide si se puede. No se usa la service role key.

// ---------- Jugadores y enlaces ----------
export async function regenerarEnlace(jugadorId: string) {
  const { supabase } = await exigirGestor();
  const { error } = await supabase.rpc("regenerar_enlace", { p_jugador: jugadorId });
  if (error) throw new Error(error.message);
  revalidatePath("/gestion/jugadores");
}

export async function anularEnlace(jugadorId: string) {
  const { supabase } = await exigirGestor();
  const { error } = await supabase.rpc("anular_enlace", { p_jugador: jugadorId });
  if (error) throw new Error(error.message);
  revalidatePath("/gestion/jugadores");
}

export async function guardarJugador(jugadorId: string, _prev: string | null, form: FormData): Promise<string | null> {
  const { supabase } = await exigirGestor();
  const telefono = String(form.get("telefono") ?? "").trim();
  if (telefono && !/^\+?[0-9 ]{9,16}$/.test(telefono)) return "El teléfono solo puede llevar números, espacios y un + delante.";
  const nombre = String(form.get("nombre_visible") ?? "").trim();
  if (!nombre) return "El nombre visible no puede quedar vacío.";
  const { error } = await supabase.from("jugadores").update({
    nombre_visible: nombre,
    telefono: telefono || null,
    entrena: form.get("entrena") === "on",
    ficha_mda: form.get("ficha_mda") === "on",
    ficha_mdl: form.get("ficha_mdl") === "on",
    activo: form.get("activo") === "on",
    rol: String(form.get("rol") ?? "jugador"),
  }).eq("id", jugadorId);
  if (error) return `No se pudo guardar: ${error.message}`;
  revalidatePath("/gestion/jugadores");
  return "Guardado.";
}

// ---------- Campanas ----------
export async function guardarCampana(campanaId: string, _prev: string | null, form: FormData): Promise<string | null> {
  const { supabase } = await exigirGestor();
  const fecha = String(form.get("fecha_limite") ?? "");
  const precios: Partial<Record<PrendaId, number>> = {};
  for (const p of PRENDAS) {
    const v = String(form.get(`precio_${p.id}`) ?? "").replace(",", ".").trim();
    if (v) {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) return `Precio no válido en ${p.nombre.toLowerCase()}.`;
      precios[p.id] = n;
    }
  }
  const { error } = await supabase.from("campanas_ropa").update({
    nombre: String(form.get("nombre") ?? "").trim() || "Pedido de ropa",
    estado: form.get("estado") === "abierta" ? "abierta" : "cerrada",
    fecha_limite: fecha ? finDeDiaMadrid(fecha) : null,
    precios,
  }).eq("id", campanaId);
  if (error) return `No se pudo guardar: ${error.message}`;
  revalidatePath("/gestion/ropa");
  return "Campaña guardada.";
}

export async function crearCampana(form: FormData) {
  const { supabase } = await exigirGestor();
  const nombre = String(form.get("nombre") ?? "").trim() || "Pedido de ropa";
  const { data, error } = await supabase.from("campanas_ropa")
    .insert({ nombre, estado: "cerrada", guia_tallas_url: "/guia-tallas" }).select("id").single();
  if (error) throw new Error(error.message);
  redirect(`/gestion/ropa?c=${data.id}`);
}

// ---------- Pedidos (los gestores pueden anadir, editar y borrar) ----------
export async function guardarPedidoGestor(datos: DatosPedido): Promise<Resultado> {
  const { supabase, user } = await exigirGestor();
  const tallas = datos.tallas ?? {};
  const marcadas = PRENDAS.filter((p) => p.id in tallas);
  if (!datos.jugador_id) return { ok: false, error: "Elige de qué jugador es el pedido." };
  if (!marcadas.length) return { ok: false, error: "sin_prendas" };
  for (const p of marcadas) {
    const t = tallas[p.id];
    if (!t) return { ok: false, error: "falta_talla" };
    if (!(TALLAS as readonly string[]).includes(t)) return { ok: false, error: "talla_invalida" };
  }
  const conNombre = marcadas.some((p) => p.llevaNombre);
  const conDorsal = marcadas.some((p) => p.llevaDorsal);
  const dorsal = conDorsal ? Number(datos.dorsal) : null;
  if (conDorsal && (!/^\d{1,2}$/.test(datos.dorsal))) return { ok: false, error: "dorsal_invalido" };
  const nombreRopa = conNombre ? datos.nombre_ropa.trim().toUpperCase() : null;
  if (conNombre && (!nombreRopa || nombreRopa.length > 15)) return { ok: false, error: "falta_nombre_ropa" };
  if (datos.nombre_completo.trim().length < 3) return { ok: false, error: "falta_nombre_completo" };

  const fila = {
    campana_id: datos.campana_id,
    jugador_id: datos.jugador_id,
    para: datos.para,
    nombre_completo: datos.nombre_completo.trim(),
    nombre_ropa: nombreRopa,
    dorsal,
    talla_camiseta: tallas.camiseta ?? null,
    talla_pantalon: tallas.pantalon ?? null,
    talla_cubre: tallas.cubre ?? null,
    talla_sudadera: tallas.sudadera ?? null,
    actualizado_por: `gestor:${user.id}`,
  };
  const { error } = datos.id
    ? await supabase.from("pedidos_ropa").update(fila).eq("id", datos.id)
    : await supabase.from("pedidos_ropa").insert({ ...fila, creado_por_gestor: true });
  if (error) return { ok: false, error: `No se pudo guardar: ${error.message}` };
  revalidatePath("/gestion/ropa");
  return { ok: true };
}

export async function comprobarDorsalGestor(campana: string, dorsal: number, pedido: string | null): Promise<boolean> {
  const { supabase } = await exigirGestor();
  let q = supabase.from("pedidos_ropa").select("id, talla_camiseta, talla_pantalon, talla_cubre").eq("campana_id", campana).eq("dorsal", dorsal).eq("para", "yo");
  if (pedido) q = q.neq("id", pedido);
  const { data } = await q;
  return (data ?? []).some((p) => p.talla_camiseta || p.talla_pantalon || p.talla_cubre);
}

export async function borrarPedidoGestor(pedidoId: string) {
  const { supabase } = await exigirGestor();
  const { error } = await supabase.from("pedidos_ropa").delete().eq("id", pedidoId);
  if (error) throw new Error(error.message);
  revalidatePath("/gestion/ropa");
}

// ---------- Cuenta ----------
export async function cambiarContrasena(_prev: string | null, form: FormData): Promise<string | null> {
  const { supabase } = await exigirGestor();
  const a = String(form.get("nueva") ?? "");
  const b = String(form.get("repetir") ?? "");
  if (a.length < 10) return "La contraseña tiene que tener al menos 10 caracteres.";
  if (a !== b) return "Las dos contraseñas no coinciden.";
  const { error } = await supabase.auth.updateUser({ password: a });
  if (error) return `No se pudo cambiar: ${error.message}`;
  return "Contraseña cambiada.";
}
