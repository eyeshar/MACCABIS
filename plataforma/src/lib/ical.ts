import "server-only";
import { eventosTemporada, type Evento, type FuenteCalendario } from "@/lib/publico";
import { GRUPO_EQUIPO } from "@/lib/web";

// Feed iCal publico (D76): partidos de MdA y MdL y entrenos de la temporada. Solo datos del club: ni nombres de
// jugadores, ni respuestas, ni correos. RFC 5545: CRLF, lineas plegadas a 75 octetos y texto escapado.

import { escapar, fechaHora, plegar, sello, VTIMEZONE } from "@/lib/icalBase";
export { plegar };

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

export function calendarioIcs(ahora = new Date(), fuente?: FuenteCalendario) {
  const s = sello(ahora);
  const lineas = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Maccabis//Calendario 2026-27//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Maccabis", "X-WR-CALDESC:Partidos de MdA y MdL y entrenos de Maccabis", "X-WR-TIMEZONE:Europe/Madrid",
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H", "X-PUBLISHED-TTL:PT12H",
    ...VTIMEZONE,
    ...eventosTemporada(fuente).flatMap((e) => vevento(e, s)),
    "END:VCALENDAR",
  ];
  return lineas.map(plegar).join("\r\n") + "\r\n";
}
