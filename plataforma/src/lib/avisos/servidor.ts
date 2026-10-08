import "server-only";
import webpush from "web-push";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { pistaEfectiva, type EventoFila, type Pista } from "@/lib/eventos/dominio";
import { horaDeEnvio } from "./horario";
import { estadoPara, inicioDe, invitados, planificar, urlDomingo, urlEvento, type EventoPlan, type JugadorPlan } from "./planificador";
import { TEXTO_PRUEBA, textoCambio, textoCancelacion, textoEntrenoHoy, textoGestores, textoMartes, textoOtro, type RespuestaTexto, type Texto } from "./textos";

// Envio de avisos al movil (D99.5): Web Push estandar con claves VAPID. Corre SOLO en el servidor con la clave de
// servicio de Supabase (SUPABASE_SERVICE_ROLE_KEY) y la privada VAPID: las dos viven en .env.local y en las variables
// de Vercel, nunca en el repositorio. Cada aviso se escribe en avisos_registro (clave unica) ANTES de enviarse y se
// "reclama" con una actualizacion condicional: repetir la tarea o pulsar dos veces no duplica nada.

export const configuradoEnvio = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let vapidListo = false;
function prepararVapid() {
  if (vapidListo) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://maccabis.vercel.app", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  vapidListo = true;
}

export function clienteServicio(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}

type TipoAviso = "recordatorio" | "cambio" | "cancelacion" | "prueba" | "gestores";
export type FilaAviso = Texto & {
  clave: string; tipo: TipoAviso; person_id?: string | null; user_id?: string | null; eventos: string[]; url: string; programado_para: Date;
};

/** "Antonio Díaz Miguel, pista 3" (como en el WhatsApp de D98: una nota que sea solo «Pista N» cuenta como numero). */
export function sitioAviso(e: Pick<EventoFila, "tipo" | "pista_id" | "numero_pista" | "notas">, pistas: Pista[]) {
  const pe = pistaEfectiva(e, pistas);
  if (pe.porConfirmar || !pe.pista) return "pista por confirmar";
  const nota = !e.numero_pista ? e.notas?.match(/^\s*pista\s+(\d+)\s*\.?\s*$/i) : null;
  const n = e.numero_pista ?? (nota ? Number(nota[1]) : null);
  return `${pe.pista.nombre_corto ?? pe.pista.nombre}${n ? `, pista ${n}` : ""}`;
}

const COLUMNAS = "id, tipo, equipo, fecha, inicio, fin, quedada, titulo, rival, es_local, jornada, pista_id, numero_pista, notas, estado, sin_recordatorios, creado_en";
type EventoBase = Pick<EventoFila, "id" | "tipo" | "equipo" | "fecha" | "inicio" | "fin" | "quedada" | "titulo" | "rival" | "es_local" | "jornada" | "pista_id" | "numero_pista" | "notas" | "estado"> & { sin_recordatorios: boolean; creado_en: string };
const aPlan = (e: EventoBase, pistas: Pista[]): EventoPlan => ({
  id: e.id, tipo: e.tipo, equipo: e.equipo, fecha: e.fecha, inicio: e.inicio, fin: e.fin, quedada: e.quedada, titulo: e.titulo,
  sitio: sitioAviso(e, pistas), estado: e.estado, sin_recordatorios: e.sin_recordatorios, creado_en: e.creado_en,
});

async function leer<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>, que: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${que}: ${error.message}`);
  return data as T;
}

export async function estadoInterruptor(sb: SupabaseClient) {
  const c = (await leer(sb.from("respuestas_web_config").select("encendido, encendido_desde").eq("id", 1).maybeSingle(), "config")) as { encendido: boolean; encendido_desde: string | null } | null;
  return { encendido: Boolean(c?.encendido), desde: c?.encendido_desde ? new Date(c.encendido_desde as string) : null };
}

/** Escribe en el registro; las claves que ya estaban se ignoran (no se duplica nada). */
export async function encolar(sb: SupabaseClient, filas: FilaAviso[]) {
  if (!filas.length) return 0;
  const { data, error } = await sb.from("avisos_registro").upsert(
    filas.map((f) => ({ clave: f.clave, tipo: f.tipo, person_id: f.person_id ?? null, user_id: f.user_id ?? null, eventos: f.eventos, titulo: f.titulo, cuerpo: f.cuerpo, url: f.url, programado_para: f.programado_para.toISOString() })),
    { onConflict: "clave", ignoreDuplicates: true },
  ).select("id");
  if (error) throw new Error(`registro de avisos: ${error.message}`);
  return data?.length ?? 0;
}

type Suscripcion = { id: string; endpoint: string; p256dh: string; auth: string };

/** Envia a un movil. 404/410 = suscripcion caducada: se desactiva sola. */
export async function enviarA(sb: SupabaseClient, s: Suscripcion, carga: { titulo: string; cuerpo: string; url: string; tag?: string }) {
  prepararVapid();
  try {
    await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(carga), { TTL: 12 * 3600, urgency: "normal" });
    await sb.from("suscripciones_avisos").update({ ultimo_envio_ok: new Date().toISOString() }).eq("id", s.id);
    return "ok" as const;
  } catch (e) {
    const codigo = (e as { statusCode?: number }).statusCode;
    if (codigo === 404 || codigo === 410) {
      await sb.from("suscripciones_avisos").update({ activa: false, desactivada_en: new Date().toISOString(), motivo_baja: "caducada" }).eq("id", s.id);
      return "caducada" as const;
    }
    return "error" as const;
  }
}

/** Envia los avisos que ya tocan (programado_para <= ahora, de las ultimas 12 h) y aun no han salido. */
export async function enviarPendientes(sb: SupabaseClient, ahora = new Date()) {
  const desde = new Date(ahora.getTime() - 12 * 3600 * 1000).toISOString();
  const pendientes = await leer(sb.from("avisos_registro").select("id, tipo, person_id, user_id, titulo, cuerpo, url, clave")
    .is("enviado_en", null).lte("programado_para", ahora.toISOString()).gte("programado_para", desde).order("programado_para").limit(500), "pendientes") as
    { id: string; tipo: TipoAviso; person_id: string | null; user_id: string | null; titulo: string; cuerpo: string; url: string; clave: string }[];
  let enviados = 0;
  for (const a of pendientes) {
    // Reclamar: solo quien lo pasa de "sin enviar" a "enviado" lo manda (dos tareas a la vez no lo duplican).
    const { data: mio } = await sb.from("avisos_registro").update({ enviado_en: new Date().toISOString(), resultado: "enviando" }).eq("id", a.id).is("enviado_en", null).select("id");
    if (!mio?.length) continue;
    const q = sb.from("suscripciones_avisos").select("id, endpoint, p256dh, auth").eq("activa", true);
    const subs = (await leer((a.user_id ? q.eq("user_id", a.user_id) : q.eq("person_id", a.person_id ?? "")), "suscripciones")) as Suscripcion[];
    let ok = 0, mal = 0;
    for (const s of subs) (await enviarA(sb, s, { titulo: a.titulo, cuerpo: a.cuerpo, url: a.url, tag: a.clave.split(":").slice(0, 3).join(":") })) === "ok" ? ok++ : mal++;
    await sb.from("avisos_registro").update({ resultado: subs.length ? (ok ? "enviado" : "fallido") : "sin_avisos", enviados: ok, fallidos: mal }).eq("id", a.id);
    if (ok) enviados++;
  }
  return { pendientes: pendientes.length, enviados };
}

async function cargarBase(sb: SupabaseClient) {
  const [eventos, pistas, jugadores, respuestas, ausencias] = await Promise.all([
    leer(sb.from("eventos").select(COLUMNAS).eq("temporada", "2026-27"), "eventos") as Promise<EventoBase[]>,
    leer(sb.from("pistas").select("id, slug, nombre, nombre_corto, direccion, uso, estado, es_de_serie, num_pistas, nota"), "pistas") as Promise<Pista[]>,
    leer(sb.from("jugadores").select("person_id, nombre_visible, ficha_mda, ficha_mdl, entrena, activo"), "jugadores") as Promise<(JugadorPlan & { nombre_visible: string })[]>,
    leer(sb.from("respuestas").select("evento_id, person_id, respuesta"), "respuestas") as Promise<{ evento_id: string; person_id: string; respuesta: RespuestaTexto }[]>,
    leer(sb.from("ausencias_periodo").select("person_id, desde, hasta, borrada_en"), "ausencias") as Promise<{ person_id: string; desde: string; hasta: string | null; borrada_en: string | null }[]>,
  ]);
  return { eventos, pistas, jugadores, respuestas, ausencias };
}

/** Alertas de cambios despues del martes (D99.8) -> un aviso a cada gestor, con las horas de silencio. */
async function encolarAlertasGestores(sb: SupabaseClient, base: Awaited<ReturnType<typeof cargarBase>>, ahora: Date) {
  const alertas = await leer(sb.from("alertas_gestores").select("id, evento_id, person_id, antes, despues, en").eq("aviso_encolado", false), "alertas") as
    { id: string; evento_id: string; person_id: string; antes: RespuestaTexto; despues: RespuestaTexto; en: string }[];
  if (!alertas.length) return 0;
  const gestores = (await leer(sb.from("gestores").select("user_id").not("user_id", "is", null), "gestores")) as { user_id: string }[];
  const filas: FilaAviso[] = [];
  for (const a of alertas) {
    const e = base.eventos.find((x) => x.id === a.evento_id);
    const j = base.jugadores.find((x) => x.person_id === a.person_id);
    if (!e || !j) continue;
    const t = textoGestores(j.nombre_visible, aPlan(e, base.pistas), a.antes, a.despues);
    const envio = horaDeEnvio(new Date(Math.max(new Date(a.en).getTime(), ahora.getTime() - 60_000)), inicioDe(e));
    for (const g of gestores) filas.push({ ...t, clave: `gestores:${a.id}:${g.user_id}`, tipo: "gestores", user_id: g.user_id, eventos: [e.id], url: `/gestion/eventos/${e.id}/respuestas`, programado_para: envio });
  }
  await encolar(sb, filas);
  await sb.from("alertas_gestores").update({ aviso_encolado: true }).in("id", alertas.map((a) => a.id));
  return filas.length;
}

/** La tarea de cada 15 minutos: recordatorios que tocan, alertas a los gestores y envio de lo pendiente. */
export async function ejecutarTarea(ahora = new Date()) {
  const sb = clienteServicio();
  const { encendido, desde } = await estadoInterruptor(sb);
  let encolados = 0;
  if (encendido) {
    const base = await cargarBase(sb);
    const plan = planificar({
      ahora, encendidoDesde: desde, eventos: base.eventos.map((e) => aPlan(e, base.pistas)), jugadores: base.jugadores,
      respuestas: base.respuestas, ausencias: base.ausencias,
    });
    encolados = await encolar(sb, plan.map((p) => ({ ...p, person_id: p.person_id })));
    encolados += await encolarAlertasGestores(sb, base, ahora);
  }
  const envio = await enviarPendientes(sb, ahora);
  return { encendido, encolados, ...envio };
}

/** (b) y (c): al guardar un cambio de fecha, hora, pista o encuentro, o al cancelar, con «Guardar y avisar». Solo con el
 *  interruptor encendido (apagado sigue la cola «Copia a SportEasy»). Pasa por el silencio. */
export async function avisarCambioEvento(eventoId: string, tipo: "cambio" | "cancelacion", cambiaElDia: boolean) {
  if (!configuradoEnvio()) return { avisados: 0, motivo: "sin_configurar" as const };
  const sb = clienteServicio();
  if (!(await estadoInterruptor(sb)).encendido) return { avisados: 0, motivo: "apagado" as const };
  const base = await cargarBase(sb);
  const e = base.eventos.find((x) => x.id === eventoId);
  if (!e) return { avisados: 0, motivo: "sin_evento" as const };
  const plan = aPlan(e, base.pistas);
  const ahora = new Date();
  const envio = horaDeEnvio(ahora, inicioDe(plan));
  const sello = ahora.getTime();
  const filas: FilaAviso[] = invitados(plan, base.jugadores).map((j) => {
    const r = base.respuestas.find((x) => x.evento_id === e.id && x.person_id === j.person_id)?.respuesta ?? "sin_responder";
    const t = tipo === "cancelacion" ? textoCancelacion(plan) : textoCambio(plan, r, cambiaElDia);
    return { ...t, clave: `${tipo}:${e.id}:${sello}:${j.person_id}`, tipo, person_id: j.person_id, eventos: [e.id], url: e.tipo === "liga" ? urlDomingo(e.fecha) : urlEvento(e), programado_para: envio };
  });
  await encolar(sb, filas);
  await enviarPendientes(sb, ahora);
  return { avisados: filas.length, motivo: envio > ahora ? ("silencio" as const) : ("enviado" as const), programado: envio };
}

/** «Enviar un recordatorio ahora» (Gestion): a quien no ha respondido (sin contar ausencias), con el silencio. */
export async function recordatorioManual(eventoId: string) {
  if (!configuradoEnvio()) return { avisados: 0 };
  const sb = clienteServicio();
  if (!(await estadoInterruptor(sb)).encendido) return { avisados: 0 };
  const base = await cargarBase(sb);
  const e = base.eventos.find((x) => x.id === eventoId);
  if (!e) return { avisados: 0 };
  const plan = aPlan(e, base.pistas);
  const ahora = new Date();
  const envio = horaDeEnvio(ahora, inicioDe(plan));
  const filas: FilaAviso[] = invitados(plan, base.jugadores)
    .filter((j) => estadoPara(j.person_id, plan, base.respuestas, base.ausencias) === "sin_responder")
    .map((j) => {
      const t = e.tipo === "entreno" ? { ...textoEntrenoHoy(plan), titulo: "Entreno: ¿vas?" } : e.tipo === "liga" ? textoMartes(e.fecha, [String(e.inicio ?? "").slice(0, 5)].filter(Boolean), false) : textoOtro(plan, "24h");
      return { ...t, clave: `rec:manual:${e.id}:${ahora.getTime()}:${j.person_id}`, tipo: "recordatorio" as const, person_id: j.person_id, eventos: [e.id], url: e.tipo === "liga" ? urlDomingo(e.fecha) : urlEvento(e), programado_para: envio };
    });
  await encolar(sb, filas);
  await enviarPendientes(sb, ahora);
  return { avisados: filas.length, programado: envio };
}

/** (d) El aviso de prueba, a los moviles de quien lo pide. Funciona con el interruptor apagado (D99.12). */
export async function avisoDePrueba(userId: string) {
  if (!configuradoEnvio()) return { enviados: 0, moviles: 0, configurado: false };
  const sb = clienteServicio();
  const ahora = new Date();
  await encolar(sb, [{ ...TEXTO_PRUEBA, clave: `prueba:${userId}:${ahora.getTime()}`, tipo: "prueba", user_id: userId, eventos: [], url: "/avisos", programado_para: ahora }]);
  const subs = (await leer(sb.from("suscripciones_avisos").select("id").eq("user_id", userId).eq("activa", true), "suscripciones")) as { id: string }[];
  const r = await enviarPendientes(sb, ahora);
  return { enviados: r.enviados, moviles: subs.length, configurado: true };
}
