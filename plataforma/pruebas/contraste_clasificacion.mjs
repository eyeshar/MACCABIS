#!/usr/bin/env node
// Contraste de la clasificación calculada con la oficial (D74, rutina B; src/lib/contrasteClasificacion.ts). Sin base de
// datos ni navegador.
//
//   npm run pruebas:clasificacion-oficial
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as C from '../src/lib/contrasteClasificacion.ts';

const PLAT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

const CALC = {
  G1: { jornadas: [1, 2, 3], clasificacion: [
    { equipo: 'MdA', pj: 3, g: 3, p: 0, pf: 192, pc: 69, pts: 6 },
    { equipo: 'Nabuco TD', pj: 3, g: 3, p: 0, pf: 181, pc: 96, pts: 6 },
    { equipo: 'Castañazo', pj: 2, g: 0, p: 2, pf: 50, pc: 90, pts: null },
    { equipo: 'Enfermos del Aro', pj: 3, g: 0, p: 3, pf: 40, pc: 150, pts: 3 },
  ] },
  G2: { jornadas: [1, 2, 3], clasificacion: [{ equipo: 'MdL', pj: 3, g: 3, p: 0, pf: 171, pc: 101, pts: 6 }] },
};

console.log('\n== Leer lo pegado');
{
  const { filas, errores } = C.leerOficial('grupo;equipo;puntos;J;G;P;TF;TC;Sanc\nG1;MACCABI DE ACOSTAR;6;3;3;0;192;71;0\n\nJDM MOR DOM MAÑ BC SEN MAS G2\tMACCABI DE LEVANTAR\t6\t3\t3\t0\t171\t101\t0\nG1;mal;6;3\n');
  ok(filas.length === 2 && filas[0].pc === 71 && filas[1].grupo === 'G2', 'punto y coma y tabuladores; la cabecera y las líneas vacías se ignoran; el grupo largo se queda en «G2»', JSON.stringify(filas));
  ok(errores.length === 1 && /Línea 5/.test(errores[0]), 'una línea incompleta es un error con su número', errores.join(' | '));
  ok(C.claveEquipo('MACCABI DE ACOSTAR') === 'mda' && C.claveEquipo('MdL') === 'mdl' && C.claveEquipo('CASTA�AZO') === C.claveEquipo('Castañazo') && C.claveEquipo('"F.T. FLOPPERS"') === C.claveEquipo('F.T. Floppers'), 'nombres: nuestros por el largo o el corto, tildes, ñ rota, comillas y puntos');
}

console.log('\n== Contrastar');
{
  const igual = 'G1;MACCABI DE ACOSTAR;6;3;3;0;192;69;0\nG1;NABUCO TD;6;3;3;0;181;96;0\nG1;CASTAÑAZO;2;2;0;2;50;90;0\nG1;ENFERMOS DEL ARO;3;3;0;3;40;150;0';
  const r = C.contrastar({ G1: { ...CALC.G1, clasificacion: CALC.G1.clasificacion.map((x) => (x.pts == null ? { ...x, pts: 2 } : x)) } }, igual);
  ok(r.coincide && r.diferencias.length === 0, 'todo igual: COINCIDE', JSON.stringify(r.diferencias));
  ok(/COINCIDE/.test(C.textoInforme(r)) && /G1 hasta la J3/.test(C.textoInforme(r)), 'el informe dice «COINCIDE» y hasta qué jornada', C.textoInforme(r));

  // Caso real del 31/10 (rutina B, J3): la oficial da a MdA 192-71; las hojas, 192-69. Sin la lista de conocidas, avisa.
  const pegadoReal = 'G1;MACCABI DE ACOSTAR;6;3;3;0;192;71;0\nG1;NABUCO TD;6;3;3;0;181;96;0\nG1;CASTAÑAZO;2;2;0;2;50;90;0\nG1;ENFERMOS DEL ARO;3;3;0;3;42;150;0\nG2;MACCABI DE LEVANTAR;6;3;3;0;171;101;0';
  const real = C.contrastar(CALC, pegadoReal, []);
  ok(!real.coincide, 'MdA 192-71 en la oficial y 192-69 en la calculada: DIFIERE (sin diferencias conocidas)');
  ok(real.diferencias.some((d) => d.equipo === 'MdA' && d.campo === 'TC' && d.calculada === '69' && d.oficial === '71'), 'la diferencia dice equipo, campo, calculada y oficial', JSON.stringify(real.diferencias));
  ok(real.diferencias.some((d) => d.equipo === 'Castañazo' && d.campo === 'puntos' && d.calculada === 'pendiente de la oficial'), 'una incomparecencia «pendiente de la oficial» sale como diferencia (hay que anotar sus puntos, D74)');
  const t = C.textoInforme(real);
  ok(/^Clasificación: DIFIERE de la oficial \(3 diferencias/.test(t) && t.includes('- G1 MdA: TC calculada 69 · oficial 71'), 'el informe: «DIFIERE (N diferencias…)» y una línea por diferencia', t);

  // D165: la J1 (16-62 publicado, 14-62 en acta y hoja) es conocida: con su desfase exacto (+2) no avisa.
  const sinCast = pegadoReal.replace('G1;CASTAÑAZO;2;2;0;2;50;90;0\n', '');
  const calcSinCast = { ...CALC, G1: { ...CALC.G1, clasificacion: CALC.G1.clasificacion.filter((x) => x.equipo !== 'Castañazo') } };
  const conocida = C.contrastar(calcSinCast, sinCast);
  ok(conocida.coincide && conocida.diferencias.length === 0 && conocida.conocidas.length === 2, 'D165: MdA TC +2 y Enfermos del Aro TF +2 son conocidas: COINCIDE', JSON.stringify(conocida));
  const tc = C.textoInforme(conocida);
  ok(/COINCIDE con la oficial \(salvo 2 diferencias conocidas, que no se avisan\)/.test(tc) && /Conocida: G1 MdA: TC calculada 69 · oficial 71 \(J1/.test(tc), 'el informe dice COINCIDE y lista las conocidas con su motivo (la rutina B no avisa)', tc);
  const otra = C.contrastar(calcSinCast, sinCast.replace(';192;71;0', ';192;73;0'));
  ok(!otra.coincide && otra.diferencias.some((d) => d.equipo === 'MdA' && d.oficial === '73') && /DIFIERE/.test(C.textoInforme(otra)), 'si la oficial se aparta en otra cantidad (73 en vez de 71), es una diferencia nueva: DIFIERE', JSON.stringify(otra.diferencias));
  const nueva = C.contrastar(calcSinCast, sinCast.replace('NABUCO TD;6;3;3;0;181;96;0', 'NABUCO TD;6;3;3;0;183;96;0'));
  ok(!nueva.coincide && nueva.conocidas.length === 2 && nueva.diferencias.length === 1, 'una diferencia nueva en otro equipo avisa aunque las conocidas sigan ahí');

  const falta = C.contrastar(CALC, 'G1;MACCABI DE ACOSTAR;6;3;3;0;192;69;0\nG1;EQUIPO NUEVO;0;0;0;0;0;0;0');
  ok(falta.sinPareja.some((s) => s.equipo === 'EQUIPO NUEVO' && s.falta === 'en la calculada') && falta.sinPareja.some((s) => s.equipo === 'Nabuco TD' && s.falta === 'en la oficial'), 'equipos que están en una y no en la otra');
  const sanc = C.contrastar(CALC, 'G2;MACCABI DE LEVANTAR;6;3;3;0;171;101;1');
  ok(sanc.coincide && sanc.sanciones.length === 1 && /Sanc 1 en G2 MACCABI DE LEVANTAR: Iván decide/.test(C.textoInforme(sanc)), 'Sanc > 0: va al informe aunque la clasificación coincida');
  ok(!C.contrastar(CALC, '').coincide && !C.contrastar(CALC, 'G3;X;1;1;1;0;1;0;0').coincide, 'nada pegado o un grupo que no existe: no «coincide»');
}

console.log('\n== Con la liga publicada (src/data/liga.json)');
{
  const liga = JSON.parse(fs.readFileSync(path.join(PLAT, 'src', 'data', 'liga.json'), 'utf8'));
  const calc = Object.fromEntries(Object.entries(liga.grupos).map(([g, x]) => [g, { jornadas: x.jornadas_cargadas, clasificacion: x.clasificacion }]));
  const pegado = Object.entries(calc).flatMap(([g, x]) => x.clasificacion.map((f) => `${g};${f.equipo === 'MdA' ? 'MACCABI DE ACOSTAR' : f.equipo === 'MdL' ? 'MACCABI DE LEVANTAR' : f.equipo.toUpperCase()};${f.pts ?? 0};${f.pj};${f.g};${f.p};${f.pf};${f.pc};0`)).join('\n');
  const r = C.contrastar(calc, pegado);
  ok(r.sinPareja.length === 0 && r.errores.length === 0, 'la oficial escrita en mayúsculas casa todos los equipos de la calculada publicada', JSON.stringify(r.sinPareja));
}

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
