import "server-only";
import webpush from "web-push";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { pistaEfectiva, type EventoFila, type Pista } from "@/lib/eventos/dominio";
import { horaDeEnvio, limiteDudas, textoLimite } from "./horario";
import { avisosCierre, avisosPasoNoVa, avisosPorDefecto, conAvisosDeDudas, efectivaDe, inicioDe, invitados, losQueFaltan, planificar, planificarPlanes, urlDomingo, urlEvento, type EventoPlan, type JugadorPlan } from "./planificador";
import { queEs, TEXTO_PRUEBA, textoCambio, textoCancelacion, textoDudas, textoEntrenoHoy, textoGestores, textoMartes, textoOtro, type RespuestaTexto, type Texto } from "./textos";

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

const COLUMNAS = "id, tipo, equipo, fecha, inicio, fin, quedada, titulo, rival, es_local, jornada, pista_id, numero_pista, notas, estado, sin_recordatorios, creado_en, oficial, recordar_un_dia_antes, borrado_en, ubicacion_nombre, solo_con_ficha_en";
type EventoBase = Pick<EventoFila, "id" | "tipo" | "equipo" | "fecha" | "inicio" | "fin" | "quedada" | "titulo" | "rival" | "es_local" | "jornada" | "pista_id" | "numero_pista" | "notas" | "estado"> & {
  sin_recordatorios: boolean; creado_en: string; oficial?: boolean; recordar_un_dia_antes?: boolean; borrado_en?: string | null; ubicacion_nombre?: string | null;
  /** D148: columna calculada de la base (pista «solo con ficha» del entreno, o null). */
  solo_con_ficha_en?: string | null;
};
export const aPlan = (e: EventoBase, pistas: Pista[]): EventoPlan => ({
  id: e.id, tipo: e.tipo, equipo: e.equipo, fecha: e.fecha, inicio: e.inicio, fin: e.fin, quedada: e.quedada, titulo: e.titulo,
  sitio: !e.pista_id && e.ubicacion_nombre ? e.ubicacion_nombre : sitioAviso(e, pistas), estado: e.estado, sin_recordatorios: e.sin_recordatorios, creado_en: e.creado_en,
  oficial: e.oficial, recordar_un_dia_antes: e.recordar_un_dia_antes, borrado_en: e.borrado_en, solo_con_ficha_en: e.solo_con_ficha_en ?? null,
});

async function leer<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>, que: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${que}: ${error.message}`);
  return data as T;
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

/** D146: marcas de disponibilidad por defecto y excepciones de entreno. La tarea NO lee jugadores_privado (niveles, D39):
 *  las marcas llegan con marcas_disponibilidad() (solo person_id y las dos marcas; solo la ejecuta service_role). Si la
 *  migracion aun no esta en la base (funcion o tabla que no existe), sin marcas y un aviso en el log: los recordatorios
 *  siguen saliendo como antes. Cualquier otro error hace fallar la tarea, como el resto de lecturas. */
async function leerDefecto(sb: SupabaseClient) {
  const falta = (e: { code?: string } | null) => !!e && ["42883", "42P01", "PGRST202", "PGRST205"].includes(e.code ?? "");
  const [m, q] = await Promise.all([
    sb.rpc("marcas_disponibilidad"),
    sb.from("entreno_defecto_quitado").select("evento_id, person_id"),
  ]);
  if (falta(m.error) || falta(q.error)) {
    console.warn("disponibilidad por defecto: migraciones 20261028230000/20261028233000 sin aplicar; recordatorios sin marcas");
    return { marcas: new Map<string, { no_suele_entrenar: boolean; nunca_partidos: boolean }>(), quitados: [] };
  }
  if (m.error) throw new Error(`marcas: ${m.error.message}`);
  if (q.error) throw new Error(`excepciones de entreno: ${q.error.message}`);
  const filas = (m.data ?? []) as { person_id: string; no_suele_entrenar: boolean; nunca_partidos: boolean }[];
  return { marcas: new Map(filas.map((f) => [f.person_id, { no_suele_entrenar: f.no_suele_entrenar, nunca_partidos: f.nunca_partidos }])), quitados: (q.data ?? []) as { evento_id: string; person_id: string }[] };
}

export async function cargarBase(sb: SupabaseClient) {
  const [eventos, pistas, jugadoresSinMarcas, respuestas, ausencias, defecto] = await Promise.all([
    leer(sb.from("eventos").select(COLUMNAS).eq("temporada", "2026-27"), "eventos") as Promise<EventoBase[]>,
    leer(sb.from("pistas").select("id, slug, nombre, nombre_corto, direccion, uso, estado, es_de_serie, num_pistas, nota"), "pistas") as Promise<Pista[]>,
    leer(sb.from("jugadores").select("person_id, nombre_visible, ficha_mda, ficha_mdl, entrena, activo, rol"), "jugadores") as Promise<(JugadorPlan & { nombre_visible: string })[]>,
    leer(sb.from("respuestas").select("evento_id, person_id, respuesta, motivo, origen, cambiado_en"), "respuestas") as Promise<{ evento_id: string; person_id: string; respuesta: RespuestaTexto; motivo: string | null; origen: string; cambiado_en: string | null }[]>,
    leer(sb.from("ausencias_periodo").select("person_id, desde, hasta, borrada_en"), "ausencias") as Promise<{ person_id: string; desde: string; hasta: string | null; borrada_en: string | null }[]>,
    leerDefecto(sb),
  ]);
  const jugadores = jugadoresSinMarcas.map((j) => ({ ...j, marcas: defecto.marcas.get(j.person_id) ?? null }));
  return { eventos, pistas, jugadores, respuestas, ausencias, quitados: defecto.quitados };
}

/** Alertas de cambios despues del cierre (D99.8; D173: martes 12:00) -> un aviso a cada gestor, con las horas de silencio.
 *  Con la convocatoria de ese domingo ya APROBADA no se manda este aviso generico: la baja de un convocado y el «voy» tardio
 *  que importa salen con su propio aviso (lib/convocatoria/tarea.ts, con el recambio propuesto). */
async function encolarAlertasGestores(sb: SupabaseClient, base: Awaited<ReturnType<typeof cargarBase>>, ahora: Date) {
  const alertas = await leer(sb.from("alertas_gestores").select("id, evento_id, person_id, antes, despues, en").eq("aviso_encolado", false), "alertas") as
    { id: string; evento_id: string; person_id: string; antes: RespuestaTexto; despues: RespuestaTexto; en: string }[];
  if (!alertas.length) return 0;
  const gestores = (await leer(sb.from("gestores").select("user_id").not("user_id", "is", null), "gestores")) as { user_id: string }[];
  const fechas = [...new Set(alertas.map((a) => base.eventos.find((x) => x.id === a.evento_id)?.fecha).filter((f): f is string => !!f))];
  const { fechasAprobadas } = await import("@/lib/convocatoria/tarea");
  const aprobadas = await fechasAprobadas(sb, fechas);
  const filas: FilaAviso[] = [];
  for (const a of alertas) {
    const e = base.eventos.find((x) => x.id === a.evento_id);
    const j = base.jugadores.find((x) => x.person_id === a.person_id);
    if (!e || !j || (e.tipo !== "entreno" && aprobadas.has(e.fecha))) continue;
    const envio = horaDeEnvio(new Date(Math.max(new Date(a.en).getTime(), ahora.getTime() - 60_000)), inicioDe(e));
    const t = textoGestores(j.nombre_visible, aPlan(e, base.pistas), a.antes, a.despues, envio.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }));
    for (const g of gestores) filas.push({ ...t, clave: `gestores:${a.id}:${g.user_id}`, tipo: "gestores", user_id: g.user_id, eventos: [e.id], url: `/gestion/eventos/${e.id}/respuestas`, programado_para: envio });
  }
  await encolar(sb, filas);
  await sb.from("alertas_gestores").update({ aviso_encolado: true }).in("id", alertas.map((a) => a.id));
  return filas.length;
}

/** D141: al llegar el limite, quien siga en «duda» pasa a «no va» (en la base: `cerrar_dudas`, idempotente). Solo si la
 *  funcion no existe (PGRST202: migracion sin aplicar) se ignora, y con un aviso en el log; cualquier otro error hace
 *  fallar la tarea (500 visible en /api/avisos/tarea), para que no se esconda un cierre que no se esta haciendo. */
async function cerrarDudas(sb: SupabaseClient, ahora: Date) {
  const { data, error } = await sb.rpc("cerrar_dudas", { p_ahora: ahora.toISOString() });
  if (error) {
    if (error.code === "PGRST202") {
      console.warn("cerrar_dudas: la funcion no existe en la base (migracion 20261028100000 sin aplicar); no se cierran dudas");
      return 0;
    }
    throw new Error(`cerrar dudas: ${error.message}`);
  }
  return Array.isArray(data) ? data.length : 0;
}

/** Un fallo en la tarea, con la parte en la que pasó y su motivo (va a los registros de Vercel y a la respuesta). */
export type FalloTarea = { paso: string; motivo: string };

/** La tarea de cada 15 minutos: cierra las dudas que llegan al limite, recordatorios que tocan (con el aviso del dia del plazo
 *  y el de «no va (por defecto)»), el aviso del cierre a quien no ha respondido (D173), la rutina C (propuesta automatica,
 *  recordatorios a gestores, bajas tras aprobar; D173), alertas a los gestores y envio de lo pendiente.
 *  Cada parte va por separado: si una falla, las demas siguen (el envio de lo pendiente, siempre) y el fallo queda en el
 *  registro con su parte y su motivo; la ruta responde entonces 500 con `fallos`, para que la alarma lo vea. */
export async function ejecutarTarea(ahora = new Date()) {
  const sb = clienteServicio();
  const fallos: FalloTarea[] = [];
  async function paso<T>(nombre: string, f: () => Promise<T>): Promise<T | null> {
    try {
      return await f();
    } catch (e) {
      const motivo = e instanceof Error ? e.message : String(e);
      console.error(`tarea de avisos: falla «${nombre}»: ${motivo}`);
      fallos.push({ paso: nombre, motivo });
      return null;
    }
  }
  let encolados = 0;
  const sumar = (n: number | null) => { encolados += n ?? 0; };
  const cerradas = (await paso("cierre de dudas", () => cerrarDudas(sb, ahora))) ?? 0;
  let propuestas: string[] = [];
  const base = await paso("lectura de la base", () => cargarBase(sb));
  if (base) {
    const eventos = base.eventos.map((e) => aPlan(e, base.pistas));
    // D173: domingos con la convocatoria ya aprobada (sin aviso de las 09:00 ni del cierre para sus partidos).
    const hoy = ahora.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
    const aprobadas = await paso("convocatorias aprobadas", async () => {
      const { fechasAprobadas } = await import("@/lib/convocatoria/tarea");
      return [...(await fechasAprobadas(sb, [...new Set(eventos.filter((e) => e.tipo === "liga" && e.fecha >= hoy).map((e) => e.fecha))]))];
    });
    const datos = { ahora, eventos, jugadores: base.jugadores, respuestas: base.respuestas, ausencias: base.ausencias, quitados: base.quitados, aprobadas: aprobadas ?? [] };
    // Sin saber que domingos estan aprobados no se manda nada que dependa de ello (recordatorios de liga y cierre): mejor
    // en la pasada siguiente que un aviso de mas a un convocado.
    if (aprobadas) {
      // Recordatorios: los del club y los planes con «recordar un dia antes» (D118); el aviso de las «duda» (D141) se junta
      // con el que ya salga ese dia a esa persona.
      sumar(await paso("recordatorios", () => encolar(sb, conAvisosDeDudas([...planificar(datos), ...planificarPlanes(datos)], datos).map((p) => ({ ...p, person_id: p.person_id })))));
    }
    // D152: «Te hemos puesto que no vas al entreno…», uno por entreno (aparte: no se junta con el de las dudas).
    sumar(await paso("avisos de no va por defecto", () => encolar(sb, avisosPorDefecto(datos))));
    sumar(await paso("avisos de paso a no va", () => encolar(sb, avisosPasoNoVa({ eventos, respuestas: base.respuestas, jugadores: base.jugadores }, ahora))));
    // D173: al cierre del partido, a quien sigue sin responder (su respuesta no se toca).
    if (aprobadas) sumar(await paso("aviso del cierre", () => encolar(sb, avisosCierre(datos))));
    // D173: la rutina C.
    const r = await paso("convocatoria", async () => {
      const { tareaConvocatoria } = await import("@/lib/convocatoria/tarea");
      return tareaConvocatoria(sb, ahora, base.eventos);
    });
    if (r) { sumar(r.encolados); propuestas = r.propuestas; }
    sumar(await paso("alertas a gestores", () => encolarAlertasGestores(sb, base, ahora)));
  }
  const envio = (await paso("envio de lo pendiente", () => enviarPendientes(sb, ahora))) ?? { pendientes: 0, enviados: 0 };
  const error = fallos.length ? fallos.map((x) => `${x.paso}: ${x.motivo}`).join(" | ") : undefined;
  return { cerradas, encolados, ...envio, propuestas, ...(error ? { error, fallos } : {}) };
}

/** (b) y (c): al guardar un cambio de fecha, hora, pista o encuentro, o al cancelar, con «Guardar y avisar». Pasa por el
 *  silencio. */
export async function avisarCambioEvento(eventoId: string, tipo: "cambio" | "cancelacion", cambiaElDia: boolean) {
  if (!configuradoEnvio()) return { avisados: 0, motivo: "sin_configurar" as const };
  const sb = clienteServicio();
  const base = await cargarBase(sb);
  const e = base.eventos.find((x) => x.id === eventoId);
  if (!e) return { avisados: 0, motivo: "sin_evento" as const };
  const plan = aPlan(e, base.pistas);
  const ahora = new Date();
  const envio = horaDeEnvio(ahora, inicioDe(plan));
  const sello = ahora.getTime();
  const filas: FilaAviso[] = invitados(plan, base.jugadores).map((j) => {
    // D177: lo que cuenta (regla única): a quien no va por defecto o por su ausencia, «Tenías No voy».
    const r = efectivaDe(j, plan, base).respuesta;
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
  const base = await cargarBase(sb);
  const e = base.eventos.find((x) => x.id === eventoId);
  if (!e) return { avisados: 0 };
  const plan = aPlan(e, base.pistas);
  const ahora = new Date();
  const envio = horaDeEnvio(ahora, inicioDe(plan));
  // D189: «Mensaje a los que faltan»: quien no ha respondido y quien sigue en «duda», sin quien tiene una ausencia ese dia.
  const { sinResponder, enDuda } = losQueFaltan(plan, base.jugadores, base);
  const limite = limiteDudas(plan);
  const fila = (j: JugadorPlan, t: { titulo: string; cuerpo: string }): FilaAviso => ({ ...t, clave: `rec:manual:${e.id}:${ahora.getTime()}:${j.person_id}`, tipo: "recordatorio", person_id: j.person_id, eventos: [e.id], url: e.tipo === "liga" ? urlDomingo(e.fecha) : urlEvento(e), programado_para: envio });
  const tSin = e.tipo === "entreno" ? { ...textoEntrenoHoy(plan), titulo: "Entreno: ¿vas?" }
    : e.tipo === "liga" ? textoMartes(e.fecha, [String(e.inicio ?? "").slice(0, 5)].filter(Boolean), ahora < limite ? textoLimite(limite, ahora) : undefined) : textoOtro(plan, "24h");
  const filas: FilaAviso[] = [
    ...sinResponder.map((j) => fila(j, tSin)),
    ...enDuda.map((j) => fila(j, textoDudas([{ que: queEs(plan), limite }], [], ahora))),
  ];
  await encolar(sb, filas);
  await enviarPendientes(sb, ahora);
  return { avisados: filas.length, programado: envio };
}

/** Plan no oficial (D118): si un gestor cambia, cancela, borra o hace oficial el plan de otro, al organizador le llega un
 *  push (si tiene los avisos activados; si no, le queda en su inicio, avisos_personales). Pasa por las horas de silencio. */
export async function avisarOrganizador(personId: string, eventoId: string, titulo: string, cuerpo: string, url: string) {
  if (!configuradoEnvio()) return { avisados: 0 };
  const sb = clienteServicio();
  const ahora = new Date();
  const { data: e } = await sb.from("eventos").select("fecha, inicio").eq("id", eventoId).maybeSingle();
  const envio = e ? horaDeEnvio(ahora, inicioDe(e as { fecha: string; inicio: string | null })) : ahora;
  await encolar(sb, [{ titulo, cuerpo, clave: `plan:${eventoId}:${ahora.getTime()}:${personId}`, tipo: "cambio", person_id: personId, eventos: [eventoId], url, programado_para: envio }]);
  await enviarPendientes(sb, ahora);
  return { avisados: 1 };
}

/** (d) El aviso de prueba, a los moviles de quien lo pide (D99.12). */
export async function avisoDePrueba(userId: string) {
  if (!configuradoEnvio()) return { enviados: 0, moviles: 0, configurado: false };
  const sb = clienteServicio();
  const ahora = new Date();
  await encolar(sb, [{ ...TEXTO_PRUEBA, clave: `prueba:${userId}:${ahora.getTime()}`, tipo: "prueba", user_id: userId, eventos: [], url: "/avisos", programado_para: ahora }]);
  const subs = (await leer(sb.from("suscripciones_avisos").select("id").eq("user_id", userId).eq("activa", true), "suscripciones")) as { id: string }[];
  const r = await enviarPendientes(sb, ahora);
  return { enviados: r.enviados, moviles: subs.length, configurado: true };
}
