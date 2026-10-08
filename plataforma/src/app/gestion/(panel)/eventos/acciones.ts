"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { exigirGestor } from "@/lib/sesion";
import { hoyMadrid } from "@/lib/dias";
import { cargarEvento, cargarEventos, cargarJugadores, cargarPistas, TEMPORADA } from "@/lib/eventos/datos";
import {
  describirCambios, deLaSerieDesde, hhmm, juntarCambios, pistaEfectiva, quedadaPorDefecto, resumenCopia,
  type CamposEditables, type EquipoEvento, type EstadoPista, type EventoFila, type TipoEvento,
} from "@/lib/eventos/dominio";
import {
  compararCalendario, crearDiccionario, leerCalendario, leerFecha, leerRespuestas, normalizar,
  type CambioCalendario, type LineaRespuesta, type Senal,
} from "@/lib/eventos/importador";

// Todas las acciones usan la sesion del gestor: la base (RLS + is_gestor) decide si se puede. Nadie borra: un evento se
// CANCELA (D94). Cada cambio deja el evento "pendiente de copiar" a SportEasy, con la descripcion de lo que cambia.

export type Estado = { error?: string } | null;
const TIPOS: TipoEvento[] = ["entreno", "liga", "amistoso", "torneo", "interno"];
const EQUIPOS: EquipoEvento[] = ["MdA", "MdL", "ambos"];
const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const hora = (v: string) => (/^\d{1,2}:\d{2}$/.test(v) ? v.padStart(5, "0") : null);
const refrescar = () => { revalidatePath("/gestion/eventos"); revalidatePath("/gestion"); revalidatePath("/"); revalidatePath("/calendario.ics"); revalidateTag("calendario", "max"); };

type Campos = CamposEditables;

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
  if ((tipo === "amistoso" || tipo === "torneo" || tipo === "interno") && !titulo && !rival) return { error: "Ponle un título o un rival." };
  return { campos: { tipo, equipo, titulo, jornada, rival, es_local, fecha, inicio, fin, quedada, pista_id, numero_pista, notas: texto(f, "notas") || null, estado: base?.estado ?? "programado" } };
}

const aFila = (c: Campos) => ({
  tipo: c.tipo, equipo: c.equipo, titulo: c.titulo, jornada: c.jornada, rival: c.rival, es_local: c.es_local, fecha: c.fecha,
  inicio: c.inicio, fin: c.fin, quedada: c.quedada, pista_id: c.pista_id, numero_pista: c.numero_pista, notas: c.notas, estado: c.estado,
});
const editables = (e: EventoFila): Campos => ({ tipo: e.tipo, equipo: e.equipo, titulo: e.titulo, jornada: e.jornada, rival: e.rival, es_local: e.es_local, fecha: e.fecha, inicio: hhmm(e.inicio), fin: hhmm(e.fin), quedada: hhmm(e.quedada), pista_id: e.pista_id, numero_pista: e.numero_pista, notas: e.notas, estado: e.estado });

// ---------------------------------------------------------------- crear
export async function crearEvento(_prev: Estado, f: FormData): Promise<Estado> {
  const { supabase } = await exigirGestor();
  const r = leerFormulario(f, null);
  if (!r.campos) return { error: r.error };
  const { data, error } = await supabase.from("eventos").insert({
    ...aFila(r.campos), clave: `m-${crypto.randomUUID()}`, temporada: TEMPORADA, origen: "manual",
    sporteasy_estado: "pendiente", sporteasy_cambio: "Evento nuevo: crearlo en SportEasy",
  }).select("id").single();
  if (error) return { error: `No se pudo crear: ${error.message}` };
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
  if (!diff.length) redirect(`/gestion/eventos/${id}?guardado=nada`);

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
    const cambios = describirCambios(actual, aplicar, pistas);
    if (!cambios.length) continue;
    const previo = o.sporteasy_estado === "pendiente" ? o.sporteasy_cambio : null;
    const { error } = await supabase.from("eventos").update({
      ...aFila(aplicar), sporteasy_estado: "pendiente", sporteasy_cambio: juntarCambios(previo, cambios),
    }).eq("id", o.id);
    if (error) return { error: `No se pudo guardar: ${error.message}` };
  }
  refrescar();
  redirect(`/gestion/eventos/${id}?guardado=${alcance === "siguientes" ? `serie-${objetivos.length}` : "cambio"}`);
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
    const previo = o.sporteasy_estado === "pendiente" ? o.sporteasy_cambio : null;
    const { error } = await supabase.from("eventos").update({
      estado: restablecer ? "programado" : "cancelado", sporteasy_estado: "pendiente",
      sporteasy_cambio: juntarCambios(previo, [restablecer ? "evento restablecido" : "evento cancelado"]),
    }).eq("id", o.id);
    if (error) throw new Error(error.message);
  }
  refrescar();
  redirect(`/gestion/eventos/${id}?guardado=${restablecer ? "restablecido" : "cancelado"}${objetivos.length > 1 ? `-${objetivos.length}` : ""}`);
}

// ---------------------------------------------------------------- copia a SportEasy
/** "Marcar como copiado": lo usa Claude tras copiar el evento a SportEasy con el OK de Ivan. */
export async function marcarCopiado(f: FormData) {
  const { supabase } = await exigirGestor();
  const ids = new Set(f.getAll("id").map(String).filter(Boolean));
  // «Entrenos de la serie» (carga inicial sin confirmar): se resuelven aqui, con el mismo criterio que la tarjeta.
  if (f.get("serie")) for (const e of resumenCopia(await cargarEventos(supabase), hoyMadrid()).deSerie) ids.add(e.id);
  if (!ids.size) return;
  const { error } = await supabase.from("eventos").update({ sporteasy_estado: "copiado", sporteasy_cambio: null, sporteasy_copiado_en: new Date().toISOString() }).in("id", [...ids]);
  if (error) throw new Error(error.message);
  refrescar();
}

// ---------------------------------------------------------------- pistas
export async function crearPista(_prev: Estado, f: FormData): Promise<Estado> {
  const { supabase } = await exigirGestor();
  const nombre = texto(f, "nombre");
  if (nombre.length < 3) return { error: "Ponle un nombre a la pista." };
  const uso = texto(f, "uso") === "partido" ? "partido" : "entreno";
  const estado = (["habitual", "provisional", "en_obras", "cerrada"] as EstadoPista[]).find((x) => x === texto(f, "estado")) ?? "provisional";
  const n = Number(texto(f, "num_pistas"));
  const slug = normalizar(nombre).replace(/\s+/g, "-").slice(0, 40) || `pista-${Date.now()}`;
  const { error } = await supabase.from("pistas").insert({
    slug, nombre, nombre_corto: texto(f, "nombre_corto") || null, direccion: texto(f, "direccion") || null, uso, estado,
    num_pistas: Number.isInteger(n) && n > 0 ? n : null,
  });
  if (error) return { error: error.code === "23505" ? "Ya hay una pista con ese nombre." : `No se pudo crear: ${error.message}` };
  revalidatePath("/gestion/eventos/pistas"); refrescar();
  const volver = texto(f, "volver");
  redirect(volver.startsWith("/gestion/eventos") ? volver : "/gestion/eventos/pistas?creada=1");
}

/** Cambia el estado o la direccion de una pista. Si es la de la serie y cambia su estado (en obras ↔ habitual), los
 *  entrenos futuros sin pista propia cambian de «Pista por confirmar» a ella (o al reves): quedan pendientes de copiar. */
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
  const cambios = { nombre, uso, estado, direccion: texto(f, "direccion") || null, num_pistas: Number.isInteger(n) && n > 0 ? n : null, nota: texto(f, "nota") || null };
  const { error } = await supabase.from("pistas").update(cambios).eq("id", id);
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  if (antes.es_de_serie && antes.estado !== estado) {
    const despues = pistas.map((p) => (p.id === id ? { ...p, ...cambios } : p));
    const hoy = hoyMadrid();
    const eventos = (await cargarEventos(supabase)).filter((e) => e.tipo === "entreno" && !e.pista_id && e.estado === "programado" && e.fecha >= hoy);
    for (const e of eventos) {
      const a = pistaEfectiva(e, pistas), d = pistaEfectiva(e, despues);
      if (a.texto === d.texto) continue;
      const previo = e.sporteasy_estado === "pendiente" ? e.sporteasy_cambio : null;
      await supabase.from("eventos").update({ sporteasy_estado: "pendiente", sporteasy_cambio: juntarCambios(previo, [`pista: ${a.texto} → ${d.texto}`]) }).eq("id", e.id);
    }
  }
  revalidatePath("/gestion/eventos/pistas"); refrescar();
  return null;
}

// ---------------------------------------------------------------- importar: calendario del Ayuntamiento
export type ResultadoCalendario = {
  lineas: number; nuestras: number; ajenas: number; iguales: number;
  errores: { n: number; crudo: string; error: string }[];
  cambios: CambioCalendario[]; senales: Senal[];
  aplicado?: { aceptadas: number; ignoradas: number; cambiosEn: string[] };
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

/** Aplica SOLO los cambios aceptados (por su id) y registra la importacion. Lo aceptado queda pendiente de copiar. */
export async function aplicarCalendario(textoPegado: string, aceptados: string[]): Promise<ResultadoCalendario> {
  const { supabase, nombre, user, eventos, comp } = await compararConLaBase(textoPegado);
  const elegidos = comp.cambios.filter((c) => aceptados.includes(c.id));
  const porEvento = new Map<string, CambioCalendario[]>();
  for (const c of elegidos) porEvento.set(c.eventoId, [...(porEvento.get(c.eventoId) ?? []), c]);
  const aplicadosEn: string[] = [];
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
    const previo = e.sporteasy_estado === "pendiente" ? e.sporteasy_cambio : null;
    const { error } = await supabase.from("eventos").update({
      ...cambio, sporteasy_estado: "pendiente",
      sporteasy_cambio: juntarCambios(previo, cs.map((c) => `${c.textoCampo.toLowerCase()}: ${c.actual} → ${c.oficial} (Ayuntamiento)`)),
    }).eq("id", eventoId);
    if (error) throw new Error(`No se pudo aplicar ${e.clave}: ${error.message}`);
    aplicadosEn.push(`${e.equipo} J${e.jornada}`);
  }
  await supabase.from("importaciones").insert({
    tipo: "calendario", por_user_id: user.id, por_nombre: nombre, lineas: comp.lineas, validas: comp.nuestras,
    aceptadas: elegidos.length, ignoradas: comp.cambios.length - elegidos.length, bloqueadas: comp.errores.length,
    detalle: { cambios: elegidos.map((c) => ({ evento: c.claveEvento, campo: c.campo, de: c.actual, a: c.oficial })), senales: comp.senales.length },
  });
  refrescar();
  const re = await compararConLaBase(textoPegado);
  return { ...aResultado(re.comp), aplicado: { aceptadas: elegidos.length, ignoradas: comp.cambios.length - elegidos.length, cambiosEn: aplicadosEn } };
}

// ---------------------------------------------------------------- importar: respuestas y ausencias de SportEasy
export type LineaVista = { n: number; crudo: string; estado: "valida" | "bloqueada" | "error"; tipo: string; nombre?: string; resumen: string; error?: string };
export type ResultadoRespuestas = { lineas: LineaVista[]; validas: number; bloqueadas: number; errores: number; nombresPendientes: string[]; guardadas?: { respuestas: number; ausencias: number } };

async function leerConLaBase(textoPegado: string) {
  const { supabase, nombre, user } = await exigirGestor();
  const [eventos, jugadores, { data: dic }] = await Promise.all([
    cargarEventos(supabase), cargarJugadores(supabase), supabase.from("diccionario_sporteasy").select("nombre_sporteasy, person_id"),
  ]);
  const personas = jugadores.map((j) => ({ person_id: j.person_id, nombre: j.nombre_visible }));
  const lineas = leerRespuestas(textoPegado, crearDiccionario((dic ?? []) as { nombre_sporteasy: string; person_id: string }[]), eventos, personas);
  return { supabase, nombre, user, lineas, jugadores };
}
const vista = (l: LineaRespuesta): LineaVista => {
  if (l.estado === "error") return { n: l.n, crudo: l.crudo, estado: "error", tipo: "error", resumen: "", error: l.error };
  if (l.estado === "bloqueada") return { n: l.n, crudo: l.crudo, estado: "bloqueada", tipo: l.tipo, nombre: l.nombre, resumen: "", error: l.motivoBloqueo };
  if (l.tipo === "ausencia") return { n: l.n, crudo: l.crudo, estado: "valida", tipo: "ausencia", nombre: l.nombre, resumen: `${l.nombre}: ausente del ${l.desde.slice(8, 10)}/${l.desde.slice(5, 7)} al ${l.hasta.slice(8, 10)}/${l.hasta.slice(5, 7)} (${l.motivo})` };
  return { n: l.n, crudo: l.crudo, estado: "valida", tipo: "respuesta", nombre: l.nombre, resumen: `${l.nombre}: ${l.respuesta === "sin_responder" ? "sin responder" : l.respuesta === "no" ? "no va" : l.respuesta}${l.motivo ? ` (${l.motivo})` : ""} · ${l.evento.clave}` };
};
const aResultadoR = (lineas: LineaRespuesta[]): ResultadoRespuestas => ({
  lineas: lineas.map(vista), validas: lineas.filter((l) => l.estado === "valida").length, bloqueadas: lineas.filter((l) => l.estado === "bloqueada").length,
  errores: lineas.filter((l) => l.estado === "error").length,
  nombresPendientes: [...new Set(lineas.filter((l) => l.estado === "bloqueada").map((l) => (l as { nombre: string }).nombre))],
});

export async function analizarRespuestas(textoPegado: string): Promise<ResultadoRespuestas> {
  const { lineas } = await leerConLaBase(textoPegado);
  return aResultadoR(lineas);
}

/** Guarda las lineas validas (una respuesta por persona y evento) y registra la importacion. Las bloqueadas esperan. */
export async function guardarRespuestas(textoPegado: string): Promise<ResultadoRespuestas> {
  const { supabase, nombre, user, lineas } = await leerConLaBase(textoPegado);
  const ahora = new Date().toISOString();
  const rs = lineas.filter((l): l is Extract<LineaRespuesta, { tipo: "respuesta"; estado: "valida" }> => l.tipo === "respuesta" && l.estado === "valida");
  const as = lineas.filter((l): l is Extract<LineaRespuesta, { tipo: "ausencia"; estado: "valida" }> => l.tipo === "ausencia" && l.estado === "valida");
  // Si el mismo jugador sale dos veces en el mismo evento, vale la ultima linea.
  const ultimas = new Map(rs.map((l) => [`${l.evento.id}|${l.person_id}`, l]));
  if (ultimas.size) {
    const { error } = await supabase.from("respuestas").upsert(
      [...ultimas.values()].map((l) => ({ evento_id: l.evento.id, person_id: l.person_id, respuesta: l.respuesta, motivo: l.motivo, detalle: l.detalle, fuente: "sporteasy", leido_en: ahora })),
      { onConflict: "evento_id,person_id" });
    if (error) throw new Error(`No se pudieron guardar las respuestas: ${error.message}`);
  }
  if (as.length) {
    const { error } = await supabase.from("ausencias_periodo").upsert(
      as.map((l) => ({ person_id: l.person_id, desde: l.desde, hasta: l.hasta, motivo: l.motivo, fuente: "sporteasy", leido_en: ahora })),
      { onConflict: "person_id,desde,hasta" });
    if (error) throw new Error(`No se pudieron guardar las ausencias: ${error.message}`);
  }
  const bloq = lineas.filter((l) => l.estado === "bloqueada").length, err = lineas.filter((l) => l.estado === "error").length;
  await supabase.from("importaciones").insert({
    tipo: "respuestas", por_user_id: user.id, por_nombre: nombre, lineas: lineas.length, validas: ultimas.size + as.length,
    aceptadas: ultimas.size + as.length, ignoradas: err, bloqueadas: bloq,
    detalle: { respuestas: ultimas.size, ausencias: as.length, eventos: [...new Set([...ultimas.values()].map((l) => l.evento.clave))] },
  });
  refrescar(); revalidatePath("/gestion/asistencia");
  const re = await leerConLaBase(textoPegado);
  return { ...aResultadoR(re.lineas), guardadas: { respuestas: ultimas.size, ausencias: as.length } };
}

/** Asigna a mano, una vez, un nombre de SportEasy a una persona: entra en el diccionario cerrado. */
export async function asignarNombre(nombreSportEasy: string, personId: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, nombre } = await exigirGestor();
  const limpio = nombreSportEasy.trim();
  if (!limpio) return { ok: false, error: "Falta el nombre." };
  const jugadores = await cargarJugadores(supabase);
  if (!jugadores.some((j) => j.person_id === personId)) return { ok: false, error: "Elige una persona de la lista." };
  const { data: dic } = await supabase.from("diccionario_sporteasy").select("nombre_sporteasy");
  if ((dic ?? []).some((d) => normalizar(d.nombre_sporteasy) === normalizar(limpio))) return { ok: false, error: "Ese nombre ya está en el diccionario." };
  const { error } = await supabase.from("diccionario_sporteasy").insert({ nombre_sporteasy: limpio, person_id: personId, creado_por: nombre });
  if (error) return { ok: false, error: `No se pudo guardar: ${error.message}` };
  return { ok: true };
}
