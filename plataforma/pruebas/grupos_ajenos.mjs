#!/usr/bin/env node
// Grupos ajenos de la fase en Liga consolidada y Scouting rivales (D184), de extremo a extremo: pila local, web compilada
// y Chrome. Datos SINTETICOS (equipos y jugadores «Sint…», nunca de terceros: va a GitHub Actions): G1 y G2 con un
// jugador que dobla y dos grupos ajenos (G3, G4) cuyos lideres superan a los nuestros, para que cualquier mezcla se note.
// Comprueba: sin sesion no se ve nada de G3-G6 (API y paginas); con un grupo elegido no sale nadie de otro grupo; el que
// dobla, filtrado por G1, solo suma sus partidos del G1; «Nuestros grupos» (por defecto) da las cifras de siempre; la
// opcion queda en la URL; Scouting abre un equipo ajeno; y ningun equipo de G3-G6 llega a la liga publicada (data/).
//
//   npm run pruebas:grupos-ajenos
import fs from 'node:fs';
import path from 'node:path';
import { preparar, personas, sinteticos, contador, visto, sinDesbordar, REPO } from './comun_e2e.mjs';
import { cargarLiga } from '../scripts/cargar_liga.mjs';
import { filasTabla } from '../src/lib/jugadoresLiga.ts';

const { ok, fallos } = contador();

// ---- La liga sintetica (la misma forma que leerLiga: privado, publico, ajenos y calendario)
const jug = (nombre, num, pts, { sec = 900, fc = 1, tla = 0, tli = 0, p3a = 0 } = {}) =>
  ({ num: String(num), nombre, sec, pts, p2a: Math.max(0, Math.floor((pts - 3 * p3a - tla) / 2)), p2i: 0, p3a, p3i: 0, tla, tli, fc, val: 0, pm: 0 });
const partido = (grupo, jornada, local, visitante, jl, jv) => ({
  grupo, jornada, fecha: null, local, visitante, fichero: `sint_${grupo}_${local}_${visitante}.xlsx`,
  pl: jl.reduce((s, j) => s + j.pts, 0), pv: jv.reduce((s, j) => s + j.pts, 0),
  equipos: [{ equipo: local, jugadores: jl }, { equipo: visitante, jugadores: jv }],
});
const DOBLA = 'SINT DOBLA, PEPE';
const privado = [
  partido('G1', 1, 'MdA', 'Sint Rival Uno', [jug(DOBLA, 7, 10), jug('SINT SOLOMDA, ANA', 4, 8)], [jug('SINT RIVALUNO, LUIS', 5, 12), jug('SINT RIVALUNO, RAUL', 6, 4)]),
  partido('G1', 2, 'Sint Rival Dos', 'MdA', [jug('SINT RIVALDOS, IKER', 9, 9)], [jug(DOBLA, 7, 6), jug('SINT SOLOMDA, ANA', 4, 11)]),
  partido('G2', 1, 'MdL', 'Sint Rival Tres', [jug(DOBLA, 17, 20), jug('SINT SOLOMDL, EVA', 8, 5)], [jug('SINT RIVALTRES, OSCAR', 10, 14)]),
  // Ajenos: sin jornada (la hoja no la trae) y con anotadores muy por encima de los nuestros
  partido('G3', null, 'Sint Ajeno Tres A', 'Sint Ajeno Tres B', [jug('SINT GTRES, ALFA', 3, 50), jug('SINT GTRES, BETA', 2, 2)], [jug('SINT GTRES, GAMMA', 1, 31)]),
  partido('G3', null, 'Sint Ajeno Tres B', 'Sint Ajeno Tres C', [jug('SINT GTRES, GAMMA', 1, 25)], [jug('SINT GTRES, DELTA', 8, 22)]),
  partido('G4', null, 'Sint Ajeno Cuatro A', 'Sint Ajeno Cuatro B', [jug('SINT GCUATRO, EPSILON', 4, 60)], [jug('SINT GCUATRO, ZETA', 5, 41)]),
];
function clasificar(grupo) {
  const t = new Map();
  for (const p of privado.filter((x) => x.grupo === grupo)) {
    for (const [eq, pf, pc] of [[p.local, p.pl, p.pv], [p.visitante, p.pv, p.pl]]) {
      const x = t.get(eq) ?? { equipo: eq, nuestro: eq === 'MdA' || eq === 'MdL', pj: 0, g: 0, p: 0, pf: 0, pc: 0 };
      x.pj++; x[pf > pc ? 'g' : 'p']++; x.pf += pf; x.pc += pc; t.set(eq, x);
    }
  }
  return [...t.values()].sort((a, b) => b.g - a.g || (b.pf - b.pc) - (a.pf - a.pc)).map((x, i) => ({ pos: i + 1, ...x, pts: 2 * x.g + x.p }));
}
const liga = {
  privado,
  publico: { grupos: { G1: { clasificacion: clasificar('G1') }, G2: { clasificacion: clasificar('G2') } } },
  ajenos: { G3: { nombre: 'DOM MAÑ G3', clasificacion: clasificar('G3') }, G4: { nombre: 'DOM TAR', clasificacion: clasificar('G4') } },
  calendario: [],
};
const nombresDe = (grupos) => privado.filter((p) => grupos.includes(p.grupo)).flatMap((p) => p.equipos.flatMap((e) => e.jugadores.map((j) => j.nombre)));
const equiposDe = (grupos) => [...new Set(privado.filter((p) => grupos.includes(p.grupo)).flatMap((p) => [p.local, p.visitante]))];
const norm = (t) => String(t ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// Lo que delata a un grupo en una pagina: el apellido sintetico de sus jugadores y los nombres de sus equipos
const huellas = (grupos) => [...new Set([...nombresDe(grupos).map((n) => n.split(',')[0]), ...equiposDe(grupos).filter((e) => !['MdA', 'MdL'].includes(e))])].map(norm);
// `propios`: los grupos que se ensenan; quien sale en uno de ellos (el que dobla sale en G1 y en G2) no es una fuga
const fugas = (texto, grupos, propios = []) => { const mias = new Set(huellas(propios)); return huellas(grupos).filter((h) => !mias.has(h) && ` ${norm(texto)} `.includes(` ${h} `)); };

const e = await preparar();
const { sql, APP } = e;
try {
  await cargarLiga(sql, liga, '2026-27', { log: () => {} });
  await sinteticos(sql, [['sint-ana', 'Ana', true, true]]);
  const P = await personas(e.pila, { jugadores: [['sint-ana', 'ana@pruebas.local']] });
  const intrusoId = await e.pila.crearUsuario('intruso@pruebas.local', 'x');
  const tIntruso = await e.pila.firmar({ sub: intrusoId, role: 'authenticated', email: 'intruso@pruebas.local' });
  const api = async (ruta, token) => {
    const r = await fetch(`${e.pila.url}/rest/v1${ruta}`, { headers: { apikey: e.pila.anonKey, authorization: `Bearer ${token ?? e.pila.anonKey}` } });
    let datos = null; try { datos = await r.json(); } catch {}
    return { status: r.status, datos };
  };
  const nada = (r) => r.status === 401 || r.status === 403 || (Array.isArray(r.datos) && r.datos.length === 0);

  console.log('\n== Datos: los grupos ajenos se cargan como G1/G2, con el grupo como campo y sin jornada');
  const porGrupo = Object.fromEntries((await sql`select grupo, count(*)::int n, count(jornada)::int con_jornada from public.liga_partidos group by grupo`).map((x) => [x.grupo, x]));
  ok(porGrupo.G3?.n === 2 && porGrupo.G4?.n === 1 && porGrupo.G3.con_jornada === 0, 'G3 (2 partidos) y G4 (1) cargados, sin jornada', JSON.stringify(porGrupo));
  ok((await sql`select count(*)::int n from public.liga_clasificacion where grupo in ('G3', 'G4')`)[0].n === 5, 'su clasificación calculada, también cargada (5 equipos)');
  let rechaza = false;
  try { await sql`insert into public.liga_partidos (temporada, grupo, jornada, local, visitante, pts_local, pts_visitante) values ('2026-27', 'G1', null, 'A', 'B', 1, 2)`; } catch { rechaza = true; }
  ok(rechaza, 'G1 y G2 siguen exigiendo jornada (la base rechaza un partido del G1 sin jornada)');

  console.log('\n== Sin sesión no se ve ningún dato de G3-G6');
  // liga_estadisticas_jugador no lleva el grupo: va por su partido
  const ruta = (t) => (t === 'liga_estadisticas_jugador' ? '/liga_estadisticas_jugador?select=nombre,liga_partidos!inner(grupo)&liga_partidos.grupo=in.(G3,G4,G5,G6)' : `/${t}?select=*&grupo=in.(G3,G4,G5,G6)`);
  for (const t of ['liga_partidos', 'liga_estadisticas_jugador', 'v_liga_jugadores', 'liga_clasificacion']) {
    ok(nada(await api(ruta(t))), `anónimo: nada de G3-G6 en ${t}`);
    ok(nada(await api(ruta(t), tIntruso)), `cuenta sin ficha: nada de G3-G6 en ${t}`);
  }
  const conFicha = await api('/liga_estadisticas_jugador?select=nombre,liga_partidos!inner(grupo)&liga_partidos.grupo=eq.G3', P['sint-ana'].token);
  ok(conFicha.status === 200 && conFicha.datos.length === 5, 'un jugador con sesión y ficha sí lee el G3 (D162)', `${conFicha.status} / ${conFicha.datos?.length}`);
  for (const r of ['/liga/consolidada?grupo=G3', '/liga/consolidada?grupo=G4', `/liga/scouting?e=${encodeURIComponent('Sint Ajeno Tres A')}`]) {
    const res = await fetch(`${APP}${r}`, { redirect: 'manual' });
    ok(res.status >= 300 && res.status < 400 && /\/entrar/.test(res.headers.get('location') ?? ''), `anónimo en ${r}: manda a Entrar`, `${res.status} ${res.headers.get('location')}`);
  }
  for (const r of ['/', '/liga', '/liga/2026-27', '/club', '/historia', '/plantilla', '/liga/consolidada?grupo=G3', '/liga/scouting']) {
    const html = await (await fetch(`${APP}${r}`, { redirect: 'follow' })).text();
    const f = fugas(html, ['G3', 'G4']);
    ok(f.length === 0, `anónimo en ${r}: ni un jugador ni un equipo de G3-G6`, f.join(', '));
  }
  // La liga publicada (data/ y su copia de la web) no lleva ningun equipo de los grupos ajenos reales (grupos_fase.json)
  const mapa = JSON.parse(fs.readFileSync(path.join(REPO, 'scripts', 'estadisticas', 'grupos_fase.json'), 'utf8'))['2026-27'];
  const ajenosReales = new Set(Object.values(mapa).flatMap((g) => g.equipos).map(norm));
  for (const f of ['data/liga_2026-27.json', 'plataforma/src/data/liga.json']) {
    const pub = JSON.parse(fs.readFileSync(path.join(REPO, f), 'utf8'));
    const equipos = Object.values(pub.grupos).flatMap((g) => g.clasificacion.map((c) => c.equipo));
    ok(Object.keys(pub.grupos).every((g) => g === 'G1' || g === 'G2') && !equipos.some((x) => ajenosReales.has(norm(x))), `${f}: solo G1 y G2, ningún equipo de G3-G6`);
  }

  const p = await e.sesion('ana@pruebas.local', 1280);
  const texto = () => p.evaluate(() => document.querySelector('main')?.innerText ?? document.body.innerText);
  const resumen = () => p.locator('#lideres .lg-sub').first().innerText();
  const filaDe = (nombre) => p.locator('.lg-tabla-todos tbody tr', { hasText: new RegExp(nombre.split(',')[0], 'i') }).filter({ hasText: new RegExp(nombre.split(', ')[1], 'i') });

  console.log('\n== «Nuestros grupos» (por defecto): la página de siempre');
  await p.goto(`${APP}/liga/consolidada`);
  const nuestros = privado.filter((x) => x.grupo === 'G1' || x.grupo === 'G2');
  const { agruparJugadores } = await import('../src/lib/jugadoresLiga.ts');
  const filasHoja = nuestros.flatMap((x, i) => x.equipos.flatMap((q) => q.jugadores.map((j) => ({ partido_id: `p${i}`, grupo: x.grupo, jornada: x.jornada, equipo: q.equipo, dorsal: j.num, nombre: j.nombre, segundos: j.sec, pts: j.pts, p2a: j.p2a, p3a: j.p3a, tla: j.tla, tli: j.tli, faltas: j.fc }))));
  const clasN = [...liga.publico.grupos.G1.clasificacion.map((c) => ({ ...c, grupo: 'G1' })), ...liga.publico.grupos.G2.clasificacion.map((c) => ({ ...c, grupo: 'G2' }))];
  const sumadas = filasTabla(agruparJugadores(filasHoja).jugadores, new Map(clasN.map((c) => [`${c.grupo}|${c.equipo}`, c.pj])));
  const esperado = `${sumadas.length} personas de los ${clasN.filter((c) => c.pj > 0).length} equipos con partidos jugados, hasta la jornada ${Math.max(...clasN.map((c) => c.pj))}. «dobla» = sale con MdA y con MdL (sus dos fichas se suman).`;
  ok((await resumen()) === esperado, `cabecera de siempre: «${esperado}»`, await resumen());
  ok((await p.locator('#grupo').inputValue()) === 'nuestros', 'el selector marca «Nuestros grupos»');
  const opciones = await p.locator('#grupo option').allInnerTexts();
  ok(JSON.stringify(opciones) === JSON.stringify(['Nuestros grupos (G1 + G2)', 'G1 · MdA', 'G2 · MdL', 'G3 · DOM MAÑ G3', 'G4 · DOM TAR', 'G5 · SAB TAR G1', 'G6 · SAB TAR G2']), 'opciones: Nuestros grupos y G1…G6 con su nombre, sin «Todos»', opciones.join(' | '));
  ok(fugas(await texto(), ['G3', 'G4']).length === 0, 'ni un jugador ni un equipo de G3-G6', fugas(await texto(), ['G3', 'G4']).join(', '));
  const htmlDefecto = await texto();
  await p.goto(`${APP}/liga/consolidada?grupo=nuestros`);
  ok((await texto()) === htmlDefecto, '?grupo=nuestros es la misma página que sin parámetro');
  await p.locator('#lideres .lg-conmutador button', { hasText: 'Totales' }).click();
  const lider = await p.locator('#lideres .lg-lider').first().locator('li').first().textContent();
  ok(/Sint Dobla, Pepe/i.test(lider) && /36\s*$/.test(lider) && /dobla/.test(lider), 'líder en puntos: el que dobla, con sus dos fichas sumadas (36 = 10 + 6 + 20)', lider);
  ok((await p.locator('details.lg-ranking summary').innerText()).includes('G1 y G2 (5 equipos)'), 'ranking: G1 y G2, 5 equipos');
  const fDobla = await filaDe(DOBLA).first().innerText();
  ok(/MdA \+ MdL/.test(fDobla) && /\t3\t/.test(fDobla) && /\t36\t/.test(fDobla), 'tabla: el que dobla, una fila con «MdA + MdL», 3 PJ y 36 puntos', fDobla);
  await p.goto(`${APP}/liga/consolidada?grupo=Todos`);
  ok((await p.locator('#grupo').inputValue()) === 'nuestros' && (await resumen()) === esperado, 'un grupo que no existe (?grupo=Todos) da «Nuestros grupos»');

  console.log('\n== G1 solo: el que dobla suma solo sus partidos del G1');
  await p.goto(`${APP}/liga/consolidada?grupo=G1`);
  ok(fugas(await texto(), ['G2', 'G3', 'G4'], ['G1']).length === 0, 'G1: ni un jugador ni un equipo de G2, G3 o G4', fugas(await texto(), ['G2', 'G3', 'G4'], ['G1']).join(', '));
  const g1 = await filaDe(DOBLA).first().innerText();
  ok(/\t2\t/.test(g1) && /\t16\t/.test(g1) && !/MdL/.test(g1), 'G1: el que dobla, 2 PJ y 16 puntos (10 + 6), solo la ficha del MdA', g1);
  ok(/dobla/.test(g1), 'G1: la etiqueta «dobla» se sigue viendo', g1);
  ok(/hasta la jornada 2\./.test(await resumen()) && /3 equipos/.test(await resumen()), 'G1: cabecera con los 3 equipos del G1 y la jornada 2', await resumen());
  ok((await p.locator('details.lg-ranking summary').innerText()).includes('G1 · MdA (3 equipos)'), 'G1: ranking solo del G1');
  await p.goto(`${APP}/liga/consolidada?grupo=G2`);
  const g2 = await filaDe(DOBLA).first().innerText();
  ok(/\t1\t/.test(g2) && /\t20\t/.test(g2) && /dobla/.test(g2) && fugas(await texto(), ['G1', 'G3', 'G4'], ['G2']).length === 0, 'G2: el que dobla, 1 PJ y 20 puntos, con «dobla»; nadie de otro grupo', g2);

  console.log('\n== G3: solo el G3; la opción en la URL');
  await p.goto(`${APP}/liga/consolidada`);
  await p.locator('#grupo').selectOption('G3');
  await p.getByTestId('selector-grupo').getByRole('button', { name: 'Ver' }).click();
  await p.waitForURL(/[?&]grupo=G3/);
  ok(new URL(p.url()).searchParams.get('grupo') === 'G3', 'elegir G3 deja ?grupo=G3 en la URL', p.url());
  const t3 = await texto();
  ok(fugas(t3, ['G1', 'G2', 'G4']).length === 0, 'G3: ni un jugador ni un equipo de G1, G2 o G4', fugas(t3, ['G1', 'G2', 'G4']).join(', '));
  ok(nombresDe(['G3']).every((n) => norm(t3).includes(norm(n.split(',')[0]))), 'G3: salen sus jugadores');
  ok((await resumen()) === '4 personas de los 3 equipos con partidos jugados, hasta la jornada 2.', 'G3: cabecera con sus 4 personas, 3 equipos y su jornada (2 partidos jugados)', await resumen());
  const lider3 = await p.locator('#lideres .lg-lider').first().locator('li').first().textContent();
  ok(/Sint Gtres, Alfa/i.test(lider3) && /50,0/.test(lider3), 'G3: el líder en puntos por partido es del G3 (Alfa, 50,0), no el del G4 (60)', lider3);
  ok((await p.locator('details.lg-ranking summary').innerText()).includes('G3 · DOM MAÑ G3 (3 equipos)'), 'G3: ranking de sus 3 equipos', await p.locator('details.lg-ranking summary').innerText());
  ok((await p.locator('.lg-todos label', { hasText: /^Grupo/ }).count()) === 0 && (await p.locator('.lg-todos .lg-check').count()) === 0, 'G3: la tabla no ofrece otro grupo ni «Solo Maccabis»');
  const equiposSel = await p.locator('.lg-todos label', { hasText: /^Equipo/ }).locator('option').allInnerTexts();
  ok(equiposSel.slice(1).every((x) => equiposDe(['G3']).includes(x)) && equiposSel.length === 4, 'G3: el filtro de equipo solo lista los del G3', equiposSel.join(' | '));
  await p.locator('nav.lg-indice a', { hasText: 'Ranking de equipos' }).click();
  ok(new URL(p.url()).searchParams.get('grupo') === 'G3' && p.url().endsWith('#ranking'), 'ir a Ranking (o a Líderes, Todos) mantiene ?grupo=G3', p.url());
  ok(await sinDesbordar(p), 'G3: sin desbordar');
  await p.goto(`${APP}/liga/consolidada?grupo=G4`);
  ok(fugas(await texto(), ['G1', 'G2', 'G3']).length === 0 && /Sint Gcuatro, Epsilon/i.test(await texto()), 'G4: solo el G4');
  await p.goto(`${APP}/liga/consolidada?grupo=G5`);
  ok(/Todavía no hay datos de liga cargados de G5 · SAB TAR G1/.test(await texto()) && fugas(await texto(), ['G1', 'G2', 'G3', 'G4']).length === 0, 'G5 sin hojas: lo dice, sin enseñar nada de otro grupo');

  console.log('\n== Scouting rivales: cualquier equipo de G3-G6, con sesión');
  await p.goto(`${APP}/liga/scouting?e=${encodeURIComponent('Sint Ajeno Tres A')}`);
  const h2 = await p.locator('.lg-cab-equipo h2').textContent();
  ok(h2.includes('Sint Ajeno Tres A') && h2.includes('G3 · DOM MAÑ G3'), 'Scouting abre un equipo del G3, con su grupo', h2);
  const tabla = await p.getByTestId('tabla-scouting').innerText();
  ok(/Sint Gtres, Alfa/i.test(tabla) && /Sint Gtres, Beta/i.test(tabla) && fugas(tabla, ['G1', 'G2', 'G4']).length === 0, 'su tabla: sus jugadores, nadie de otro grupo', tabla);
  ok((await p.locator('.lg-prox').count()) === 0 && (await p.getByTestId('claves-partido').count()) === 0, 'sin «próximo partido contra nosotros» ni claves (no juega contra nosotros)');
  const grupos = await p.locator('select[name="e"] optgroup').evaluateAll((g) => g.map((x) => x.label));
  ok(JSON.stringify(grupos) === JSON.stringify(['G1 · MdA', 'G2 · MdL', 'G3 · DOM MAÑ G3', 'G4 · DOM TAR']), 'el desplegable agrupa los equipos por grupo, con los ajenos', grupos.join(' | '));
  ok((await p.getByRole('link', { name: 'Ver todos los jugadores del G3' }).getAttribute('href')) === '/liga/consolidada?grupo=G3#todos', 'el enlace a todos los jugadores lleva al G3 en la Liga consolidada');
  await p.locator('select[name="e"]').selectOption('Sint Ajeno Cuatro B');
  await p.getByRole('button', { name: 'Ver' }).click();
  await p.waitForURL(/e=Sint/);
  ok(/Sint Gcuatro, Zeta/i.test(await p.getByTestId('tabla-scouting').innerText()), 'el desplegable abre un equipo del G4');
  await p.goto(`${APP}/liga/scouting?e=MdA`);
  ok(/dobla/.test(await p.getByTestId('tabla-scouting').innerText()) && fugas(await texto(), ['G3', 'G4']).filter((x) => !equiposDe(['G3', 'G4']).map(norm).includes(x)).length === 0, 'nuestro equipo, como siempre (con «dobla»), sin jugadores ajenos');
  await p.context().close();

  ok(e.errores.length === 0, 'sin errores de JavaScript', e.errores.join(' | '));
} finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
