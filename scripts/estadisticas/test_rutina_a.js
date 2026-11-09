/**
 * test_rutina_a.js — las dos mejoras de la rutina A del 09/11/2026 (BACKLOG), con datos sintéticos (sin calendario real, D185):
 *   1. aviso si falta NUESTRA hoja un lunes con «Nada nuevo» (hoja_nuestra.js y rutina_a_publicar.ps1);
 *   2. aplazado ≠ hoja que falta (liga.jornadasDelGrupo y liga.aplazadoDe).
 * Los casos copian la J4 (08/11/2026): MdA descansa, MdL juega contra Trascendedores y RIF–Chupitimanguis está aplazado.
 *
 *   npm run test:rutina-a
 */
const fs = require('fs');
const path = require('path');
const { faltanNuestras, textoAviso } = require('./hoja_nuestra');
const liga = require('./liga');

let ok = 0, fallos = 0;
const comprueba = (cond, que, detalle = '') => {
  if (cond) { ok++; console.log(`  OK    ${que}`); }
  else { fallos++; console.log(`  FALLO ${que}${detalle ? ' -> ' + detalle : ''}`); }
};
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ------------------------------------------------------------------ 1. aviso de la hoja nuestra
console.log('== Aviso si falta nuestra hoja (lunes con «Nada nuevo»)');
const NOMBRES = { MDA: ['MDA', 'MdA'], MDL: ['MDL', 'MdL'] };
const calJ4 = [
  { equipo: 'MDA', fase: 'liga', jornada: 3, fecha: '2026-10-25', descansa: false, estado: null },
  { equipo: 'MDL', fase: 'liga', jornada: 3, fecha: '2026-10-25', descansa: false, estado: null },
  { equipo: 'MDA', fase: 'liga', jornada: 4, fecha: '2026-11-08', descansa: true, estado: null },
  { equipo: 'MDL', fase: 'liga', jornada: 4, fecha: '2026-11-08', descansa: false, estado: null },
];
const fila = [{ display: 'X', pts: 10 }];
const conHojas = { partidos: [], box: { '3_MDA': fila, '3_MDL': fila, '4_MDL': fila } };
const sinHojaMdL = { partidos: [], box: { '3_MDA': fila, '3_MDL': fila } };
const LUNES = '2026-11-09';

comprueba(igual(faltanNuestras({ calendario: calJ4, season: conHojas, hoy: LUNES, nombres: NOMBRES }), []),
  'J4 con la hoja de MdL y MdA descansando: sin aviso');
const f = faltanNuestras({ calendario: calJ4, season: sinHojaMdL, hoy: LUNES, nombres: NOMBRES });
comprueba(f.length === 1 && f[0].equipo === 'MdL' && f[0].jornada === 4, 'J4 sin la hoja de MdL: avisa de MdL J4 (y no de MdA, que descansa)', JSON.stringify(f));
comprueba(f[0] && f[0].texto === 'Iván, no hay hoja de MdL de la J4: revisa la tarea "hojas del lunes" o bájala del S21',
  'el texto es el pedido', f[0] && f[0].texto);
comprueba(igual(faltanNuestras({ calendario: calJ4, season: { partidos: [], box: {} }, hoy: LUNES, nombres: NOMBRES }).map(x => x.equipo), ['MdL']),
  'MdA descansa: nunca avisa de MdA, aunque no tenga hoja de la J4');
const calAplazado = calJ4.map(c => (c.equipo === 'MDL' && c.jornada === 4 ? { ...c, fecha: '2026-12-20' } : c));
comprueba(igual(faltanNuestras({ calendario: calAplazado, season: sinHojaMdL, hoy: LUNES, nombres: NOMBRES }), []),
  'partido de MdL aplazado a otra fecha en el calendario: sin aviso');
const calEstado = calJ4.map(c => (c.equipo === 'MDL' && c.jornada === 4 ? { ...c, estado: 'aplazado' } : c));
comprueba(igual(faltanNuestras({ calendario: calEstado, season: sinHojaMdL, hoy: LUNES, nombres: NOMBRES }), []),
  'partido de MdL con estado «aplazado» en el calendario: sin aviso');
comprueba(igual(faltanNuestras({ calendario: calJ4, season: sinHojaMdL, hoy: '2026-11-12', nombres: NOMBRES }), []),
  'un jueves no avisa (solo los lunes)');
comprueba(igual(faltanNuestras({ calendario: calJ4, season: sinHojaMdL, hoy: '2026-11-16', nombres: NOMBRES }), []),
  'el lunes siguiente no avisa de la J4 (no se jugó ese fin de semana)');
const calSabado = calJ4.map(c => (c.equipo === 'MDL' && c.jornada === 4 ? { ...c, fecha: '2026-11-07' } : c));
comprueba(igual(faltanNuestras({ calendario: calSabado, season: sinHojaMdL, hoy: LUNES, nombres: NOMBRES }).map(x => x.equipo), ['MdL']),
  'un partido del sábado también cuenta');
comprueba(textoAviso('MdA', 7) === 'Iván, no hay hoja de MdA de la J7: revisa la tarea "hojas del lunes" o bájala del S21', 'textoAviso con MdA');

// La rutina usa ese resumen: con «Nada nuevo» y faltan_nuestras, avisa por la notificación de siempre.
const ps1 = fs.readFileSync(path.join(__dirname, '..', 'rutina_a_publicar.ps1'), 'utf8');
const bloqueNada = (ps1.match(/if \(\$res\.estado -eq 'nada'\) \{[\s\S]*?exit 0\s*\}/) || [''])[0];
comprueba(/faltan_nuestras/.test(bloqueNada) && /Avisar /.test(bloqueNada), 'rutina_a_publicar.ps1: con «Nada nuevo» y faltan_nuestras llama a Avisar');
comprueba(ps1.charCodeAt(0) === 0xfeff, 'rutina_a_publicar.ps1 sigue con BOM (PowerShell 5.1 lee así los acentos)');

// ------------------------------------------------------------------ 2. aplazado ≠ hoja que falta
console.log('== Aplazado no es hoja que falta (G1 J4: MdA descansa, RIF–Chupitimanguis aplazado)');
const slug = n => n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');
const NOMBRES_G1 = ['MdA', 'Wild Boys', 'Enfermos del Aro', 'Vallekas Basket', 'Litros de Mahou', 'Tropicaleros', 'Chavalitros', 'Nabuco TD', 'Los Khinkis Rusos', 'RIF', 'Chupitimanguis'];
const equipos = NOMBRES_G1.map(n => ({ id: slug(n), nombre: n }));
const E = n => equipos.find(e => e.nombre === n);
const juego = (j, l, v) => ({ jornada: j, local: E(l), visitante: E(v) });
const juegosJ4 = [juego(4, 'Wild Boys', 'Enfermos del Aro'), juego(4, 'Vallekas Basket', 'Litros de Mahou'), juego(4, 'Tropicaleros', 'Chavalitros'), juego(4, 'Nabuco TD', 'Los Khinkis Rusos')];
const RIF = { grupo: 'G1', jornada: 4, local: 'RIF', visitante: 'Chupitimanguis', fecha: '2027-08-01' };

let r = liga.jornadasDelGrupo({ clave: 'G1', equipos, juegos: juegosJ4, aplazados: [RIF], hoy: LUNES });
comprueba(igual(r.descansan, { 4: ['MdA'] }), 'descansa solo MdA (RIF y Chupitimanguis no «descansan»)', JSON.stringify(r.descansan));
comprueba(!r.avisos.some(a => /faltan hojas/.test(a)), 'no dice «faltan hojas»', r.avisos.join(' / '));
comprueba(r.aplazados[4] && r.aplazados[4].length === 1 && r.aplazados[4][0].local === 'RIF' && r.aplazados[4][0].visitante_id === 'chupitimanguis',
  'la J4 lleva el aplazado RIF – Chupitimanguis', JSON.stringify(r.aplazados));
comprueba(r.textos.length === 1 && /RIF - Chupitimanguis, aplazado/.test(r.textos[0]), 'el resumen lo dice «aplazado»', r.textos.join(' / '));

r = liga.jornadasDelGrupo({ clave: 'G1', equipos, juegos: juegosJ4, aplazados: [{ ...RIF, fecha: null }], hoy: LUNES });
comprueba(!r.avisos.some(a => /faltan hojas/.test(a)) && r.aplazados[4] && /sin fecha/.test(r.textos[0]), '«No comenzado» sin fecha: aplazado, sin «faltan hojas»');

r = liga.jornadasDelGrupo({ clave: 'G1', equipos, juegos: juegosJ4, aplazados: [], hoy: LUNES });
comprueba(r.avisos.some(a => /G1 J4: faltan hojas \(juegan 8 de 10/.test(a)) && igual(r.descansan[4], ['MdA', 'RIF', 'Chupitimanguis']),
  'sin anotarlo como aplazado sigue siendo «faltan hojas» (como antes)', r.avisos.join(' / '));

r = liga.jornadasDelGrupo({ clave: 'G1', equipos, juegos: juegosJ4, aplazados: [RIF], hoy: '2027-08-02' });
comprueba(r.avisos.some(a => /faltan hojas/.test(a)) && !r.aplazados[4] && !r.textos.length,
  'con la fecha ya pasada y sin hoja: vuelve a faltar su hoja (jugado sin hoja)', r.avisos.join(' / '));

r = liga.jornadasDelGrupo({ clave: 'G1', equipos, juegos: [...juegosJ4, juego(4, 'RIF', 'Chupitimanguis')], aplazados: [RIF], hoy: LUNES });
comprueba(!r.aplazados[4] && igual(r.descansan[4], ['MdA']) && r.avisos.some(a => /ya tiene hoja/.test(a)) && !r.avisos.some(a => /faltan hojas/.test(a)),
  'cuando llega su hoja deja de ser aplazado (y se avisa para quitarlo de liga.aplazados)', r.avisos.join(' / '));

r = liga.jornadasDelGrupo({ clave: 'G1', equipos, juegos: juegosJ4, aplazados: [{ ...RIF, visitante: 'Mafia del Alcohol' }], hoy: LUNES });
comprueba(r.errores.some(e => /no son equipos del G1/.test(e)), 'un aplazado con un equipo de otro grupo es un error');

const g1 = { clave: 'G1' };
const cfg = { liga: { aplazados: [RIF] } };
comprueba(liga.aplazadoDe(cfg, g1, 'Chupitimanguis', 'RIF') && liga.aplazadoDe(cfg, g1, 'RIF', 'CHUPITIMANGUIS').jornada === 4,
  'la hoja del aplazado, cuando llegue, va a la J4 (en cualquier orden)');
comprueba(liga.aplazadoDe(cfg, { clave: 'G2' }, 'RIF', 'Chupitimanguis') === null && liga.aplazadoDe(cfg, g1, 'RIF', 'Wild Boys') === null,
  'otro grupo u otro cruce no es el aplazado');

console.log(`\n${ok} OK, ${fallos} FALLO(S)`);
process.exit(fallos ? 1 : 0);
