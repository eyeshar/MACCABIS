// Dominio de los eventos (paso 2, pista E, D94): funciones PURAS, sin acceso a datos y sin imports, para que las use la
// web y las pruebas (`node` puede cargar este fichero tal cual). Fechas como "AAAA-MM-DD" y horas como "HH:MM".

export type TipoEvento = "entreno" | "liga" | "amistoso" | "torneo" | "interno";
export type EquipoEvento = "MdA" | "MdL" | "ambos";
export type EstadoPista = "habitual" | "provisional" | "en_obras" | "cerrada";
export type EstadoCopia = "pendiente" | "copiado";
export type Respuesta = "va" | "duda" | "no" | "sin_responder";
export type Motivo = "lesion" | "trabajo" | "viaje" | "familia" | "otro";

export type Pista = {
  id: string; slug: string; nombre: string; nombre_corto: string | null; direccion: string | null;
  uso: "entreno" | "partido"; estado: EstadoPista; es_de_serie: boolean; num_pistas: number | null; nota: string | null;
};

export type EventoFila = {
  id: string; clave: string; temporada: string; tipo: TipoEvento; equipo: EquipoEvento; titulo: string | null;
  jornada: number | null; rival: string | null; es_local: boolean | null; fecha: string;
  inicio: string | null; fin: string | null; quedada: string | null; pista_id: string | null; numero_pista: number | null;
  notas: string | null; origen: "ayuntamiento" | "manual"; serie: string | null; estado: "programado" | "cancelado";
  sporteasy_estado: EstadoCopia; sporteasy_cambio: string | null; sporteasy_copiado_en: string | null;
};

export const TIPOS: { id: TipoEvento; texto: string; corto: string }[] = [
  { id: "entreno", texto: "Entreno", corto: "ENTRENO" },
  { id: "liga", texto: "Partido de liga", corto: "LIGA" },
  { id: "amistoso", texto: "Amistoso", corto: "AMISTOSO" },
  { id: "torneo", texto: "Torneo", corto: "TORNEO" },
  { id: "interno", texto: "Entre nosotros", corto: "INTERNO" },
];
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

/** La pista propia del evento; si no tiene y es un entreno, la de la serie SOLO si esta habitual (en obras: "por
 *  confirmar" y el motivo dice cual). Un partido sin pista tambien sale "por confirmar". */
export function pistaEfectiva(e: Pick<EventoFila, "tipo" | "pista_id" | "numero_pista">, pistas: Pista[]): PistaEfectiva {
  const propia = e.pista_id ? pistas.find((p) => p.id === e.pista_id) ?? null : null;
  const corto = (p: Pista) => p.nombre_corto ?? p.nombre;
  if (propia) {
    const n = e.numero_pista ? ` · Pista ${e.numero_pista}` : "";
    return { pista: propia, texto: `${corto(propia)}${n}`, porConfirmar: false, motivo: null };
  }
  if (e.tipo === "entreno") {
    const serie = pistas.find((p) => p.es_de_serie && p.uso === "entreno");
    if (serie?.estado === "habitual") return { pista: serie, texto: corto(serie), porConfirmar: false, motivo: null };
    return { pista: null, texto: "Pista por confirmar", porConfirmar: true, motivo: serie?.estado === "en_obras" ? `${serie.nombre.split(" (")[0]} en obras` : null };
  }
  return { pista: null, texto: "Pista por confirmar", porConfirmar: true, motivo: null };
}

// ---------------------------------------------------------------- titulo y texto de un evento
const NOMBRE_NUESTRO = { MdA: "MdA", MdL: "MdL", ambos: "Maccabis" } as const;
export function tituloEvento(e: Pick<EventoFila, "tipo" | "equipo" | "titulo" | "rival" | "es_local" | "jornada">) {
  if (e.tipo === "liga" && e.rival) {
    const n = NOMBRE_NUESTRO[e.equipo];
    return `${e.es_local === false ? `${e.rival} – ${n}` : `${n} – ${e.rival}`}`;
  }
  if (e.tipo === "entreno") return e.titulo ?? "Entrenamiento semanal";
  if (e.rival && e.titulo) return `${e.titulo} · ${e.rival}`;
  return e.titulo ?? e.rival ?? textoTipo(e.tipo);
}

// ---------------------------------------------------------------- series de entrenos
/** Eventos de la misma serie desde `base` (inclusive), por fecha, sin los cancelados. */
export function deLaSerieDesde<T extends Pick<EventoFila, "serie" | "fecha" | "estado" | "id">>(todos: T[], base: Pick<EventoFila, "serie" | "fecha">): T[] {
  if (!base.serie) return [];
  return todos.filter((e) => e.serie === base.serie && e.fecha >= base.fecha && e.estado === "programado").sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
}

// ---------------------------------------------------------------- cambios y copia a SportEasy
export type CamposEditables = Pick<EventoFila, "tipo" | "equipo" | "titulo" | "rival" | "es_local" | "fecha" | "inicio" | "fin" | "quedada" | "pista_id" | "numero_pista" | "notas" | "estado" | "jornada">;

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
  if ((antes.notas ?? "") !== (despues.notas ?? "")) c.push(despues.notas ? `notas: «${despues.notas}»` : "notas quitadas");
  if (antes.tipo !== despues.tipo) c.push(`tipo: ${textoTipo(antes.tipo)} → ${textoTipo(despues.tipo)}`);
  if (antes.equipo !== despues.equipo) c.push(`equipo: ${antes.equipo} → ${despues.equipo}`);
  if ((antes.rival ?? "") !== (despues.rival ?? "")) c.push(`rival: ${antes.rival ?? "—"} → ${despues.rival ?? "—"}`);
  if (antes.es_local !== despues.es_local) c.push(`${despues.es_local ? "ahora juega de local" : "ahora juega de visitante"}`);
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

// ---------------------------------------------------------------- mensaje de WhatsApp al guardar
export type AccionMensaje = "nuevo" | "cambio" | "cancelado";

/** El texto para pegar en el grupo de WhatsApp. `lineaEquipacion` (rutina C) se pasa ya calculada, solo en partidos. */
export function mensajeWhatsApp(e: EventoFila, pistas: Pista[], accion: AccionMensaje, opciones: { cambios?: string[]; lineaEquipacion?: string | null } = {}) {
  const pe = pistaEfectiva(e, pistas);
  const dia = diaCorto(e.fecha);
  const hora = hhmm(e.inicio);
  const quedada = hhmm(e.quedada);
  const sitio = pe.porConfirmar ? `pista por confirmar${pe.motivo ? ` (${pe.motivo})` : ""}` : pe.texto.replace(" · Pista", ", pista");
  const que = e.tipo === "entreno" ? `entreno del ${dia}`
    : e.tipo === "liga" ? `partido de liga${e.jornada ? ` (J${e.jornada})` : ""} ${tituloEvento(e)}, ${dia}`
    : `${textoTipo(e.tipo).toLowerCase()}${e.titulo ? ` «${e.titulo}»` : ""}${e.rival ? ` contra ${e.rival}` : ""}, ${dia}`;
  if (accion === "cancelado") return `Se cancela el ${que}. Perdonad las molestias.`;
  const detalle = [
    hora ? `a las ${hora}${hhmm(e.fin) ? ` (hasta las ${hhmm(e.fin)})` : ""}` : "hora por confirmar",
    sitio,
    quedada && hora ? `quedada a las ${quedada}` : null,
  ].filter(Boolean).join(", ");
  const cab = accion === "cambio" ? `Cambio en el ${que}` : `${que[0].toUpperCase()}${que.slice(1)}`;
  const lineas = [`${cab}: ${detalle}.`];
  if (accion === "cambio" && opciones.cambios?.length) lineas.push(`Qué cambia: ${opciones.cambios.join("; ")}.`);
  if (e.notas) lineas.push(e.notas.replace(/\.$/, "") + ".");
  if (opciones.lineaEquipacion) lineas.push(opciones.lineaEquipacion);
  lineas.push("Responded en SportEasy, por favor.");
  return lineas.join("\n");
}

// ---------------------------------------------------------------- ¿quien esta convocado a un evento?
export type JugadorBasico = { person_id: string; nombre_visible: string; ficha_mda: boolean; ficha_mdl: boolean; entrena: boolean; activo: boolean };

/** Personas a las que se les pide respuesta: en un entreno, quien entrena; en un partido, la ficha de su equipo. */
export function convocadosDe(e: Pick<EventoFila, "tipo" | "equipo">, jugadores: JugadorBasico[]) {
  const activos = jugadores.filter((j) => j.activo);
  if (e.tipo === "entreno" || e.tipo === "interno") return activos.filter((j) => j.entrena || j.ficha_mda || j.ficha_mdl);
  if (e.equipo === "MdA") return activos.filter((j) => j.ficha_mda);
  if (e.equipo === "MdL") return activos.filter((j) => j.ficha_mdl);
  return activos.filter((j) => j.ficha_mda || j.ficha_mdl);
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
export function resumenCopia(eventos: EventoFila[], hoy: string) {
  const pendientes = eventos.filter((e) => e.sporteasy_estado === "pendiente" && (e.fecha >= hoy || e.estado === "cancelado"));
  const deSerie = pendientes.filter((e) => e.serie && e.origen === "manual" && (e.sporteasy_cambio ?? "").startsWith("Carga inicial"));
  const concretos = pendientes.filter((e) => !deSerie.includes(e));
  return { pendientes, concretos, deSerie };
}
