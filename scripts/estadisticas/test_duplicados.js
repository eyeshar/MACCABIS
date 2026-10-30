/**
 * test_duplicados.js — prueba de regresión de `npm run jornada` (npm run test:duplicados).
 *
 * Caso real (23/10/2026): al procesar la J2 con `--jornada 2`, las hojas de la J1 que seguían en Descargas
 * se habrían copiado a fuentes_fbm/2026-27/liga/ como si fueran de la J2 (nombre nuevo, mismo contenido).
 *
 * Se trabaja con hojas SINTÉTICAS (mismo formato que las de la FBM: cabecera "Estadísticas - A vs B - ... -
 * FBM - 26/27" y dos bloques con TOTALES), en carpetas temporales: nunca toca fuentes_fbm/ ni data/. Los
 * equipos son los del calendario real (data/calendario_2026-27.json), porque la jornada y el grupo salen de él.
 *
 *  1. Con hojas de la J1 (ya cargadas) y de la J2 en la misma carpeta, `--jornada 2` copia SOLO las de la J2
 *     y descarta las de la J1 diciendo dónde están ya. Lo mismo sin `--jornada` (jornada inferida por fecha).
 *  2. Dos copias idénticas del mismo fichero en Descargas se copian una sola vez.
 *  3. Si una hoja no puede ser de la jornada pedida, PARA sin copiar nada:
 *     - hoja de liga descargada antes de que se jugara esa jornada y con otra señal de ser vieja (su partido ya está
 *       cargado en otra jornada, o no tiene puntos);
 *     - hoja de liga de un equipo que juega contra nosotros esa jornada según el calendario;
 *     - hoja de liga de un equipo que ya tiene hoja de esa jornada;
 *     - hoja nuestra cuyo partido, según el calendario, es de otra jornada.
 *  4. Si solo la fecha del fichero es anterior a la jornada (una copia con su fecha antigua), avisa y la carga, también
 *     con --no-interactivo (rutina A).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const X = require('xlsx');
const { recoger, copiar } = require('./procesar_jornada');

const T = '2026-27';
let fallos = 0;
const ok = (c, m) => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}`); if (!c) fallos++; };
const md5 = b => crypto.createHash('md5').update(b).digest('hex');
const callado = () => {};

/** Bytes de una hoja de estadística sintética con el formato de la FBM. */
function hoja(local, visitante, ptsL, ptsV, extra = '') {
  const bloque = (nombre, pts) => {
    const p2 = Math.floor(pts / 2), tl = pts - 2 * p2;
    const fila = (num, nom) => [num, nom, '20:00', String(pts), `${p2}/${p2 + 2}`, '', '0/0', '', `${tl}/${tl}`, '', '0', '0', '0', '0', '0', '0', '0', '0', '1', '0', String(pts), '0'];
    return [[nombre], ['Num.', 'Nombre', 'MIN', 'PTS', 'TC 2P', '%', 'TC 3P', '%', 'TL', '%', 'DEF', 'OF', 'Tot.', 'AST', 'REC', 'PER', 'TC', 'TR', 'FC', 'FR', 'VAL', '+/-'],
      fila('4', 'JUGADOR DE PRUEBA'), fila('', 'TOTALES'), []];
  };
  const filas = [['FEDERACIÓN DE BALONCESTO DE MADRID'], [], [], [],
    [`Estadísticas - ${local} vs ${visitante} - SenMas JDM - Competiciones JDM - FBM - 26/27`], [extra], [], [],
    ...bloque(local, ptsL), ...bloque(visitante, ptsV)];
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(filas), 'Estadísticas-');
  return X.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

const HOJAS = {
  j1_nuestra: hoja('ENFERMOS DEL ARO', 'MDA', 14, 62),           // J1 (04/10): MdA fuera
  j1_liga: hoja('CHAVALITROS', 'VALLEKAS BASKET', 50, 40),       // J1, G1
  j2_nuestra: hoja('MDA', 'LITROS DE MAHOU', 74, 17),            // J2 (18/10): MdA en casa
  j2_liga: hoja('WILD BOYS', 'CHAVALITROS', 45, 55),             // J2, G1
  j1_liga_bis: hoja('CHAVALITROS', 'VALLEKAS BASKET', 50, 40, 'reexportada'),   // misma J1, contenido distinto
  j1_nuestra_bis: hoja('ENFERMOS DEL ARO', 'MDA', 14, 62, 'reexportada'),
  j1_liga_mahou: hoja('LITROS DE MAHOU', 'LOS KHINKIS RUSOS', 60, 30),           // J1, G1 (Mahou juega contra MdA en la J2)
  j2_liga_vacia: hoja('WILD BOYS', 'CHAVALITROS', 0, 0),                          // J2 bajada antes de jugarse: sin puntos
};

/** Carpeta temporal nueva. */
const tmp = n => fs.mkdtempSync(path.join(os.tmpdir(), `maccabis-dup-${n}-`));
const escribe = (dir, nombre, bytes, fecha) => {
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, nombre);
  fs.writeFileSync(f, bytes);
  if (fecha) { const d = new Date(fecha + 'T12:00:00Z'); fs.utimesSync(f, d, d); }
  return f;
};
const lista = base => fs.readdirSync(base, { recursive: true }).map(String).filter(f => fs.statSync(path.join(base, f)).isFile()).map(f => f.replace(/\\/g, '/')).sort();
const hashes = base => new Set(lista(base).map(f => md5(fs.readFileSync(path.join(base, f)))));

/** fuentes_fbm temporal con la J1 ya cargada (como quedó tras procesar la J1). */
function baseConJ1() {
  const base = tmp('fuentes');
  escribe(path.join(base, 'hojas'), `estadisticaPartido_J01_MDA_vs_enfermos-del-aro_${md5(HOJAS.j1_nuestra).slice(0, 8)}.xlsx`, HOJAS.j1_nuestra, '2026-10-05');
  escribe(path.join(base, 'liga'), `liga_J01_G1_chavalitros_vs_vallekas-basket_${md5(HOJAS.j1_liga).slice(0, 8)}.xlsx`, HOJAS.j1_liga, '2026-10-06');
  return base;
}
/** Descargas temporal: las hojas de la J1 (bajadas el 06/10) siguen ahí junto a las de la J2 (bajadas el 23/10). */
function descargasJ1yJ2() {
  const d = tmp('descargas');
  escribe(d, 'estadisticaPartido_06102026 1.xlsx', HOJAS.j1_nuestra, '2026-10-06');
  escribe(d, 'estadisticaPartido_06102026 2.xlsx', HOJAS.j1_liga, '2026-10-06');
  escribe(d, 'estadisticaPartido_23102026.xlsx', HOJAS.j2_nuestra, '2026-10-23');
  escribe(d, 'estadisticaPartido_23102026_3.xlsx', HOJAS.j2_liga, '2026-10-23');
  return d;
}

(async () => {
  // 1a. --jornada 2 con las hojas de la J1 todavía en Descargas: no se duplican.
  for (const [modo, opts] of [['--jornada 2', { jornadaForzada: 2 }], ['jornada inferida por fecha (23/10/2026)', { hoy: '2026-10-23' }]]) {
    const base = baseConJ1(), desde = descargasJ1yJ2();
    const antes = lista(base), hAntes = hashes(base);
    const r = await recoger({ temporada: T, desde, base, sinAsistencia: true, log: callado, ...opts });
    ok(r.descartes.length === 2 && r.descartes.every(d => /ya cargada como fuentes_fbm\/2026-27\/(hojas|liga)\//.test(d.motivo)),
      `${modo}: las 2 hojas de la J1 se descartan diciendo dónde están ya (${r.descartes.map(d => d.origen).join(', ')})`);
    ok(r.plan.length === 2 && r.plan.some(p => p.nombre.startsWith('estadisticaPartido_J02_MDA_vs_litros-de-mahou_')) && r.plan.some(p => p.nombre.startsWith('liga_J02_G1_wild-boys_vs_chavalitros_')),
      `${modo}: el plan lleva solo las 2 hojas de la J2 (${r.plan.map(p => p.nombre).join(', ')})`);
    const nuevos = copiar(r.plan, { desde, base, log: callado });
    const despues = lista(base);
    ok(nuevos === 2 && despues.length === 4, `${modo}: se copian 2 ficheros y la carpeta queda con 4 (${despues.length})`);
    ok(antes.every(f => despues.includes(f)), `${modo}: los ficheros de la J1 siguen tal cual`);
    ok(!despues.some(f => /J02.*chavalitros_vs_vallekas|J02.*enfermos/.test(f)), `${modo}: ninguna hoja de la J1 aparece renombrada como J02`);
    ok(hashes(base).size === 4 && [...hAntes].every(h => hashes(base).has(h)), `${modo}: 4 contenidos distintos, sin duplicados`);
    // Repetir el proceso no cambia nada.
    const r2 = await recoger({ temporada: T, desde, base, sinAsistencia: true, log: callado, ...opts });
    ok(r2.plan.length === 0 && r2.descartes.length === 4, `${modo}: al repetir, las 4 hojas ya están cargadas y no se copia nada`);
  }

  // 2. Dos copias idénticas del mismo fichero en Descargas ("x.xlsx" y "x (1).xlsx").
  {
    const base = baseConJ1(), desde = tmp('descargas');
    escribe(desde, 'estadisticaPartido_23102026.xlsx', HOJAS.j2_liga, '2026-10-23');
    escribe(desde, 'estadisticaPartido_23102026 (1).xlsx', HOJAS.j2_liga, '2026-10-23');
    const r = await recoger({ temporada: T, desde, base, jornadaForzada: 2, sinAsistencia: true, log: callado });
    ok(r.plan.length === 1 && r.descartes.length === 1 && /idéntica a "estadisticaPartido_23102026( \(1\))?\.xlsx"/.test(r.descartes[0].motivo),
      'dos copias idénticas en Descargas: se copia una y la otra se descarta como idéntica');
  }

  // 3. Hojas que no pueden ser de la jornada pedida: para sin copiar nada.
  const paraSinCopiar = async (titulo, base, desde, opts, re) => {
    const antes = lista(base);
    let err = null;
    try { await recoger({ temporada: T, desde, base, sinAsistencia: true, log: callado, ...opts }); } catch (e) { err = e; }
    ok(err && re.test(err.message), `${titulo}: para con un aviso claro (${err ? err.message.slice(0, 110) : 'NO PARA'}...)`);
    ok(JSON.stringify(lista(base)) === JSON.stringify(antes), `${titulo}: no se ha copiado nada`);
  };
  {   // hoja de liga de la J1 reexportada (contenido distinto), bajada el 06/10, con --jornada 2 (18/10): fecha vieja
      // y además ese partido ya está cargado en la J1
    const base = baseConJ1(), desde = tmp('descargas');
    escribe(desde, 'estadisticaPartido_06102026.xlsx', HOJAS.j1_liga_bis, '2026-10-06');
    await paraSinCopiar('hoja de liga bajada antes de la J2 y con su partido ya cargado en la J1', base, desde, { jornadaForzada: 2 },
      /no puede ser de la J02: se descargó el 2026-10-06 y esa jornada se jugó el 2026-10-18 y ese partido ya está cargado en la J01 \(liga\/liga_J01_G1_chavalitros_vs_vallekas-basket_/);
  }
  {   // fecha vieja y la hoja sin puntos (bajada antes de que se jugara el partido)
    const base = baseConJ1(), desde = tmp('descargas');
    escribe(desde, 'estadisticaPartido_06102026.xlsx', HOJAS.j2_liga_vacia, '2026-10-06');
    await paraSinCopiar('hoja de liga bajada antes de la J2 y sin puntos', base, desde, { jornadaForzada: 2, estricto: true },
      /se descargó el 2026-10-06 y esa jornada se jugó el 2026-10-18 y la hoja no tiene puntos/);
  }
  // 4. Solo la fecha del fichero es vieja (una hoja copiada con su fecha antigua): avisa y se carga, también con
  //    --no-interactivo (estricto), que es como la llama la rutina A.
  for (const [modo, opts] of [['interactivo', {}], ['--no-interactivo', { estricto: true }]]) {
    const base = baseConJ1(), desde = tmp('descargas');
    escribe(desde, 'estadisticaPartido_23102026.xlsx', HOJAS.j2_liga, '2026-10-06');
    let r = null, err = null;
    try { r = await recoger({ temporada: T, desde, base, jornadaForzada: 2, sinAsistencia: true, log: callado, ...opts }); } catch (e) { err = e; }
    ok(!err, `solo fecha vieja (${modo}): no para (${err ? err.message.slice(0, 110) : 'sigue'})`);
    ok(r && r.plan.length === 1 && r.plan[0].nombre.startsWith('liga_J02_G1_wild-boys_vs_chavalitros_'), `solo fecha vieja (${modo}): la hoja va al plan como J02`);
    ok(r && r.avisos.length === 1 && /se descargó el 2026-10-06 y esa jornada se jugó el 2026-10-18, pero no hay otra señal/.test(r.avisos[0]),
      `solo fecha vieja (${modo}): deja un aviso (${r && r.avisos[0] ? r.avisos[0].slice(0, 110) : 'SIN AVISO'}...)`);
  }
  {   // hoja de liga en la que juega nuestro rival de la J2 (Litros de Mahou contra MdA), bajada hoy
    const base = baseConJ1(), desde = tmp('descargas');
    escribe(desde, 'estadisticaPartido_23102026.xlsx', HOJAS.j1_liga_mahou, '2026-10-23');
    await paraSinCopiar('hoja de liga con nuestro rival de la J2', base, desde, { jornadaForzada: 2 }, /no puede ser de la J02: según el calendario, LITROS DE MAHOU juega contra MDA en la J02/);
  }
  {   // hoja de liga de un equipo que ya tiene hoja de la J2 (Chavalitros, Wild Boys - Chavalitros ya cargada)
    const base = baseConJ1(), desde = tmp('descargas');
    escribe(path.join(base, 'liga'), `liga_J02_G1_wild-boys_vs_chavalitros_${md5(HOJAS.j2_liga).slice(0, 8)}.xlsx`, HOJAS.j2_liga, '2026-10-23');
    escribe(desde, 'estadisticaPartido_23102026.xlsx', HOJAS.j1_liga_bis, '2026-10-23');
    await paraSinCopiar('hoja de liga de un equipo que ya tiene hoja de la J2', base, desde, { jornadaForzada: 2 }, /no puede ser de la J02: CHAVALITROS ya tiene hoja de esa jornada \(liga\/liga_J02_G1_wild-boys_vs_chavalitros_/);
  }
  {   // dos hojas del mismo equipo en la misma carpeta para la misma jornada
    const base = baseConJ1(), desde = tmp('descargas');
    escribe(desde, 'estadisticaPartido_23102026.xlsx', HOJAS.j2_liga, '2026-10-23');
    escribe(desde, 'estadisticaPartido_23102026_2.xlsx', HOJAS.j1_liga_bis, '2026-10-23');
    await paraSinCopiar('dos hojas de Chavalitros en la misma carpeta para la J2', base, desde, { jornadaForzada: 2 }, /ya tiene hoja de esa jornada \(estadisticaPartido_23102026\.xlsx \(en esta misma carpeta\)\)/);
  }
  {   // hoja nuestra de la J1 reexportada con --jornada 2: el calendario dice J1
    const base = baseConJ1(), desde = tmp('descargas');
    escribe(desde, 'estadisticaPartido_23102026.xlsx', HOJAS.j1_nuestra_bis, '2026-10-23');
    await paraSinCopiar('hoja nuestra de la J1 con --jornada 2', base, desde, { jornadaForzada: 2 }, /es de la J01 según el calendario, no de la J02 pedida con --jornada/);
  }
  {   // hoja nuestra de la J1 reexportada sin --jornada: ya tenemos otra hoja distinta de ese partido
    const base = baseConJ1(), desde = tmp('descargas');
    escribe(desde, 'estadisticaPartido_23102026.xlsx', HOJAS.j1_nuestra_bis, '2026-10-23');
    await paraSinCopiar('hoja nuestra de la J1 distinta de la ya cargada', base, desde, { hoy: '2026-10-23' }, /MDA ya tiene hoja de esa jornada \(hojas\/estadisticaPartido_J01_MDA_vs_enfermos-del-aro_/);
  }

  console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('ERROR: ' + (e.stack || e.message)); process.exit(1); });
