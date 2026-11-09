/**
 * hoja_nuestra.js — aviso de la rutina A cuando no llega NUESTRA hoja (09/11/2026, BACKLOG).
 *
 * El lunes de la J4 (09/11/2026) las dos pasadas (9:45 y 13:00) salieron «Nada nuevo» sin la hoja de MdL y nadie se enteró
 * hasta la tarde. Ahora, si una pasada de un LUNES sale «Nada nuevo» y el calendario dice que MdA o MdL jugaron el fin de
 * semana anterior (sábado o domingo) sin hoja publicada en data/season_<temporada>.json, `npm run jornada` lo deja en su
 * resumen (`faltan_nuestras`) y rutina_a_publicar.ps1 avisa a Iván con la notificación de Windows de siempre.
 * Sin aviso si nuestro equipo descansó o su partido está aplazado (en el calendario, otra fecha o estado «aplazado»).
 */
const DIA = 86400000;

/** aaaa-mm-dd ± n días. */
const sumarDias = (f, n) => new Date(Date.parse(f + 'T00:00:00Z') + n * DIA).toISOString().slice(0, 10);

/** El texto del aviso, tal cual lo pidió Iván. */
const textoAviso = (equipo, jornada) => `Iván, no hay hoja de ${equipo} de la J${jornada}: revisa la tarea "hojas del lunes" o bájala del S21`;

/**
 * Partidos nuestros del fin de semana anterior a `hoy` (un lunes) que no tienen hoja publicada.
 * calendario: partidos de data/calendario_<temporada>.json ({equipo, fase, jornada, fecha, descansa, estado});
 * season: data/season_<temporada>.json ({partidos, box}); nombres: nombres_club de temporadas.json (para «MdA»).
 * Devuelve [{ equipo, jornada, fecha, texto }]; vacío si hoy no es lunes.
 */
function faltanNuestras({ calendario, season, hoy, nombres = {} }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hoy || '') || new Date(hoy + 'T00:00:00Z').getUTCDay() !== 1) return [];
  const finde = [sumarDias(hoy, -2), sumarDias(hoy, -1)];
  const corto = eq => (nombres[eq] || []).find(n => n !== n.toUpperCase()) || eq;
  const box = (season && season.box) || {};
  return calendario
    .filter(c => c.fase === 'liga' && !c.descansa && finde.includes(c.fecha) && !/aplaz|cancel/i.test(c.estado || ''))
    .filter(c => !(box[`${c.jornada}_${c.equipo}`] || []).length)
    .map(c => ({ equipo: corto(c.equipo), jornada: c.jornada, fecha: c.fecha, texto: textoAviso(corto(c.equipo), c.jornada) }));
}

/** «Hoy» en Madrid (aaaa-mm-dd). */
const hoyMadrid = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date());

module.exports = { faltanNuestras, textoAviso, hoyMadrid };
