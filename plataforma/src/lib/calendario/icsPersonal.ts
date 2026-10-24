// Calendario PERSONAL (D119): el .ics de una persona, PURO (lo usan la ruta /cal/<enlace>.ics y las pruebas). Solo sus
// eventos y SU estado: nunca motivos, niveles, nombres de otros jugadores ni respuestas ajenas.
// Para que las apps lo actualicen bien: UID estable por evento, SEQUENCE y LAST-MODIFIED que cambian en cada cambio,
// los cancelados con STATUS:CANCELLED (no desaparecen de golpe), Europe/Madrid con su VTIMEZONE y REFRESH-INTERVAL /
// X-PUBLISHED-TTL de una hora (Google los ignora; iPhone y Outlook los usan).
import { escapar, fechaHora, plegar, sello, VTIMEZONE } from "../icalBase.ts";
import { enlaceGoogle } from "../ubicacion.ts";

export type EventoPersonal = {
  id: string; tipo: string; equipo: "MdA" | "MdL" | "ambos"; oficial: boolean; titulo: string | null; rival: string | null; rival_texto: string | null;
  es_local: boolean | null; jornada: number | null; fecha: string; inicio: string | null; fin: string | null; quedada: string | null;
  estado: "programado" | "cancelado"; lugar_nombre: string | null; lugar_direccion: string | null; lugar_lat: number | null; lugar_lng: number | null;
  lugar_enlace: string | null; numero_pista: number | null; secuencia: number; actualizado_en: string;
  respuesta: "va" | "duda" | "no" | "sin_responder"; convocado: boolean; convocatoria_aprobada: boolean;
};

const hh = (t: string | null) => (t ? String(t).slice(0, 5) : null);
const limpiar = (r: string | null) => (r ? r.replace(/([.,;:!?])\1+/g, "$1").replace(/\s+/g, " ").trim() : "");
const NOMBRE = { MdA: "MdA", MdL: "MdL", ambos: "Maccabis" } as const;
const TIPO: Record<string, string> = { entreno: "Entreno", amistoso: "Amistoso", torneo: "Torneo", interno: "Entre nosotros", quedada: "Quedada", pachanga: "Pachanga", otro: "Plan" };

export function tituloPersonal(e: EventoPersonal) {
  if (e.tipo === "liga") {
    const n = NOMBRE[e.equipo], r = limpiar(e.rival);
    return `${e.es_local === false ? `${r} – ${n}` : `${n} – ${r}`}${e.jornada ? ` (J${e.jornada})` : ""}`;
  }
  if (!e.oficial) return `${e.titulo ?? "Plan"} (plan no oficial)`;
  if (e.tipo === "entreno") return "Entreno Maccabis";
  return `${TIPO[e.tipo] ?? "Evento"}${e.titulo ? ` «${e.titulo}»` : e.rival ? ` contra ${limpiar(e.rival)}` : ""}`;
}

/** Su estado, sin nada de nadie mas: Convocado, Vas, No vas, Duda o Sin responder. */
export function estadoPersonal(e: EventoPersonal) {
  if (e.estado === "cancelado") return "Cancelado";
  if (e.tipo === "liga" && e.convocatoria_aprobada) return e.convocado ? `Convocado (${e.equipo})` : "No convocado";
  return { va: "Vas", no: "No vas", duda: "Duda", sin_responder: "Sin responder" }[e.respuesta];
}

const masMinutos = (h: string, m: number) => {
  const [a, b] = h.split(":").map(Number);
  const t = (((a * 60 + b + m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

const diaSiguiente = (f: string) => { const d = new Date(`${f}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };

export function vevento(e: EventoPersonal, base: string): string[] {
  const modificado = sello(new Date(e.actualizado_en));
  const l = [`UID:${e.id}@personal.maccabis`, `DTSTAMP:${modificado}`, `LAST-MODIFIED:${modificado}`, `SEQUENCE:${e.secuencia}`];
  const inicio = hh(e.inicio), fin = hh(e.fin);
  if (inicio) {
    l.push(`DTSTART;TZID=Europe/Madrid:${fechaHora(e.fecha, inicio)}`);
    // Sin hora de fin: 1 h 30 un partido, 2 h lo demas (para que ocupe su hueco en el calendario). Si pasa de la
    // medianoche (una cena a las 22:40), acaba al dia siguiente.
    const finReal = fin && fin > inicio ? fin : masMinutos(inicio, e.tipo === "liga" ? 90 : 120);
    l.push(`DTEND;TZID=Europe/Madrid:${fechaHora(finReal > inicio ? e.fecha : diaSiguiente(e.fecha), finReal)}`);
  } else {
    l.push(`DTSTART;VALUE=DATE:${e.fecha.replace(/-/g, "")}`);
  }
  l.push(`SUMMARY:${escapar(tituloPersonal(e))}`);
  const mapa = enlaceGoogle({ nombre: e.lugar_nombre ?? "", direccion: e.lugar_direccion, lat: e.lugar_lat, lng: e.lugar_lng, enlace: e.lugar_enlace });
  const sitio = e.lugar_nombre ? `${e.lugar_nombre}${e.numero_pista ? `, pista ${e.numero_pista}` : ""}${e.lugar_direccion ? ` (${e.lugar_direccion})` : ""}` : "Pista por confirmar";
  l.push(`LOCATION:${escapar(sitio)}`);
  if (e.lugar_lat != null && e.lugar_lng != null) l.push(`GEO:${e.lugar_lat};${e.lugar_lng}`);
  const url = `${base}${e.oficial ? `/mi-zona/evento/${e.id}` : `/planes/${e.id}`}`;
  const q = hh(e.quedada) ?? (inicio ? masMinutos(inicio, -20) : null);
  const desc = [
    `Tu estado: ${estadoPersonal(e)}`,
    q ? `Quedada: ${q}` : "Hora por confirmar",
    !e.oficial ? "Plan no oficial de la plantilla." : null,
    e.tipo === "amistoso" && e.rival_texto ? `Contra: ${e.rival_texto}` : null,
    mapa ? `Cómo llegar: ${mapa}` : null,
    `En la web: ${url}`,
  ].filter(Boolean).join("\n");
  l.push(`DESCRIPTION:${escapar(desc)}`);
  l.push(`URL:${url}`);
  l.push(`STATUS:${e.estado === "cancelado" ? "CANCELLED" : "CONFIRMED"}`);
  l.push("TRANSP:OPAQUE");
  return ["BEGIN:VEVENT", ...l, "END:VEVENT"];
}

export function calendarioPersonal(eventos: EventoPersonal[], base: string) {
  const lineas = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Maccabis//Calendario personal//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Maccabis (tu agenda)", "X-WR-CALDESC:Tus partidos\\, entrenos y planes de Maccabis", "X-WR-TIMEZONE:Europe/Madrid",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
    ...VTIMEZONE,
    ...eventos.flatMap((e) => vevento(e, base)),
    "END:VCALENDAR",
  ];
  return lineas.map(plegar).join("\r\n") + "\r\n";
}
