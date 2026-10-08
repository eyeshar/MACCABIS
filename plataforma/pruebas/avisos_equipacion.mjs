#!/usr/bin/env node
// Avisos de choque de equipacion (D79): el calculo (data/avisos_equipacion.js) con los datos reales del repo.
// Sin base de datos ni navegador.
//
//   npm run pruebas:equipacion
//
// Falla si algun equipo del calendario no tiene color, si las copias de plataforma/src/data/ estan desfasadas
// o si los casos de control cambian. Al final lista todos los partidos de la temporada con aviso.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { desfasadas } from '../scripts/sincronizar_equipacion.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const A = require(path.join(RAIZ, 'data', 'avisos_equipacion.js'));
const leer = (f) => JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', f), 'utf8'));
const equip = leer('equipaciones_2026-27.json');
const cal = leer('calendario_2026-27.json');

let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };
const partido = (eq, j) => cal.partidos.find((p) => p.equipo === eq && p.jornada === j);

console.log('\n== Datos');
const COLORES = ['negro', 'azul oscuro', 'azul', 'blanco', 'rojo', 'rosa', 'naranja', 'amarillo'];
const lista = Object.values(equip.equipos);
ok(lista.length === 22, '22 equipos (20 rivales + MdA + MdL)', String(lista.length));
ok(lista.every((e) => e.camiseta_original && e.pantalon_original), 'todos con el texto original de camiseta y pantalon');
{
  const MASC = /camiseta (negro|blanco|amarillo|rojo)\b/, FEM = /pantalón (negra|blanca|amarilla|roja)\b/;
  const textos = Object.values(equip.equipos).map((e) => A.descripcionColores(e.camiseta, e.pantalon));
  ok(textos.every((t) => !MASC.test(t) && !FEM.test(t)), `ningún equipo sale con «camiseta negro/blanco/amarillo/rojo» ni «pantalón negra/…» (${textos.length} equipos)`, textos.find((t) => MASC.test(t) || FEM.test(t)));
  ok(['negro', 'blanco', 'amarillo', 'rojo'].every((c) => !MASC.test(A.descripcionColores(c, c)) && !FEM.test(A.descripcionColores(c, c))), 'los cuatro colores con género: negra, blanca, amarilla, roja (camiseta) y negro, blanco, amarillo, rojo (pantalón)');
  const todosAvisos = A.listarAvisos(equip, cal).map((x) => x.texto).join(' ');
  ok(!MASC.test(todosAvisos) && !/\((negro|blanco|amarillo|rojo)\)/.test(todosAvisos), 'los avisos de choque tampoco dicen «camiseta negro» ni «(negro)» suelto');
}
ok(A.descripcionColores('rojo', 'rojo') === 'camiseta roja, pantalón rojo' && A.descripcionColores('negro', 'negro') === 'camiseta negra, pantalón negro' && A.descripcionColores('azul oscuro', 'blanco') === 'camiseta azul oscuro, pantalón blanco' && A.descripcionColores('amarillo', 'rosa') === 'camiseta amarilla, pantalón rosa', 'el texto del color concuerda con la prenda: «camiseta roja, pantalón rojo»');
ok(lista.every((e) => COLORES.includes(e.camiseta) && COLORES.includes(e.pantalon)), 'colores normalizados: minusculas, sin genero, de la lista');
ok(lista.every((e) => A.colorNormalizado(e.camiseta_original) === e.camiseta && A.colorNormalizado(e.pantalon_original) === e.pantalon), 'el color normalizado sale del texto original (negra->negro, amarilla->amarillo...)');
ok(!!equip.fuente && /^\d{4}-\d{2}-\d{2}$/.test(equip.fecha), 'fuente y fecha del dato');
ok(equip.regla_choque.nuestra_segunda === 'amarilla' && JSON.stringify(equip.regla_choque.camiseta_rival_choca) === '["negro","azul oscuro","azul"]', 'regla: choque con negro / azul oscuro / azul; nuestra 2.ª amarilla');
const qc = equip.regla_choque.quien_cambia;
ok(qc && qc.cambia === 'segundo_en_calendario' && /5\.11/.test(qc.articulo) && /figure en segundo lugar/.test(qc.cita) && /BasesReguladoras47JDM/.test(qc.fuente), 'regla de quien cambia: segundo en el calendario (Bases 47 JDM, 5.11), con cita y fuente');
ok(equip.equipos['28500'] && equip.equipos['28500'].camiseta === 'negro', '28500 incluido aunque aun no tenga hoja');

console.log('\n== Mapeo de nombres del calendario');
const sin = A.rivalesSinColor(equip, cal);
ok(sin.length === 0, 'TODOS los rivales del calendario tienen color', sin.join(', '));
const rivalesCal = [...new Set(cal.partidos.filter((p) => p.rival).map((p) => p.rival))];
ok(rivalesCal.length === 20, '20 rivales distintos en el calendario', String(rivalesCal.length));
ok(new Set(rivalesCal.map((r) => A.equipoPorNombre(equip, r)?.nombre)).size === 20, 'cada nombre del calendario cae en un equipo distinto');
for (const [txt, esperado] of [['"TROPICALEROS"', 'Tropicaleros'], ['MEJORADA 2012 C.B..', 'Mejorada 2012 C.B.'], ['CASTAÑAZO', 'Castañazo'], ['CASTA�AZO', 'Castañazo'], ['  los khinkis  rusos ', 'Los Khinkis Rusos'], ['F.T. FLOPPERS', 'F.T. Floppers']]) {
  const e = A.equipoPorNombre(equip, txt);
  ok(e && e.nombre === esperado, `«${txt}» -> ${esperado}`, e ? e.nombre : 'null');
}
ok(A.equipoPorNombre(equip, 'Equipo Inventado') === null, 'un equipo desconocido da null (la pantalla no inventa color)');
const desc = A.avisoPartido(equip, { equipo: 'MDA', rival: 'Equipo Inventado', descansa: false });
ok(desc && !desc.conocido && !desc.hay, 'rival sin color: aviso "no conocido", sin alarma falsa');

console.log('\n== Casos de control');
const a = (eq, j) => A.avisoPartido(equip, partido(eq, j));
ok(a('MDA', 2).hay && a('MDA', 2).tipo === 'cambian_ellos' && a('MDA', 2).colorRival === 'negro', 'J2 18/10 MdA–Litros de Mahou: CAMBIAN ELLOS (somos locales)');
ok(a('MDA', 2).etiqueta === 'ℹ Coinciden colores: cambia Litros de Mahou' && a('MDA', 2).texto === 'Jugamos de negro; Litros de Mahou (camiseta negra) va en segundo lugar y debe cambiar. Llevad la amarilla por si acaso.', 'J2: etiqueta y texto de "cambian ellos"', a('MDA', 2).texto);
ok(a('MDL', 1).tipo === 'cambian_ellos' && a('MDL', 1).colorRival === 'azul oscuro', 'J1 04/10 MdL–Mejorada: CAMBIAN ELLOS (local, azul oscuro)');
ok(a('MDL', 6).tipo === 'nos_toca' && a('MDL', 6).colorRival === 'negro' && partido('MDL', 6).local === false, 'J6 MdL en 28500 (negro): NOS TOCA (visitantes, vamos en segundo lugar)');
ok(a('MDL', 6).etiqueta === '⚠ Nos toca cambiar: equipación AMARILLA' && a('MDL', 6).texto === 'Vamos en segundo lugar contra 28500 (camiseta negra). Obligatorio: si no cambiamos, partido perdido (Bases 47 JDM, 5.11).', 'J6: etiqueta y texto de "nos toca cambiar"', a('MDL', 6).texto);
ok(a('MDA', 10).tipo === 'nos_toca' && a('MDA', 16).tipo === 'nos_toca' && a('MDA', 16).colorRival === 'azul', 'MdA en Chavalitros (negro) y en Nabuco TD (azul): NOS TOCA');
ok(!a('MDL', 2).hay && a('MDL', 2).colorRival === 'naranja', 'J2 18/10 MdL–Quinto Tiempo: SIN aviso (naranja)');
ok(!a('MDA', 3).hay && !a('MDL', 3).hay, 'J3: sin avisos (Khinkis rojo, Suanzes naranja)');
ok(a('MDA', 5).hay && a('MDA', 5).colorRival === 'azul', 'J5 MdA–Nabuco TD: aviso (el azul cuenta, decision de Ivan)');
ok(a('MDL', 1).hay && a('MDL', 1).colorRival === 'azul oscuro', 'J1 MdL–Mejorada: aviso (azul oscuro)');
ok(!a('MDA', 1).hay && !a('MDA', 6).hay && !a('MDA', 7).hay, 'rival blanco / naranja / amarillo: sin aviso');
ok(A.avisoPartido(equip, partido('MDA', 4)) === null, 'jornada de descanso: sin aviso ni rival');
ok(A.lineaConvocatoria(equip, partido('MDL', 6)) === 'Llevad la equipación AMARILLA (nos toca cambiar).', 'convocatoria, nos toca: "Llevad la equipación AMARILLA (nos toca cambiar)."');
ok(A.lineaConvocatoria(equip, partido('MDA', 2)) === 'Jugamos de negro; cambia Litros de Mahou. Llevad la amarilla por si acaso.', 'convocatoria, cambian ellos: "Jugamos de negro; cambia Litros de Mahou. Llevad la amarilla por si acaso."');
ok(A.lineaConvocatoria(equip, partido('MDL', 2)) === null, 'convocatoria: sin linea cuando no hay choque');

console.log('\n== Orden del calendario (Bases 5.11) y sin regla');
const mismo = { equipo: 'MDA', rival: 'Litros de Mahou' };
ok(A.avisoPartido(equip, { ...mismo, local: false }).tipo === 'nos_toca' && A.avisoPartido(equip, { ...mismo, local: true }).tipo === 'cambian_ellos', 'si el orden local/visitante cambia, el aviso cambia solo (rutina B)');
ok(A.avisoPartido(equip, { ...mismo, local: null }).tipo === 'dudoso', 'sin saber quien es local: aviso prudente "llevad la amarilla por si acaso"');
const sinRegla = { ...equip, regla_choque: { ...equip.regla_choque, quien_cambia: null } };
ok(A.avisoPartido(sinRegla, { ...mismo, local: false }).texto === 'Coincidencia de color con Litros de Mahou (camiseta negra): llevad la amarilla por si acaso', 'sin regla en el fichero: vuelve al aviso prudente');

console.log('\n== Proximo partido');
const prox = (h, e) => A.proximoPartido(cal, h, e);
ok(prox('2026-10-06', 'MDA').jornada === 2 && prox('2026-10-06', 'MDL').jornada === 2, 'el 06/10 el proximo de MdA y MdL es la J2');
ok(prox('2026-10-18', 'MDA').jornada === 2, 'el dia del partido todavia cuenta como proximo');
ok(prox('2026-11-01', 'MDA').jornada === 5, 'salta la jornada de descanso (J4 de MdA)');
ok(prox('2027-06-01', 'MDA') === null, 'acabada la liga: null');

console.log('\n== Copias de la plataforma');
const d = desfasadas();
ok(d.length === 0, 'plataforma/src/data/ coincide con data/ (npm run equipacion:sync)', d.join(', '));

console.log('\n== Partidos de la temporada con aviso');
const av = A.listarAvisos(equip, cal);
const dd = (f) => f.split('-').reverse().join('/');
for (const [tipo, titulo] of [['nos_toca', 'NOS TOCA CAMBIAR'], ['cambian_ellos', 'CAMBIAN ELLOS']]) {
  console.log(`  ${titulo}`);
  for (const x of av.filter((y) => y.tipo === tipo)) {
    const n = x.equipo === 'MDA' ? 'MdA' : 'MdL';
    console.log(`   ${dd(x.fecha)}  J${String(x.jornada).padStart(2)}  ${n} ${cal.partidos.find((p) => p.equipo === x.equipo && p.jornada === x.jornada).local ? 'vs' : 'en'} ${x.rival} (${x.color})`);
  }
}
ok(av.length === 18 && av.filter((x) => x.tipo === 'nos_toca').length === 9 && av.filter((x) => x.tipo === 'cambian_ellos').length === 9, '18 avisos en la temporada: 9 nos toca cambiar + 9 cambian ellos', String(av.length));

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
