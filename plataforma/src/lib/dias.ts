// Dias civiles "AAAA-MM-DD" (sin husos horarios) y sus textos en español. Sin datos: se puede usar en el cliente.
const d = (f: string) => new Date(`${f}T12:00:00Z`);
const ymd = (x: Date) => x.toISOString().slice(0, 10);
export const sumarDias = (f: string, n: number) => { const x = d(f); x.setUTCDate(x.getUTCDate() + n); return ymd(x); };
/** 0 = domingo ... 6 = sabado */
export const diaDeLaSemana = (f: string) => d(f).getUTCDay();
const fmt = (f: string, o: Intl.DateTimeFormatOptions) => d(f).toLocaleDateString("es-ES", { timeZone: "UTC", ...o }).replace(/\./g, "");
/** "dom" */
export const diaSemanaCorto = (f: string) => fmt(f, { weekday: "short" });
/** "Dom 18" */
export const diaYNumero = (f: string) => { const s = `${diaSemanaCorto(f)} ${+f.slice(8)}`; return s[0].toUpperCase() + s.slice(1); };
/** "18 oct" */
export const diaMes = (f: string) => fmt(f, { day: "numeric", month: "short" });
/** "domingo, 18 de octubre" */
export const diaLargo = (f: string) => fmt(f, { weekday: "long", day: "numeric", month: "long" });
/** "9 de mayo" */
export const diaMesLargo = (f: string) => fmt(f, { day: "numeric", month: "long" });
/** Lunes de la semana de f. */
export const lunes = (f: string) => sumarDias(f, -((d(f).getUTCDay() + 6) % 7));
/** "Semana del 12 al 18 oct" / "Semana del 26 oct al 1 nov" */
export function textoSemana(f: string) {
  const a = lunes(f), b = sumarDias(a, 6);
  return a.slice(5, 7) === b.slice(5, 7) ? `Semana del ${+a.slice(8)} al ${diaMes(b)}` : `Semana del ${diaMes(a)} al ${diaMes(b)}`;
}
/** "10:15" + 75 -> "11:30" */
export function sumarMinutos(hora: string, min: number) {
  const [h, m] = hora.split(":").map(Number);
  const t = h * 60 + m + min;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
/** Hoy en Madrid, "AAAA-MM-DD". */
export const hoyMadrid = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
