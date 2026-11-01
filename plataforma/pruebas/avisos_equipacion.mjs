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
const FIN = ' Llevad la amarilla por si acaso.';
const lc = (p) => A.lineaConvocatoria(equip, p);
ok(lc(partido('MDL', 6)) === 'Coinciden colores: cambiamos nosotros, de amarillo.' + FIN, 'convocatoria (D160), nos toca: «Coinciden colores: cambiamos nosotros, de amarillo. Llevad la amarilla por si acaso.»', lc(partido('MDL', 6)));
ok(lc(partido('MDA', 2)) === 'Coinciden colores: cambia Litros de Mahou.' + FIN, 'convocatoria, cambian ellos: «Coinciden colores: cambia Litros de Mahou. Llevad…»', lc(partido('MDA', 2)));
ok(lc(partido('MDL', 1)) === 'Coinciden colores: cambia Mejorada 2012 C.B.' + FIN, 'un nombre que acaba en punto no sale con «..»', lc(partido('MDL', 1)));
ok(lc(partido('MDL', 2)) === 'Jugamos de negro (ellos de naranja).' + FIN, 'convocatoria SIN choque: también hay línea, «Jugamos de negro (ellos de naranja). Llevad…»', lc(partido('MDL', 2)));
ok(lc({ ...partido('MDA', 2), local: null }) === 'Coinciden colores con Litros de Mahou: no consta quién va en segundo lugar.' + FIN, 'choque sin saber quién es local: lo dice y no inventa quién cambia');
ok(lc({ equipo: 'MDA', rival: 'Equipo Inventado', descansa: false }) === 'Jugamos de negro (no tenemos el color de Equipo Inventado).' + FIN, 'rival sin color: «Jugamos de negro (no tenemos el color de …)»');
ok(lc(partido('MDA', 4)) === null, 'jornada de descanso: sin línea');
ok(cal.partidos.filter((p) => !p.descansa && p.rival).every((p) => lc(p)?.endsWith(FIN) && A.avisoPartido(equip, p).convocatoria === lc(p)), 'TODOS los partidos con rival tienen línea, acaba en «Llevad la amarilla por si acaso.» y es la misma en avisoPartido().convocatoria');

console.log('\n== Colores parecidos (D160)');
ok(A.parecidos('negro', 'negro') && A.parecidos('negra', 'negro'), 'un color se parece a sí mismo (con o sin género)');
for (const [x, y] of [['negro', 'azul oscuro'], ['negro', 'azul'], ['azul oscuro', 'azul'], ['rojo', 'naranja'], ['rojo', 'rosa'], ['naranja', 'amarillo']]) ok(A.parecidos(x, y) && A.parecidos(y, x), `${x} ~ ${y} (y al revés)`);
for (const [x, y] of [['negro', 'blanco'], ['negro', 'rojo'], ['negro', 'amarillo'], ['negro', 'naranja'], ['negro', 'rosa'], ['blanco', 'amarillo'], ['azul', 'rojo'], ['amarillo', 'rosa']]) ok(!A.parecidos(x, y), `${x} y ${y} NO se parecen`);
ok(!A.parecidos('', 'negro') && !A.parecidos(null, 'negro'), 'sin color: no se parece a nada');
ok(Object.keys(equip.paleta).filter((c) => A.chocan(equip, c)).join(',') === equip.regla_choque.camiseta_rival_choca.join(','), 'la lista camiseta_rival_choca del fichero es exactamente la que sale de la tabla de parecidos con nuestra 1.ª (negro)');
ok(A.COLORES_PARECIDOS.flat().every((c) => c in equip.paleta), 'todos los colores de la tabla existen en la paleta');

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

console.log('\n== Una sola fuente del calendario (D151)');
{
  // El calendario de los avisos es la tabla de eventos: equipacion.ts no importa ningun calendario; lo recibe.
  const eqTs = fs.readFileSync(path.join(RAIZ, 'plataforma', 'src', 'lib', 'equipacion.ts'), 'utf8');
  ok(!eqTs.split('\n').some((l) => /^import /.test(l) && /calendario/.test(l)), 'equipacion.ts no importa el calendario del repo');
  // El JSON del repo es copia generada: la tabla (filas como las de las vistas publicas) da exactamente el mismo fichero.
  const { calendarioDesdeTabla, diferencias } = await import('../scripts/exportar_calendario.mjs');
  const C = { MDA: 'MdA', MDL: 'MdL' };
  const filas = cal.partidos.filter((p) => !p.descansa).map((p) => ({ tipo: 'liga', equipo: C[p.equipo], jornada: p.jornada, rival: p.rival, es_local: p.local, fecha: p.fecha, inicio: p.hora ? `${p.hora}:00` : null, numero_pista: p.campo ? Number(p.campo) : null, estado: 'programado' }));
  const descansos = cal.partidos.filter((p) => p.descansa).map((p) => ({ equipo: C[p.equipo], jornada: p.jornada, fecha: p.fecha }));
  const gen = calendarioDesdeTabla(filas, descansos);
  ok(JSON.stringify(gen) === JSON.stringify(cal), 'data/calendario_2026-27.json = lo que genera calendario:exportar desde la tabla (copia generada, no editada a mano)', diferencias(cal, gen).join('; ') || 'cabecera distinta');
  // Un cambio de local/visitante en la tabla cambia el aviso sin tocar ningun fichero a mano (la rutina B ya no edita el JSON).
  const vuelta = calendarioDesdeTabla(filas.map((f) => (f.equipo === 'MdL' && f.jornada === 6 ? { ...f, es_local: true } : f)), descansos);
  ok(A.avisoPartido(equip, partido('MDL', 6)).tipo === 'nos_toca' && A.avisoPartido(equip, vuelta.partidos.find((p) => p.equipo === 'MDL' && p.jornada === 6)).tipo === 'cambian_ellos', 'MdL J6 pasa de «nos toca cambiar» a «cambian ellos» si la tabla lo pone en casa');
  ok(calendarioDesdeTabla(filas.map((f) => (f.equipo === 'MdA' && f.jornada === 1 ? { ...f, estado: 'cancelado' } : f)), descansos).partidos.length === 43, 'un partido cancelado en la tabla no sale en la copia (como en la web)');
}

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
