/**
 * test_hojas_ajenas.js — prueba de la entrada de hojas de OTROS equipos de `npm run jornada` (npm run test:hojas-ajenas, D182/D183).
 *
 * Hojas SINTÉTICAS en carpetas temporales (nunca toca fuentes_fbm/ ni data/). Comprueba que cada hoja se clasifica por su
 * CONTENIDO (temporada por la etiqueta de la cabecera, grupo por los equipos) y nunca por el nombre ni la fecha de descarga:
 *  1. Una hoja de 26/27 de dos equipos sin grupo conocido no se copia y avisa (no para, ni con --no-interactivo).
 *  2. Con esos equipos en el mapa (grupos_fase.json), va a liga/ con su grupo (G5) y sin jornada (J--).
 *  3. Una hoja de otra temporada (25/26, fuera de alcance) se aparta sin procesar y se avisa.
 *  5. La carpeta de Drive se lee con sus subcarpetas (respaldo_…); Descargas no.
 *  6. Una hoja descuadrada en origen para en G1/G2 y solo avisa en los grupos ajenos.
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

  // 6. Hoja descuadrada en origen (faltas por jugador distintas del total): PARA en G1/G2 (nuestros), solo avisa en los ajenos.
  const { validarPartidos } = require('./liga');
  const { leerHojaLiga } = require('./leer_hoja_liga');
  const d7 = tmp('descuadre');
  escribe(d7, 'x.xlsx', hoja('EQUIPO UNO', 'EQUIPO DOS', 58, 42, '26/27'));
  const mala = leerHojaLiga(path.join(d7, 'x.xlsx'));
  mala.equipos[0].totales.fc += 1;
  const nuestro = validarPartidos([{ grupo: { clave: 'G1', ajeno: false }, hoja: mala }]);
  const ajeno = validarPartidos([{ grupo: { clave: 'G3', ajeno: true }, hoja: mala }]);
  ok(nuestro.errores.length > 0 && nuestro.avisos.length === 0, '6. hoja descuadrada en G1/G2: error (para la rutina)');
  ok(ajeno.errores.length === 0 && ajeno.avisos.length > 0, '6b. hoja descuadrada en G3-G6: solo aviso');

  // 7. Jornada de G3-G6 (D186): del registro de descargas de la rutina A (jornadas_hojas.csv en la carpeta de Drive) y, si el
  //    partido ya estaba, de data/jornadas_grupos_ajenos_<temporada>.json (aquí, uno temporal).
  fs.writeFileSync(mapa, JSON.stringify({ '2026-27': { G5: { nombre: 'SAB TAR G1 (prueba)', equipos: ['EQUIPO UNO', 'EQUIPO DOS', 'EQUIPO TRES', 'EQUIPO CUATRO'] } } }));
  const datos = path.join(tmp('datos'), 'jornadas.json');
  fs.writeFileSync(datos, JSON.stringify({ temporada: '2026-27', nota: '', partidos: [], jornadas: [] }));
  process.env.MACCABIS_JORNADAS_AJENAS = datos;
  const ja = require('./jornadas_ajenas');
  const { contexto } = require('./liga');
  const CAB = 'archivo;grupo;jornada;local;visitante\n';
  const d8 = tmp('drive-reg'), base8 = tmp('base8');
  escribe(d8, 'estadisticaPartido_10112026.xlsx', hoja('EQUIPO UNO', 'EQUIPO DOS', 61, 40, '26/27'));
  escribe(d8, 'estadisticaPartido_10112026 (1).xlsx', hoja('EQUIPO TRES', 'EQUIPO CUATRO', 52, 49, '26/27'));
  fs.writeFileSync(path.join(d8, ja.MANIFIESTO), CAB + 'estadisticaPartido_10112026.xlsx;G5;4;EQUIPO UNO;EQUIPO DOS\n;SAB TAR G1 (prueba);J4;Equipo Tres;Equipo Cuatro\n');
  r = await recoger({ temporada: '2026-27', desde: d8, recursivo: [d8], base: base8, sinAsistencia: true, estricto: true, log: () => {} });
  const nombres = r.plan.map(p => p.nombre).sort();
  ok(nombres.length === 2 && nombres.every(n => /^liga_J04_G5_/.test(n)), `7. con el registro de descargas, la copia lleva su jornada (por el nombre del fichero y, sin él, por el partido y el nombre del grupo) (${nombres.join(', ')})`);
  copiar(r.plan, { base: base8, log: () => {} });
  ja.anotar('2026-27', r.plan.map(p => p.registro).filter(Boolean), contexto('2026-27').grupos);
  let reg = ja.leer('2026-27');
  ok(reg.partidos.length === 2 && reg.partidos.every(p => p.jornada === 4 && p.comprobado === true && /^liga_J04_G5_/.test(p.hoja) && !('marcador' in p)),
    '7b. y queda anotada en el fichero de datos (sin marcador)');
  ok(reg.jornadas.length === 1 && reg.jornadas[0].descansa === null, '7c. con 4 equipos y 2 partidos no descansa nadie');

  // Sin registro: se copia igual como J-- y se avisa, también con --no-interactivo (no para la rutina).
  const d9 = tmp('drive-sin');
  escribe(d9, 'estadisticaPartido_17112026.xlsx', hoja('EQUIPO UNO', 'EQUIPO TRES', 44, 39, '26/27'));
  r = await recoger({ temporada: '2026-27', desde: d9, recursivo: [d9], base: base8, sinAsistencia: true, estricto: true, log: () => {} }).catch(e => e);
  ok(!(r instanceof Error) && r.plan.length === 1 && /^liga_J--_G5_/.test(r.plan[0].nombre) && !r.plan[0].registro && r.avisos.some(a => /sin jornada/.test(a)),
    '7d. sin registro: se copia como J-- y avisa, sin parar la rutina');

  // Ya en el fichero de datos (la misma hoja con otro contenido, p. ej. corregida): toma esa jornada; si el registro dice otra, duda.
  const d10 = tmp('drive-otra');
  escribe(d10, 'estadisticaPartido_18112026.xlsx', hoja('EQUIPO UNO', 'EQUIPO DOS', 61, 41, '26/27'));
  r = await recoger({ temporada: '2026-27', desde: d10, recursivo: [d10], base: tmp('base10'), sinAsistencia: true, estricto: true, log: () => {} });
  ok(r.plan.length === 1 && /^liga_J04_G5_/.test(r.plan[0].nombre) && !r.plan[0].registro, '7e. un partido que ya está en el fichero de datos toma de ahí su jornada (y no se anota dos veces)');
  fs.writeFileSync(path.join(d10, ja.MANIFIESTO), CAB + 'estadisticaPartido_18112026.xlsx;G5;5;EQUIPO UNO;EQUIPO DOS\n');
  r = await recoger({ temporada: '2026-27', desde: d10, recursivo: [d10], base: tmp('base11'), sinAsistencia: true, estricto: true, log: () => {} }).catch(e => e);
  ok(r instanceof Error && /lo tiene en la J04, no en la J05/.test(r.message), `7f. el registro y el fichero de datos no coinciden: duda (${r.message})`);

  // El registro apunta a otro partido para ese fichero: duda.
  const d11 = tmp('drive-mal');
  escribe(d11, 'estadisticaPartido_19112026.xlsx', hoja('EQUIPO DOS', 'EQUIPO CUATRO', 50, 30, '26/27'));
  fs.writeFileSync(path.join(d11, ja.MANIFIESTO), CAB + 'estadisticaPartido_19112026.xlsx;G5;5;EQUIPO TRES;EQUIPO UNO\n');
  r = await recoger({ temporada: '2026-27', desde: d11, recursivo: [d11], base: tmp('base12'), sinAsistencia: true, estricto: true, log: () => {} }).catch(e => e);
  ok(r instanceof Error && /pero la hoja es G5 EQUIPO DOS - EQUIPO CUATRO/.test(r.message), '7g. el registro dice otro partido para ese fichero: duda');

  // Un equipo que ya juega esa jornada: duda.
  fs.writeFileSync(path.join(d11, ja.MANIFIESTO), CAB + 'estadisticaPartido_19112026.xlsx;G5;4;EQUIPO DOS;EQUIPO CUATRO\n');
  r = await recoger({ temporada: '2026-27', desde: d11, recursivo: [d11], base: tmp('base13'), sinAsistencia: true, estricto: true, log: () => {} }).catch(e => e);
  ok(r instanceof Error && /no puede ser de la J04/.test(r.message), '7h. un equipo que ya juega esa jornada: duda');

  // Un registro mal escrito: duda (no se adivina).
  fs.writeFileSync(path.join(d11, ja.MANIFIESTO), CAB + 'estadisticaPartido_19112026.xlsx;G9;x;EQUIPO DOS;EQUIPO CUATRO\n');
  r = await recoger({ temporada: '2026-27', desde: d11, recursivo: [d11], base: tmp('base14'), sinAsistencia: true, estricto: true, log: () => {} }).catch(e => e);
  ok(r instanceof Error && /grupo desconocido/.test(r.message), '7i. una línea del registro con un grupo desconocido: duda');

  // 8. Partidos SIN HOJA con resultado oficial (fix/g5-rutina-s21-y-repaso): en el registro, con marcador y motivo y sin archivo.
  //    El marcador va a <base>/resultados_sin_hoja.csv (fuera de git) y en el fichero de datos queda solo el hueco.
  const CAB2 = 'archivo;grupo;jornada;local;visitante;marcador;fecha;hora;motivo\n';
  const d12 = tmp('drive-sinhoja'), base15 = tmp('base15');
  fs.writeFileSync(path.join(d12, ja.MANIFIESTO), CAB2 + ';G5;6;EQUIPO UNO;EQUIPO TRES;38-30;03/10/2026;15:15;sin hoja\n;G5;6;EQUIPO DOS;EQUIPO CUATRO;20-0;17/10/2026;19:00;incomparecencia\n');
  r = await recoger({ temporada: '2026-27', desde: d12, recursivo: [d12], base: base15, sinAsistencia: true, estricto: true, log: () => {} });
  const sh = r.plan.filter(p => p.destino === 'sin_hoja');
  ok(sh.length === 2 && sh[0].sinHoja.pl === 38 && sh[0].sinHoja.motivo === 'sin_hoja' && sh[1].sinHoja.no_presentado === 'EQUIPO CUATRO',
    '8. dos partidos sin hoja del registro: marcador, motivo y quién no se presentó (el del 0)');
  const restaurar = [];
  ok(copiar(r.plan, { base: base15, temporada: '2026-27', restaurar, log: () => {} }) === 2, '8b. se anotan los dos');
  const csv = fs.readFileSync(path.join(base15, ja.SIN_HOJA), 'utf8');
  ok(/^grupo;jornada;local;visitante;marcador;fecha;hora;motivo;pts_no_presentado\n/.test(csv) && /G5;6;EQUIPO UNO;EQUIPO TRES;38-30;03\/10\/2026;15:15;sin hoja;\n/.test(csv) && restaurar.length === 1 && restaurar[0].previo === null,
    '8c. en resultados_sin_hoja.csv de fuentes_fbm (fuera de git), con su marcador; y se sabe cómo deshacerlo');
  ok(ja.anotarHuecos('2026-27', sh.map(p => p.sinHoja), contexto('2026-27').grupos) === 2, '8d. los dos huecos, al fichero de datos');
  reg = ja.leer('2026-27');
  const j6 = reg.jornadas.find(j => j.jornada === 6);
  ok(j6 && j6.huecos.length === 2 && !JSON.stringify(reg).includes('38') && !JSON.stringify(reg).includes('20-0') && j6.huecos[1].nota.includes('incomparecencia de EQUIPO CUATRO'),
    '8e. en el fichero de datos, el hueco con su motivo y SIN marcador');
  r = await recoger({ temporada: '2026-27', desde: d12, recursivo: [d12], base: base15, sinAsistencia: true, estricto: true, log: () => {} });
  ok(!r.plan.some(p => p.destino === 'sin_hoja'), '8f. ya anotados: la siguiente vez no se repiten');
  fs.writeFileSync(path.join(d12, ja.MANIFIESTO), CAB2 + ';G5;7;EQUIPO UNO;EQUIPO DOS;20-3;;;incomparecencia\n');
  r = await recoger({ temporada: '2026-27', desde: d12, recursivo: [d12], base: tmp('base16'), sinAsistencia: true, estricto: true, log: () => {} }).catch(e => e);
  ok(r instanceof Error && /una incomparecencia es 20-0/.test(r.message), '8g. una incomparecencia que no es 20-0: duda');
  process.env.MACCABIS_SIN_HOJA = path.join(base15, ja.SIN_HOJA);
  const leidos = ja.leerSinHoja('2026-27', contexto('2026-27').grupos);
  ok(leidos.errores.length === 0 && leidos.entradas.length === 2 && leidos.entradas[1].pl === 20 && leidos.entradas[1].fecha === '2026-10-17', '8h. liga.js y db:liga leen el fichero (fecha en ISO)');
  delete process.env.MACCABIS_SIN_HOJA;

  delete process.env.MACCABIS_JORNADAS_AJENAS;
  delete process.env.MACCABIS_GRUPOS_FASE;
  console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo bien.');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
