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

// ---------------------------------------------------------------- dudas con hora limite (D141)
const UN_DIA = 24 * 3600 * 1000;

/** Hora limite de las «dudas» de un evento (misma definicion que `_limite_dudas` en la base; una prueba las compara).
 *  Entreno oficial del miercoles y partido de liga oficial de miercoles a domingo: el MARTES de esa semana a las 20:00 (los
 *  dos, el mismo martes). Todo lo demas (amistosos, torneos, «entre nosotros», planes, entrenos de otro dia): 24 h antes
 *  del inicio. Desde ese instante ya no hay «duda»: quien siga en ella pasa a «no va». */
export function limiteDudas(e: { tipo: string; fecha: string; inicio: string | null; oficial?: boolean }): Date {
  const dia = diaSemana(e.fecha);
  if (e.oficial !== false) {
    if (e.tipo === "entreno" && dia === 2) return madrid(sumarDias(e.fecha, -1), "20:00");
    if (e.tipo === "liga" && dia >= 2) return madrid(sumarDias(lunesDe(e.fecha), 1), "20:00");
  }
  return new Date(madrid(e.fecha, e.inicio ? String(e.inicio).slice(0, 5) : "00:00").getTime() - UN_DIA);
}

/** ¿Siguen valiendo las «dudas» en este instante? */
export const dudaAbierta = (e: Parameters<typeof limiteDudas>[0], ahora: Date) => ahora.getTime() < limiteDudas(e).getTime();

/** Cuando sale el aviso de «te quedan hasta las HH:MM» a quien siga en «duda»: las 12:00 del dia del limite; si el limite es
 *  antes de las 13:00, una hora antes del limite pero nunca antes de las 08:30 (fin del silencio); null si ni asi cabe
 *  (limite antes de las 09:30 pasado el silencio: no hay aviso previo, solo el paso a «no va»). */
export function avisoDeDudas(limite: Date): Date | null {
  const l = enMadrid(limite);
  if (l.minutos >= 13 * 60) return madrid(l.fecha, "12:00");
  const t = new Date(limite.getTime() - 3600 * 1000);
  const tm = enMadrid(t);
  if (tm.fecha !== l.fecha || tm.minutos < SILENCIO_HASTA) return null;
  return t;
}

const DIAS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
/** El limite en palabras: "hoy a las 20:00" / "mañana a las 20:00" si cae hoy / mañana; si no, "el martes a las 20:00"
 *  (con el numero del dia si falta mas de cinco dias: "el martes 3 a las 20:00"). */
export function textoLimite(limite: Date, ahora: Date) {
  const l = enMadrid(limite);
  const hoy = enMadrid(ahora).fecha;
  if (l.fecha === hoy) return `hoy a las ${l.hora}`;
  if (l.fecha === sumarDias(hoy, 1)) return `mañana a las ${l.hora}`;
  const dia = DIAS_ES[new Date(`${l.fecha}T12:00:00Z`).getUTCDay()];
  const lejos = limite.getTime() - ahora.getTime() > 5 * UN_DIA;
  return `el ${dia}${lejos ? ` ${+l.fecha.slice(8)}` : ""} a las ${l.hora}`;
}
