// Piezas comunes de los calendarios iCal (RFC 5545), PURAS: el publico (/calendario.ics, lib/ical.ts) y el personal
// (/cal/<enlace>.ics, D119). CRLF, lineas plegadas a 75 octetos y texto escapado.

export const escapar = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const bytes = (c: string) => new TextEncoder().encode(c).length;

/** Pliega una linea a 75 octetos (UTF-8), sin partir un caracter. */
export function plegar(linea: string) {
  const trozos: string[] = [];
  let actual = "", n = 0;
  for (const c of linea) {
    const b = bytes(c);
    if (n + b > (trozos.length ? 74 : 75)) { trozos.push(actual); actual = ""; n = 0; }
    actual += c; n += b;
  }
  trozos.push(actual);
  return trozos.join("\r\n ");
}

export const fechaHora = (f: string, h: string) => `${f.replace(/-/g, "")}T${h.replace(":", "").slice(0, 4)}00`;
export const sello = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// Zona horaria de Madrid con las reglas vigentes de la UE (ultimo domingo de marzo y de octubre).
export const VTIMEZONE = [
  "BEGIN:VTIMEZONE", "TZID:Europe/Madrid", "X-LIC-LOCATION:Europe/Madrid",
  "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST", "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
  "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET", "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
  "END:VTIMEZONE",
];
