const ZONA = "Europe/Madrid";

export function fechaCorta(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-ES", { timeZone: ZONA, day: "numeric", month: "long" });
}

export function fechaHora(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-ES", { timeZone: ZONA, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// "2026-10-15" -> fin de ese dia en Madrid (23:59:59), como ISO con su desfase real (horario de verano o no).
export function finDeDiaMadrid(ymd: string) {
  const aprox = new Date(`${ymd}T23:59:59Z`);
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: ZONA, timeZoneName: "longOffset" }).formatToParts(aprox);
  const desfase = partes.find((p) => p.type === "timeZoneName")?.value.replace("GMT", "") || "+00:00";
  return new Date(`${ymd}T23:59:59${desfase === "" ? "+00:00" : desfase}`).toISOString();
}

// ISO -> "2026-10-15" en hora de Madrid (para el campo de fecha).
export function ymdMadrid(iso: string | null | undefined) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
