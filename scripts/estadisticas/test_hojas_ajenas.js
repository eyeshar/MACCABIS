/**
 * test_hojas_ajenas.js — prueba de la entrada de hojas de OTROS equipos de `npm run jornada` (npm run test:hojas-ajenas, D182/D183).
 *
 * Hojas SINTÉTICAS en carpetas temporales (nunca toca fuentes_fbm/ ni data/). Comprueba que cada hoja se clasifica por su
 * CONTENIDO (temporada por la etiqueta de la cabecera, grupo por los equipos) y nunca por el nombre ni la fecha de descarga:
 *  1. Una hoja de 26/27 de dos equipos sin grupo conocido no se copia y avisa (no para, ni con --no-interactivo).
 *  2. Con esos equipos en el mapa (grupos_fase.json), va a liga/ con su grupo (G5) y sin jornada (J--).
 *  3. Una hoja de otra temporada (25/26, fuera de alcance) se aparta sin procesar y se avisa.
 *  5. La carpeta de Drive se lee con sus subcarpetas (respaldo_…); Descargas no.
 *  4. La misma hoja descargada otra vez (bytes distintos, mismo contenido) y la que está en dos carpetas de entrada se copian una vez.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const X = require('xlsx');

let fallos = 0;
const ok = (c, m) => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}`); if (!c) fallos++; };
const tmp = n => fs.mkdtempSync(path.join(os.tmpdir(), `maccabis-ajenas-${n}-`));

function hoja(local, visitante, ptsL, ptsV, etiqueta, extra = '') {
  const bloque = (nombre, pts) => {
    const p2 = Math.floor(pts / 2), tl = pts - 2 * p2;
    const fila = (num, nom) => [num, nom, '20:00', String(pts), `${p2}/${p2 + 2}`, '', '0/0', '', `${tl}/${tl}`, '', '0', '0', '0', '0', '0', '0', '0', '0', '1', '0', String(pts), '0'];
    return [[nombre], ['Num.', 'Nombre', 'MIN', 'PTS', 'TC 2P', '%', 'TC 3P', '%', 'TL', '%', 'DEF', 'OF', 'Tot.', 'AST', 'REC', 'PER', 'TC', 'TR', 'FC', 'FR', 'VAL', '+/-'],
      fila('4', 'JUGADOR DE PRUEBA'), fila('', 'TOTALES'), []];
  };
  const filas = [['FEDERACIÓN DE BALONCESTO DE MADRID'], [], [], [],
    [`Estadísticas - ${local} vs ${visitante} - SenMas JDM - Competiciones JDM - FBM - ${etiqueta}`], [extra], [], [],
    ...bloque(local, ptsL), ...bloque(visitante, ptsV)];
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(filas), 'Estadísticas-');
  return X.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
const escribe = (dir, nombre, bytes) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, nombre), bytes); };

(async () => {
  const mapa = path.join(tmp('mapa'), 'grupos_fase.json');
  fs.writeFileSync(mapa, JSON.stringify({ '2026-27': { G5: { nombre: 'SAB TAR G1 (prueba)', equipos: ['EQUIPO UNO', 'EQUIPO DOS'] } } }));
  const { recoger, copiar } = require('./procesar_jornada');
  const llamada = (desde, base) => recoger({ temporada: '2026-27', desde, base, sinAsistencia: true, log: () => {} });

  const base = tmp('base');
  const d1 = tmp('descargas'), d2 = tmp('drive');
  const g5 = hoja('EQUIPO UNO', 'EQUIPO DOS', 58, 42, '26/27');
  escribe(d1, 'estadisticaPartido_04112026 (1).xlsx', g5);                               // nombre sin significado
  escribe(d2, 'estadisticaPartido_04112026 (1).xlsx', hoja('EQUIPO UNO', 'EQUIPO DOS', 58, 42, '26/27'));   // mismo nombre en otra carpeta

  // 1. Sin mapa
  delete process.env.MACCABIS_GRUPOS_FASE;
  let r = await llamada(d1, base);
  ok(r.plan.length === 0 && r.avisos.some(a => /ningún grupo conocido/.test(a)), '1. sin grupo conocido: no se copia y avisa');
  r = await recoger({ temporada: '2026-27', desde: d1, base, sinAsistencia: true, estricto: true, log: () => {} }).catch(e => e);
  ok(!(r instanceof Error) && r.plan.length === 0, '1b. con --no-interactivo tampoco para la rutina por ello');

  // 2. Con mapa: dos carpetas con el mismo nombre de fichero y la misma hoja
  process.env.MACCABIS_GRUPOS_FASE = mapa;
  r = await llamada([d1, d2], base);
  ok(r.plan.length === 1 && r.plan[0].destino === 'liga' && /^liga_J--_G5_equipo-uno_vs_equipo-dos_[0-9a-f]{8}\.xlsx$/.test(r.plan[0].nombre), `2. grupo por los equipos, sin jornada (${r.plan[0] && r.plan[0].nombre})`);
  ok(r.descartes.length === 1, '4a. la misma hoja en dos carpetas (mismo nombre) se copia una vez');
  copiar(r.plan, { base, log: () => {} });
  ok(fs.readdirSync(path.join(base, 'liga')).length === 1, '2b. copiada a liga/');
  // misma hoja descargada de nuevo: bytes distintos
  const d3 = tmp('otra');
  escribe(d3, 'estadisticaPartido_05112026.xlsx', hoja('EQUIPO UNO', 'EQUIPO DOS', 58, 42, '26/27', ''));
  r = await llamada(d3, base);
  ok(r.plan.length === 0 && r.descartes.length === 1, '4b. la misma hoja reexportada (o ya cargada) se descarta');

  // 3. Otra temporada (25/26): fuera de alcance. Se aparta sin procesar y se avisa, sin crear carpeta alguna.
  const d4 = tmp('pasada');
  escribe(d4, 'estadisticaPartido_21102025.xlsx', hoja('EQUIPO UNO', 'EQUIPO DOS', 50, 40, '25/26'));
  r = await llamada(d4, base);
  ok(r.plan.length === 0 && r.avisos.some(a => /25\/26, no la 26\/27/.test(a)), '3. hoja de 25/26: se aparta y avisa');
  ok(fs.readdirSync(base).join() === 'liga', '3b. no se crea ninguna carpeta nueva (ni rivales/)');

  // 5. Subcarpetas: solo en las carpetas marcadas como recursivas (la de Drive: respaldo_04112026\), no en Descargas.
  const d5 = tmp('drive-sub'), d6 = tmp('descargas-sub');
  escribe(path.join(d5, 'respaldo_04112026'), 'estadisticaPartido_04112026 (7).xlsx', hoja('EQUIPO UNO', 'EQUIPO DOS', 61, 47, '26/27'));
  escribe(path.join(d6, 'otra'), 'estadisticaPartido_04112026 (7).xlsx', hoja('EQUIPO UNO', 'EQUIPO DOS', 61, 47, '26/27'));
  r = await recoger({ temporada: '2026-27', desde: d5, recursivo: [d5], base: tmp('base2'), sinAsistencia: true, log: () => {} });
  ok(r.plan.length === 1, '5. entra en las subcarpetas de la carpeta de Drive');
  r = await recoger({ temporada: '2026-27', desde: d6, base: tmp('base3'), sinAsistencia: true, log: () => {} });
  ok(r.plan.length === 0, '5b. no entra en las subcarpetas de Descargas');

  delete process.env.MACCABIS_GRUPOS_FASE;
  console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo bien.');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
