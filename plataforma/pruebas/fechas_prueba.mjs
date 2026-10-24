// Fechas de las pruebas que no caducan. Las pruebas de respuestas (paso 3) se escribieron el 08/10/2026 con fechas de la
// temporada que entonces eran futuras (el entreno del 14/10, la J2 del 18/10 y la J3 del 25/10). Para que sigan
// valiendo cualquier dia, en la base de PRUEBAS (la pila local, nunca la real) se adelantan TODOS los eventos el mismo
// numero de semanas enteras: se conservan el dia de la semana, las horas y la distancia entre eventos. Las fechas fijas
// de la prueba pasan por F() para que apunten al mismo evento ya movido.

export const hoyMadrid = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
export const sumarDias = (f, n) => { const d = new Date(`${f}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dias = (a, b) => Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);

/** Semanas que hay que adelantar para que `primera` quede despues de hoy; `vale(F)` puede pedir mas (p. ej. que un
 *  rango no cruce de mes). 0 si ya es futura. */
export function semanas(primera, { hoy = hoyMadrid(), vale = () => true } = {}) {
  let w = Math.max(0, Math.ceil((dias(primera, hoy) + 1) / 7));
  while (!vale((f) => sumarDias(f, 7 * w))) w++;
  return w;
}

/** Adelanta eventos y descansos `w` semanas en la base de pruebas y devuelve F(fecha) -> la fecha movida. */
export async function adelantar(sql, w) {
  if (w > 0) {
    await sql`update public.eventos set fecha = fecha + ${7 * w}::int`;
    await sql`update public.descansos set fecha = fecha + ${7 * w}::int`;
  }
  return (f) => sumarDias(f, 7 * w);
}

// Textos de fechas como los escribe la web («domingo 25 de octubre», «domingo 25 oct», «Octubre 2026», «25/10»).
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const dia = (f) => DIAS[new Date(`${f}T12:00:00Z`).getUTCDay()];
export const diaLargo = (f) => `${dia(f)} ${+f.slice(8, 10)} de ${MESES[+f.slice(5, 7) - 1]}`;
export const diaMesCorto = (f) => `${dia(f)} ${+f.slice(8, 10)} ${MESES[+f.slice(5, 7) - 1].slice(0, 3)}`;
export const diaNumero = (f) => `${dia(f)} ${+f.slice(8, 10)}`;
export const mesAno = (f) => { const m = MESES[+f.slice(5, 7) - 1]; return `${m[0].toUpperCase()}${m.slice(1)} ${f.slice(0, 4)}`; };
export const ddmm = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
