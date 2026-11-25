// Reglas que comprueban las `-real` contra los datos del momento (BACKLOG 24, D201): propiedades, no recuentos ni fotos.
// Cada función devuelve la lista de problemas (vacía si todo cumple). Solo nombran claves de evento y campos, nunca
// datos de personas.

const TIPOS = ['entreno', 'liga', 'amistoso', 'torneo', 'interno', 'quedada', 'pachanga', 'otro'];
const EQUIPOS = ['MdA', 'MdL', 'ambos'];
const fechaTxt = (f) => (f instanceof Date ? f.toISOString().slice(0, 10) : String(f ?? '').slice(0, 10));

/** «2026-27» -> [2026-08-01, 2027-07-31]; null si el texto no es una temporada bien formada. */
export function rangoTemporada(t) {
  const m = /^(\d{4})-(\d{2})$/.exec(t ?? '');
  if (!m || (Number(m[1]) + 1) % 100 !== Number(m[2])) return null;
  return [`${m[1]}-08-01`, `${Number(m[1]) + 1}-07-31`];
}

/** Un evento de la vista pública: campos obligatorios y válidos. */
export function problemasEventoPublico(e) {
  const p = [];
  const f = fechaTxt(e.fecha);
  const r = rangoTemporada(e.temporada);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) p.push('sin fecha válida');
  if (!r) p.push(`temporada mal formada (${e.temporada})`);
  else if (f < r[0] || f > r[1]) p.push(`fecha ${f} fuera de su temporada ${e.temporada}`);
  if (!TIPOS.includes(e.tipo)) p.push(`tipo desconocido (${e.tipo})`);
  if (!EQUIPOS.includes(e.equipo)) p.push(`equipo desconocido (${e.equipo})`);
  if (!['programado', 'cancelado'].includes(e.estado)) p.push(`estado desconocido (${e.estado})`);
  if (e.tipo === 'liga') {
    if (!['MdA', 'MdL'].includes(e.equipo)) p.push('partido de liga sin equipo MdA o MdL');
    if (!(e.jornada > 0)) p.push('partido de liga sin jornada');
    if (!(e.rival ?? '').trim()) p.push('partido de liga sin rival');
    if (typeof e.es_local !== 'boolean') p.push('partido de liga sin local/visitante');
  }
  if (!e.inicio) p.push('sin hora de inicio');
  if (e.inicio && e.fin && String(e.fin) <= String(e.inicio)) p.push('la hora de fin no es posterior a la de inicio');
  return p;
}

/** Los partidos de liga públicos: una sola fila por equipo, temporada y jornada. */
export function jornadasRepetidas(publicos) {
  const vistos = new Map();
  for (const e of publicos.filter((x) => x.tipo === 'liga')) {
    const k = `${e.temporada} ${e.equipo} J${e.jornada}`;
    vistos.set(k, (vistos.get(k) ?? 0) + 1);
  }
  return [...vistos].filter(([, n]) => n > 1).map(([k, n]) => `${k} (${n} veces)`);
}

/** El calendario de liga está entero: por temporada y equipo, sus partidos y sus descansos cubren las jornadas 1…N sin
 *  huecos. Sustituye al «67 eventos» fijo en lo que este sí detectaba: que un partido desaparezca (borrado o perdido). */
export function huecosJornadas(publicos, descansos) {
  const por = new Map();
  for (const x of [...publicos.filter((e) => e.tipo === 'liga'), ...descansos]) {
    const k = `${x.temporada} ${x.equipo}`;
    if (!por.has(k)) por.set(k, new Set());
    por.get(k).add(x.jornada);
  }
  const p = [];
  for (const [k, js] of por) {
    const max = Math.max(...js);
    const faltan = Array.from({ length: max }, (_, i) => i + 1).filter((j) => !js.has(j));
    if (faltan.length) p.push(`${k}: faltan las jornadas ${faltan.join(', ')} (de ${max})`);
  }
  return p;
}

/** Descansos públicos: bien formados, y ese equipo no juega esa jornada ni ese día. */
export function problemasDescansos(descansos, publicos) {
  const p = [];
  const liga = publicos.filter((e) => e.tipo === 'liga' && e.estado === 'programado');
  for (const d of descansos) {
    const f = fechaTxt(d.fecha);
    const r = rangoTemporada(d.temporada);
    const k = `${d.temporada} ${d.equipo} J${d.jornada}`;
    if (!['MdA', 'MdL'].includes(d.equipo)) p.push(`${k}: equipo no válido`);
    if (!(d.jornada > 0)) p.push(`${k}: sin jornada`);
    if (!r || f < r[0] || f > r[1]) p.push(`${k}: fecha ${f} fuera de su temporada`);
    if (liga.some((e) => e.equipo === d.equipo && e.temporada === d.temporada && (e.jornada === d.jornada || fechaTxt(e.fecha) === f))) p.push(`${k}: ese equipo tiene partido esa jornada o ese día`);
  }
  return p;
}

/** Pistas: coordenadas completas (las dos o ninguna) y en rango; las habituales, con coordenadas (el mapa las necesita). */
export function problemasPistas(pistas) {
  const p = [];
  for (const x of pistas) {
    const tiene = [x.lat, x.lng].filter((v) => v !== null && v !== undefined).length;
    if (tiene === 1) p.push(`${x.slug}: solo una de las dos coordenadas`);
    if (tiene === 2 && (Math.abs(x.lat) > 90 || Math.abs(x.lng) > 180)) p.push(`${x.slug}: coordenadas fuera de rango`);
    if (x.estado === 'habitual' && tiene < 2) p.push(`${x.slug}: pista habitual sin coordenadas`);
  }
  return p;
}

/**
 * Invitado esperado (D148 y anteriores), escrito aparte de `public._invitado` para compararlo con ella: si alguien cambia
 * la función, esta prueba lo nota. `marcado` = el evento tiene «solo con ficha» (solo_con_ficha_en no nulo).
 */
export function invitadoEsperado(j, e, marcado) {
  if (!j.activo || j.rol === 'entrenador') return false;
  const ficha = j.ficha_mda || j.ficha_mdl;
  const porEquipo = e.equipo === 'MdA' ? j.ficha_mda : e.equipo === 'MdL' ? j.ficha_mdl : null;
  if (!e.oficial || ['quedada', 'pachanga', 'otro'].includes(e.tipo)) return porEquipo ?? (j.entrena || ficha);
  if (['entreno', 'interno'].includes(e.tipo)) return (j.entrena || ficha) && (ficha || !marcado);
  if (j.rol === 'solo_entreno') return false;
  return porEquipo ?? ficha;
}
