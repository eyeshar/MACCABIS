// Que recordatorios tocan AHORA (D99.6): funcion PURA. La tarea de avisos (cada 15 minutos) la llama con los datos de
// la base y la hora; las pruebas, con una hora fija simulada. Devuelve avisos con una CLAVE unica: la tarea los escribe
// en el registro antes de enviarlos, asi repetir la tarea no duplica nada.
//
//   - Entreno (miercoles): lunes 19:00 y el mismo dia 10:00.
//   - Partido (domingo):   lunes 19:00 y martes 10:00 (este, tambien a quien tiene «duda»).
//   - Amistoso, torneo o «entre nosotros»: al crearlo y 24 h antes.
//   - El lunes a las 19:00 sale UN aviso por jugador con todo lo que le falta de esa semana.
//   - Solo a quien no ha respondido; una ausencia que cubre el dia cuenta como respondido.
//   - Nada si el evento lleva «Sin recordatorios», esta cancelado o ya empezo, ni con el interruptor apagado.
//   - Horas de silencio (22:30–8:30): sale a las 8:30 salvo que el evento empiece en menos de 12 h.

import { quienResponde, type PersonaResponde } from "../respuestas/dominio.ts";
import { horaDeEnvio, lunesDe, madrid, sumarDias } from "./horario.ts";
import { queEs, textoEntrenoHoy, textoLunes, textoMartes, textoOtro, type EventoTexto, type Texto } from "./textos.ts";

export type EventoPlan = EventoTexto & { estado: "programado" | "cancelado"; sin_recordatorios: boolean; creado_en: string };
export type JugadorPlan = { person_id: string; ficha_mda: boolean; ficha_mdl: boolean; entrena: boolean; activo: boolean; rol: PersonaResponde["rol"] };
export type RespuestaPlan = { evento_id: string; person_id: string; respuesta: "va" | "duda" | "no" | "sin_responder" };
export type AusenciaPlan = { person_id: string; desde: string; hasta: string | null; borrada_en?: string | null };

export type DatosPlan = {
  ahora: Date;
  /** Cuando se encendio «respuestas en la web»; null = apagado (no sale ningun recordatorio). */
  encendidoDesde: Date | null;
  eventos: EventoPlan[];
  jugadores: JugadorPlan[];
  respuestas: RespuestaPlan[];
  ausencias: AusenciaPlan[];
};

export type AvisoPlan = Texto & {
  clave: string; tipo: "recordatorio"; person_id: string; eventos: string[]; url: string;
  /** Cuando "toca" (lunes 19:00...) y cuando sale de verdad (con el silencio). */
  toca: Date; programado_para: Date;
};

/** Si la tarea no pudo pasar a su hora, un recordatorio aun sale dentro de este margen; despues, ya no. */
export const MARGEN_MS = 3 * 3600 * 1000;

/** Invitados a un evento (D105): la definicion unica `quienResponde`, igual que en la base. */
export function invitados(e: Pick<EventoPlan, "tipo" | "equipo">, jugadores: JugadorPlan[]) {
  return jugadores.filter((j) => quienResponde(e, j));
}

export const inicioDe = (e: Pick<EventoPlan, "fecha" | "inicio">) => madrid(e.fecha, e.inicio ? String(e.inicio).slice(0, 5) : "00:00");
export const urlEvento = (e: Pick<EventoPlan, "id">) => `/mi-zona/evento/${e.id}`;
export const urlDomingo = (fecha: string) => `/mi-zona/domingo/${fecha}`;

/** Estado de un jugador en un evento a efectos de recordatorio: su respuesta, y una ausencia que cubre el dia = "no". */
export function estadoPara(person: string, e: Pick<EventoPlan, "id" | "fecha">, respuestas: RespuestaPlan[], ausencias: AusenciaPlan[]) {
  const r = respuestas.find((x) => x.evento_id === e.id && x.person_id === person)?.respuesta ?? "sin_responder";
  if (r !== "sin_responder") return r;
  const cubre = ausencias.some((a) => !a.borrada_en && a.person_id === person && a.desde <= e.fecha && (a.hasta == null || a.hasta >= e.fecha));
  return cubre ? "no" : "sin_responder";
}

type Hueco = { tipo: "lunes" | "martes" | "dia" | "creado" | "24h"; toca: Date };

/** Los momentos en que un evento pide respuesta. */
export function huecos(e: EventoPlan): Hueco[] {
  const ini = inicioDe(e);
  if (e.tipo === "entreno") return [{ tipo: "lunes", toca: madrid(lunesDe(e.fecha), "19:00") }, { tipo: "dia", toca: madrid(e.fecha, "10:00") }];
  if (e.tipo === "liga") return [{ tipo: "lunes", toca: madrid(lunesDe(e.fecha), "19:00") }, { tipo: "martes", toca: madrid(sumarDias(lunesDe(e.fecha), 1), "10:00") }];
  return [{ tipo: "creado", toca: new Date(e.creado_en) }, { tipo: "24h", toca: new Date(ini.getTime() - 24 * 3600 * 1000) }];
}

export function planificar(d: DatosPlan): AvisoPlan[] {
  if (!d.encendidoDesde) return [];
  const ahora = d.ahora.getTime();
  const salida: AvisoPlan[] = [];
  // Un hueco vale si ya toca (con el silencio aplicado), aun no ha pasado el margen, el evento no ha empezado y el
  // momento es posterior al encendido del interruptor.
  const vale = (e: EventoPlan, h: Hueco) => {
    const ini = inicioDe(e);
    const envio = horaDeEnvio(h.toca, ini);
    const ok = e.estado === "programado" && !e.sin_recordatorios && h.toca.getTime() >= d.encendidoDesde!.getTime()
      && envio.getTime() <= ahora && ahora < envio.getTime() + MARGEN_MS && ahora < ini.getTime() && h.toca.getTime() < ini.getTime();
    return ok ? envio : null;
  };
  const sinResponder = (p: string, e: EventoPlan) => estadoPara(p, e, d.respuestas, d.ausencias) === "sin_responder";

  // ---- lunes 19:00: agrupado por jugador (un domingo con dos partidos cuenta una vez)
  const porLunes = new Map<string, { envio: Date; toca: Date; eventos: EventoPlan[] }>();
  for (const e of d.eventos) {
    const h = huecos(e).find((x) => x.tipo === "lunes");
    const envio = h && vale(e, h);
    if (!h || !envio) continue;
    const k = lunesDe(e.fecha);
    const g = porLunes.get(k) ?? { envio, toca: h.toca, eventos: [] };
    g.eventos.push(e);
    porLunes.set(k, g);
  }
  for (const [lunes, g] of porLunes) {
    const porJugador = new Map<string, EventoPlan[]>();
    for (const e of g.eventos) for (const j of invitados(e, d.jugadores)) if (sinResponder(j.person_id, e)) porJugador.set(j.person_id, [...(porJugador.get(j.person_id) ?? []), e]);
    for (const [p, evs] of porJugador) {
      evs.sort((a, b) => (a.fecha + (a.inicio ?? "") < b.fecha + (b.inicio ?? "") ? -1 : 1));
      const unidades: { texto: string; url: string; ids: string[] }[] = [];
      for (const e of evs) {
        const u = e.tipo === "liga" ? unidades.find((x) => x.url === urlDomingo(e.fecha)) : null;
        if (u) { u.ids.push(e.id); continue; }
        unidades.push({ texto: queEs(e), url: e.tipo === "liga" ? urlDomingo(e.fecha) : urlEvento(e), ids: [e.id] });
      }
      salida.push({
        clave: `rec:lunes:${lunes}:${p}`, tipo: "recordatorio", person_id: p, eventos: unidades.flatMap((u) => u.ids),
        ...textoLunes(unidades.map((u) => u.texto)), url: unidades.length === 1 ? unidades[0].url : "/mi-zona", toca: g.toca, programado_para: g.envio,
      });
    }
  }

  // ---- martes 10:00 de un domingo de partido: sin responder y «duda», uno por jugador y domingo
  const domingos = new Map<string, EventoPlan[]>();
  for (const e of d.eventos) if (e.tipo === "liga") domingos.set(e.fecha, [...(domingos.get(e.fecha) ?? []), e]);
  for (const [fecha, partidos] of domingos) {
    const h = huecos(partidos[0]).find((x) => x.tipo === "martes")!;
    const abiertos = partidos.filter((e) => vale(e, h));
    if (!abiertos.length) continue;
    const envio = vale(abiertos[0], h)!;
    const personas = new Set(abiertos.flatMap((e) => invitados(e, d.jugadores).map((j) => j.person_id)));
    for (const p of personas) {
      const suyos = abiertos.filter((e) => invitados(e, d.jugadores).some((j) => j.person_id === p));
      const estados = suyos.map((e) => estadoPara(p, e, d.respuestas, d.ausencias));
      if (!estados.some((s) => s === "sin_responder" || s === "duda")) continue;
      const tieneDuda = !estados.includes("sin_responder");
      salida.push({
        clave: `rec:martes:${fecha}:${p}`, tipo: "recordatorio", person_id: p, eventos: suyos.map((e) => e.id),
        ...textoMartes(fecha, suyos.map((e) => String(e.inicio ?? "").slice(0, 5)).filter(Boolean), tieneDuda),
        url: suyos.length > 1 ? urlDomingo(fecha) : urlEvento(suyos[0]), toca: h.toca, programado_para: envio,
      });
    }
  }

  // ---- entreno: el mismo dia a las 10:00; amistosos, torneos y «entre nosotros»: al crearlo y 24 h antes
  for (const e of d.eventos) {
    for (const h of huecos(e)) {
      if (h.tipo === "lunes" || h.tipo === "martes") continue;
      const envio = vale(e, h);
      if (!envio) continue;
      for (const j of invitados(e, d.jugadores)) {
        if (!sinResponder(j.person_id, e)) continue;
        const t = h.tipo === "dia" ? textoEntrenoHoy(e) : textoOtro(e, h.tipo === "creado" ? "creado" : "24h");
        salida.push({ clave: `rec:${h.tipo}:${e.id}:${j.person_id}`, tipo: "recordatorio", person_id: j.person_id, eventos: [e.id], ...t, url: urlEvento(e), toca: h.toca, programado_para: envio });
      }
    }
  }
  return salida;
}

/** Los recordatorios de un evento para el lateral de Gestion: cuando tocan (con el silencio) segun su tipo. */
export function calendarioRecordatorios(e: EventoPlan) {
  const ini = inicioDe(e);
  return huecos(e).map((h) => ({ tipo: h.tipo, toca: h.toca, envio: horaDeEnvio(h.toca, ini) })).filter((h) => h.toca.getTime() < ini.getTime());
}

export const TEXTO_HUECO: Record<Hueco["tipo"], string> = {
  lunes: "Lunes a las 19:00 (uno por jugador con todo lo que le falta)",
  martes: "Martes a las 10:00 (sin responder y «duda»)",
  dia: "El mismo día a las 10:00",
  creado: "Al crear el evento",
  "24h": "24 horas antes",
};
