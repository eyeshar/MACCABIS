// Horas de Madrid para los avisos (D99.6, D99.7): funciones PURAS, sin imports, para que las usen la web, la tarea de
// avisos y las pruebas (`node` carga este fichero tal cual). Todo en Europe/Madrid, con el cambio de hora incluido
// (25/10/2026: a las 03:00 vuelven a ser las 02:00).

export const ZONA = "Europe/Madrid";
const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

/** La fecha y la hora de Madrid de un instante: { fecha: "AAAA-MM-DD", hora: "HH:MM", minutos: 0..1439 }. */
export function enMadrid(t: Date) {
  const p = Object.fromEntries(fmt.formatToParts(t).map((x) => [x.type, x.value]));
  const hora = `${p.hour}:${p.minute}`;
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora, minutos: Number(p.hour) * 60 + Number(p.minute) };
}

/** El instante de "fecha a las hora" en Madrid (Madrid va 2 h por delante de UTC en verano y 1 h en invierno). Una
 *  hora que no existe (02:30 del ultimo domingo de marzo) se lee como la de despues del salto; una que ocurre dos veces
 *  (02:30 del 25/10/2026) es la primera. */
export function madrid(fecha: string, hora: string): Date {
  const [h, mi] = hora.slice(0, 5).split(":").map(Number);
  const base = Date.UTC(+fecha.slice(0, 4), +fecha.slice(5, 7) - 1, +fecha.slice(8, 10), h, mi);
  const texto = `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
  const candidatos = [120, 60].map((d) => new Date(base - d * 60000)).filter((x) => enMadrid(x).hora === texto && enMadrid(x).fecha === fecha);
  return candidatos[0] ?? new Date(base - 60 * 60000);
}

export const sumarDias = (f: string, n: number) => { const x = new Date(`${f}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
/** 0 = lunes ... 6 = domingo */
export const diaSemana = (f: string) => (new Date(`${f}T12:00:00Z`).getUTCDay() + 6) % 7;
export const lunesDe = (f: string) => sumarDias(f, -diaSemana(f));

// ---------------------------------------------------------------- horas de silencio (D99.7)
export const SILENCIO_DESDE = 22 * 60 + 30; // 22:30
export const SILENCIO_HASTA = 8 * 60 + 30; // 08:30

export function enSilencio(t: Date) {
  const m = enMadrid(t).minutos;
  return m >= SILENCIO_DESDE || m < SILENCIO_HASTA;
}

/** Fin del silencio en el que cae t: las 08:30 de ese dia (de madrugada) o del siguiente (de noche). */
export function finDelSilencio(t: Date) {
  const m = enMadrid(t);
  return madrid(m.minutos >= SILENCIO_DESDE ? sumarDias(m.fecha, 1) : m.fecha, "08:30");
}

const DOCE_HORAS = 12 * 3600 * 1000;

/** Cuando sale de verdad un aviso que "toca" en t: fuera del silencio, en t; dentro, a las 08:30, salvo que el evento
 *  empiece en menos de 12 horas (tiempo real, no de reloj): entonces en t. */
export function horaDeEnvio(t: Date, inicioEvento: Date | null) {
  if (!enSilencio(t)) return t;
  if (inicioEvento && inicioEvento.getTime() - t.getTime() < DOCE_HORAS) return t;
  return finDelSilencio(t);
}
