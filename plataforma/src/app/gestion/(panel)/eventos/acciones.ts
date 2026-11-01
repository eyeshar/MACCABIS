"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { exigirGestor } from "@/lib/sesion";
import { hoyMadrid } from "@/lib/dias";
import { cargarEvento, cargarEventos, cargarPistas, TEMPORADA } from "@/lib/eventos/datos";
import {
  describirCambios, deLaSerieDesde, fechaDMA, hhmm, pistaEfectiva, quedadaPorDefecto, sumarDias,
  type CamposEditables, type EquipoEvento, type EstadoPista, type EventoFila, type Pista, type TipoEvento,
} from "@/lib/eventos/dominio";
import { avisarCambioEvento, configuradoEnvio, ejecutarTarea } from "@/lib/avisos/servidor";
import { leerEnlaceGoogle } from "@/lib/ubicacion";
import { compararCalendario, leerCalendario, leerFecha, normalizar, type CambioCalendario, type Senal } from "@/lib/eventos/importador";

// Todas las acciones usan la sesion del gestor: la base (RLS + is_gestor) decide si se puede. Nadie borra: un evento se
// CANCELA (D94). El mensaje de WhatsApp de la ficha del evento sale de sus propios datos (estado y `cambio_visible`).

export type Estado = { error?: string } | null;
const TIPOS: TipoEvento[] = ["entreno", "liga", "amistoso", "torneo", "interno", "quedada", "pachanga", "otro"];
const num = (v: string) => { const n = v === "" ? NaN : Number(v.replace(",", ".")); return Number.isFinite(n) ? n : null; };
const EQUIPOS: EquipoEvento[] = ["MdA", "MdL", "ambos"];
const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const hora = (v: string) => (/^\d{1,2}:\d{2}$/.test(v) ? v.padStart(5, "0") : null);
const refrescar = () => { revalidatePath("/gestion/eventos"); revalidatePath("/gestion"); revalidatePath("/"); revalidatePath("/calendario.ics"); revalidateTag("calendario", "max"); };

type Campos = CamposEditables;

/** Solo se avisa al movil de los eventos de las proximas dos semanas (en una serie, no se avisa de todo el curso). */
const AVISAR_DIAS = 14;

/** Que cambio de lo que avisa (fecha, hora, pista, encuentro) y como era antes, para la linea amarilla del evento. */
function cambioVisible(a: Campos, d: Campos, pistas: Pista[]) {
  const campos: string[] = [], antes: string[] = [];
  if (a.fecha !== d.fecha) { campos.push("fecha"); antes.push(fechaDMA(a.fecha).slice(0, 5)); }
  const ha = `${hhmm(a.inicio) ?? "sin hora"}${a.fin ? `–${hhmm(a.fin)}` : ""}`, hd = `${hhmm(d.inicio) ?? "sin hora"}${d.fin ? `–${hhmm(d.fin)}` : ""}`;
  if (ha !== hd) { campos.push("hora"); antes.push(ha); }
  const pa = pistaEfectiva(a, pistas).texto, pd = pistaEfectiva(d, pistas).texto;
  if (pa !== pd) { campos.unshift("pista"); antes.unshift(pa); }
  if (!campos.includes("hora") && hhmm(a.quedada) !== hhmm(d.quedada)) { campos.push("encuentro"); antes.push(`encuentro ${hhmm(a.quedada) ?? "—"}`); }
  return campos.length ? { campos, antes: antes.join(", ") } : null;
}

/** Lee el formulario de un evento. `base` = el evento actual (si se edita); un partido del Ayuntamiento solo cambia
 *  quedada y notas. */
function leerFormulario(f: FormData, base: EventoFila | null): { campos?: Campos; error?: string } {
  const delAyuntamiento = base?.tipo === "liga" && base.origen === "ayuntamiento";
  const tipo = (delAyuntamiento ? base!.tipo : texto(f, "tipo")) as TipoEvento;
  if (!TIPOS.includes(tipo)) return { error: "Elige el tipo de evento." };
  const equipo = (delAyuntamiento ? base!.equipo : texto(f, "equipo") || "ambos") as EquipoEvento;
  if (!EQUIPOS.includes(equipo)) return { error: "Elige para quién es el evento." };
  const fecha = delAyuntamiento ? base!.fecha : leerFecha(texto(f, "fecha"));
  if (!fecha) return { error: "Pon una fecha válida." };
  const inicio = delAyuntamiento ? hhmm(base!.inicio) : hora(texto(f, "inicio"));
  const fin = delAyuntamiento ? hhmm(base!.fin) : hora(texto(f, "fin"));
  if (!delAyuntamiento && texto(f, "inicio") && !inicio) return { error: "La hora de inicio debe ser tipo 20:30." };
  if (!delAyuntamiento && texto(f, "fin") && !fin) return { error: "La hora de fin debe ser tipo 22:30." };
  if (inicio && fin && fin <= inicio) return { error: "El evento debe terminar después de empezar." };
  const quedadaTxt = texto(f, "quedada");
  if (quedadaTxt && !hora(quedadaTxt)) return { error: "La quedada debe ser una hora tipo 20:10 (vacía = 20 minutos antes)." };
  const quedada = quedadaTxt ? hora(quedadaTxt) : quedadaPorDefecto(inicio);
  const pista_id = delAyuntamiento ? base!.pista_id : texto(f, "pista") || null;
  const numero = Number(texto(f, "numero_pista"));
  const numero_pista = delAyuntamiento ? base!.numero_pista : pista_id && Number.isInteger(numero) && numero > 0 ? numero : null;
  const rival = delAyuntamiento ? base!.rival : texto(f, "rival") || null;
  const local = texto(f, "local");
  const es_local = delAyuntamiento ? base!.es_local : local === "local" ? true : local === "visitante" ? false : null;
  const jornadaN = Number(texto(f, "jornada"));
  const jornada = delAyuntamiento ? base!.jornada : Number.isInteger(jornadaN) && jornadaN > 0 ? jornadaN : null;
  const titulo = delAyuntamiento ? base!.titulo : texto(f, "titulo") || null;
  if (tipo === "liga" && !delAyuntamiento && !rival) return { error: "Un partido de liga necesita rival." };
  if (tipo !== "liga" && tipo !== "entreno" && !titulo && !rival) return { error: "Ponle un título o un rival." };
  // D119: sin pista del catalogo, un sitio libre (buscador de OpenStreetMap o enlace de Google Maps).
  const libre = !pista_id && !delAyuntamiento;
  const ubicacion = libre ? {
    ubicacion_nombre: texto(f, "ubicacion_nombre").slice(0, 120) || null, ubicacion_direccion: texto(f, "ubicacion_direccion").slice(0, 240) || null,
    ubicacion_lat: num(texto(f, "ubicacion_lat")), ubicacion_lng: num(texto(f, "ubicacion_lng")), ubicacion_enlace: texto(f, "ubicacion_enlace").slice(0, 500) || null,
  } : delAyuntamiento ? {
    ubicacion_nombre: base!.ubicacion_nombre ?? null, ubicacion_direccion: base!.ubicacion_direccion ?? null, ubicacion_lat: base!.ubicacion_lat ?? null,
    ubicacion_lng: base!.ubicacion_lng ?? null, ubicacion_enlace: base!.ubicacion_enlace ?? null,
  } : { ubicacion_nombre: null, ubicacion_direccion: null, ubicacion_lat: null, ubicacion_lng: null, ubicacion_enlace: null };
  if (ubicacion.ubicacion_enlace && !/^https:\/\//.test(ubicacion.ubicacion_enlace)) return { error: "El enlace del sitio debe empezar por https://." };
  return { campos: { tipo, equipo, titulo, jornada, rival, es_local, fecha, inicio, fin, quedada, pista_id, numero_pista, notas: texto(f, "notas") || null, estado: base?.estado ?? "programado", ...ubicacion } };
}

const aFila = (c: Campos) => ({
  tipo: c.tipo, equipo: c.equipo, titulo: c.titulo, jornada: c.jornada, rival: c.rival, es_local: c.es_local, fecha: c.fecha,
  inicio: c.inicio, fin: c.fin, quedada: c.quedada, pista_id: c.pista_id, numero_pista: c.numero_pista, notas: c.notas, estado: c.estado,
  ubicacion_nombre: c.ubicacion_nombre ?? null, ubicacion_direccion: c.ubicacion_direccion ?? null, ubicacion_lat: c.ubicacion_lat ?? null,
  ubicacion_lng: c.ubicacion_lng ?? null, ubicacion_enlace: c.ubicacion_enlace ?? null,
});
const editables = (e: EventoFila): Campos => ({
  tipo: e.tipo, equipo: e.equipo, titulo: e.titulo, jornada: e.jornada, rival: e.rival, es_local: e.es_local, fecha: e.fecha, inicio: hhmm(e.inicio), fin: hhmm(e.fin), quedada: hhmm(e.quedada), pista_id: e.pista_id, numero_pista: e.numero_pista, notas: e.notas, estado: e.estado,
  ubicacion_nombre: e.ubicacion_nombre ?? null, ubicacion_direccion: e.ubicacion_direccion ?? null, ubicacion_lat: e.ubicacion_lat ?? null, ubicacion_lng: e.ubicacion_lng ?? null, ubicacion_enlace: e.ubicacion_enlace ?? null,
});

// ---------------------------------------------------------------- crear
export async function crearEvento(_prev: Estado, f: FormData): Promise<Estado> {
  const { supabase } = await exigirGestor();
  const r = leerFormulario(f, null);
  if (!r.campos) return { error: r.error };
  const { data, error } = await supabase.from("eventos").insert({
    ...aFila(r.campos), clave: `m-${crypto.randomUUID()}`, temporada: TEMPORADA, origen: "manual",
  }).select("id").single();
  if (error) return { error: `No se pudo crear: ${error.message}` };
  if (f.get("sin_recordatorios") === "on") await supabase.from("eventos").update({ sin_recordatorios: true }).eq("id", data.id);
  // Amistoso, torneo o «entre nosotros»: el recordatorio «al crearlo» sale ya (si toca; la tarea lo repite sin duplicar).
  else if (configuradoEnvio()) { try { await ejecutarTarea(new Date()); } catch { /* lo recoge la tarea de cada 15 min */ } }
  refrescar();
  redirect(`/gestion/eventos/${data.id}?guardado=nuevo`);
}

// ---------------------------------------------------------------- guardar (solo este / este y los siguientes)
export async function guardarEvento(id: string, _prev: Estado, f: FormData): Promise<Estado> {
  const { supabase } = await exigirGestor();
  const [antes, pistas, todos] = await Promise.all([cargarEvento(supabase, id), cargarPistas(supabase), cargarEventos(supabase)]);
  if (!antes) return { error: "Ese evento ya no existe." };
  const r = leerFormulario(f, antes);
  if (!r.campos) return { error: r.error };
  const nuevo = r.campos, viejo = editables(antes);
  const alcance = texto(f, "alcance") === "siguientes" && antes.serie ? "siguientes" : "este";
  const diff = describirCambios(viejo, nuevo, pistas);
  // «Sin recordatorios para este evento» (D99.6): no es un cambio del evento ni avisa a nadie.
  const sinRec = f.get("sin_recordatorios") === "on";
  if (sinRec !== Boolean(antes.sin_recordatorios)) {
    const { error } = await supabase.from("eventos").update({ sin_recordatorios: sinRec }).eq("id", id);
    if (error) return { error: `No se pudo guardar: ${error.message}` };
    if (!diff.length) { refrescar(); redirect(`/gestion/eventos/${id}?guardado=recordatorios`); }
  }
  if (!diff.length) redirect(`/gestion/eventos/${id}?guardado=nada`);
  const avisar = texto(f, "avisar") === "1";
  const avisados: { id: string; cambiaDia: boolean }[] = [];

  // Solo este: se guarda todo. Este y los siguientes: solo lo que ha cambiado en el formulario (menos la fecha), para no
  // pisar las excepciones de cada miercoles (por ejemplo, el del 07/10 a las 20:00 en la Caja Magica).
  const CAMPOS_SERIE: (keyof Campos)[] = ["inicio", "fin", "quedada", "pista_id", "numero_pista", "notas", "titulo", "equipo"];
  const objetivos = alcance === "siguientes" ? deLaSerieDesde(todos, antes) : [antes];
  for (const o of objetivos) {
    const actual = editables(o);
    const aplicar: Campos = alcance === "este" ? { ...nuevo, estado: o.estado } : { ...actual };
    if (alcance === "siguientes") {
      for (const k of CAMPOS_SERIE) if (nuevo[k] !== viejo[k]) (aplicar as Record<string, unknown>)[k] = nuevo[k];
      // Si cambia la hora de inicio y no se toco la quedada, la quedada acompaña (20 minutos antes).
      if (nuevo.inicio !== viejo.inicio && nuevo.quedada === viejo.quedada) aplicar.quedada = quedadaPorDefecto(aplicar.inicio);
    }
    if (!describirCambios(actual, aplicar, pistas).length) continue;
    // «Guardar y avisar» (D99.9): la linea amarilla del evento dice que cambio y como era antes.
    const visible = avisar ? cambioVisible(actual, aplicar, pistas) : null;
    const { error } = await supabase.from("eventos").update({
      ...aFila(aplicar),
      ...(visible ? { cambio_visible: visible, cambio_visible_en: new Date().toISOString() } : {}),
    }).eq("id", o.id);
    if (error) return { error: `No se pudo guardar: ${error.message}` };
    if (visible && o.fecha <= sumarDias(hoyMadrid(), AVISAR_DIAS)) avisados.push({ id: o.id, cambiaDia: actual.fecha !== aplicar.fecha });
  }
  let n = 0;
  let sale: Date | null = null;
  for (const a of avisados) {
    const r = await avisarCambioEvento(a.id, "cambio", a.cambiaDia);
    n += r.avisados;
    if (r.avisados && "programado" in r && r.programado && r.programado > new Date()) sale = r.programado;
  }
  refrescar();
  // `sale`: solo si el aviso espera a que acabe la franja de noche (22:30-08:00, D155); si no, ha salido ya.
  redirect(`/gestion/eventos/${id}?guardado=${alcance === "siguientes" ? `serie-${objetivos.length}` : "cambio"}${avisar ? `&avisados=${n}${sale ? `&sale=${sale.toISOString()}` : ""}` : ""}`);
}

// ---------------------------------------------------------------- cancelar y restablecer
export async function cancelarEvento(id: string, alcance: "este" | "siguientes", restablecer: boolean) {
  const { supabase } = await exigirGestor();
  const [antes, todos] = await Promise.all([cargarEvento(supabase, id), cargarEventos(supabase)]);
  if (!antes) throw new Error("Ese evento ya no existe.");
  const objetivos = alcance === "siguientes" && antes.serie
    ? todos.filter((e) => e.serie === antes.serie && e.fecha >= antes.fecha && e.estado === (restablecer ? "cancelado" : "programado"))
    : [antes];
  for (const o of objetivos) {
    const { error } = await supabase.from("eventos").update({ estado: restablecer ? "programado" : "cancelado" }).eq("id", o.id);
    if (error) throw new Error(error.message);
  }
  // Cancelar avisa a los invitados (D99.9) con «respuestas en la web» encendido. En una serie, solo los de las dos
  // proximas semanas.
  if (!restablecer) {
    const limite = sumarDias(hoyMadrid(), AVISAR_DIAS);
    for (const o of objetivos) if (o.fecha >= hoyMadrid() && o.fecha <= limite) await avisarCambioEvento(o.id, "cancelacion", false);
  }
  refrescar();
  redirect(`/gestion/eventos/${id}?guardado=${restablecer ? "restablecido" : "cancelado"}${objetivos.length > 1 ? `-${objetivos.length}` : ""}`);
}

// ---------------------------------------------------------------- pistas
/** «40.3975, -3.6316» (o un enlace de Google Maps con coordenadas) -> lat y lng. Vacio = sin coordenadas. */
function coordenadas(f: FormData): { lat: number | null; lng: number | null } | { error: string } {
  const t = texto(f, "coordenadas");
  if (!t) return { lat: null, lng: null };
  const g = leerEnlaceGoogle(t);
  if (g?.lat != null) return { lat: g.lat, lng: g.lng };
  const m = /^\s*(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*$/.exec(t);
  const lat = m ? Number(m[1].replace(",", ".")) : NaN, lng = m ? Number(m[2].replace(",", ".")) : NaN;
  if (!m || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { error: "Las coordenadas van como «40.3975, -3.6316» (latitud, longitud)." };
  return { lat, lng };
}

export async function crearPista(_prev: Estado, f: FormData): Promise<Estado> {
  const { supabase } = await exigirGestor();
  const nombre = texto(f, "nombre");
  if (nombre.length < 3) return { error: "Ponle un nombre a la pista." };
  const c = coordenadas(f);
  if ("error" in c) return { error: c.error };
  const uso = texto(f, "uso") === "partido" ? "partido" : "entreno";
  const estado = (["habitual", "provisional", "en_obras", "cerrada"] as EstadoPista[]).find((x) => x === texto(f, "estado")) ?? "provisional";
  const n = Number(texto(f, "num_pistas"));
  const slug = normalizar(nombre).replace(/\s+/g, "-").slice(0, 40) || `pista-${Date.now()}`;
  const { error } = await supabase.from("pistas").insert({
    slug, nombre, nombre_corto: texto(f, "nombre_corto") || null, direccion: texto(f, "direccion") || null, uso, estado,
    num_pistas: Number.isInteger(n) && n > 0 ? n : null, lat: c.lat, lng: c.lng,
  });
  if (error) return { error: error.code === "23505" ? "Ya hay una pista con ese nombre." : `No se pudo crear: ${error.message}` };
  revalidatePath("/gestion/eventos/pistas"); refrescar();
  const volver = texto(f, "volver");
  redirect(volver.startsWith("/gestion/eventos") ? volver : "/gestion/eventos/pistas?creada=1");
}

/** Cambia el estado o la direccion de una pista. Si es la de la serie y cambia su estado (en obras ↔ habitual), los
 *  entrenos futuros sin pista propia cambian de «Pista por confirmar» a ella (o al reves): lo calcula `pistaEfectiva`. */
export async function cambiarPista(id: string, _prev: Estado, f: FormData): Promise<Estado> {
  const { supabase } = await exigirGestor();
  const pistas = await cargarPistas(supabase);
  const antes = pistas.find((p) => p.id === id);
  if (!antes) return { error: "Esa pista ya no existe." };
  const pedido = f.get("reabrir") ? "habitual" : f.get("cerrar_obras") ? "en_obras" : texto(f, "estado");
  const estado = (["habitual", "provisional", "en_obras", "cerrada"] as EstadoPista[]).find((x) => x === pedido) ?? antes.estado;
  const n = Number(texto(f, "num_pistas"));
  const nombre = texto(f, "nombre") || antes.nombre;
  if (nombre.length < 3) return { error: "Ponle un nombre a la pista." };
  const uso = f.get("uso") ? (texto(f, "uso") === "partido" ? "partido" : "entreno") : antes.uso;
  const c = f.has("coordenadas") ? coordenadas(f) : { lat: antes.lat ?? null, lng: antes.lng ?? null };
  if ("error" in c) return { error: c.error };
  // D148: «solo jugadores con ficha»; un formulario sin ese campo no lo cambia.
  const solo = f.has("solo_con_ficha_campo") ? { solo_con_ficha: uso === "entreno" && f.get("solo_con_ficha") === "on" } : {};
  // D148: nada retroactivo. Las fechas «desde» (vacías: siempre); un formulario sin el campo no la cambia. La de la serie,
  // al pasar a habitual sin fecha, toma la de hoy: los entrenos pasados sin pista propia no heredan la pista.
  const fecha = (k: string) => (/^d{4}-d{2}-d{2}$/.test(texto(f, k)) ? texto(f, k) : null);
  const fichaDesde = f.has("solo_con_ficha_desde") ? { solo_con_ficha_desde: fecha("solo_con_ficha_desde") } : {};
  const reabre = antes.es_de_serie && estado === "habitual" && antes.estado !== "habitual";
  const habitualDesde = f.has("habitual_desde") || reabre ? { habitual_desde: fecha("habitual_desde") ?? (reabre ? hoyMadrid() : null) } : {};
  const cambios = { nombre, uso, estado, direccion: texto(f, "direccion") || null, num_pistas: Number.isInteger(n) && n > 0 ? n : null, nota: texto(f, "nota") || null, lat: c.lat, lng: c.lng, ...solo, ...fichaDesde, ...habitualDesde };
  const { error } = await supabase.from("pistas").update(cambios).eq("id", id);
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath("/gestion/eventos/pistas"); refrescar();
  return null;
}

// ---------------------------------------------------------------- importar: calendario del Ayuntamiento
export type ResultadoCalendario = {
  lineas: number; nuestras: number; ajenas: number; iguales: number;
  errores: { n: number; crudo: string; error: string }[];
  cambios: CambioCalendario[]; senales: Senal[];
  aplicado?: {
    aceptadas: number; ignoradas: number; cambiosEn: string[]; avisados?: number | null;
    /** Si el aviso espera a la franja de noche (22:30-08:00, D155): cuando sale (ISO). Sin esto, ha salido ya. */
    sale?: string | null;
    /** Partidos cambiados de los que no sale aviso (ya jugados) o por que no sale ninguno (avisos sin configurar). */
    sinAviso?: string[];
  };
};

async function compararConLaBase(textoPegado: string) {
  const { supabase, nombre, user } = await exigirGestor();
  const [eventos, { data: descansos }] = await Promise.all([cargarEventos(supabase), supabase.from("descansos").select("equipo, jornada, fecha").eq("temporada", TEMPORADA)]);
  const lineas = leerCalendario(textoPegado);
  const comp = compararCalendario(lineas, eventos, (descansos ?? []) as { equipo: "MdA" | "MdL"; jornada: number; fecha: string | null }[]);
  return { supabase, nombre, user, eventos, lineas, comp };
}
const aResultado = (c: Awaited<ReturnType<typeof compararConLaBase>>["comp"]): ResultadoCalendario => ({
  lineas: c.lineas, nuestras: c.nuestras, ajenas: c.ajenas, iguales: c.iguales,
  errores: c.errores.map((e) => ({ n: e.n, crudo: e.crudo, error: e.error })), cambios: c.cambios, senales: c.senales,
});

/** Solo compara y ensena: no escribe nada. */
export async function analizarCalendario(textoPegado: string): Promise<ResultadoCalendario> {
  const { comp } = await compararConLaBase(textoPegado);
  return aResultado(comp);
}

/** Aplica SOLO los cambios aceptados (por su id) y registra la importacion. «Aplicar y avisar» (D103, D155) avisa de
 *  cada partido cambiado que no se ha jugado, sea cuando sea (no solo los de las dos proximas semanas: cada linea es un
 *  partido concreto, no una serie), con la franja de noche. */
export async function aplicarCalendario(textoPegado: string, aceptados: string[], avisar = false): Promise<ResultadoCalendario> {
  const { supabase, nombre, user, eventos, comp } = await compararConLaBase(textoPegado);
  const elegidos = comp.cambios.filter((c) => aceptados.includes(c.id));
  const porEvento = new Map<string, CambioCalendario[]>();
  for (const c of elegidos) porEvento.set(c.eventoId, [...(porEvento.get(c.eventoId) ?? []), c]);
  const aplicadosEn: string[] = [];
  const porAvisar: { id: string; cambiaDia: boolean }[] = [];
  const sinAviso: string[] = [];
  let avisados = 0;
  let sale: Date | null = null;
  for (const [eventoId, cs] of porEvento) {
    const e = eventos.find((x) => x.id === eventoId);
    if (!e) continue;
    const cambio: Record<string, unknown> = {};
    for (const c of cs) {
      if (c.campo === "fecha") cambio.fecha = c.valorOficial;
      if (c.campo === "hora") { cambio.inicio = c.valorOficial; cambio.quedada = quedadaPorDefecto(c.valorOficial as string | null); }
      if (c.campo === "pista") cambio.numero_pista = c.valorOficial;
      if (c.campo === "local") cambio.es_local = c.valorOficial;
      if (c.campo === "rival") cambio.rival = c.valorOficial;
    }
    // «Aplicar y avisar» (D103): como en Editar evento, la linea amarilla dice que cambio y como era antes.
    const avisables = cs.filter((c) => c.campo === "fecha" || c.campo === "hora" || c.campo === "pista");
    const ORDEN_CAMPO = { pista: 0, fecha: 1, hora: 2 } as Record<string, number>;
    const visible = avisar && avisables.length ? {
      campos: avisables.map((c) => c.campo).sort((a, b) => ORDEN_CAMPO[a] - ORDEN_CAMPO[b]),
      antes: avisables.sort((a, b) => ORDEN_CAMPO[a.campo] - ORDEN_CAMPO[b.campo]).map((c) => (c.campo === "pista" ? `pista ${c.actual}` : String(c.actual))).join(", "),
    } : null;
    const { error } = await supabase.from("eventos").update({
      ...cambio,
      ...(visible ? { cambio_visible: visible, cambio_visible_en: new Date().toISOString() } : {}),
    }).eq("id", eventoId);
    if (error) throw new Error(`No se pudo aplicar ${e.clave}: ${error.message}`);
    aplicadosEn.push(`${e.equipo} J${e.jornada}`);
    const fechaNueva = (cambio.fecha as string | undefined) ?? e.fecha;
    if (visible && fechaNueva >= hoyMadrid()) porAvisar.push({ id: eventoId, cambiaDia: "fecha" in cambio });
    else if (visible) sinAviso.push(`${e.equipo} J${e.jornada} (ya jugado)`);
  }
  for (const a of porAvisar) {
    const r = await avisarCambioEvento(a.id, "cambio", a.cambiaDia);
    avisados += r.avisados;
    if (r.motivo === "sin_configurar" || r.motivo === "apagado") sinAviso.push(r.motivo === "apagado" ? "«respuestas en la web» apagado" : "avisos sin configurar en el servidor");
    if (r.avisados && "programado" in r && r.programado && r.programado > new Date()) sale = r.programado;
  }
  await supabase.from("importaciones").insert({
    tipo: "calendario", por_user_id: user.id, por_nombre: nombre, lineas: comp.lineas, validas: comp.nuestras,
    aceptadas: elegidos.length, ignoradas: comp.cambios.length - elegidos.length, bloqueadas: comp.errores.length,
    detalle: { cambios: elegidos.map((c) => ({ evento: c.claveEvento, campo: c.campo, de: c.actual, a: c.oficial })), senales: comp.senales.length },
  });
  refrescar();
  const re = await compararConLaBase(textoPegado);
  return { ...aResultado(re.comp), aplicado: {
    aceptadas: elegidos.length, ignoradas: comp.cambios.length - elegidos.length, cambiosEn: aplicadosEn,
    avisados: avisar ? avisados : null, sale: sale?.toISOString() ?? null, sinAviso: [...new Set(sinAviso)],
  } };
}
