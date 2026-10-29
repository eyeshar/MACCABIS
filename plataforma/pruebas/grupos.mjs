#!/usr/bin/env node
// Grupos de entreno (D122, D143, D144, D147).
//   - la sugerencia (pura, D147: la estructura manda sobre el nivel). Caso ANONIMO (J1…J17) con la forma del entreno
//     del 28/10: 17 de 6 en 6 → 6, 6, 5, cada grupo con 1 base, 2 exteriores y 2 interiores, el cuarto base de reserva de
//     exterior, los interiores sobrantes de sexto, nivel medio parejo y A 2/1/1; «Otra sugerencia» igual de buena;
//     determinista; numero de grupos (17 de 5 o de 6 → 6, 6, 5; 12 de 5 → 6, 6; nunca por debajo del quinteto si se
//     puede); cuando no se puede (sin bases, 1 interior, 3 exteriores, sin posicion, grupos de 4 y de 7) con sus
//     avisos; el criterio opcional de juntar a los del siguiente partido (margen de 0,2) y sin convocatoria, lo mismo;
//   - de extremo a extremo: sugerir, resumen con la estructura, «hace de …» y avisos que se recalculan al mover, el dato
//     «N de M juegan juntos» con una convocatoria aprobada, aviso de «sin nivel», mover con la
//     seleccion («Mover N a…»), renombrar, guardar, varios repartos, duplicar, borrar y publicar; el jugador ve SOLO su
//     grupo y sus compañeros (inicio y agenda) y nunca niveles; un jugador no lee los repartos (RLS);
//   - «Vista para el equipo»: solo titulo, grupos y nombres; ningun dato privado en la pagina (ni oculto con CSS); se
//     desactiva con el mismo interruptor, al recargar vuelve la vista normal y a 375 px no desborda.
//
//   npm run pruebas:grupos
import { preparar, personas, sinteticos, contador, visto, sinDesbordar, foto } from './comun_e2e.mjs';
import { sugerirGrupos, mensajeGrupos, resumenGrupo, tamanos, estructuraGrupo, avisosEstructura, etiquetaPapel, parejasJuntas } from '../src/lib/grupos/sugerir.ts';
import { trasAccion, hasta } from './infra/esperas.mjs';

const { ok, fallos, sumar } = contador();
const J = (id, posicion, nivel = 'C', base_reserva = false) => ({ person_id: id, nombre: id.toUpperCase(), posicion, nivel, base_reserva });
const VALOR = { A: 5, B: 4, C: 3, D: 2, E: 1 };
const valor = (j) => (j.nivel ? VALOR[j.nivel] : 3);
const ordenadas = (xs) => [...xs].sort((a, b) => b - a).join('/');
const reloj = () => { const t = Date.now(); return () => `${Date.now() - t} ms`; };
/** Cifras de un reparto: tamaños, papeles (base, ext, int) y faltas por grupo, A, nivel medio, juntos y avisos. */
function cifras(grupos, lista, juntos = null) {
  const por = new Map(lista.map((j) => [j.person_id, j]));
  const gs = grupos.map((g) => g.personas.map((p) => por.get(p)));
  const es = gs.map(estructuraGrupo);
  const media = gs.map((g) => g.reduce((s, j) => s + valor(j), 0) / g.length);
  return {
    tam: gs.map((g) => g.length), bases: es.map((e) => e.cuenta.base), ext: es.map((e) => e.cuenta.exterior), int: es.map((e) => e.cuenta.interior),
    faltas: es.map((e) => e.faltas), sinFaltas: es.every((e) => !e.faltas.length), extras: es.map((e) => e.extras),
    papel: new Map(es.flatMap((e) => [...e.papel])),
    A: gs.map((g) => g.filter((j) => j.nivel === 'A').length), media, rango: Math.max(...media) - Math.min(...media),
    juntos: juntos ? gs.reduce((s, g) => s + parejasJuntas(g.map((j) => j.person_id), juntos), 0) : 0,
    avisos: avisosEstructura(grupos.map((g, i) => ({ nombre: g.nombre, js: gs[i] }))),
    todos: new Set(gs.flat().map((j) => j.person_id)).size === lista.length && gs.flat().length === lista.length,
  };
}
const quinteto = (c) => c.bases.every((b) => b === 1) && c.ext.every((x) => x >= 2) && c.int.every((x) => x >= 2) && c.sinFaltas;

console.log('\n== La sugerencia (sin pantalla): caso anónimo con la forma del 28/10');
// 0 bases puros, 4 bases de reserva (una A), 5 exteriores, 8 interiores; 4 A, 3 B, 8 C, 1 D, 1 E; grupos de 6.
const caso = [
  J('j01', 'escolta', 'A', true), J('j02', 'escolta', 'B', true), J('j03', 'alero', 'B', true), J('j04', 'escolta', 'C', true),
  J('j05', 'ala_pivot', 'A'), J('j06', 'pivot', 'B'), J('j07', 'pivot', 'C'), J('j08', 'pivot', 'C'), J('j09', 'ala_pivot', 'C'), J('j10', 'ala_pivot', 'C'), J('j11', 'pivot', 'C'), J('j12', 'ala_pivot', 'E'),
  J('j13', 'alero', 'A'), J('j14', 'escolta', 'A'), J('j15', 'escolta', 'C'), J('j16', 'alero', 'C'), J('j17', 'alero', 'D'),
];
const n = (f) => caso.filter(f).length;
ok(caso.length === 17 && n((j) => j.posicion === 'base') === 0 && n((j) => j.base_reserva) === 4 && n((j) => !j.base_reserva && ['escolta', 'alero'].includes(j.posicion)) === 5 && n((j) => ['pivot', 'ala_pivot'].includes(j.posicion)) === 8
  && ['A', 'B', 'C', 'D', 'E'].map((x) => n((j) => j.nivel === x)).join() === '4,3,8,1,1' && caso.some((j) => j.base_reserva && j.nivel === 'A'), 'el caso tiene la forma pedida (0 bases puros, 4 de reserva —una A—, 5 exteriores, 8 interiores; 4 A, 3 B, 8 C, 1 D, 1 E)');
let t = reloj();
const s0 = sugerirGrupos({ van: caso, tamano: 6 });
const tCaso = t();
let c = cifras(s0.grupos, caso);
ok(ordenadas(c.tam) === '6/6/5' && c.todos, `17 de 6 en 6: grupos de 6, 6 y 5, todos colocados una sola vez (${tCaso})`, JSON.stringify(c.tam));
ok(quinteto(c), 'cada grupo con 1 base, al menos 2 exteriores y al menos 2 interiores, sin avisos', JSON.stringify({ b: c.bases, e: c.ext, i: c.int, f: c.faltas }));
const reservas = caso.filter((j) => j.base_reserva);
ok(reservas.filter((j) => c.papel.get(j.person_id) === 'base').length === 3 && reservas.filter((j) => c.papel.get(j.person_id) === 'exterior').length === 1, 'tres bases de reserva hacen de base y el cuarto juega de exterior');
const de6 = c.tam.map((x, i) => (x === 6 ? i : -1)).filter((i) => i >= 0), de5 = c.tam.indexOf(5);
ok(de6.every((i) => c.int[i] === 3 && c.ext[i] === 2 && c.extras[i].interior === 1) && c.int[de5] === 2 && c.ext[de5] === 2, 'los dos interiores sobrantes van de sexto a los dos grupos de 6 (1 base · 2 ext · 3 int; el de 5, quinteto justo)', JSON.stringify({ e: c.ext, i: c.int }));
ok(c.rango <= 0.5, `diferencia de nivel medio entre grupos ≤ 0,5 (${c.rango.toFixed(2)})`);
ok(ordenadas(c.A) === '2/1/1', 'jugadores A 2/1/1', JSON.stringify(c.A));
ok(!c.avisos.length, 'ningún aviso de estructura', c.avisos.join(' | '));
ok(JSON.stringify(sugerirGrupos({ van: [...caso].reverse(), tamano: 6 })) === JSON.stringify(s0), 'determinista: mismos datos (en cualquier orden), mismo resultado');
ok(s0.variante === 0 && s0.variantes > 1, `hay otras combinaciones igual de buenas (${s0.variantes})`);
const s1 = sugerirGrupos({ van: caso, tamano: 6, variante: 1 });
ok(s1.variante === 1 && JSON.stringify(s1.grupos) !== JSON.stringify(s0.grupos), '«Otra sugerencia» (variante 1) da otra combinación');
let todasBien = true;
for (let v = 0; v < Math.min(s0.variantes, 20); v++) {
  const x = cifras(sugerirGrupos({ van: caso, tamano: 6, variante: v }).grupos, caso);
  if (!(quinteto(x) && ordenadas(x.A) === '2/1/1' && Math.abs(x.rango - c.rango) < 1e-9 && ordenadas(x.int) === ordenadas(c.int))) todasBien = false;
}
ok(todasBien, `las ${Math.min(s0.variantes, 20)} primeras sugerencias cumplen lo mismo (misma estructura, A 2/1/1, misma diferencia de nivel)`);
ok(JSON.stringify(sugerirGrupos({ van: caso, tamano: 6, variante: s0.variantes })) === JSON.stringify(s0), 'al pasar de la última vuelve a la primera');
ok(s0.grupos.every((g, i) => g.nombre === `Grupo ${i + 1}` && Object.keys(g).join() === 'nombre,personas'), 'cada grupo lleva solo nombre y personas (sin criterio)');

console.log('\n== Cuando no se puede cumplir la estructura');
// Numero de grupos (D147): redondo(N / tamaño), sin pasar de suelo(N / 5), minimo 1; los que sobran, de sextos o septimos.
for (const [nn, tt, esperado] of [[17, 5, '6,6,5'], [17, 6, '6,6,5'], [20, 5, '5,5,5,5'], [22, 6, '6,6,5,5'], [10, 6, '5,5'], [12, 5, '6,6'], [12, 4, '6,6'], [13, 5, '7,6'], [14, 7, '7,7'], [5, 6, '5'], [4, 5, '4'], [3, 3, '3']])
  ok(tamanos(nn, tt).join() === esperado, `${nn} con ${tt} → ${esperado.split(',').length} ${esperado.includes(',') ? 'grupos' : 'grupo'} (${esperado.replaceAll(',', ', ')})`, tamanos(nn, tt).join());
ok(tamanos(0, 5).length === 0, 'nadie: ningún grupo');
// Sin bases ni de reserva: 10 de 5 en 5.
const sinBases = [J('x1', 'escolta', 'A'), J('x2', 'alero', 'B'), J('x3', 'escolta', 'C'), J('x4', 'alero', 'C'), J('x5', 'alero', 'D'), J('i1', 'pivot', 'A'), J('i2', 'pivot', 'B'), J('i3', 'ala_pivot', 'C'), J('i4', 'ala_pivot', 'C'), J('i5', 'pivot', 'E')];
t = reloj(); c = cifras(sugerirGrupos({ van: sinBases, tamano: 5 }).grupos, sinBases);
ok(c.todos && c.bases.join() === '0,0' && c.ext.every((x) => x >= 2) && c.int.every((x) => x >= 2) && c.rango <= 0.5, `sin bases ni de reserva: los dos grupos sin base, con sus exteriores e interiores (${t()})`, JSON.stringify(c));
ok(c.avisos.join(' | ') === 'Grupo 1 sin base: no hay bases suficientes. | Grupo 2 sin base: no hay bases suficientes.', 'aviso «Grupo 1 sin base: no hay bases suficientes.» en cada grupo', c.avisos.join(' | '));
// Falta un base: el de reserva hace de base en un grupo; el otro, sin base.
const unBase = [J('r1', 'escolta', 'B', true), ...sinBases.slice(0, 9)];
c = cifras(sugerirGrupos({ van: unBase, tamano: 5 }).grupos, unBase);
ok(ordenadas(c.bases) === '1/0' && c.avisos.length === 1 && /^Grupo \d sin base: no hay bases suficientes\.$/.test(c.avisos[0]) && c.papel.get('r1') === 'base', 'un solo base de reserva: hace de base en un grupo y el otro va sin base, con aviso', c.avisos.join(' | '));
// Solo 1 interior: los exteriores completan, con aviso.
const unInt = [J('b1', 'base', 'B'), J('b2', 'base', 'C'), J('x1', 'escolta', 'A'), J('x2', 'alero', 'B'), J('x3', 'escolta', 'C'), J('x4', 'alero', 'C'), J('x5', 'alero', 'D'), J('x6', 'escolta', 'C'), J('x7', 'alero', 'E'), J('i1', 'pivot', 'A')];
t = reloj(); c = cifras(sugerirGrupos({ van: unInt, tamano: 5 }).grupos, unInt);
const deInt = c.faltas.flat().filter((f) => f.papel === 'interior' && f.por === 'exterior').length;
ok(c.todos && c.bases.join() === '1,1' && c.int.join() === '2,2' && deInt === 3 && c.faltas.flat().length === 3, `solo 1 interior: 1 base en cada grupo y tres exteriores hacen de interior (${t()})`, JSON.stringify(c.faltas));
ok(c.avisos.length === 2 && c.avisos.every((a) => /^Grupo \d: (un exterior hace|2 exteriores hacen) de interior: no hay interiores suficientes\.$/.test(a)), 'aviso «Grupo 1: 2 exteriores hacen de interior: no hay interiores suficientes.»', c.avisos.join(' | '));
// Solo 3 exteriores: primero un base sobrante hace de exterior (sin aviso); si no basta, un interior (con aviso).
const tresExt = [J('b1', 'base', 'B'), J('b2', 'base', 'C'), J('b3', 'base', 'A'), J('x1', 'escolta', 'A'), J('x2', 'alero', 'B'), J('x3', 'escolta', 'C'), J('i1', 'pivot', 'A'), J('i2', 'pivot', 'C'), J('i3', 'ala_pivot', 'C'), J('i4', 'ala_pivot', 'D')];
c = cifras(sugerirGrupos({ van: tresExt, tamano: 5 }).grupos, tresExt);
const baseExt = ['b1', 'b2', 'b3'].filter((p) => c.papel.get(p) === 'exterior');
ok(c.sinFaltas && !c.avisos.length && c.bases.join() === '1,1' && c.ext.join() === '2,2' && baseExt.length === 1 && etiquetaPapel(tresExt.find((j) => j.person_id === baseExt[0]), 'exterior') === 'hace de exterior', 'solo 3 exteriores y 3 bases: el base sobrante hace de exterior («hace de exterior»), sin aviso', JSON.stringify(c));
const tresExt2 = [...tresExt.filter((j) => j.person_id !== 'b3'), J('i5', 'pivot', 'B')];
c = cifras(sugerirGrupos({ van: tresExt2, tamano: 5 }).grupos, tresExt2);
ok(c.bases.join() === '1,1' && c.ext.join() === '2,2' && c.faltas.flat().length === 1 && c.faltas.flat()[0].por === 'interior' && /^Grupo \d: un interior hace de exterior: no hay exteriores suficientes\.$/.test(c.avisos.join()), 'solo 3 exteriores y ningún base sobrante: un interior completa, con aviso', c.avisos.join(' | '));
// Sin posicion: comodines que rellenan el hueco que quede (sin aviso).
const comodines = [J('b1', 'base', 'B'), J('b2', 'base', 'C'), J('x1', 'escolta', 'A'), J('x2', 'alero', 'C'), J('i1', 'pivot', 'B'), J('i2', 'ala_pivot', 'C'), J('c1', null, 'A'), J('c2', null, 'C'), J('c3', null, null), J('c4', null, 'D')];
c = cifras(sugerirGrupos({ van: comodines, tamano: 5 }).grupos, comodines);
ok(c.todos && quinteto(c) && !c.avisos.length && ['c1', 'c2', 'c3', 'c4'].every((p) => ['exterior', 'interior'].includes(c.papel.get(p))) && etiquetaPapel(comodines[6], c.papel.get('c1')) === `hace de ${c.papel.get('c1')}`, 'jugadores sin posición: rellenan los huecos de exterior e interior (quinteto completo, sin avisos) con «hace de …»', JSON.stringify(c));
const soloComodin = [J('c1', null, 'B'), J('x1', 'escolta'), J('x2', 'alero'), J('i1', 'pivot'), J('i2', 'pivot')];
c = cifras(sugerirGrupos({ van: soloComodin, tamano: 5 }).grupos, soloComodin);
ok(c.bases.join() === '1' && c.avisos.join() === 'Grupo 1 sin base (hace de base uno sin posición): no hay bases suficientes.' && resumenGrupo(soloComodin).texto.startsWith('0 bases · 2 ext · 2 int') && etiquetaPapel(soloComodin[0], 'base') === 'hace de base', 'sin bases y con un comodín: hace de base («hace de base»), pero el grupo va sin base (aviso y «0 bases» en el resumen)', c.avisos.join(' | '));
// Tamaño 4 con 12: 2 grupos de 6 (ningun grupo por debajo del quinteto si se puede), cada uno con su quinteto.
const de4 = [J('r1', 'escolta', 'A', true), J('r2', 'alero', 'C', true), J('b1', 'base', 'D'), J('x1', 'escolta', 'A'), J('x2', 'alero', 'B'), J('x3', 'escolta', 'C'), J('x4', 'alero', 'C'), J('i1', 'pivot', 'A'), J('i2', 'pivot', 'B'), J('i3', 'ala_pivot', 'C'), J('i4', 'ala_pivot', 'C'), J('i5', 'pivot', 'E')];
t = reloj(); c = cifras(sugerirGrupos({ van: de4, tamano: 4 }).grupos, de4);
ok(c.tam.join() === '6,6' && quinteto(c) && c.rango <= 0.5, `tamaño 4 con 12 jugadores: 2 grupos de 6 con su quinteto, no 3 de 4; diferencia ${c.rango.toFixed(2)} (${t()})`, JSON.stringify(c));
// Grupos de menos de 5 (solo con menos de 5 jugadores): 1 base, 1 exterior y 1 interior como minimo.
const de4b = [J('r1', 'escolta', 'A', true), J('x1', 'alero', 'C'), J('i1', 'pivot', 'B'), J('i2', 'ala_pivot', 'C')];
c = cifras(sugerirGrupos({ van: de4b, tamano: 4 }).grupos, de4b);
ok(c.tam.join() === '4' && c.bases.join() === '1' && c.ext[0] >= 1 && c.int[0] >= 1 && c.sinFaltas && resumenGrupo(de4b).texto === '1 base · 1 ext · 2 int · nivel medio 3,8', 'grupo de 4: 1 base, 1 exterior y 1 interior como mínimo, sin avisos («1 base · 1 ext · 2 int»)', JSON.stringify(c));
const de4mal = [J('x1', 'escolta', 'A'), J('x2', 'alero', 'C'), J('i1', 'pivot', 'B'), J('i2', 'ala_pivot', 'C')];
c = cifras(sugerirGrupos({ van: de4mal, tamano: 4 }).grupos, de4mal);
ok(c.bases.join() === '0' && c.avisos.join() === 'Grupo 1 sin base: no hay bases suficientes.', 'grupo de 4 sin bases: aviso «Grupo 1 sin base: no hay bases suficientes.»', c.avisos.join(' | '));
// Grupos de 7: quinteto y dos «uno más» por grupo, de lineas distintas.
const de7 = [J('b1', 'base', 'A'), J('b2', 'base', 'C'), J('x1', 'escolta', 'A'), J('x2', 'alero', 'B'), J('x3', 'escolta', 'C'), J('x4', 'alero', 'C'), J('x5', 'escolta', 'D'), J('x6', 'alero', 'B'), J('i1', 'pivot', 'A'), J('i2', 'pivot', 'B'), J('i3', 'ala_pivot', 'C'), J('i4', 'ala_pivot', 'C'), J('i5', 'pivot', 'E'), J('i6', 'pivot', 'C')];
t = reloj(); c = cifras(sugerirGrupos({ van: de7, tamano: 7 }).grupos, de7);
ok(c.tam.join() === '7,7' && quinteto(c) && c.extras.every((e) => e.exterior === 1 && e.interior === 1) && c.rango <= 0.5, `grupos de 7: quinteto y los dos sextos de líneas distintas (un exterior y un interior) en cada grupo; diferencia ${c.rango.toFixed(2)} (${t()})`, JSON.stringify(c.extras));
const uno = sugerirGrupos({ van: caso.slice(0, 5), tamano: 6 });
ok(uno.grupos.length === 1 && uno.grupos[0].personas.length === 5 && uno.variantes === 1, 'un solo grupo (5 de 6 en 6): un grupo y ninguna otra sugerencia');
ok(sugerirGrupos({ van: [], tamano: 5 }).grupos.length === 0, 'nadie que vaya: ningún grupo');

console.log('\n== Criterio opcional: juntar a los del siguiente partido');
// Convocatoria anonima del domingo: 9 en el MdA y 8 en el MdL (uno dobla).
const juntos = Object.fromEntries(caso.map((j, i) => [j.person_id, [i % 2 ? 'MdL' : 'MdA']]));
juntos.j02.push('MdA');
const sinJ = cifras(s0.grupos, caso, juntos);
t = reloj();
const sj = sugerirGrupos({ van: caso, tamano: 6, juntos });
const tJ = t();
c = cifras(sj.grupos, caso, juntos);
ok(quinteto(c) && ordenadas(c.tam) === '6/6/5' && ordenadas(c.int) === ordenadas(sinJ.int) && ordenadas(c.A) === '2/1/1', `con convocatoria: la misma estructura (quinteto, sextos interiores) y los A 2/1/1 (${tJ})`, JSON.stringify(c));
ok(c.rango <= sinJ.rango + 0.2 + 1e-9, `nivel dentro del margen: diferencia ${c.rango.toFixed(2)} ≤ ${sinJ.rango.toFixed(2)} + 0,2`);
ok(c.juntos > sinJ.juntos, `más coincidencias: ${c.juntos} parejas de compañeros del domingo en el mismo grupo (sin el criterio, ${sinJ.juntos})`);
ok(JSON.stringify(sugerirGrupos({ van: caso, tamano: 6, juntos: null })) === JSON.stringify(s0) && JSON.stringify(sugerirGrupos({ van: caso, tamano: 6, juntos: {} })) === JSON.stringify(s0) && JSON.stringify(sugerirGrupos({ van: caso, tamano: 6, juntos: { j01: ['MdA'], otro: ['MdA'] } })) === JSON.stringify(s0), 'sin convocatoria (o con menos de 2 de los que van): el mismo resultado que sin el criterio');
const r = resumenGrupo(sj.grupos[0].personas.map((p) => caso.find((j) => j.person_id === p)), { juntos, dia: 'domingo' });
ok(/^1 base · 2 ext · [23] int · nivel medio \d,\d · \d de [56] juegan juntos el domingo$/.test(r.texto) && r.cumple, `resumen con el dato: «${r.texto}»`);

console.log('\n== Resumen y etiquetas');
ok(resumenGrupo([J('a', 'base', 'B'), J('b', 'escolta', 'A'), J('c', 'alero', 'C'), J('d', 'pivot', 'C'), J('e', 'ala_pivot', 'C'), J('f', 'pivot', 'C')]).texto === '1 base · 2 ext · 3 int · nivel medio 3,5', 'resumen: «1 base · 2 ext · 3 int · nivel medio 3,5»');
const mal = resumenGrupo([J('b', 'escolta', 'A'), J('c', 'alero', 'C'), J('d', 'pivot', 'C'), J('e', 'ala_pivot', 'C'), J('f', 'pivot', null)]);
ok(mal.texto === '0 bases · 2 ext · 3 int · nivel medio 3,4 · no cumple: sin base' && !mal.cumple, 'el resumen marca el grupo que no cumple («no cumple: sin base»)', mal.texto);
ok(etiquetaPapel(J('r', 'escolta', 'B', true), 'base') === 'hace de base' && etiquetaPapel(J('r', 'escolta', 'B', true), 'exterior') === null && etiquetaPapel(J('b', 'base'), 'base') === null && etiquetaPapel(J('i', 'pivot'), 'exterior') === 'hace de exterior', 'etiqueta «hace de base» solo si su papel no es su posición (el de reserva de exterior, nada)');
const movido = avisosEstructura([{ nombre: 'Azules', js: [J('x', 'escolta'), J('y', 'alero'), J('z', 'pivot')] }, { nombre: 'Rojos', js: [J('b', 'base'), J('r', 'escolta', 'C', true), J('w', 'pivot')] }]);
ok(movido.join(' | ') === 'Azules sin base: en Rojos sobra uno.', 'tras mover a mano, el aviso dice dónde sobra («Azules sin base: en Rojos sobra uno.»)', movido.join(' | '));
const msg = mensajeGrupos('Grupos del entreno del miércoles 28', [{ nombre: 'Azules', personas: ['a1', 'a2'] }], (x) => x.toUpperCase());
ok(msg === 'Grupos del entreno del miércoles 28:\nAzules: A1, A2' && !/nivel|domingo|base|ext|int/i.test(msg), 'mensaje de WhatsApp: solo grupos y nombres');
if (process.env.SOLO_PURAS) { console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK (solo puras)'); process.exit(fallos() ? 1 : 0); }

const e = await preparar();
const { sql, APP } = e;
try {
  const P = await personas(e.pila, { jugadores: [['esteban-jon', 'jon@pruebas.local'], ['gianatti-adriano', 'adri@pruebas.local']], gestores: [['Iván', 'ivan@pruebas.local', null]] });
  const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const [ent] = await sql`select id, fecha::text from public.eventos where tipo = 'entreno' and estado = 'programado' and fecha > ${hoy} order by fecha limit 1`;
  // Datos privados (posicion, nivel) solo en jugadores SINTETICOS (D39); Jon y Adriano (reales) van sin ellos.
  const POS = ['base', 'escolta', 'alero', 'ala_pivot', 'pivot'];
  const sint = Array.from({ length: 10 }, (_, i) => [`sint-g${i}`, `Prueba${i}`, true, i % 3 !== 0]);
  await sinteticos(sql, sint);
  const privado = {};
  for (const [i, s] of sint.entries()) {
    privado[s[0]] = { posicion: POS[i % 5], base_reserva: i === 6, nivel: 'ABCDE'[i % 5] };
    await sql`insert into public.jugadores_privado (person_id, posicion, nivel, base_reserva) values (${s[0]}, ${POS[i % 5]}, ${'ABCDE'[i % 5]}, ${i === 6})`;
    await sql`insert into public.respuestas (evento_id, person_id, respuesta) values (${ent.id}, ${s[0]}, 'va')`;
  }
  await sql`insert into public.respuestas (evento_id, person_id, respuesta) values (${ent.id}, 'esteban-jon', 'va'), (${ent.id}, 'gianatti-adriano', 'va') on conflict do nothing`;
  await sql`insert into public.respuestas (evento_id, person_id, respuesta) values (${ent.id}, 'vallesi-daniele', 'duda') on conflict (evento_id, person_id) do update set respuesta = 'duda'`;
  const datoDe = (p) => ({ person_id: p, ...(privado[p] ?? { posicion: null, base_reserva: false, nivel: null }) });
  // D147: convocatoria APROBADA del siguiente partido (solo sinteticos): 0-4 en el MdA y 5-9 en el MdL.
  const [sigP] = await sql`select fecha::text from public.eventos where tipo = 'liga' and estado = 'programado' and equipo in ('MdA', 'MdL') and fecha > ${ent.fecha} order by fecha limit 1`;
  const juntos = Object.fromEntries(sint.map((x, i) => [x[0], [i < 5 ? 'MdA' : 'MdL']]));
  const siguiente = sigP ? { juntos, dia: new Date(`${sigP.fecha}T12:00:00Z`).toLocaleDateString('es-ES', { timeZone: 'UTC', weekday: 'long' }) } : null;
  if (sigP) await sql`insert into public.convocatorias (fecha, estado, origen, equipos, aprobada_en) values (${sigP.fecha}, 'aprobada', 'propuesta', ${sql.json({ MdA: sint.slice(0, 5).map((x) => ({ person_id: x[0] })), MdL: sint.slice(5).map((x) => ({ person_id: x[0] })) })}, now())
    on conflict (fecha) do update set estado = 'aprobada', equipos = excluded.equipos`;
  ok(!!sigP, `hay un partido de liga después del entreno para el criterio de juntos (${sigP?.fecha})`);
  const enPantalla = (pg) => pg.getByTestId('grupo').evaluateAll((xs) => xs.map((x) => ({
    nombre: x.querySelector('input[type=text]')?.value ?? '', ids: [...x.querySelectorAll('li[data-person]')].map((li) => li.dataset.person), r: x.querySelector('[data-testid=gr-resumen]')?.textContent ?? '',
    hace: [...x.querySelectorAll('li[data-person]')].map((li) => li.querySelector('[data-testid=gr-hace]')?.textContent ?? null),
  })));
  /** Resumen, etiquetas «hace de …» y avisos en pantalla = los calculados con los datos de la base (se recalculan al mover). */
  const resumenesBien = async (pg) => {
    const gs = await enPantalla(pg);
    const bien = gs.every((g) => {
      const js = g.ids.map(datoDe), papel = estructuraGrupo(js).papel;
      return g.r === resumenGrupo(js, siguiente).texto && g.hace.every((h, k) => h === etiquetaPapel(js[k], papel.get(g.ids[k])));
    });
    const avisos = avisosEstructura(gs.map((g) => ({ nombre: g.nombre, js: g.ids.map(datoDe) })));
    const vistos = (await pg.getByTestId('gr-avisos').count()) ? await pg.getByTestId('gr-avisos').locator('div').allInnerTexts() : [];
    return bien && vistos.join('|') === avisos.join('|') ? true : JSON.stringify({ gs, avisos, vistos });
  };

  console.log('\n== Gestor (1280 px): sugerir, resumen, otra sugerencia, mover, renombrar, guardar');
  const pg = await e.sesion('ivan@pruebas.local', 1280);
  await pg.goto(`${APP}/gestion/grupos/${ent.id}`);
  ok(await visto(pg.getByRole('heading', { name: /Dudan/ })) && /Daniele/.test(await pg.locator('.gr-dudas').innerText()), 'los «Duda», aparte (para añadirlos a mano)');
  const html0 = await pg.content();
  ok(!/"nivel"|base_reserva|"posicion"/.test(html0), 'posición, base de reserva y nivel no viajan en el HTML de la página (llegan aparte)');
  await pg.getByTestId('gr-resumen').first().waitFor({ state: 'attached', timeout: 1000 }).catch(() => {});
  ok(!/MdL|MdA/.test(await pg.locator('.gr').innerText()) && !/MdL|MdA|juntos/.test(await pg.locator('.gr').evaluate((x) => x.outerHTML)), 'ningún equipo del domingo en el reparto (solo «N de M juegan juntos» en el resumen)');
  ok(await visto(pg.getByTestId('gr-sin-nivel')) && (await pg.getByTestId('gr-sin-nivel').innerText()) === '2 jugadores sin nivel: la sugerencia los cuenta como C.', 'aviso arriba: «2 jugadores sin nivel: la sugerencia los cuenta como C.»');
  ok(/sin nivel/.test(await pg.locator('li[data-person="esteban-jon"]').innerText()), 'la tarjeta del que no tiene nivel dice «sin nivel»');
  await pg.getByLabel('Jugadores por grupo (aprox.)').selectOption('5');
  ok((await pg.getByTestId('gr-previsto').innerText()) === '12 jugadores → 2 grupos (6, 6)', 'antes de sugerir: «12 jugadores → 2 grupos (6, 6)»', await pg.getByTestId('gr-previsto').innerText());
  await pg.getByLabel('Jugadores por grupo (aprox.)').selectOption('3');
  ok((await pg.getByTestId('gr-previsto').innerText()) === '12 jugadores → 2 grupos (6, 6)', 'con 3 por grupo tampoco baja del quinteto: «12 jugadores → 2 grupos (6, 6)»', await pg.getByTestId('gr-previsto').innerText());
  await pg.getByLabel('Jugadores por grupo (aprox.)').selectOption('6');
  ok(await visto(pg.getByText('Jugadores por grupo (aprox.)')) && (await pg.getByTestId('gr-previsto').innerText()) === '12 jugadores → 2 grupos (6, 6)', 'selector «Jugadores por grupo (aprox.)»; la línea se actualiza al cambiar el número');
  await pg.getByLabel('Jugadores por grupo (aprox.)').selectOption('5');
  await pg.getByRole('button', { name: 'Sugerir grupos' }).click();
  await pg.getByTestId('grupo').first().waitFor({ timeout: 15000 });
  const n = await pg.getByTestId('grupo').count();
  ok(n === 2 && (await pg.locator('.gr-sin li').count()) === 0, `la sugerencia coloca a los 12 que van en 2 grupos (${n}) de 6`);
  await hasta(async () => (await resumenesBien(pg)) === true, 5000);
  const r1 = await resumenesBien(pg);
  const res1 = await pg.getByTestId('gr-resumen').allInnerTexts();
  ok(r1 === true && res1.every((x) => /^1 base · \d ext · \d int · nivel medio \d,\d( · \d de 6 juegan juntos el [a-zé]+)?$/.test(x)), `cada grupo con su estructura y nivel («${res1[0]}»), sin avisos`, r1);
  ok(!siguiente || res1.some((x) => x.includes(`juegan juntos el ${siguiente.dia}`)), `con la convocatoria aprobada, el dato en el resumen («N de 6 juegan juntos el ${siguiente?.dia}»)`, res1.join(' | '));
  const hace = await pg.getByTestId('gr-hace').allInnerTexts();
  ok(hace.length >= 2 && hace.every((x) => /^hace de (base|exterior|interior)$/.test(x)), `etiqueta «hace de …» en las tarjetas que no juegan en su posición (${hace.join(', ')})`);
  const antes = await pg.getByTestId('grupo').evaluateAll((xs) => xs.map((x) => [...x.querySelectorAll('li[data-person]')].map((li) => li.dataset.person).join()).join('|'));
  await pg.getByRole('button', { name: 'Otra sugerencia' }).click();
  await pg.getByText(/^Sugerencia 2 de \d+/).waitFor({ timeout: 15000 });
  const despues = await pg.getByTestId('grupo').evaluateAll((xs) => xs.map((x) => [...x.querySelectorAll('li[data-person]')].map((li) => li.dataset.person).join()).join('|'));
  ok(antes !== despues && (await resumenesBien(pg)) === true, '«Otra sugerencia»: otra combinación, con su resumen');
  // Mover a mano los bases (puros o de reserva) del grupo 1 al grupo 2: el grupo 1 se queda sin base y el aviso dice dónde sobra.
  const g1 = (await enPantalla(pg))[0];
  const susBases = g1.ids.filter((p) => privado[p] && (privado[p].posicion === 'base' || privado[p].base_reserva));
  for (const b of susBases) await pg.locator(`[data-testid=grupo] li[data-person="${b}"] input[type=checkbox]`).check();
  await pg.locator('.tb-barra').getByRole('combobox').selectOption({ index: 1 });
  await pg.locator('.tb-barra').getByRole('button', { name: 'Mover' }).click();
  ok(susBases.length >= 1 && (await pg.getByTestId('grupo').nth(1).locator('li').count()) === 6 + susBases.length, `«Mover ${susBases.length} a…» los pasa de grupo`);
  const r2 = await resumenesBien(pg);
  ok(r2 === true, 'el resumen, las etiquetas y los avisos se recalculan al mover a mano', r2);
  ok(/^Grupo 1 sin base( \(hace de base uno sin posición\))?: en Grupo 2 sobra uno\.$/m.test(await pg.getByTestId('gr-avisos').innerText()) && /no cumple: sin base/.test(await pg.getByTestId('gr-resumen').first().innerText()) && (await pg.locator('.gr-resumen-mal').count()) === 1,
    'aviso arriba «Grupo 1 sin base: en Grupo 2 sobra uno.» y el resumen del grupo 1 marcado («no cumple: sin base»)', await pg.getByTestId('gr-avisos').innerText().catch(() => ''));
  await pg.getByLabel('Nombre del grupo 1').fill('Azules');
  await pg.getByLabel('Nombre del reparto').fill('5 contra 5');
  await foto(pg, 'grupos_sugerencia_1280');
  await pg.getByRole('button', { name: 'Guardar como reparto nuevo' }).click();
  await pg.getByText('Reparto guardado.').waitFor({ timeout: 15000 });
  let rep = await sql`select id, nombre, grupos, publicado from public.grupos_repartos where evento_id = ${ent.id} and borrado_en is null`;
  ok(rep.length === 1 && rep[0].nombre === '5 contra 5' && rep[0].grupos[0].nombre === 'Azules' && rep[0].publicado === false && !JSON.stringify(rep[0].grupos).includes('explica'), 'guardado, sin publicar (por defecto) y sin criterio', JSON.stringify(rep));

  console.log('\n== Vista para el equipo (1280 px)');
  const interruptor = pg.getByTestId('vista-equipo-interruptor');
  ok(await visto(interruptor) && (await interruptor.getAttribute('aria-checked')) === 'false', 'interruptor «Vista para el equipo» visible junto a los grupos, apagado');
  await interruptor.click();
  await pg.getByTestId('vista-equipo').waitFor({ timeout: 5000 });
  const vista = pg.getByTestId('vista-equipo');
  const texto = await pg.locator('body').innerText();
  ok((await vista.getByRole('heading', { level: 2 }).textContent()) === '5 contra 5' && /^Entreno del (lunes|martes|miércoles|jueves|viernes|sábado|domingo) \d{1,2} de [a-z]+$/.test(await vista.locator('.ge-fecha').textContent()), 'título del reparto con la fecha del entreno («Entreno del miércoles 4 de noviembre»)', await vista.locator('.ge-fecha').textContent());
  const nombres = ['Azules', 'Jon', 'Adriano', 'Prueba0', 'Prueba6', 'Daniele'];
  ok(nombres.every((x) => texto.includes(x)) && /Dudan/.test(texto), 'grupos con su nombre y los nombres de los jugadores; «Dudan» con nombres', texto);
  ok(!/nivel|Nivel medio|interior|\bbases?\b|base de reserva|sin posición|Escolta|Alero|Ala-pívot|Pívot|\bduda\b|hace de|juegan juntos|\bext\b|\bint\b|sin base/i.test(texto), 'el texto de la página no lleva nivel, posición, «base de reserva», «sin nivel», «duda» ni el resumen', texto);
  const letras = await pg.evaluate(() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const out = []; while (w.nextNode()) { const t = w.currentNode.textContent.trim(); if (/^(nivel )?[A-E]$/i.test(t)) out.push(t); } return out; });
  ok(!letras.length, 'ninguna letra de nivel como etiqueta (en ningún nodo de texto, visible o no)', letras.join());
  const html = await pg.content();
  ok(!/nivel|base_reserva|base de reserva|"posicion"|escolta|alero|ala_pivot|pivot|Pívot|sin posición|tb-marca|Nivel medio|hace de|juegan juntos|gr-avisos|sin base/i.test(html), 'el HTML (con el inspector) no tiene niveles ni posiciones ocultos con CSS');
  const fuera = ['Sugerir grupos', 'Otra sugerencia', 'Quitar grupo', '+ Añadir grupo', 'Guardar reparto', 'Copiar mensaje de WhatsApp', 'Van sin grupo', 'Publicar a la plantilla', 'Los grupos no cuentan'];
  ok(fuera.every((x) => !html.includes(x)) && (await pg.locator('.gr input[type=checkbox]').count()) === 0, 'sin botones, casillas, ayuda ni «Van sin grupo»');
  ok(!(await pg.locator('.nv-cab').first().isVisible()) && !(await pg.locator('.gs-titulo').isVisible()), 'sin la cabecera de la web ni la de la página (pantallazo limpio)');
  ok((await sql`select grupos from public.grupos_repartos where evento_id = ${ent.id} and borrado_en is null`)[0].grupos[0].nombre === 'Azules', 'no guarda ni toca nada');
  await foto(pg, 'grupos_vista_equipo_1280');
  await interruptor.click();
  ok(await visto(pg.getByRole('button', { name: 'Sugerir grupos' })) && (await resumenesBien(pg)) === true && await visto(pg.locator('.tb-marca')) && await pg.locator('.nv-cab').first().isVisible(), 'otro clic en el interruptor: vuelve todo (botones, etiquetas, resumen y cabecera)');
  await interruptor.click();
  await pg.getByTestId('vista-equipo').waitFor({ timeout: 5000 });
  await pg.reload();
  ok(await visto(pg.getByRole('button', { name: 'Sugerir grupos' })) && (await pg.getByTestId('vista-equipo').count()) === 0 && (await pg.getByTestId('vista-equipo-interruptor').getAttribute('aria-checked')) === 'false', 'al recargar sale la vista normal');

  console.log('\n== Varios repartos: duplicar y borrar');
  await pg.reload();
  await trasAccion(pg, () => pg.getByRole('button', { name: 'Duplicar' }).click());
  await pg.reload();
  ok((await sql`select count(*)::int n from public.grupos_repartos where evento_id = ${ent.id} and borrado_en is null`)[0].n === 2 && await visto(pg.getByRole('tab', { name: /5 contra 5 \(copia\)/ })), 'duplicar: dos repartos con nombre');
  await pg.getByRole('tab', { name: /5 contra 5 \(copia\)/ }).click();
  await pg.getByRole('button', { name: 'Borrar reparto' }).click();
  await trasAccion(pg, () => pg.getByRole('button', { name: 'Sí, borrar' }).click());
  ok((await sql`select count(*)::int n from public.grupos_repartos where evento_id = ${ent.id} and borrado_en is null`)[0].n === 1, 'borrar (confirmación en la página): queda uno');

  console.log('\n== Publicar a la plantilla: cada jugador ve SOLO su grupo y nunca niveles');
  await pg.reload();
  await trasAccion(pg, () => pg.getByTestId('publicar').locator('input').click());
  ok((await sql`select publicado from public.grupos_repartos where evento_id = ${ent.id} and borrado_en is null`)[0].publicado === true, 'publicado');
  const wa = await pg.getByTestId('mensaje-grupos').innerText();
  ok(/^Grupos del entreno del/.test(wa) && /Azules: /.test(wa) && !/nivel|del domingo|interior|base/i.test(wa), '«Copiar mensaje de WhatsApp»: grupos y nombres, nada más');
  rep = (await sql`select grupos from public.grupos_repartos where evento_id = ${ent.id} and publicado`)[0].grupos;
  const suyo = rep.find((x) => x.personas.includes('esteban-jon'));
  const mios = (await (await fetch(`${e.pila.url}/rest/v1/rpc/mis_grupos`, { method: 'POST', headers: { apikey: e.pila.anonKey, authorization: `Bearer ${P['esteban-jon'].token}`, 'content-type': 'application/json' }, body: '{}' })).json());
  ok(mios.length === 1 && mios[0].grupo === suyo.nombre && mios[0].companeros.length === suyo.personas.length - 1 && !JSON.stringify(mios).match(/nivel|explica|posicion/), 'mis_grupos (base): solo el nombre de su grupo y sus compañeros', JSON.stringify(mios));
  const leer = await (await fetch(`${e.pila.url}/rest/v1/grupos_repartos?select=grupos`, { headers: { apikey: e.pila.anonKey, authorization: `Bearer ${P['esteban-jon'].token}` } })).json();
  ok(Array.isArray(leer) && leer.length === 0, 'un jugador NO lee los repartos (RLS: solo gestores)');
  const pj = await e.sesion('jon@pruebas.local', 375);
  const tg = pj.getByTestId('tu-grupo').first();
  ok(await visto(tg) && (await tg.innerText()).includes(`Tu grupo: ${suyo.nombre}`), `inicio: «Tu grupo: ${suyo.nombre}» en el entreno`);
  const htmlJ = (await pj.content()).replace(/<script[\s\S]*?<\/script>/g, '');
  const otro = rep.find((x) => !x.personas.includes('esteban-jon'));
  ok(!/nivel/i.test(htmlJ) && (!otro || !htmlJ.includes(otro.nombre === suyo.nombre ? '§' : `Tu grupo: ${otro.nombre}`)), 'nunca niveles ni otros grupos');
  await pj.goto(`${APP}/agenda`);
  ok(await visto(pj.getByTestId('tu-grupo')), 'agenda: también «Tu grupo»');
  ok(await sinDesbordar(pj), 'a 375 px sin desbordamiento');

  console.log('\n== Gestor a 375 px: vista normal y vista para el equipo');
  const pg375 = await e.nuevaPagina(await e.contexto(375));
  await pg375.context().addCookies(await pg.context().cookies());
  await pg375.goto(`${APP}/gestion/grupos/${ent.id}`);
  await pg375.getByTestId('gr-resumen').first().waitFor({ timeout: 10000 });
  ok(await sinDesbordar(pg375), 'grupos (gestor) a 375 px sin desbordamiento');
  await foto(pg375, 'grupos_sugerencia_375');
  await pg375.getByTestId('vista-equipo-interruptor').click();
  await pg375.getByTestId('vista-equipo').waitFor({ timeout: 5000 });
  ok(await sinDesbordar(pg375), 'vista para el equipo a 375 px sin desbordamiento');
  const alto = await pg375.getByTestId('vista-equipo').evaluate((x) => x.getBoundingClientRect().bottom);
  ok(alto <= 812, `la vista para el equipo cabe en una pantalla de móvil (${Math.round(alto)} px de 812)`);
  ok(!(await pg375.locator('.nv-barra').first().isVisible()), 'sin la barra inferior de la web');
  await foto(pg375, 'grupos_vista_equipo_375', false);
  ok(!e.errores.length, 'sin errores de consola', e.errores.slice(0, 5).join(' | '));
} catch (err) { console.error(err); sumar(); } finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
