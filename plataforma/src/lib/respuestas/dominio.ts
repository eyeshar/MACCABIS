// Respuestas del jugador en la web (D99): funciones PURAS (las usan las pantallas y las pruebas). Un "domingo" con dos
// partidos se responde una sola vez (D99.3) pero se guarda por evento (D95).

export type Resp = "va" | "duda" | "no" | "sin_responder";
export type MotivoJugador = "lesion" | "trabajo" | "viaje" | "familia" | "otro";
export type MotivoTodo = MotivoJugador | "horario";

export const MOTIVOS_JUGADOR: { id: MotivoJugador; texto: string }[] = [
  { id: "lesion", texto: "Lesión" }, { id: "trabajo", texto: "Trabajo" }, { id: "viaje", texto: "Viaje" },
  { id: "familia", texto: "Familia" }, { id: "otro", texto: "Otro" },
];
export const TEXTO_MOTIVO_TODO: Record<MotivoTodo, string> = { lesion: "Lesión", trabajo: "Trabajo", viaje: "Viaje", familia: "Familia", otro: "Otro", horario: "Horario" };

export type MiEvento = {
  id: string; tipo: "entreno" | "liga" | "amistoso" | "torneo" | "interno"; equipo: "MdA" | "MdL" | "ambos";
  titulo: string | null; jornada: number | null; rival: string | null; es_local: boolean | null; fecha: string;
  inicio: string | null; fin: string | null; quedada: string | null; notas: string | null; estado: "programado" | "cancelado";
  cambio_visible: { campos: string[]; antes: string } | null; cambio_visible_en: string | null;
  pista_nombre: string | null; pista_nombre_corto: string | null; pista_direccion: string | null; numero_pista: number | null;
  pista_por_confirmar: boolean; pista_motivo: string | null;
};
export type MiRespuesta = { evento_id: string; respuesta: Resp; motivo: MotivoTodo | null; detalle: string | null; ausencia_id: string | null; origen?: string; puesto_por_nombre?: string | null };
export type MiAusencia = { id: string; desde: string; hasta: string | null; motivo: MotivoJugador; detalle: string | null; borrada_en: string | null; origen?: string };

export const hhmm = (t: string | null | undefined) => (t ? String(t).slice(0, 5) : null);
export const restar20 = (h: string) => { const [a, b] = h.split(":").map(Number); const t = a * 60 + b - 20; return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };

/** Periodo vigente (no borrado) que cubre una fecha. */
export const ausenciaQueCubre = (fecha: string, ausencias: MiAusencia[]) =>
  ausencias.filter((a) => !a.borrada_en && a.desde <= fecha && (a.hasta == null || a.hasta >= fecha)).sort((a, b) => (a.desde < b.desde ? 1 : -1))[0] ?? null;

// ---------------------------------------------------------------- quien responde (D105): UNA sola definicion
// (la base tiene la misma en _invitado): responden los activos menos el entrenador; "solo entreno" solo a entrenos.
export type PersonaResponde = { ficha_mda: boolean; ficha_mdl: boolean; entrena: boolean; activo: boolean; rol: "jugador" | "solo_entreno" | "entrenador" };

/** ¿Es de los que responden (a algo)? Los activos menos el entrenador: hoy 27 de 28. */
export const respondeEnGeneral = (j: Pick<PersonaResponde, "activo" | "rol">) => j.activo && j.rol !== "entrenador";

/** ¿Está invitado a este evento? Entreno o «entre nosotros»: quien entrena o tiene ficha; partido: su ficha, y nunca «solo entreno». */
export function quienResponde(e: { tipo: string; equipo: string }, j: PersonaResponde) {
  if (!respondeEnGeneral(j)) return false;
  if (e.tipo === "entreno" || e.tipo === "interno") return j.entrena || j.ficha_mda || j.ficha_mdl;
  if (j.rol === "solo_entreno") return false;
  return e.equipo === "MdA" ? j.ficha_mda : e.equipo === "MdL" ? j.ficha_mdl : j.ficha_mda || j.ficha_mdl;
}

// ---------------------------------------------------------------- unidades: un evento, o un domingo con sus partidos
export type Unidad = {
  clave: string; tipo: "evento" | "domingo"; fecha: string; eventos: MiEvento[];
  /** domingo: "distintas" (dos partidos a horas distintas), "misma" (a la misma hora), "una" (una sola ficha). */
  modo: "evento" | "distintas" | "misma" | "una";
  url: string;
};

export function unidades(eventos: MiEvento[]): Unidad[] {
  const out: Unidad[] = [];
  const ligaPorFecha = new Map<string, MiEvento[]>();
  for (const e of eventos) if (e.tipo === "liga" && e.estado === "programado") ligaPorFecha.set(e.fecha, [...(ligaPorFecha.get(e.fecha) ?? []), e]);
  const hechos = new Set<string>();
  for (const e of eventos) {
    if (e.tipo === "liga" && e.estado === "programado") {
      if (hechos.has(e.fecha)) continue;
      hechos.add(e.fecha);
      const ps = (ligaPorFecha.get(e.fecha) ?? []).sort((a, b) => ((a.inicio ?? "") < (b.inicio ?? "") ? -1 : 1));
      const modo = ps.length === 1 ? "una" : hhmm(ps[0].inicio) === hhmm(ps[1].inicio) ? "misma" : "distintas";
      out.push({ clave: `d-${e.fecha}`, tipo: "domingo", fecha: e.fecha, eventos: ps, modo, url: ps.length === 1 ? `/mi-zona/evento/${ps[0].id}` : `/mi-zona/domingo/${e.fecha}` });
    } else {
      out.push({ clave: e.id, tipo: "evento", fecha: e.fecha, eventos: [e], modo: "evento", url: `/mi-zona/evento/${e.id}` });
    }
  }
  return out;
}

// ---------------------------------------------------------------- estado de una unidad para el jugador
export type Estado = { clase: "vas" | "novas" | "duda" | "responde" | "ausente" | "cancelado"; texto: string; pendiente: boolean };

export function estadoDe(u: Unidad, respuestas: MiRespuesta[], ausencias: MiAusencia[]): Estado {
  if (u.eventos.every((e) => e.estado === "cancelado")) return { clase: "cancelado", texto: "Cancelado", pendiente: false };
  const rs = u.eventos.map((e) => respuestas.find((r) => r.evento_id === e.id) ?? null);
  const aus = ausenciaQueCubre(u.fecha, ausencias);
  const valor = (i: number) => rs[i]?.respuesta ?? "sin_responder";
  // Ausente: la respuesta la puso una ausencia, o no hay respuesta y un periodo cubre el dia (importado de SportEasy).
  if (aus && rs.every((r, i) => valor(i) === "sin_responder" || (r?.respuesta === "no" && r.ausencia_id))) {
    return { clase: "ausente", texto: `Ausente · ${TEXTO_MOTIVO_TODO[aus.motivo]}`, pendiente: false };
  }
  const vals = rs.map((_, i) => valor(i));
  if (vals.includes("sin_responder")) return { clase: "responde", texto: "Responde", pendiente: true };
  if (vals.every((v) => v === "va")) return { clase: "vas", texto: u.modo === "distintas" ? "Vas a los dos" : "Vas", pendiente: false };
  if (u.modo === "distintas" && vals.includes("va")) {
    const i = vals.indexOf("va");
    return { clase: "vas", texto: `Vas · solo ${hhmm(u.eventos[i].inicio)}`, pendiente: false };
  }
  if (vals.includes("duda")) return { clase: "duda", texto: "Duda", pendiente: false };
  const m = rs.find((r) => r?.motivo && r.motivo !== "horario")?.motivo;
  return { clase: "novas", texto: `No vas${m ? ` · ${TEXTO_MOTIVO_TODO[m]}` : ""}`, pendiente: false };
}

// ---------------------------------------------------------------- opciones del domingo (D99.3)
export type OpcionDomingo = { id: string; opcion: "ambos" | "solo" | "voy" | "no" | "duda"; evento?: string; texto: string };

export function opcionesDomingo(u: Pick<Unidad, "modo" | "eventos">): OpcionDomingo[] {
  if (u.modo === "distintas") {
    return [
      { id: "ambos", opcion: "ambos", texto: "A los dos" },
      ...u.eventos.map((e) => ({ id: `solo-${e.id}`, opcion: "solo" as const, evento: e.id, texto: `Solo al de las ${hhmm(e.inicio)} (${e.equipo})` })),
      { id: "no", opcion: "no", texto: "No voy" },
      { id: "duda", opcion: "duda", texto: "Duda" },
    ];
  }
  return [{ id: "voy", opcion: "voy", texto: "Voy" }, { id: "no", opcion: "no", texto: "No voy" }, { id: "duda", opcion: "duda", texto: "Duda" }];
}

/** La respuesta unica guardada de un domingo (D103); solo cuenta si sigue vigente. */
export type MiDomingo = { fecha: string; opcion: "ambos" | "solo" | "voy" | "no" | "duda"; solo_evento: string | null; vigente: boolean };

/** Opcion marcada ahora (null = sin responder). Manda la respuesta del domingo guardada; si no la hay (o dejo de valer
 *  porque un partido cambio por otro camino), se deduce de cada partido. */
export function opcionActual(u: Pick<Unidad, "modo" | "eventos">, respuestas: MiRespuesta[], domingo?: MiDomingo | null): string | null {
  if (domingo?.vigente) {
    if (domingo.opcion === "solo") return `solo-${domingo.solo_evento}`;
    if (u.modo === "distintas" && domingo.opcion === "voy") return "ambos";
    if (u.modo !== "distintas" && domingo.opcion === "ambos") return "voy";
    return domingo.opcion;
  }
  const vals = u.eventos.map((e) => respuestas.find((r) => r.evento_id === e.id)?.respuesta ?? "sin_responder");
  if (vals.includes("sin_responder")) return null;
  if (vals.every((v) => v === "va")) return u.modo === "distintas" ? "ambos" : "voy";
  if (u.modo === "distintas" && vals.includes("va")) return `solo-${u.eventos[vals.indexOf("va")].id}`;
  if (vals.every((v) => v === "duda")) return "duda";
  if (vals.every((v) => v === "no")) return "no";
  return null;
}

// ---------------------------------------------------------------- textos de pantalla
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
/** "miércoles 14 de octubre" */
export const fechaLarga = (f: string) => `${DIAS[new Date(`${f}T12:00:00Z`).getUTCDay()]} ${+f.slice(8, 10)} de ${MESES[+f.slice(5, 7) - 1]}`;
/** "miércoles 14" */
export const diaCorto = (f: string) => `${DIAS[new Date(`${f}T12:00:00Z`).getUTCDay()]} ${+f.slice(8, 10)}`;
export const ddmm = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;

const NOMBRE_EQ = { MdA: "MdA", MdL: "MdL", ambos: "Maccabis" } as const;
const limpiar = (r: string | null) => (r ? r.replace(/([.,;:!?])\1+/g, "$1").replace(/\s+/g, " ").trim() : r);
/** "Entreno", "MdA – Litros de Mahou", "Amistoso «X»" */
export function tituloDe(e: Pick<MiEvento, "tipo" | "equipo" | "titulo" | "rival" | "es_local">) {
  if (e.tipo === "entreno") return e.titulo && e.titulo !== "Entrenamiento semanal" ? e.titulo : "Entreno";
  if (e.tipo === "liga") { const n = NOMBRE_EQ[e.equipo]; const r = limpiar(e.rival); return e.es_local === false ? `${r} – ${n}` : `${n} – ${r}`; }
  const tipo = { amistoso: "Amistoso", torneo: "Torneo", interno: "Entre nosotros" }[e.tipo];
  return e.titulo ? `${tipo} «${e.titulo}»` : e.rival ? `${tipo} contra ${limpiar(e.rival)}` : tipo;
}
/** "entreno del miércoles 14" (para «No voy al …») */
export function nombreCorto(e: Pick<MiEvento, "tipo" | "fecha">) {
  const t = { entreno: "entreno", liga: "partido", amistoso: "amistoso", torneo: "torneo", interno: "partido entre nosotros" }[e.tipo];
  return `${t} del ${diaCorto(e.fecha)}`;
}
/** "20:00–22:00 · encuentro 19:40" (el encuentro siempre 20 min antes, D98) */
export function horario(e: Pick<MiEvento, "inicio" | "fin" | "quedada">) {
  const i = hhmm(e.inicio), f = hhmm(e.fin);
  if (!i) return "Hora por confirmar";
  return `${f ? `${i}–${f}` : i} · encuentro ${hhmm(e.quedada) ?? restar20(i)}`;
}
/** "Antonio Díaz Miguel · pista 3" o "Pista por confirmar (Valdebernardo en obras)" */
export function pistaTexto(e: Pick<MiEvento, "pista_nombre" | "pista_nombre_corto" | "numero_pista" | "pista_por_confirmar" | "pista_motivo" | "notas">) {
  if (e.pista_por_confirmar || !e.pista_nombre) return `Pista por confirmar${e.pista_motivo ? ` (${e.pista_motivo})` : ""}`;
  const nota = !e.numero_pista ? e.notas?.match(/^\s*pista\s+(\d+)\s*\.?\s*$/i) : null;
  const n = e.numero_pista ?? (nota ? Number(nota[1]) : null);
  return `${e.pista_nombre_corto ?? e.pista_nombre}${n ? ` · pista ${n}` : ""}`;
}
export const enlaceMapa = (direccion: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;

/** La linea amarilla: «Cambió la pista y la hora el 12/10 (antes: …)». */
export function lineaCambio(e: Pick<MiEvento, "cambio_visible" | "cambio_visible_en">) {
  const c = e.cambio_visible;
  if (!c || !c.campos?.length || !e.cambio_visible_en) return null;
  const NOM: Record<string, string> = { fecha: "el día", hora: "la hora", pista: "la pista", encuentro: "el encuentro" };
  const lista = c.campos.map((x) => NOM[x] ?? x);
  const que = lista.length === 1 ? lista[0] : `${lista.slice(0, -1).join(", ")} y ${lista.at(-1)}`;
  const dia = ddmm(new Date(e.cambio_visible_en).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }));
  return `Cambió ${que} el ${dia}${c.antes ? ` (antes: ${c.antes})` : ""}`;
}

export const ERRORES: Record<string, string> = {
  sin_ficha: "Tu cuenta no tiene ficha de jugador.",
  respuestas_apagadas: "Por ahora, responde en SportEasy.",
  no_invitado: "Este evento no es para tu ficha.",
  evento_cerrado: "Este evento ya empezó o se canceló: no se puede cambiar la respuesta.",
  falta_motivo: "Elige un motivo para guardar «no voy».",
  opcion_no_valida: "Esa opción no vale para este domingo.",
  fechas_no_validas: "El último día no puede ser antes que el primero.",
  ausencia_no_encontrada: "Esa ausencia ya no existe.",
};
export const textoError = (m: string | undefined) => ERRORES[Object.keys(ERRORES).find((k) => m?.includes(k)) ?? ""] ?? "No se pudo guardar. Inténtalo otra vez.";
