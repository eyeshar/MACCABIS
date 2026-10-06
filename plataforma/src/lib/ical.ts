import "server-only";
import { eventosTemporada, type Evento } from "@/lib/publico";
import { GRUPO_EQUIPO } from "@/lib/web";

// Feed iCal publico (D76): partidos de MdA y MdL y entrenos de la temporada. Solo datos del club: ni nombres de
// jugadores, ni respuestas, ni correos. RFC 5545: CRLF, lineas plegadas a 75 octetos y texto escapado.

const escapar = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Pliega una linea a 75 octetos (UTF-8), sin partir un caracter. */
export function plegar(linea: string) {
  const trozos: string[] = [];
  let actual = "", bytes = 0;
  for (const c of linea) {
    const n = Buffer.byteLength(c);
    if (bytes + n > (trozos.length ? 74 : 75)) { trozos.push(actual); actual = ""; bytes = 0; }
    actual += c; bytes += n;
  }
  trozos.push(actual);
  return trozos.join("\r\n ");
}

const fechaHora = (f: string, h: string) => `${f.replace(/-/g, "")}T${h.replace(":", "")}00`;
const sello = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// Zona horaria de Madrid con las reglas vigentes de la UE (ultimo domingo de marzo y de octubre).
const VTIMEZONE = [
  "BEGIN:VTIMEZONE", "TZID:Europe/Madrid", "X-LIC-LOCATION:Europe/Madrid",
  "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST", "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
  "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET", "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
  "END:VTIMEZONE",
];

function vevento(e: Evento, ahora: string): string[] {
  const l = [`UID:${e.id}-2026-27@maccabis`, `DTSTAMP:${ahora}`];
  if (e.inicio) {
    l.push(`DTSTART;TZID=Europe/Madrid:${fechaHora(e.fecha, e.inicio)}`);
    if (e.fin) l.push(`DTEND;TZID=Europe/Madrid:${fechaHora(e.fecha, e.fin)}`);
  } else {
    l.push(`DTSTART;VALUE=DATE:${e.fecha.replace(/-/g, "")}`);
  }
  if (e.tipo === "partido") {
    const nombre = e.equipo === "MDA" ? "MdA" : "MdL";
    l.push(`SUMMARY:${escapar(`${e.titulo.replace(/^J\d+ · /, "")} (J${e.jornada})`)}`);
    l.push(`LOCATION:${escapar(e.lugar)}`);
    const desc = [`${nombre} · Liga Municipal de Moratalaz, grupo ${GRUPO_EQUIPO[e.equipo!].slice(1)}, jornada ${e.jornada}.`];
    if (!e.inicio) desc.push("Hora por confirmar.");
    if (e.aviso?.hay && e.aviso.convocatoria) desc.push(`Equipación: ${e.aviso.convocatoria}`);
    desc.push("Calendario de Maccabis: maccabis.vercel.app");
    l.push(`DESCRIPTION:${escapar(desc.join("\n"))}`);
    l.push("CATEGORIES:Partido");
  } else {
    l.push(`SUMMARY:${escapar(`${e.titulo} Maccabis`)}`);
    l.push(`LOCATION:${escapar(e.pistaPorConfirmar ? `Pista por confirmar${e.nota ? ` (${e.nota})` : ""}` : e.lugar)}`);
    l.push(`DESCRIPTION:${escapar([e.pistaPorConfirmar ? "Pista por confirmar: el calendario se actualiza cuando se fije." : e.nota ?? "", "Calendario de Maccabis: maccabis.vercel.app"].filter(Boolean).join("\n"))}`);
    l.push("CATEGORIES:Entrenamiento");
  }
  l.push("TRANSP:OPAQUE");
  return ["BEGIN:VEVENT", ...l, "END:VEVENT"];
}

export function calendarioIcs(ahora = new Date()) {
  const s = sello(ahora);
  const lineas = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Maccabis//Calendario 2026-27//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Maccabis", "X-WR-CALDESC:Partidos de MdA y MdL y entrenos de Maccabis", "X-WR-TIMEZONE:Europe/Madrid",
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H", "X-PUBLISHED-TTL:PT12H",
    ...VTIMEZONE,
    ...eventosTemporada().flatMap((e) => vevento(e, s)),
    "END:VCALENDAR",
  ];
  return lineas.map(plegar).join("\r\n") + "\r\n";
}
