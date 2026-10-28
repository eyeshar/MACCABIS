// Contexto del asistente (D142): el texto que acompaña a cada pregunta. PURO (sin base ni red) para poder probarlo.
//
// PRIVACIDAD, criterio de primer orden. Solo entra:
//   la guia del jugador · los avisos activos de data/avisos.json · los proximos eventos (fecha, hora, pista, quedada) ·
//   del propio usuario: sus respuestas, sus ausencias (con SU motivo), su convocatoria y sus estadisticas publicas ·
//   de los demas: SOLO el nombre visible y si va, duda, no va o no ha contestado (lo que ya ve en la web, D141).
// Nunca: motivos de otros, niveles ni nada de privado/, correos, telefonos, DNIs, tesoreria ni datos de gestion.
// Cada campo se copia a mano (lista blanca): aunque el cargador pase un objeto con mas campos, aqui no pasan.

export type EventoCtx = {
  id: string; tipo: string; equipo: string; titulo: string | null; rival: string | null; fecha: string;
  inicio: string | null; fin: string | null; quedada: string | null; lugar: string | null; mapa: string | null;
  cancelado: boolean; oficial: boolean;
};
export type QuienCtx = { va: string[]; duda: string[]; no: string[]; sin_responder: string[] };
export type MiRespuestaCtx = { evento_id: string; respuesta: string; motivo: string | null; detalle: string | null };
export type MiAusenciaCtx = { desde: string; hasta: string | null; motivo: string; detalle: string | null };
export type StatsCtx = {
  pj: number; minutos: number | null; dorsales: (string | number)[]; masMenos: number | null;
  /** Totales publicos de la temporada: pts, p2a/p2i, p3a/p3i, tla/tli (anotados/intentados), fc (faltas). */
  tot: Record<string, unknown>;
  entrenos: { fueron: number; total: number; pct: number | null } | null;
  partidos: { equipo: string; rival: string; fecha: string | null; jornada: number | null; pts: number | null; minutos: number | null; pf: number | null; pc: number | null }[];
};
export type EntradaContexto = {
  hoy: string;
  guia: string;
  yo: { nombre: string; equipos: string[]; esGestor: boolean; tieneFicha: boolean };
  avisos: { texto: string; desde: string; hasta: string; para: string }[];
  eventos: EventoCtx[];
  quienVa: Map<string, QuienCtx>;
  respuestas: MiRespuestaCtx[];
  ausencias: MiAusenciaCtx[];
  convocatorias: { fecha: string; equipos: string[] }[];
  stats: StatsCtx | null;
};

const WEB = "https://maccabis.vercel.app";
const TEXTO_RESP: Record<string, string> = { va: "voy", duda: "duda", no: "no voy", sin_responder: "sin responder" };
const MOTIVO: Record<string, string> = { lesion: "lesión", trabajo: "trabajo", viaje: "viaje", familia: "familia", otro: "otro", horario: "horario" };
const TIPO: Record<string, string> = { entreno: "Entreno", liga: "Partido de liga", amistoso: "Amistoso", torneo: "Torneo", interno: "Partido entre nosotros", quedada: "Quedada", pachanga: "Pachanga", otro: "Evento" };
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const dia = (f: string) => `${DIAS[new Date(`${f}T12:00:00Z`).getUTCDay()]} ${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`;
const hm = (t: string | null) => (t ? t.slice(0, 5) : null);
const menos20 = (h: string) => { const [a, b] = h.split(":").map(Number); const t = a * 60 + b - 20; return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };
/** Una sola linea, sin saltos ni marcas que puedan imitar una seccion del contexto. */
const linea = (s: string | null | undefined, max = 200) => String(s ?? "").replace(/[\r\n]+/g, " ").replace(/={3,}/g, "=").trim().slice(0, max);
/** Por si un nombre visible lleva algo con forma de correo o telefono: fuera. */
const nombre = (s: string) => linea(s, 60).replace(/\S+@\S+/g, "").replace(/\+?\d[\d\s]{7,}\d/g, "").trim();
const lista = (l: string[]) => (l.length ? l.map(nombre).filter(Boolean).join(", ") : "nadie");

function textoEvento(e: EventoCtx, quien: QuienCtx | undefined, mia: MiRespuestaCtx | undefined, conAgenda: boolean) {
  const titulo = e.tipo === "liga" || e.tipo === "amistoso"
    ? `${TIPO[e.tipo] ?? "Partido"} ${linea(e.equipo, 10)}${e.rival ? ` contra ${linea(e.rival, 80)}` : ""}`
    : `${TIPO[e.tipo] ?? "Evento"}${e.titulo ? `: ${linea(e.titulo, 80)}` : ""}${e.equipo && e.equipo !== "ambos" ? ` (${linea(e.equipo, 10)})` : ""}`;
  const ini = hm(e.inicio), fin = hm(e.fin);
  const partes = [
    `- ${dia(e.fecha)} · ${titulo}${e.oficial ? "" : " (plan no oficial)"}${e.cancelado ? " · CANCELADO" : ""}`,
    `  Hora: ${ini ? `${ini}${fin ? `–${fin}` : ""}` : "por confirmar"}${ini ? ` · quedada ${hm(e.quedada) ?? menos20(ini)}` : ""}`,
    `  Lugar: ${linea(e.lugar) || "por confirmar"}${e.mapa ? ` · cómo llegar: ${linea(e.mapa, 300)}` : ""}`,
  ];
  if (conAgenda) {
    partes.push(`  Página: ${WEB}/mi-zona/evento/${encodeURIComponent(e.id)}`);
    partes.push(`  Tu respuesta: ${mia ? TEXTO_RESP[mia.respuesta] ?? "sin responder" : "sin responder"}${mia?.respuesta === "no" && mia.motivo ? ` (tu motivo: ${MOTIVO[mia.motivo] ?? "otro"}${mia.detalle ? `, ${linea(mia.detalle, 120)}` : ""})` : ""}`);
  }
  if (quien) {
    partes.push(`  Van (${quien.va.length}): ${lista(quien.va)}`);
    partes.push(`  Dudan (${quien.duda.length}): ${lista(quien.duda)}`);
    partes.push(`  No van (${quien.no.length}): ${lista(quien.no)}`);
    partes.push(`  No han contestado (${quien.sin_responder.length}): ${lista(quien.sin_responder)}`);
  }
  return partes.join("\n");
}

export function construirContexto(d: EntradaContexto): string {
  const s: string[] = [];
  s.push(`Hoy es ${dia(d.hoy)} (hora de Madrid). Web: ${WEB}`);
  s.push(`Usuario: ${nombre(d.yo.nombre)}${d.yo.equipos.length ? ` · juega en ${d.yo.equipos.map((x) => linea(x, 10)).join(" y ")}` : ""}${d.yo.esGestor ? " · es gestor" : ""}${d.yo.tieneFicha ? "" : " · sin ficha de jugador"}`);
  s.push(`Páginas útiles: inicio ${WEB}/ · agenda ${WEB}/agenda · ausencias ${WEB}/mi-zona/ausencias · avisos en el móvil ${WEB}/avisos · mis números ${WEB}/mis-numeros · liga ${WEB}/liga · plantilla ${WEB}/plantilla · historia ${WEB}/historia · proponer un plan ${WEB}/planes/nuevo · mi cuenta ${WEB}/cuenta · entrar ${WEB}/entrar`);

  s.push("\n## Avisos del club activos");
  s.push(d.avisos.length ? d.avisos.map((a) => `- ${linea(a.texto, 600)} (del ${a.desde} al ${a.hasta}${a.para !== "todos" ? `, para ${linea(a.para, 10)}` : ""})`).join("\n") : "- Ninguno.");

  s.push("\n## Próximos eventos");
  if (!d.eventos.length) s.push("- No hay eventos en los próximos días.");
  for (const e of d.eventos) {
    const mia = d.respuestas.find((r) => r.evento_id === e.id);
    s.push(textoEvento(e, d.quienVa.get(e.id), mia, d.yo.tieneFicha));
  }

  if (d.yo.tieneFicha) {
    s.push("\n## Tus convocatorias publicadas");
    const conv = d.convocatorias.filter((c) => c.fecha >= d.hoy);
    s.push(conv.length ? conv.map((c) => `- ${dia(c.fecha)}: ${c.equipos.length ? `convocado con ${c.equipos.map((x) => linea(x, 10)).join(" y ")}` : "no convocado esta vez"}`).join("\n") : "- Ninguna publicada todavía (se publica tras el cierre de dudas del martes).");

    s.push("\n## Tus ausencias por periodo");
    s.push(d.ausencias.length ? d.ausencias.map((a) => `- Del ${a.desde} ${a.hasta ? `al ${a.hasta}` : "sin fecha de vuelta"} · tu motivo: ${MOTIVO[a.motivo] ?? "otro"}${a.detalle ? `, ${linea(a.detalle, 120)}` : ""}`).join("\n") : "- Ninguna.");

    s.push("\n## Tus estadísticas públicas de la temporada 2026/27");
    if (!d.stats || !d.stats.pj) s.push("- Aún sin partidos con estadísticas.");
    else {
      const t = d.stats.tot;
      const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);
      const par = (a: unknown, i: unknown) => (num(a) != null ? `${num(a)}${num(i) != null ? ` de ${num(i)}` : ""}` : null);
      s.push(`- Partidos: ${d.stats.pj}${d.stats.dorsales.length ? ` · dorsal ${d.stats.dorsales.map((x) => linea(String(x), 4)).join(" y ")}` : ""}${d.stats.minutos != null ? ` · minutos: ${Math.round(d.stats.minutos)}` : ""}${num(t.pts) != null ? ` · puntos: ${num(t.pts)}` : ""}${par(t.p2a, t.p2i) ? ` · tiros de 2: ${par(t.p2a, t.p2i)}` : ""}${par(t.p3a, t.p3i) ? ` · triples: ${par(t.p3a, t.p3i)}` : ""}${par(t.tla, t.tli) ? ` · tiros libres: ${par(t.tla, t.tli)}` : ""}${num(t.fc) != null ? ` · faltas: ${num(t.fc)}` : ""}${d.stats.masMenos != null ? ` · +/-: ${d.stats.masMenos}` : ""}`);
      if (d.stats.entrenos) s.push(`- Entrenos: fue a ${d.stats.entrenos.fueron} de ${d.stats.entrenos.total}${d.stats.entrenos.pct != null ? ` (${Math.round(d.stats.entrenos.pct * 100)} %)` : ""}`);
      for (const p of d.stats.partidos) s.push(`- ${p.fecha ? dia(p.fecha) : "fecha ?"}${p.jornada ? ` (J${p.jornada})` : ""} ${linea(p.equipo, 10)} contra ${linea(p.rival, 80)}: ${p.pts ?? 0} puntos${p.minutos != null ? `, ${p.minutos} min` : ""}${p.pf != null && p.pc != null ? ` · resultado ${p.pf}-${p.pc}` : ""}`);
      s.push(`- Ficha completa: ${WEB}/mis-numeros`);
    }
  }

  s.push("\n## Guía del jugador (cómo funciona la web)");
  s.push(d.guia.replace(/={3,}/g, "=").trim());
  return s.join("\n");
}

/** Campos que nunca pueden salir en el contexto (los usa la prueba y, como red de seguridad, la ruta). */
export const PATRON_PROHIBIDO = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b|\b\d{8}[A-HJ-NP-TV-Z]\b|\b[XYZ]\d{7}[A-HJ-NP-TV-Z]\b|(?:\+34[\s-]?)?\b[6789]\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/i;
