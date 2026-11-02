// Que recordatorios tocan AHORA (D99.6): funcion PURA. La tarea de avisos (cada 15 minutos) la llama con los datos de
// la base y la hora; las pruebas, con una hora fija simulada. Devuelve avisos con una CLAVE unica: la tarea los escribe
// en el registro antes de enviarlos, asi repetir la tarea no duplica nada.
//
//   - Entreno del miercoles y partido del domingo (D173): lunes 19:00 y, el dia del PLAZO (miercoles 12:00 el entreno,
//     martes 12:00 el partido), UN aviso a las 09:00 a quien no ha respondido o sigue en «duda» (conAvisosDeDudas), unido a
//     cualquier otro recordatorio de ese dia. Al cierre del partido, aviso a quien sigue sin responder (avisosCierre).
//   - Entreno de otro dia: lunes 19:00 y el mismo dia 10:00.
//   - «Duda» de los demas eventos (D141): aviso a las 12:00 del dia del limite, unido a otro recordatorio de ese dia.
//   - Amistoso, torneo o «entre nosotros»: al crearlo y 24 h antes.
//   - El lunes a las 19:00 sale UN aviso por jugador con todo lo que le falta de esa semana.
//   - Solo a quien no ha respondido; una ausencia que cubre el dia cuenta como respondido.
//   - D146: tampoco a quien «no suele entrenar» en un entreno (cuenta como «no va (por defecto)», salvo que un gestor se lo
//     quitara para ese entreno) ni a quien es «nunca a partidos» en un partido.
//   - Nada si el evento lleva «Sin recordatorios», esta cancelado o ya empezo.
//   - Horas de silencio (22:30–8:00, D155): sale a las 8:00 salvo que el evento empiece en menos de 12 h.
//   - D152: el lunes a las 19:00, a quien le sale un entreno como «no va (por defecto)», UN aviso por entreno
//     («Te hemos puesto que no vas…»; avisosPorDefecto). Nunca se repite (clave por entreno y persona).

import { fueraPorFicha, quienResponde, type PersonaResponde } from "../respuestas/dominio.ts";
import { ausenciaQueCubre, claveQuitado, esEntreno, respuestaEfectiva, type MarcasDisponibilidad } from "../disponibilidad/porDefecto.ts";
import { avisoDeDudas, avisoDePlazo, enMadrid, horaDeEnvio, limiteDudas, lunesDe, madrid, plazoSemanal } from "./horario.ts";
import { queEs, textoCierre, textoDudas, textoNoVaPorDefecto, textoPasoNoVa, textoPlazo, textoEntrenoHoy, textoLunes, textoOtro, textoPlanManana, type EventoTexto, type Texto } from "./textos.ts";

/** `oficial = false`: plan no oficial de un jugador (D118). No entra en ningun recordatorio del club: solo, si el
 *  organizador lo marco, un aviso un dia antes (planificarPlanes). */
export type EventoPlan = EventoTexto & {
  estado: "programado" | "cancelado"; sin_recordatorios: boolean; creado_en: string;
  oficial?: boolean; recordar_un_dia_antes?: boolean; borrado_en?: string | null;
  /** D148: pista «solo con ficha» a la que va el entreno (columna calculada de la base), o null. */
  solo_con_ficha_en?: string | null;
};
export type JugadorPlan = {
  person_id: string; ficha_mda: boolean; ficha_mdl: boolean; entrena: boolean; activo: boolean; rol: PersonaResponde["rol"];
  /** D146: marcas privadas (las lee la tarea con el rol de servicio). Sin ellas, como siempre. */
  marcas?: MarcasDisponibilidad | null;
};
export type RespuestaPlan = { evento_id: string; person_id: string; respuesta: "va" | "duda" | "no" | "sin_responder" };
export type AusenciaPlan = { person_id: string; desde: string; hasta: string | null; borrada_en?: string | null };

export type DatosPlan = {
  ahora: Date;
  eventos: EventoPlan[];
  jugadores: JugadorPlan[];
  respuestas: RespuestaPlan[];
  ausencias: AusenciaPlan[];
  /** D146: entrenos en los que un gestor quito el «no va (por defecto)» a alguien (vuelve a recibir recordatorios). */
  quitados?: { evento_id: string; person_id: string }[];
};

export type AvisoPlan = Texto & {
  clave: string; tipo: "recordatorio"; person_id: string; eventos: string[]; url: string;
  /** Cuando "toca" (lunes 19:00...) y cuando sale de verdad (con el silencio). */
  toca: Date; programado_para: Date;
};

/** Si la tarea no pudo pasar a su hora, un recordatorio aun sale dentro de este margen; despues, ya no. */
export const MARGEN_MS = 3 * 3600 * 1000;

/** Invitados a un evento (D105): la definicion unica `quienResponde`, igual que en la base. */
export function invitados(e: Pick<EventoPlan, "tipo" | "equipo" | "oficial" | "solo_con_ficha_en">, jugadores: JugadorPlan[]) {
  return jugadores.filter((j) => quienResponde(e, j));
}

export const inicioDe = (e: Pick<EventoPlan, "fecha" | "inicio">) => madrid(e.fecha, e.inicio ? String(e.inicio).slice(0, 5) : "00:00");
export const urlEvento = (e: Pick<EventoPlan, "id"> & { oficial?: boolean }) => (e.oficial === false ? `/planes/${e.id}` : `/mi-zona/evento/${e.id}`);
export const urlDomingo = (fecha: string) => `/mi-zona/domingo/${fecha}`;

/** Estado de un jugador en un evento a efectos de recordatorio: su respuesta, y una ausencia que cubre el dia = "no". */
export function estadoPara(person: string, e: Pick<EventoPlan, "id" | "fecha">, respuestas: RespuestaPlan[], ausencias: AusenciaPlan[]) {
  const r = respuestas.find((x) => x.evento_id === e.id && x.person_id === person)?.respuesta ?? "sin_responder";
  if (r !== "sin_responder") return r;
  return ausenciaQueCubre(person, e.fecha, ausencias) ? "no" : "sin_responder";
}

/** Lo que cuenta para este jugador en este evento: la regla de todas las pantallas (`respuestaEfectiva`, D146 y D150). */
export function efectivaDe(j: Pick<JugadorPlan, "person_id" | "marcas">, e: Pick<EventoPlan, "id" | "fecha" | "tipo" | "oficial">, d: Pick<DatosPlan, "respuestas" | "ausencias" | "quitados">) {
  const r = d.respuestas.find((x) => x.evento_id === e.id && x.person_id === j.person_id)?.respuesta ?? "sin_responder";
  const quitado = !!d.quitados?.some((q) => claveQuitado(q.evento_id, q.person_id) === claveQuitado(e.id, j.person_id));
  return respuestaEfectiva(e, j.marcas, r, { quitado, ausencia: ausenciaQueCubre(j.person_id, e.fecha, d.ausencias) });
}

/** ¿Le toca recordatorio a este jugador en este evento? Sin responder (ni ausencia) y sin estar fuera por D146. */
export function pendienteDe(j: Pick<JugadorPlan, "person_id" | "marcas">, e: Pick<EventoPlan, "id" | "fecha" | "tipo" | "oficial">, d: Pick<DatosPlan, "respuestas" | "ausencias" | "quitados">) {
  // Con una ausencia que cubre el dia, «no va (por defecto)» o fuera del partido, no es pendiente.
  const r = efectivaDe(j, e, d);
  return !r.fuera && r.respuesta === "sin_responder";
}

type Hueco = { tipo: "lunes" | "plazo" | "cierre" | "dia" | "creado" | "24h"; toca: Date };

/** Los momentos en que un evento pide respuesta. «plazo» (09:00 del dia del plazo) y «cierre» (el plazo del partido) los
 *  generan conAvisosDeDudas y avisosCierre; aqui estan para el calendario de Gestion. */
export function huecos(e: EventoPlan): Hueco[] {
  const ini = inicioDe(e);
  const semanal = plazoSemanal(e);
  const lunes: Hueco = { tipo: "lunes", toca: madrid(lunesDe(e.fecha), "19:00") };
  if (semanal) {
    const limite = limiteDudas(e);
    return [lunes, { tipo: "plazo", toca: avisoDePlazo(limite) }, ...(semanal === "partido" ? [{ tipo: "cierre" as const, toca: limite }] : [])];
  }
  if (e.tipo === "entreno") return [lunes, { tipo: "dia", toca: madrid(e.fecha, "10:00") }];
  if (e.tipo === "liga") return [lunes];
  return [{ tipo: "creado", toca: new Date(e.creado_en) }, { tipo: "24h", toca: new Date(ini.getTime() - 24 * 3600 * 1000) }];
}

/** Un hueco vale si ya toca (con el silencio aplicado), aun no ha pasado el margen y el evento no ha empezado. Devuelve
 *  la hora de envio, o null. */
function valeHueco(e: EventoPlan, h: Hueco, d: Pick<DatosPlan, "ahora">) {
  const ahora = d.ahora.getTime();
  const ini = inicioDe(e);
  const envio = horaDeEnvio(h.toca, ini);
  const ok = e.estado === "programado" && !e.sin_recordatorios
    && envio.getTime() <= ahora && ahora < envio.getTime() + MARGEN_MS && ahora < ini.getTime() && h.toca.getTime() < ini.getTime();
  return ok ? envio : null;
}

export function planificar(datos: DatosPlan): AvisoPlan[] {
  // Los planes no oficiales no cuentan para nada del club (D118): fuera de estos recordatorios.
  const d = { ...datos, eventos: datos.eventos.filter((e) => e.oficial !== false) };
  const salida: AvisoPlan[] = [];
  const vale = (e: EventoPlan, h: Hueco) => valeHueco(e, h, d);
  const sinResponder = (j: JugadorPlan, e: EventoPlan) => pendienteDe(j, e, d);

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
    for (const e of g.eventos) for (const j of invitados(e, d.jugadores)) if (sinResponder(j, e)) porJugador.set(j.person_id, [...(porJugador.get(j.person_id) ?? []), e]);
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

  // ---- entreno de otro dia que el miercoles: el mismo dia a las 10:00; amistosos, torneos y «entre nosotros»: al crearlo
  //      y 24 h antes. (El dia del plazo del entreno del miercoles y del partido: conAvisosDeDudas.)
  for (const e of d.eventos) {
    for (const h of huecos(e)) {
      if (h.tipo === "lunes" || h.tipo === "plazo" || h.tipo === "cierre") continue;
      const envio = vale(e, h);
      if (!envio) continue;
      for (const j of invitados(e, d.jugadores)) {
        if (!sinResponder(j, e)) continue;
        const t = h.tipo === "dia" ? textoEntrenoHoy(e) : textoOtro(e, h.tipo === "creado" ? "creado" : "24h");
        salida.push({ clave: `rec:${h.tipo}:${e.id}:${j.person_id}`, tipo: "recordatorio", person_id: j.person_id, eventos: [e.id], ...t, url: urlEvento(e), toca: h.toca, programado_para: envio });
      }
    }
  }
  return salida;
}

/** D152: el lunes a las 19:00 (el hueco «lunes» del entreno, con el silencio y el margen de siempre), UN aviso por
 *  entreno a cada invitado al que le sale como «no va (por defecto)» (`respuestaEfectiva`, `por: "defecto"`): no si ya
 *  respondio, si tiene una ausencia que cubre el dia, si un gestor se lo quito para ese entreno ni si no esta invitado
 *  (D148, solo con ficha). Va aparte del aviso de «te faltan» (no se junta con nada) y su clave es por entreno y persona:
 *  la tarea nunca lo repite, aunque el entreno cambie de dia. */
export function avisosPorDefecto(datos: DatosPlan): AvisoPlan[] {
  const salida: AvisoPlan[] = [];
  for (const e of datos.eventos) {
    if (!esEntreno(e) || e.borrado_en) continue;
    const h = huecos(e).find((x) => x.tipo === "lunes");
    const envio = h && valeHueco(e, h, datos);
    if (!h || !envio) continue;
    for (const j of invitados(e, datos.jugadores)) {
      if (efectivaDe(j, e, datos).por !== "defecto") continue;
      salida.push({ clave: `rec:defecto:${e.id}:${j.person_id}`, tipo: "recordatorio", person_id: j.person_id, eventos: [e.id], ...textoNoVaPorDefecto(e), url: urlEvento(e), toca: h.toca, programado_para: envio });
    }
  }
  return salida;
}

/** Planes no oficiales (D118): si el organizador marco «recordar un dia antes», UN aviso 24 h antes a los invitados que
 *  no han respondido (una ausencia cuenta como respondido), con las horas de silencio. Ningun otro aviso automatico. */
export function planificarPlanes(d: DatosPlan): AvisoPlan[] {
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
  plazo: "El día del plazo a las 09:00 (sin responder o en «duda»)",
  cierre: "Al cierre (martes 12:00), a quien sigue sin responder",
  dia: "El mismo día a las 10:00",
  creado: "Al crear el evento",
  "24h": "24 horas antes",
};

/** El aviso del dia del limite (D141, D173), todo puro:
 *   - eventos con PLAZO SEMANAL (D173: partido del domingo, martes 12:00; entreno del miercoles, miercoles 12:00): a las
 *     09:00 del dia del plazo, UN aviso a quien no ha respondido (sin contar a quien esta fuera por D146 o una ausencia) o
 *     sigue en «duda»: «Tienes hasta hoy a las 12:00 para decir si vas; si no, te quedas fuera de la convocatoria»;
 *   - el resto (amistosos, torneos, planes…), como en D141: a las 12:00 del dia del limite (o una hora antes si es
 *     temprano), a quien siga en «duda»: «Te quedan hasta las 20:00 para confirmar…»;
 *   - si ese dia a esa persona ya sale otro recordatorio (`base`), se JUNTAN en uno: sale a la hora del primero, con la
 *     clave del aviso de dudas (repetir la tarea no duplica nada).
 *  Devuelve los avisos de `base` (sin los que se han juntado) mas los nuevos; la tarea solo encola lo que ya toca. */
export function conAvisosDeDudas(base: AvisoPlan[], datos: DatosPlan): AvisoPlan[] {
  const ahora = datos.ahora.getTime();
  const eventos = datos.eventos.filter((e) => e.estado === "programado" && !e.borrado_en && !e.sin_recordatorios);
  // (persona, dia del aviso) -> lo que tiene pendiente
  type Item = { e: EventoPlan; limite: Date; toca: Date; semanal: "partido" | "entreno" | null; duda: boolean };
  const grupos = new Map<string, { p: string; dia: string; items: Item[] }>();
  for (const e of eventos) {
    const limite = limiteDudas(e);
    const semanal = plazoSemanal(e);
    const toca = semanal ? avisoDePlazo(limite) : avisoDeDudas(limite);
    if (!toca || toca.getTime() >= limite.getTime() || ahora >= limite.getTime() || ahora >= inicioDe(e).getTime()) continue;
    for (const j of invitados(e, datos.jugadores)) {
      const duda = datos.respuestas.find((r) => r.evento_id === e.id && r.person_id === j.person_id)?.respuesta === "duda";
      if (!duda && !(semanal && pendienteDe(j, e, datos))) continue;
      const dia = enMadrid(toca).fecha;
      const g = grupos.get(`${j.person_id}|${dia}`) ?? { p: j.person_id, dia, items: [] };
      g.items.push({ e, limite, toca, semanal, duda });
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
    const semanales = g.items.filter((i) => i.semanal);
    const otros = g.items.filter((i) => !i.semanal);
    // Un domingo con dos partidos cuenta como uno; las dudas de otros eventos y lo que ya salia ese dia van en «Además».
    const unicos = semanales.filter((i, k) => i.semanal === "entreno" || semanales.findIndex((x) => x.semanal === "partido" && x.e.fecha === i.e.fecha) === k);
    const t = semanales.length
      ? textoPlazo(unicos.map((i) => ({ tipo: i.semanal!, fecha: i.e.fecha, inicio: i.e.inicio, duda: semanales.some((x) => x.e.fecha === i.e.fecha && x.duda), limite: i.limite })),
        [...otros.map((i) => `confirma tu «duda» del ${queEs(i.e)}`), ...propios.map((a) => a.titulo)], envio)
      : textoDudas(otros.map((i) => ({ que: queEs(i.e), limite: i.limite })), propios.map((a) => a.titulo), envio);
    const ids = [...new Set([...g.items.map((i) => i.e.id), ...propios.flatMap((a) => a.eventos)])];
    const unico = ids.length === 1 ? g.items.find((i) => i.e.id === ids[0])!.e : null;
    nuevos.push({
      clave: `rec:dudas:${toca.toISOString()}:${g.p}`, tipo: "recordatorio", person_id: g.p, eventos: ids, ...t,
      url: unico ? urlEvento(unico)
        : g.items.every((i) => i.e.tipo === "liga" && i.e.fecha === g.items[0].e.fecha) && !propios.length ? urlDomingo(g.items[0].e.fecha) : "/",
      toca, programado_para: envio,
    });
  }
  return [...base.filter((a) => !juntados.has(a)), ...nuevos];
}

/** D173: al cierre del partido (martes 12:00, con las horas de silencio y el margen de siempre), UN aviso por domingo a quien
 *  sigue sin responder a todos los partidos de ese domingo a los que esta invitado (sin contar a quien esta fuera por D146
 *  o una ausencia): «No has respondido: no entras en la propuesta de convocatoria…». Su respuesta no se toca. */
export function avisosCierre(datos: DatosPlan): AvisoPlan[] {
  const ahora = datos.ahora.getTime();
  const domingos = new Map<string, EventoPlan[]>();
  for (const e of datos.eventos) {
    if (plazoSemanal(e) !== "partido" || e.estado !== "programado" || e.borrado_en || e.sin_recordatorios) continue;
    domingos.set(e.fecha, [...(domingos.get(e.fecha) ?? []), e]);
  }
  const salida: AvisoPlan[] = [];
  for (const [fecha, partidos] of domingos) {
    const limite = limiteDudas(partidos[0]);
    const ini = Math.min(...partidos.map((e) => inicioDe(e).getTime()));
    const envio = horaDeEnvio(limite, new Date(ini));
    if (!(envio.getTime() <= ahora && ahora < envio.getTime() + MARGEN_MS && ahora < ini)) continue;
    const personas = new Set(partidos.flatMap((e) => invitados(e, datos.jugadores).map((j) => j.person_id)));
    for (const p of personas) {
      const j = datos.jugadores.find((x) => x.person_id === p)!;
      const suyos = partidos.filter((e) => invitados(e, datos.jugadores).some((x) => x.person_id === p));
      if (!suyos.every((e) => pendienteDe(j, e, datos))) continue;
      salida.push({ clave: `rec:cierre:${fecha}:${p}`, tipo: "recordatorio", person_id: p, eventos: suyos.map((e) => e.id), ...textoCierre(fecha), url: urlDomingo(fecha), toca: limite, programado_para: envio });
    }
  }
  return salida;
}

/** D141: el aviso «tu duda ha pasado a no va», UNO por persona y limite. Sale de las respuestas que el sistema cerro (origen
 *  sistema, motivo no_confirmo) en las ultimas 24 h y siguen asi: si la tarea falla despues de cerrar, el siguiente
 *  intento lo encola igual (clave estable), y quien ya volvio a decir «voy» no recibe nada. */
export function avisosPasoNoVa(base: { eventos: EventoPlan[]; respuestas: { evento_id: string; person_id: string; respuesta: string; motivo: string | null; origen: string; cambiado_en: string | null }[]; jugadores?: JugadorPlan[] }, ahora: Date): AvisoPlan[] {
  const desde = ahora.getTime() - 24 * 3600 * 1000;
  const grupos = new Map<string, { p: string; limite: Date; envio: Date; evs: EventoPlan[] }>();
  for (const r of base.respuestas) {
    if (r.respuesta !== "no" || r.motivo !== "no_confirmo" || r.origen !== "sistema" || !r.cambiado_en || new Date(r.cambiado_en).getTime() < desde) continue;
    const e = base.eventos.find((x) => x.id === r.evento_id);
    if (!e || e.estado !== "programado") continue;
    // D148: quien está fuera del entreno por no tener ficha no recibe avisos de ese entreno.
    const j = base.jugadores?.find((x) => x.person_id === r.person_id);
    if (j && fueraPorFicha(e, j)) continue;
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

