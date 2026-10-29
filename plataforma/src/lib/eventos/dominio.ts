// Dominio de los eventos (paso 2, pista E, D94): funciones PURAS, sin acceso a datos y sin imports, para que las use la
// web y las pruebas (`node` puede cargar este fichero tal cual; solo importa la definicion unica de quien responde). Fechas como "AAAA-MM-DD" y horas como "HH:MM".

import { quienResponde } from "../respuestas/dominio.ts";
import { enlaceGoogle } from "../ubicacion.ts";

export type TipoEvento = "entreno" | "liga" | "amistoso" | "torneo" | "interno" | "quedada" | "pachanga" | "otro";
export type EquipoEvento = "MdA" | "MdL" | "ambos";
export type EstadoPista = "habitual" | "provisional" | "en_obras" | "cerrada";
export type EstadoCopia = "pendiente" | "copiado";
export type Respuesta = "va" | "duda" | "no" | "sin_responder";
export type Motivo = "lesion" | "trabajo" | "viaje" | "familia" | "otro";

export type Pista = {
  id: string; slug: string; nombre: string; nombre_corto: string | null; direccion: string | null;
  uso: "entreno" | "partido"; estado: EstadoPista; es_de_serie: boolean; num_pistas: number | null; nota: string | null;
  /** D148: en los entrenos en esta pista solo están invitados los jugadores con ficha (MdA o MdL). */
  solo_con_ficha?: boolean;
  /** D148: la regla «solo con ficha» vale desde esta fecha (null: siempre). */
  solo_con_ficha_desde?: string | null;
  /** D148: los entrenos sin pista propia heredan esta pista de la serie solo desde esta fecha (null: siempre). */
  habitual_desde?: string | null;
  /** D119: coordenadas («Cómo llegar»). */
  lat?: number | null; lng?: number | null;
};
/** Ubicacion libre de un evento (D119): cuando no usa una pista del catalogo. */
export type UbicacionLibre = { ubicacion_nombre?: string | null; ubicacion_direccion?: string | null; ubicacion_lat?: number | null; ubicacion_lng?: number | null; ubicacion_enlace?: string | null };

export type EventoFila = {
  id: string; clave: string; temporada: string; tipo: TipoEvento; equipo: EquipoEvento; titulo: string | null;
  jornada: number | null; rival: string | null; es_local: boolean | null; fecha: string;
  inicio: string | null; fin: string | null; quedada: string | null; pista_id: string | null; numero_pista: number | null;
  notas: string | null; origen: "ayuntamiento" | "manual"; serie: string | null; estado: "programado" | "cancelado";
  sporteasy_estado: EstadoCopia; sporteasy_cambio: string | null; sporteasy_copiado_en: string | null;
  /** Paso 3 (D99) */
  sin_recordatorios?: boolean; creado_en?: string; cambio_visible?: { campos: string[]; antes: string } | null; cambio_visible_en?: string | null;
  /** D118: plan no oficial (oficial = false) y su organizador; D119: ubicacion libre. */
  oficial?: boolean; creado_por?: string | null; plazas?: number | null; recordar_un_dia_antes?: boolean; rival_texto?: string | null; borrado_en?: string | null;
  /** D148: columna calculada de la base (solo_con_ficha_en): la pista «solo con ficha» a la que va este entreno, o null. */
  solo_con_ficha_en?: string | null;
} & UbicacionLibre;

export const TIPOS: { id: TipoEvento; texto: string; corto: string }[] = [
  { id: "entreno", texto: "Entreno", corto: "ENTRENO" },
  { id: "liga", texto: "Partido de liga", corto: "LIGA" },
  { id: "amistoso", texto: "Amistoso", corto: "AMISTOSO" },
  { id: "torneo", texto: "Torneo", corto: "TORNEO" },
  { id: "interno", texto: "Entre nosotros", corto: "INTERNO" },
  { id: "quedada", texto: "Quedada", corto: "QUEDADA" },
  { id: "pachanga", texto: "Pachanga", corto: "PACHANGA" },
  { id: "otro", texto: "Otro plan", corto: "OTRO" },
];
/** Un plan no oficial de un jugador (D118): no cuenta para nada del club. */
export const esPlanFila = (e: Pick<EventoFila, "oficial">) => e.oficial === false;
export const textoTipo = (t: TipoEvento) => TIPOS.find((x) => x.id === t)?.texto ?? t;

export const TEXTO_ESTADO_PISTA: Record<EstadoPista, string> = { habitual: "Habitual", provisional: "Provisional", en_obras: "En obras", cerrada: "Cerrada" };
export const TEXTO_RESPUESTA: Record<Respuesta, string> = { va: "Va", duda: "Duda", no: "No va", sin_responder: "Sin responder" };
export const TEXTO_MOTIVO: Record<Motivo, string> = { lesion: "Lesión", trabajo: "Trabajo", viaje: "Viaje", familia: "Familia", otro: "Otro" };
export const MOTIVOS = Object.keys(TEXTO_MOTIVO) as Motivo[];

// ---------------------------------------------------------------- fechas y horas
const d = (f: string) => new Date(`${f}T12:00:00Z`);
export const hhmm = (t: string | null | undefined) => (t ? String(t).slice(0, 5) : null);
export const sumarDias = (f: string, n: number) => { const x = d(f); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const diaDeLaSemana = (f: string) => d(f).getUTCDay();
export function restarMinutos(hora: string, min: number) {
  const [h, m] = hora.split(":").map(Number);
  const t = (((h * 60 + m - min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
/** Quedada por defecto: 20 minutos antes del inicio. */
export const quedadaPorDefecto = (inicio: string | null) => (inicio ? restarMinutos(inicio, 20) : null);
/** "miércoles 14/10" */
export const diaCorto = (f: string) => {
  const s = d(f).toLocaleDateString("es-ES", { timeZone: "UTC", weekday: "long" });
  return `${s} ${f.slice(8, 10)}/${f.slice(5, 7)}`;
};
/** "Mié 14" */
export const diaYNumero = (f: string) => {
  const s = d(f).toLocaleDateString("es-ES", { timeZone: "UTC", weekday: "short" }).replace(/\./g, "");
  return `${s[0].toUpperCase()}${s.slice(1)} ${+f.slice(8)}`;
};
/** "14/10/2026" */
export const fechaDMA = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`;
/** "20:30–22:30" / "10:15" */
export const rangoHoras = (e: Pick<EventoFila, "inicio" | "fin">) => {
  const i = hhmm(e.inicio), f = hhmm(e.fin);
  return i ? (f ? `${i}–${f}` : i) : "Hora por confirmar";
};

// ---------------------------------------------------------------- pista efectiva (igual que v_eventos_publicos)
export type PistaEfectiva = { pista: Pista | null; texto: string; porConfirmar: boolean; motivo: string | null };

/** La pista propia del evento; si no tiene y es un entreno, la de la serie SOLO si esta habitual y el entreno es de su
 *  fecha «habitual desde» o posterior (D148: nada retroactivo; en obras: "por confirmar" y el motivo dice cual). Un
 *  partido sin pista tambien sale "por confirmar". */
export function pistaEfectiva(e: Pick<EventoFila, "tipo" | "pista_id" | "numero_pista"> & { fecha?: string } & UbicacionLibre, pistas: Pista[]): PistaEfectiva {
  const propia = e.pista_id ? pistas.find((p) => p.id === e.pista_id) ?? null : null;
  const corto = (p: Pista) => p.nombre_corto ?? p.nombre;
  if (propia) {
    const n = e.numero_pista ? ` · Pista ${e.numero_pista}` : "";
    return { pista: propia, texto: `${corto(propia)}${n}`, porConfirmar: false, motivo: null };
  }
  // Ubicacion libre (D119): un sitio fuera del catalogo de pistas.
  if (e.ubicacion_nombre) return { pista: null, texto: e.ubicacion_nombre, porConfirmar: false, motivo: null };
  if (e.tipo === "entreno") {
    const deSerie = pistas.find((p) => p.es_de_serie && p.uso === "entreno");
    const serie = deSerie?.habitual_desde && !(e.fecha && e.fecha >= deSerie.habitual_desde) ? undefined : deSerie;
    if (serie?.estado === "habitual") return { pista: serie, texto: corto(serie), porConfirmar: false, motivo: null };
    return { pista: null, texto: "Pista por confirmar", porConfirmar: true, motivo: serie?.estado === "en_obras" ? `${serie.nombre.split(" (")[0]} en obras` : null };
  }
  return { pista: null, texto: "Pista por confirmar", porConfirmar: true, motivo: null };
}

// ---------------------------------------------------------------- titulo y texto de un evento
const NOMBRE_NUESTRO = { MdA: "MdA", MdL: "MdL", ambos: "Maccabis" } as const;
/** Para MOSTRAR: puntuacion repetida fuera ("C.B.." -> "C.B."). El nombre guardado (el del Ayuntamiento) no se toca. */
export const limpiarRival = (r: string | null | undefined) => (r == null ? r : r.replace(/([.,;:!?])\1+/g, "$1").replace(/\s+/g, " ").trim()) as string | null;

export function tituloEvento(e: Pick<EventoFila, "tipo" | "equipo" | "titulo" | "rival" | "es_local" | "jornada">) {
  if (e.tipo === "liga" && e.rival) {
    const n = NOMBRE_NUESTRO[e.equipo];
    const rv = limpiarRival(e.rival);
    return `${e.es_local === false ? `${rv} – ${n}` : `${n} – ${rv}`}`;
  }
  if (e.tipo === "entreno") return e.titulo ?? "Entrenamiento semanal";
  if (e.rival && e.titulo) return `${e.titulo} · ${limpiarRival(e.rival)}`;
  return e.titulo ?? limpiarRival(e.rival) ?? textoTipo(e.tipo);
}

// ---------------------------------------------------------------- series de entrenos
/** Como se nombra una serie de cara a las personas: «serie miércoles 20:30–22:30» (nunca su nombre interno, «entreno-semanal»). */
export function nombreSerie(e: Pick<EventoFila, "fecha" | "inicio" | "fin">) {
  const dia = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][new Date(`${e.fecha}T12:00:00Z`).getUTCDay()];
  const i = e.inicio ? String(e.inicio).slice(0, 5) : null, f = e.fin ? String(e.fin).slice(0, 5) : null;
  return `serie ${dia}${i ? ` ${i}${f ? `–${f}` : ""}` : ""}`;
}

/** Eventos de la misma serie desde `base` (inclusive), por fecha, sin los cancelados. */
export function deLaSerieDesde<T extends Pick<EventoFila, "serie" | "fecha" | "estado" | "id">>(todos: T[], base: Pick<EventoFila, "serie" | "fecha">): T[] {
  if (!base.serie) return [];
  return todos.filter((e) => e.serie === base.serie && e.fecha >= base.fecha && e.estado === "programado").sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
}

// ---------------------------------------------------------------- cambios y copia a SportEasy
export type CamposEditables = Pick<EventoFila, "tipo" | "equipo" | "titulo" | "rival" | "es_local" | "fecha" | "inicio" | "fin" | "quedada" | "pista_id" | "numero_pista" | "notas" | "estado" | "jornada"> & UbicacionLibre;

/** Cambios entre dos versiones de un evento, en lenguaje llano ("pista: Pista por confirmar → Caja Mágica"). */
export function describirCambios(antes: CamposEditables, despues: CamposEditables, pistas: Pista[]): string[] {
  const c: string[] = [];
  if (antes.estado !== despues.estado) c.push(despues.estado === "cancelado" ? "evento cancelado" : "evento restablecido");
  if (antes.fecha !== despues.fecha) c.push(`fecha: ${fechaDMA(antes.fecha)} → ${fechaDMA(despues.fecha)}`);
  if (hhmm(antes.inicio) !== hhmm(despues.inicio)) c.push(`hora de inicio: ${hhmm(antes.inicio) ?? "sin hora"} → ${hhmm(despues.inicio) ?? "sin hora"}`);
  if (hhmm(antes.fin) !== hhmm(despues.fin)) c.push(`hora de fin: ${hhmm(antes.fin) ?? "sin hora"} → ${hhmm(despues.fin) ?? "sin hora"}`);
  if (hhmm(antes.quedada) !== hhmm(despues.quedada)) c.push(`quedada: ${hhmm(antes.quedada) ?? "sin quedada"} → ${hhmm(despues.quedada) ?? "sin quedada"}`);
  const pa = pistaEfectiva(antes, pistas), pd = pistaEfectiva(despues, pistas);
  if (pa.texto !== pd.texto) c.push(`pista: ${pa.texto} → ${pd.texto}`);
  else if ([antes.ubicacion_direccion, antes.ubicacion_lat, antes.ubicacion_lng, antes.ubicacion_enlace].join("|") !== [despues.ubicacion_direccion, despues.ubicacion_lat, despues.ubicacion_lng, despues.ubicacion_enlace].join("|")) c.push(`sitio: ${pd.texto} (dirección o mapa cambiados)`);
  if ((antes.notas ?? "") !== (despues.notas ?? "")) c.push(despues.notas ? `notas: «${despues.notas}»` : "notas quitadas");
  if (antes.tipo !== despues.tipo) c.push(`tipo: ${textoTipo(antes.tipo)} → ${textoTipo(despues.tipo)}`);
  if (antes.equipo !== despues.equipo) c.push(`equipo: ${antes.equipo} → ${despues.equipo}`);
  if ((antes.rival ?? "") !== (despues.rival ?? "")) c.push(`rival: ${antes.rival ?? "—"} → ${despues.rival ?? "—"}`);
  // D129: sin «local / visitante» en lo que ve la gente; si cambia, se dice el cartel nuevo tal cual (el orden del calendario).
  if (antes.es_local !== despues.es_local) c.push(`cartel: ${tituloEvento(antes)} → ${tituloEvento(despues)}`);
  if ((antes.titulo ?? "") !== (despues.titulo ?? "")) c.push(`título: ${despues.titulo ?? "—"}`);
  return c;
}

/** La base de pruebas local usa WIN1252 (sin la flecha «→»): lo que se guarda lleva « -> » y al mostrarlo vuelve a ser «→». */
export const cambioParaGuardar = (t: string | null) => (t == null ? t : t.replaceAll("→", "->"));
export const cambioParaVer = (t: string | null) => (t == null ? t : t.replaceAll(" -> ", " → "));

/** Texto de "cambio pendiente": lo anterior + lo nuevo, sin repetir. */
export const juntarCambios = (previo: string | null, nuevos: string[]) => {
  const lista = [...(previo && previo !== "Cambio sin describir" && !previo.startsWith("Carga inicial") ? previo.split("; ") : []), ...nuevos];
  return cambioParaGuardar([...new Set(lista.map((x) => cambioParaGuardar(x)!))].join("; ") || null);
};

/** Enlace «Cómo llegar» de un evento (D119): la pista efectiva si tiene coordenadas o direccion; si no, la ubicacion
 *  libre. null si no hay con que hacerlo (pista por confirmar, o solo un nombre sin mapa). */
export function mapaDe(e: Pick<EventoFila, "tipo" | "pista_id" | "numero_pista"> & UbicacionLibre, pistas: Pista[]) {
  const pe = pistaEfectiva(e, pistas);
  if (pe.pista) return pe.pista.lat != null || pe.pista.direccion ? enlaceGoogle({ nombre: pe.pista.nombre, direccion: pe.pista.direccion, lat: pe.pista.lat ?? null, lng: pe.pista.lng ?? null, enlace: null }) : null;
  if (!e.ubicacion_nombre && !e.ubicacion_enlace) return null;
  if (e.ubicacion_lat == null && !e.ubicacion_direccion && !e.ubicacion_enlace) return null;
  return enlaceGoogle({ nombre: e.ubicacion_nombre ?? "", direccion: e.ubicacion_direccion ?? null, lat: e.ubicacion_lat ?? null, lng: e.ubicacion_lng ?? null, enlace: e.ubicacion_enlace ?? null });
}

// ---------------------------------------------------------------- mensaje de WhatsApp al guardar
export type AccionMensaje = "nuevo" | "cambio" | "cancelado";

/** El texto para pegar en el grupo de WhatsApp. `lineaEquipacion` (rutina C) se pasa ya calculada, solo en partidos. */
export function mensajeWhatsApp(e: EventoFila, pistas: Pista[], accion: AccionMensaje, opciones: { cambios?: string[]; lineaEquipacion?: string | null; respondeEnLaWeb?: string | null } = {}) {
  const pe = pistaEfectiva(e, pistas);
  const dia = diaCorto(e.fecha);
  const hora = hhmm(e.inicio);
  const quedada = hhmm(e.quedada);
  // «Pista 3» escrito en las notas cuenta como numero de pista (y no se repite en las notas).
  const notaPista = !e.numero_pista ? e.notas?.match(/^\s*pista\s+(\d+)\s*\.?\s*$/i) : null;
  const numero = e.numero_pista ?? (notaPista ? Number(notaPista[1]) : null);
  const notas = notaPista ? null : e.notas;
  const sitio = !pe.porConfirmar && !pe.pista ? `en ${pe.texto}${e.ubicacion_direccion ? ` — ${e.ubicacion_direccion.replace(/\.$/, "")}` : ""}`
    : pe.porConfirmar || !pe.pista ? `pista por confirmar${pe.motivo ? ` (${pe.motivo})` : ""}`
    : `en ${pe.pista.nombre_corto ?? pe.pista.nombre}${numero ? `, pista ${numero}` : ""}${pe.pista.direccion ? ` — ${pe.pista.direccion.replace(/\.$/, "")}` : ""}`;
  const que = e.tipo === "entreno" ? `entreno del ${dia}`
    : e.tipo === "liga" ? `partido de liga${e.jornada ? ` (J${e.jornada})` : ""} ${tituloEvento(e)}, ${dia}`
    : `${textoTipo(e.tipo).toLowerCase()}${e.titulo ? ` «${e.titulo}»` : ""}${e.rival ? ` contra ${limpiarRival(e.rival)}` : ""}, ${dia}`;
  if (accion === "cancelado") return `Se cancela el ${que}. Perdonad las molestias.`;
  const fin = hhmm(e.fin);
  const cuando = hora ? `${fin ? `de ${hora} a ${fin}` : `a las ${hora}`}${quedada ? ` (encuentro ${quedada})` : ""}` : "hora por confirmar";
  const detalle = `${cuando} ${sitio}`.replace(" pista por confirmar", ", pista por confirmar");
  const cab = accion === "cambio" && opciones.cambios?.length ? `Cambio en el ${que}` : `${que[0].toUpperCase()}${que.slice(1)}`;
  const lineas = [`${cab}: ${detalle.replace(/\.$/, "")}.`];
  if (accion === "cambio" && opciones.cambios?.length) lineas.push(`Qué cambia: ${opciones.cambios.join("; ")}.`);
  // D119: el enlace de Google Maps del sitio (pista con coordenadas o direccion, o la ubicacion libre).
  const mapa = mapaDe(e, pistas);
  if (mapa) lineas.push(`Cómo llegar: ${mapa}`);
  if (notas) lineas.push(notas.replace(/\.$/, "") + ".");
  if (opciones.lineaEquipacion) lineas.push(opciones.lineaEquipacion);
  // Con «respuestas en la web» encendido (D99) se termina con el enlace a la web; si no, SportEasy (fase puente).
  lineas.push(opciones.respondeEnLaWeb ? `Responde en la web: ${opciones.respondeEnLaWeb}` : "Responded en SportEasy, por favor.");
  return lineas.join("\n");
}

// ---------------------------------------------------------------- ¿quien esta convocado a un evento?
export type JugadorBasico = { person_id: string; nombre_visible: string; ficha_mda: boolean; ficha_mdl: boolean; entrena: boolean; activo: boolean; rol: "jugador" | "solo_entreno" | "entrenador" };

/** Personas a las que se les pide respuesta (D105): la definicion unica `quienResponde`. */
export function convocadosDe(e: Pick<EventoFila, "tipo" | "equipo" | "oficial" | "solo_con_ficha_en">, jugadores: JugadorBasico[]) {
  return jugadores.filter((j) => quienResponde(e, j));
}

// ---------------------------------------------------------------- respuestas ordenadas
export const ORDEN_RESPUESTA: Record<Respuesta, number> = { no: 0, duda: 1, sin_responder: 2, va: 3 };

export type FilaRespuesta = { person_id: string; nombre: string; respuesta: Respuesta; motivo: Motivo | null; detalle: string | null; leido_en: string | null; porPeriodo: { motivo: Motivo; desde: string; hasta: string } | null };
export type Periodo = { person_id: string; desde: string; hasta: string; motivo: Motivo };

/** Una fila por convocado: su respuesta guardada o "sin responder". Ordenadas: no van → dudan → sin responder → van. */
export function ordenarRespuestas(
  e: Pick<EventoFila, "fecha">, convocados: JugadorBasico[],
  respuestas: { person_id: string; respuesta: Respuesta; motivo: Motivo | null; detalle: string | null; leido_en: string | null }[],
  periodos: Periodo[],
): FilaRespuesta[] {
  const porPersona = new Map(respuestas.map((r) => [r.person_id, r]));
  const filas = convocados.map((j) => {
    const r = porPersona.get(j.person_id);
    const periodo = periodos.find((p) => p.person_id === j.person_id && p.desde <= e.fecha && e.fecha <= p.hasta) ?? null;
    return {
      person_id: j.person_id, nombre: j.nombre_visible,
      respuesta: r?.respuesta ?? "sin_responder", motivo: r?.motivo ?? null, detalle: r?.detalle ?? null, leido_en: r?.leido_en ?? null,
      porPeriodo: periodo ? { motivo: periodo.motivo, desde: periodo.desde, hasta: periodo.hasta } : null,
    } satisfies FilaRespuesta;
  });
  return filas.sort((a, b) => ORDEN_RESPUESTA[a.respuesta] - ORDEN_RESPUESTA[b.respuesta] || a.nombre.localeCompare(b.nombre, "es"));
}

export const contarRespuestas = (filas: { respuesta: Respuesta }[]) => ({
  va: filas.filter((f) => f.respuesta === "va").length,
  duda: filas.filter((f) => f.respuesta === "duda").length,
  no: filas.filter((f) => f.respuesta === "no").length,
  sin_responder: filas.filter((f) => f.respuesta === "sin_responder").length,
});

/** Resumen por evento tras importar respuestas, para cotejarlo con SportEasy: solo cuenta a quien se le pide respuesta
 *  (los demas, aparte, en «fuera»). Sin nombres ni motivos: solo cuantos llevan motivo. Ordenado por fecha y hora. */
export type FilaCotejo = { id: string; fecha: string; titulo: string; equipo: EquipoEvento; va: number; duda: number; no: number; sin_responder: number; conMotivo: number; fuera: number };
export function resumenCotejo(
  eventos: Pick<EventoFila, "id" | "fecha" | "inicio" | "tipo" | "equipo" | "titulo" | "rival" | "es_local" | "jornada" | "oficial" | "solo_con_ficha_en">[],
  jugadores: JugadorBasico[], respuestas: { evento_id: string; person_id: string; respuesta: Respuesta; motivo: string | null }[],
): FilaCotejo[] {
  const porEvento = new Map<string, typeof respuestas>();
  for (const r of respuestas) porEvento.set(r.evento_id, [...(porEvento.get(r.evento_id) ?? []), r]);
  return [...eventos].sort((a, b) => (a.fecha + (a.inicio ?? "")).localeCompare(b.fecha + (b.inicio ?? ""))).map((e) => {
    const invitados = new Set(convocadosDe(e, jugadores).map((j) => j.person_id));
    const suyas = (porEvento.get(e.id) ?? []).filter((r) => invitados.has(r.person_id));
    const filas = [...invitados].map((id) => suyas.find((r) => r.person_id === id) ?? { respuesta: "sin_responder" as Respuesta, motivo: null });
    return {
      id: e.id, fecha: e.fecha, titulo: tituloEvento(e), equipo: e.equipo, ...contarRespuestas(filas),
      conMotivo: filas.filter((f) => f.respuesta !== "sin_responder" && f.motivo).length,
      fuera: (porEvento.get(e.id) ?? []).filter((r) => !invitados.has(r.person_id) && r.respuesta !== "sin_responder").length,
    };
  });
}
/** «12 van · 3 no · 8 sin responder» (y «· 1 duda» si hay). */
export const textoCotejo = (f: Pick<FilaCotejo, "va" | "duda" | "no" | "sin_responder">) =>
  `${f.va} ${f.va === 1 ? "va" : "van"} · ${f.no} no${f.duda ? ` · ${f.duda} duda` : ""} · ${f.sin_responder} sin responder`;

/** Lista y texto del recordatorio que Claude enviara desde SportEasy (con el OK de Ivan). Solo lo genera. */
export function recordatorio(e: EventoFila, filas: FilaRespuesta[], pistas: Pista[]) {
  const faltan = filas.filter((f) => f.respuesta === "sin_responder" && !f.porPeriodo).map((f) => f.nombre);
  const hora = hhmm(e.inicio);
  const que = e.tipo === "entreno" ? `entreno del ${diaCorto(e.fecha)}` : `${tituloEvento(e)} del ${diaCorto(e.fecha)}`;
  const pe = pistaEfectiva(e, pistas);
  const texto = faltan.length
    ? `Chicos, os falta responder en SportEasy al ${que}${hora ? ` (${hora}${pe.porConfirmar ? "" : `, ${pe.texto.replace(" · Pista", ", pista")}`})` : ""}. Es un momento: Voy / No voy / Duda. ¡Gracias!`
    : "";
  return { faltan, texto };
}

// ---------------------------------------------------------------- resumen de la copia a SportEasy
/** Cerrado SIN copiar a SportEasy por decisión de Iván (D148: «Iván: no se copia a SportEasy (29/10/2026)»): estado
 *  «copiado» con esa nota en sporteasy_cambio. No está pendiente ni sale en la tarjeta «Copia a SportEasy». */
export const noSeCopia = (e: Pick<EventoFila, "sporteasy_estado" | "sporteasy_cambio">) => e.sporteasy_estado === "copiado" && /no se copia/i.test(e.sporteasy_cambio ?? "");

export function resumenCopia(eventos: EventoFila[], hoy: string) {
  // Los planes no oficiales no existen en SportEasy (D118): nunca entran en la cola de copia.
  const pendientes = eventos.filter((e) => !esPlanFila(e) && e.sporteasy_estado === "pendiente" && (e.fecha >= hoy || e.estado === "cancelado"));
  const deSerie = pendientes.filter((e) => e.serie && e.origen === "manual" && (e.sporteasy_cambio ?? "").startsWith("Carga inicial"));
  const concretos = pendientes.filter((e) => !deSerie.includes(e));
  return { pendientes, concretos, deSerie };
}
