// Rutina B (jueves, D154): ¿falta la revisión del calendario de esta semana? Funciones PURAS (sin datos ni sesión).
// La rutina sale el jueves a las 20:20 (Madrid) y deja su rastro en `importaciones` (tipo «calendario»): al aplicar
// cambios o, con «0 cambios», al comparar (fix/g5-rutina-s21-y-repaso). Antes, un jueves sin cambios no dejaba nada y
// Gestión seguía diciendo «Última importación» de la semana anterior.

const ZONA = "Europe/Madrid";
/** Margen tras las 20:20 antes de darla por no hecha (la rutina tarda unos minutos y puede reintentar). */
const MARGEN = "21:30";

const partesMadrid = (x: Date) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" })
    .formatToParts(x).map((y) => [y.type, y.value]));
  return { dia: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}`, semana: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) };
};
const restarDias = (f: string, n: number) => { const x = new Date(`${f}T12:00:00Z`); x.setUTCDate(x.getUTCDate() - n); return x.toISOString().slice(0, 10); };

/** El último jueves (AAAA-MM-DD, Madrid) cuya rutina B ya debería haber corrido a esta hora. */
export function ultimoJuevesRutinaB(ahora: Date = new Date()): string {
  const { dia, hora, semana } = partesMadrid(ahora);
  const atras = (semana - 4 + 7) % 7;                     // días desde el jueves de esta semana (0 si hoy es jueves)
  return atras === 0 && hora < MARGEN ? restarDias(dia, 7) : restarDias(dia, atras);
}

/** El jueves de la rutina B sin revisión registrada (AAAA-MM-DD), o null si la última revisión es de ese jueves o posterior. */
export function rutinaBPendiente(ultimaRevision: string | null | undefined, ahora: Date = new Date()): string | null {
  const jueves = ultimoJuevesRutinaB(ahora);
  return ultimaRevision && partesMadrid(new Date(ultimaRevision)).dia >= jueves ? null : jueves;
}
