// Que recordatorios tocan AHORA (D99.6): funcion PURA. La tarea de avisos (cada 15 minutos) la llama con los datos de
// la base y la hora; las pruebas, con una hora fija simulada. Devuelve avisos con una CLAVE unica: la tarea los escribe
// en el registro antes de enviarlos, asi repetir la tarea no duplica nada.
//
//   - Entreno (miercoles): lunes 19:00 y el mismo dia 10:00.
//   - Partido (domingo):   lunes 19:00 y martes 10:00 (solo a quien no ha respondido; las «duda» tienen su aviso, D141).
//   - «Duda» (D141): aviso a las 12:00 del dia del limite (conAvisosDeDudas), unido a otro recordatorio de ese dia.
//   - Amistoso, torneo o «entre nosotros»: al crearlo y 24 h antes.
//   - El lunes a las 19:00 sale UN aviso por jugador con todo lo que le falta de esa semana.
//   - Solo a quien no ha respondido; una ausencia que cubre el dia cuenta como respondido.
//   - Nada si el evento lleva «Sin recordatorios», esta cancelado o ya empezo, ni con el interruptor apagado.
//   - Horas de silencio (22:30–8:30): sale a las 8:30 salvo que el evento empiece en menos de 12 h.

import { quienResponde, type PersonaResponde } from "../respuestas/dominio.ts";
import { avisoDeDudas, enMadrid, horaDeEnvio, limiteDudas, lunesDe, madrid, sumarDias } from "./horario.ts";
import { queEs, textoDudas, textoPasoNoVa, textoEntrenoHoy, textoLunes, textoMartes, textoOtro, textoPlanManana, type EventoTexto, type Texto } from "./textos.ts";

/** `oficial = false`: plan no oficial de un jugador (D118). No entra en ningun recordatorio del club: solo, si el
 *  organizador lo marco, un aviso un dia antes (planificarPlanes). */
export type EventoPlan = EventoTexto & {
  estado: "programado" | "cancelado"; sin_recordatorios: boolean; creado_en: string;
  oficial?: boolean; recordar_un_dia_antes?: boolean; borrado_en?: string | null;
};
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
export function invitados(e: Pick<EventoPlan, "tipo" | "equipo" | "oficial">, jugadores: JugadorPlan[]) {
  return jugadores.filter((j) => quienResponde(e, j));
}

export const inicioDe = (e: Pick<EventoPlan, "fecha" | "inicio">) => madrid(e.fecha, e.inicio ? String(e.inicio).slice(0, 5) : "00:00");
export const urlEvento = (e: Pick<EventoPlan, "id"> & { oficial?: boolean }) => (e.oficial === false ? `/planes/${e.id}` : `/mi-zona/evento/${e.id}`);
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

export function planificar(datos: DatosPlan): AvisoPlan[] {
  if (!datos.encendidoDesde) return [];
  // Los planes no oficiales no cuentan para nada del club (D118): fuera de estos recordatorios.
  const d = { ...datos, eventos: datos.eventos.filter((e) => e.oficial !== false) };
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
        ...textoLunes(unidades.map((u) => u.texto)), url: unidades.length === 1 ? unidades[0].url : "/", toca: g.toca, programado_para: g.envio,
      });
    }
  }

  // ---- martes 10:00 de un domingo de partido: sin responder (las «duda» van en su aviso de las 12:00), uno por jugador y domingo
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
      if (!estados.includes("sin_responder")) continue;
      salida.push({
        clave: `rec:martes:${fecha}:${p}`, tipo: "recordatorio", person_id: p, eventos: suyos.map((e) => e.id),
        ...textoMartes(fecha, suyos.map((e) => String(e.inicio ?? "").slice(0, 5)).filter(Boolean)),
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

/** Planes no oficiales (D118): si el organizador marco «recordar un dia antes», UN aviso 24 h antes a los invitados que
 *  no han respondido (una ausencia cuenta como respondido), con las horas de silencio. Ningun otro aviso automatico. No
 *  depende del interruptor de respuestas en la web: los planes solo se responden aqui. */
export function planificarPlanes(d: Omit<DatosPlan, "encendidoDesde">): AvisoPlan[] {
  const ahora = d.ahora.getTime();
  const salida: AvisoPlan[] = [];
  for (const e of d.eventos) {
    if (e.oficial !== false || !e.recordar_un_dia_antes || e.estado !== "programado" || e.borrado_en) continue;
    const ini = inicioDe(e);
    const toca = new Date(ini.getTime() - 24 * 3600 * 1000);
    const envio = horaDeEnvio(toca, ini);
    // Un plan creado con menos de un dia de margen no tiene «un dia antes»: no sale nada.
    if (new Date(e.creado_en).getTime() > toca.getTime()) continue;
    if (!(envio.getTime() <= ahora && ahora < envio.getTime() + MARGEN_MS && ahora < ini.getTime())) continue;
    for (const j of invitados(e, d.jugadores)) {
      if (estadoPara(j.person_id, e, d.respuestas, d.ausencias) !== "sin_responder") continue;
      salida.push({ clave: `rec:plan:${e.id}:${j.person_id}`, tipo: "recordatorio", person_id: j.person_id, eventos: [e.id], ...textoPlanManana(e), url: urlEvento(e), toca, programado_para: envio });
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
  martes: "Martes a las 10:00 (sin responder)",
  dia: "El mismo día a las 10:00",
  creado: "Al crear el evento",
  "24h": "24 horas antes",
};

/** «Duda» con hora limite (D141). Tres cosas, todas puras:
 *   - a las 12:00 del dia del limite (o una hora antes si el limite es temprano; horas de silencio), UN aviso por persona
 *     a quien siga en «duda»: «Te quedan hasta las 20:00 para confirmar; si no, contarás como "no va"»;
 *   - si ese dia a esa persona ya sale otro recordatorio (`base`), se JUNTAN en uno: sale a la hora del primero, con la
 *     clave del aviso de dudas (repetir la tarea no duplica nada);
 *   - eventos oficiales solo con el interruptor encendido (`encendidoDesde`); los planes, siempre.
 *  Devuelve los avisos de `base` (sin los que se han juntado) mas los de dudas; la tarea solo encola lo que ya toca. */
export function conAvisosDeDudas(base: AvisoPlan[], datos: DatosPlan): AvisoPlan[] {
  const ahora = datos.ahora.getTime();
  const eventos = datos.eventos.filter((e) => e.estado === "programado" && !e.borrado_en && !e.sin_recordatorios
    && (e.oficial === false || datos.encendidoDesde != null));
  // (persona, dia del aviso) -> lo que tiene en duda
  type Item = { e: EventoPlan; limite: Date; toca: Date };
  const grupos = new Map<string, { p: string; dia: string; items: Item[] }>();
  for (const e of eventos) {
    const limite = limiteDudas(e);
    const toca = avisoDeDudas(limite);
    if (!toca || ahora >= limite.getTime() || ahora >= inicioDe(e).getTime()) continue;
    for (const j of invitados(e, datos.jugadores)) {
      if (datos.respuestas.find((r) => r.evento_id === e.id && r.person_id === j.person_id)?.respuesta !== "duda") continue;
      const dia = enMadrid(toca).fecha;
      const g = grupos.get(`${j.person_id}|${dia}`) ?? { p: j.person_id, dia, items: [] };
      g.items.push({ e, limite, toca });
      grupos.set(`${j.person_id}|${dia}`, g);
    }
  }
  const juntados = new Set<AvisoPlan>();
  const nuevos: AvisoPlan[] = [];
  for (const g of grupos.values()) {
    g.items.sort((a, b) => a.toca.getTime() - b.toca.getTime() || (a.e.id < b.e.id ? -1 : 1));
    const propios = base.filter((a) => a.person_id === g.p && enMadrid(a.programado_para).fecha === g.dia);
    const toca = g.items[0].toca;
    const envio = new Date(Math.min(toca.getTime(), ...propios.map((a) => a.programado_para.getTime())));
    const hasta = Math.min(...g.items.map((i) => i.limite.getTime()));
    if (!(envio.getTime() <= ahora && ahora < envio.getTime() + MARGEN_MS && ahora < hasta)) continue;
    propios.forEach((a) => juntados.add(a));
    const t = textoDudas(g.items.map((i) => ({ que: queEs(i.e), limite: i.limite })), propios.map((a) => a.titulo), envio);
    const ids = [...new Set([...g.items.map((i) => i.e.id), ...propios.flatMap((a) => a.eventos)])];
    const unico = ids.length === 1 ? g.items.find((i) => i.e.id === ids[0])!.e : null;
    nuevos.push({
      clave: `rec:dudas:${toca.toISOString()}:${g.p}`, tipo: "recordatorio", person_id: g.p, eventos: ids, ...t,
      url: unico ? urlEvento(unico) : g.items.every((i) => i.e.tipo === "liga" && i.e.fecha === g.items[0].e.fecha) && !propios.length ? urlDomingo(g.items[0].e.fecha) : "/",
      toca, programado_para: envio,
    });
  }
  return [...base.filter((a) => !juntados.has(a)), ...nuevos];
}

/** D141: el aviso «tu duda ha pasado a no va», UNO por persona y limite. Sale de las respuestas que el sistema cerro (origen
 *  sistema, motivo no_confirmo) en las ultimas 24 h y siguen asi: si la tarea falla despues de cerrar, el siguiente
 *  intento lo encola igual (clave estable), y quien ya volvio a decir «voy» no recibe nada. */
export function avisosPasoNoVa(base: { eventos: EventoPlan[]; respuestas: { evento_id: string; person_id: string; respuesta: string; motivo: string | null; origen: string; cambiado_en: string | null }[] }, ahora: Date): AvisoPlan[] {
  const desde = ahora.getTime() - 24 * 3600 * 1000;
  const grupos = new Map<string, { p: string; limite: Date; envio: Date; evs: EventoPlan[] }>();
  for (const r of base.respuestas) {
    if (r.respuesta !== "no" || r.motivo !== "no_confirmo" || r.origen !== "sistema" || !r.cambiado_en || new Date(r.cambiado_en).getTime() < desde) continue;
    const e = base.eventos.find((x) => x.id === r.evento_id);
    if (!e || e.estado !== "programado") continue;
    const limite = limiteDudas(e);
    const k = `${r.person_id}|${limite.toISOString()}`;
    const g = grupos.get(k) ?? { p: r.person_id, limite, envio: horaDeEnvio(new Date(r.cambiado_en), inicioDe(e)), evs: [] };
    g.evs.push(e);
    grupos.set(k, g);
  }
  return [...grupos.values()].map((g) => {
    g.evs.sort((a, b) => (a.fecha + (a.inicio ?? "") < b.fecha + (b.inicio ?? "") ? -1 : 1));
    const t = textoPasoNoVa(g.evs.map(queEs));
    const unico = g.evs.length === 1 ? g.evs[0] : null;
    return { ...t, clave: `rec:paso:${g.limite.toISOString()}:${g.p}`, tipo: "recordatorio" as const, person_id: g.p, eventos: g.evs.map((e) => e.id), toca: g.limite,
      url: unico ? urlEvento(unico) : g.evs.every((e) => e.tipo === "liga" && e.fecha === g.evs[0].fecha) ? urlDomingo(g.evs[0].fecha) : "/", programado_para: g.envio };
  });
}

