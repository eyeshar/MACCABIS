#!/usr/bin/env node
// «Claves del partido» (D174): clavesRival (src/lib/scouting/claves.ts), cada regla con sus umbrales por los dos lados,
// pocos datos, historial dudoso que no sale, orden, tope y textos. Datos sintéticos; sin base de datos ni navegador.
//
//   npm run pruebas:claves
import fs from 'node:fs';
import { AJUSTES, clavesRival, lineaClave, primerasClaves } from '../src/lib/scouting/claves.ts';

let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

// --------------------------------------------------------------------------------------------- escenario sintético
// Grupo de seis equipos: «Rival» (el que se estudia), cuatro más y MdA. Todos los demás anotan 50 en todos sus partidos con
// 3 triples, 8/12 en libres y 15 faltas: la media del grupo (sin contar al rival ni sus partidos) es exacta y los
// umbrales se prueban al punto. Cada partido de Rival lleva sus propios números.
const OTROS = ['Beta', 'Gama', 'Delta', 'Eta'];
const BASE = { pts: 50, t2: 0, t3: 3, tl: 8, tl_int: 12, faltas: 15 };
const est = (o = {}) => ({ ...BASE, ...o });
// Emparejamientos por jornada (el rival siempre es el primero). MdA juega contra Eta (J1), Delta (J2), Beta (J3) y Gama (J4).
const CALENDARIO = {
  1: [['Rival', 'Beta'], ['Gama', 'Delta'], ['Eta', 'MdA']],
  2: [['Rival', 'Gama'], ['Beta', 'Eta'], ['Delta', 'MdA']],
  3: [['Rival', 'Delta'], ['Gama', 'Eta'], ['Beta', 'MdA']],
  4: [['Rival', 'Eta'], ['Beta', 'Delta'], ['Gama', 'MdA']],
};

/** Los partidos del grupo. `r[j]` = lo del rival en la jornada j (pf, pc, y su hoja); `extra[j]` = cambios de otros partidos. */
function partidos({ jornadas = 3, r = [], suyos = {}, nuestros = {}, incomp = [] } = {}) {
  const out = [];
  for (let j = 1; j <= jornadas; j++) {
    for (const [a, b] of CALENDARIO[j]) {
      if (a === 'Rival') {
        const x = r[j - 1] ?? {};
        const pf = x.pf ?? 50, pc = x.pc ?? 50;
        out.push({ id: `g-j${j}-rival`, jornada: j, local: 'Rival', visitante: b, pl: pf, pv: pc, est: { local: est({ pts: pf, ...(x.est ?? {}) }), visitante: est({ pts: pc }) } });
      } else if (b === 'MdA') {
        const n = nuestros[j] ?? {};
        const pf = n.pf ?? 50, pc = n.pc ?? 50;   // pf = los de MdA
        out.push({ id: `g-j${j}-mda`, jornada: j, local: a, visitante: 'MdA', pl: pc, pv: pf, est: { local: est({ pts: pc, ...(n.rival ?? {}) }), visitante: est({ pts: pf, ...(n.est ?? {}) }) } });
      } else {
        out.push({ id: `g-j${j}-${a}-${b}`, jornada: j, local: a, visitante: b, pl: 50, pv: 50, est: { local: est(), visitante: est() } });
      }
    }
  }
  for (const [jornada, no_presentado] of incomp) out.push({ id: `inc-${jornada}`, jornada, local: no_presentado, visitante: 'Zeta', pl: null, pv: null, incomparecencia: true, no_presentado });
  return out;
}

/** Ocho jugadores por equipo, repartidos por igual: nadie destaca por nada. Cada equipo, en n partidos. */
function plantilla(equipo, n, cambios = {}) {
  return Array.from({ length: 8 }, (_, i) => {
    const base = {
      grupo: 'G1', equipo, nombre: `${equipo.toUpperCase()} JUGADOR${i + 1}, NOMBRE`, dorsal: String(i + 1), pj: n, segundos: 1500 * n,
      pts: Math.round((50 * n) / 8), p2a: 3, p3a: i === 0 ? 2 : 1, tla: 6, tli: 10, faltas: 2 * n,
    };
    return { ...base, ...(cambios[i] ?? {}) };
  });
}
function jugadoresDe({ n = 3, rival = {}, resto = {} } = {}) {
  return ['Rival', ...OTROS, 'MdA'].flatMap((q) => plantilla(q, n, q === 'Rival' ? rival : resto));
}
const entrada = (o = {}) => ({ equipo: 'Rival', nuestro: 'MdA', partidos: partidos(o), jugadores: jugadoresDe({ n: o.jornadas ?? 3, rival: o.rival, resto: o.resto }), historial: null, ...(o.entrada ?? {}) });
const claves = (o = {}, opc = { tope: 0 }) => clavesRival(entrada(o), opc);
const hay = (res, regla) => res.claves.find((c) => c.regla === regla);

// Marcadores del rival: [pf, pc] por partido.
const marcadores = (...v) => v.map(([pf, pc = 50]) => ({ pf, pc }));
const conEst = (pf, e, pc = 50) => ({ pf, pc, est: e });

console.log('\n== Pocos datos');
{
  const dos = claves({ jornadas: 2 });
  ok(dos.pocosDatos === 'Pocos datos: 2 partidos jugados' && dos.claves.length === 0 && dos.partidos === 2, 'con 2 partidos: «Pocos datos: 2 partidos jugados» y ninguna clave', JSON.stringify(dos));
  const tres = claves();
  ok(tres.pocosDatos === null && tres.partidos === 3, 'con 3 partidos ya se calculan (el mínimo es 3)');
  const uno = clavesRival({ ...entrada({ jornadas: 1 }) });
  ok(uno.pocosDatos === 'Pocos datos: 1 partido jugado', 'singular: «1 partido jugado»', uno.pocosDatos);
  const cero = clavesRival({ ...entrada({ jornadas: 1 }), partidos: [] });
  ok(cero.pocosDatos === 'Pocos datos: 0 partidos jugados', 'sin partidos: «0 partidos jugados»', cero.pocosDatos);
  const incomp = claves({ jornadas: 2, incomp: [[3, 'Rival']] });
  ok(incomp.pocosDatos === 'Pocos datos: 2 partidos jugados', 'una incomparecencia no cuenta como partido jugado', incomp.pocosDatos);
}

console.log('\n== Equipo normal: ninguna clave (y la media no cuenta al rival)');
{
  const r = claves({ r: marcadores([60], [40], [60]) });
  ok(r.claves.length === 0, 'un rival dentro de lo normal del grupo: sin claves', r.claves.map((c) => c.regla).join(','));
  const p = claves({ r: marcadores([100], [100], [100]) });
  ok(hay(p, 'puntos')?.referencia === 50, 'la media del grupo no cuenta al propio rival (50,0 aunque él anote 100)', String(hay(p, 'puntos')?.referencia));
}

console.log('\n== 1) Cómo anotan: puntos por partido (umbral del 20 % por los dos lados)');
{
  const alto = hay(claves({ r: marcadores([60], [60], [60]) }), 'puntos');
  ok(alto?.tipo === 'cuidado' && alto.texto === 'Anotan 60,0 puntos por partido (media del grupo: 50,0)' && alto.etiqueta === 'Cuidado', 'justo +20 %: sale (Cuidado), coma decimal', JSON.stringify(alto));
  ok(!hay(claves({ r: marcadores([60], [60], [59]) }), 'puntos'), '+19,3 %: no sale');
  const bajo = hay(claves({ r: marcadores([40], [40], [40]) }), 'puntos');
  ok(bajo?.tipo === 'aprovechar' && bajo.etiqueta === 'Aprovechar', 'justo −20 %: sale (Aprovechar)', JSON.stringify(bajo));
  ok(!hay(claves({ r: marcadores([40], [40], [41]) }), 'puntos'), '−19,7 %: no sale');
  const enc = hay(claves({ r: marcadores([50, 60], [50, 60], [50, 60]) }), 'encajados');
  ok(enc?.tipo === 'aprovechar' && enc.texto === 'Encajan 60,0 puntos por partido (media del grupo: 50,0)', 'encajan +20 %: Aprovechar', JSON.stringify(enc));
  ok(hay(claves({ r: marcadores([50, 40], [50, 40], [50, 40]) }), 'encajados')?.tipo === 'cuidado', 'encajan −20 %: Cuidado');
  ok(!hay(claves({ r: marcadores([50, 59], [50, 60], [50, 60]) }), 'encajados'), 'encajan +19,3 %: no sale');
}

console.log('\n== 1) Cómo anotan: dependencia (primero > 35 % o los dos primeros > 55 %)');
{
  // 150 puntos en 3 partidos. A mete 53 (35,3 %): sale; 52 (34,7 %): no. El resto, repartido.
  const rep = (a, b = 0) => { const resto = 150 - a - b; const base = Math.floor(resto / (b ? 6 : 7)); const c = {}; for (let i = 0; i < 8; i++) c[i] = { pts: base }; c[0] = { pts: a }; if (b) c[1] = { pts: b }; c[7] = { pts: c[7].pts + (resto - base * (b ? 6 : 7)) }; return c; };
  const d1 = hay(claves({ rival: rep(53) }), 'dependencia');
  ok(d1?.tipo === 'cuidado' && /^El 35 % de sus puntos los mete Nombre Rival Jugador1$/.test(d1.texto), 'el primero mete el 35,3 %: «El 35 % de sus puntos los mete X»', d1?.texto);
  ok(!hay(claves({ rival: rep(52) }), 'dependencia'), 'el primero mete el 34,7 %: no sale');
  const d2 = hay(claves({ rival: rep(41, 42) }), 'dependencia');
  ok(d2?.tipo === 'cuidado' && /^Nombre Rival Jugador\d y Nombre Rival Jugador\d meten el 55 % de sus puntos$/.test(d2.texto), 'los dos primeros meten el 55,3 %: «X y Y meten el 55 % de sus puntos»', d2?.texto);
  ok(!hay(claves({ rival: rep(41, 41) }), 'dependencia'), 'los dos primeros meten el 54,7 %: no sale');
  const solo1 = claves({ rival: { ...rep(60), 0: { pts: 60, pj: 1 } } });
  ok(!hay(solo1, 'dependencia'), 'quien no llega al mínimo de partidos (D169) no cuenta: 60 puntos en 1 partido, nada');
}

console.log('\n== 1) Cómo anotan: triples por partido, parte de triple, quién los tira, mezcla');
{
  const t = (...v) => v.map((x) => conEst(50, { t3: x }));
  const alto = hay(claves({ r: t(4, 4, 3.0) }), 'triples');
  ok(alto?.tipo === 'cuidado' && alto.texto === 'Meten 3,7 triples por partido (media del grupo: 3,0)', '+22 % en triples: Cuidado', JSON.stringify(alto));
  ok(!hay(claves({ r: t(4, 3, 3) }), 'triples'), '+11 %: no sale');
  ok(hay(claves({ r: t(2, 2, 2) }), 'triples')?.tipo === 'aprovechar', '−33 %: Aprovechar');
  const parte = hay(claves({ r: t(4, 4, 4) }), 'triples_parte');
  ok(parte?.tipo === 'cuidado' && parte.texto === 'El 24 % de sus puntos son de triple (media del grupo: 18 %)', 'parte de sus puntos de triple', JSON.stringify(parte));
  ok(!hay(claves({ r: t(3, 3, 3) }), 'triples_parte'), 'en la media: no sale');
  // quién tira los triples: 4 de 10 (40 %) sale; 4 de 11 no; con menos de 5 triples en el equipo no sale
  const tj = (a, resto) => { const c = { 0: { p3a: a } }; for (let i = 1; i < 8; i++) c[i] = { p3a: i <= resto ? 1 : 0 }; return c; };
  const j40 = hay(claves({ rival: tj(4, 6) }), 'triples_jugador');
  ok(j40?.tipo === 'cuidado' && /mete el 40 % de sus triples \(4 de 10\)$/.test(j40.texto), 'uno mete el 40 % de los triples: «mete el 40 % de sus triples (4 de 10)»', j40?.texto);
  ok(!hay(claves({ rival: tj(4, 7) }), 'triples_jugador'), '36 %: no sale');
  ok(!hay(claves({ rival: tj(4, 0) }), 'triples_jugador'), 'con 4 triples en todo el equipo, no sale (ruido)');
  ok(!hay(claves({ rival: { ...tj(5, 5), 0: { p3a: 5, pj: 1 } } }), 'triples_jugador'), 'quien no llega al mínimo de partidos no cuenta');
  // mezcla: tiros libres como parte de los puntos
  const mez = hay(claves({ r: [10, 10, 10].map((x) => conEst(50, { tl: x })) }), 'mezcla');
  ok(mez?.tipo === 'ojo' && mez.texto === 'El 20 % de sus puntos son de tiro libre (media del grupo: 16 %)', 'mucho tiro libre: «El 20 % de sus puntos son de tiro libre»', JSON.stringify(mez));
  ok(!hay(claves({ r: [9, 9, 9].map((x) => conEst(50, { tl: x })) }), 'mezcla'), '+12,5 %: no sale');
}

console.log('\n== 2) Tiros libres y faltas');
{
  const tl = (a, i) => [0, 1, 2].map(() => conEst(50, { tl: a, tl_int: i }));
  const bajo = hay(claves({ r: tl(4, 12) }), 'tl_equipo');
  ok(bajo?.tipo === 'aprovechar' && bajo.texto === 'Meten 12 de 36 en libres, el 33 % (media del grupo: 67 %)', 'TL% del equipo muy por debajo: Aprovechar', JSON.stringify(bajo));
  const alto = hay(claves({ r: tl(12, 15) }), 'tl_equipo');
  ok(alto?.tipo === 'ojo', 'TL% del equipo justo +20 % (80 % frente a 67 %): Ojo', JSON.stringify(alto));
  ok(!hay(claves({ r: tl(11, 15) }), 'tl_equipo'), '73 %: no sale');
  ok(!hay(claves({ r: tl(1, 3) }), 'tl_equipo'), 'con 9 tiros libres intentados (menos de 10) no sale, aunque sea 33 %');
  ok(hay(claves({ r: tl(1, 4) }), 'tl_equipo'), 'con 12 intentados (más de 10) sí');

  // jugadores que tiran mal: referencia del grupo 60 % (6/10 en los demás); umbral 45 % con 6+ intentos y minutos
  const p = (tla, tli, extra = {}) => ({ 0: { tla, tli, ...extra } });
  const mal = hay(claves({ rival: p(9, 20) }), 'tl_jugadores');
  ok(mal?.tipo === 'aprovechar' && mal.texto === 'Nombre Rival Jugador1: 9 de 20 en libres (media del grupo: 60 %)', 'jugador a 15 puntos de la media (45 % frente a 60 %): «X: 9 de 20 en libres»', mal?.texto);
  ok(!hay(claves({ rival: p(10, 20) }), 'tl_jugadores'), '50 % (10 puntos por debajo): no sale');
  ok(!hay(claves({ rival: p(0, 5) }), 'tl_jugadores'), 'con 5 intentos (menos de 6): no sale');
  ok(hay(claves({ rival: p(2, 6) }), 'tl_jugadores'), 'con 6 intentos sí');
  ok(!hay(claves({ rival: p(2, 12, { segundos: 3 * 540 }) }), 'tl_jugadores'), 'solo entre los que juegan minutos: 9 min por partido, no sale');
  ok(!hay(claves({ rival: p(2, 12, { pj: 1, segundos: 1500 }) }), 'tl_jugadores'), 'ni quien no llega al mínimo de partidos');
  const dos = hay(claves({ rival: { 0: { tla: 4, tli: 12 }, 1: { tla: 2, tli: 8 }, 2: { tla: 3, tli: 10 } } }), 'tl_jugadores');
  ok(dos && dos.texto.split(';').length === 2, 'como mucho dos jugadores en la clave', dos?.texto);

  const f = (x) => [0, 1, 2].map(() => conEst(50, { faltas: x }));
  ok(hay(claves({ r: f(18) }), 'faltas_equipo')?.tipo === 'aprovechar', 'faltas +20 %: Aprovechar', JSON.stringify(hay(claves({ r: f(18) }), 'faltas_equipo')));
  ok(hay(claves({ r: f(18) }), 'faltas_equipo')?.texto === 'Cometen 18,0 faltas por partido (media del grupo: 15,0)', 'texto de faltas por partido');
  ok(!hay(claves({ r: f(17) }), 'faltas_equipo'), 'faltas +13 %: no sale');
  ok(hay(claves({ r: f(12) }), 'faltas_equipo')?.tipo === 'contexto', 'faltas −20 %: Contexto');
  ok(!hay(claves({ r: f(13) }), 'faltas_equipo'), 'faltas −13 %: no sale');

  // jugador importante con 3,5 faltas por partido o más (de los que más anotan o más minutos juegan)
  const fj = (faltas, extra = {}) => ({ 0: { faltas, pts: 40, ...extra } });
  const fa = hay(claves({ rival: fj(11) }), 'faltas_jugador');   // 11 faltas / 3 partidos = 3,67
  ok(fa?.tipo === 'aprovechar' && /: 3,7 faltas por partido$/.test(fa.texto), 'importante con 3,7 faltas por partido: Aprovechar', fa?.texto);
  ok(!hay(claves({ rival: fj(10) }), 'faltas_jugador'), '3,33 faltas por partido: no sale');
  ok(/: 7,0 faltas por partido$/.test(hay(claves({ rival: fj(21) }), 'faltas_jugador')?.texto ?? ''), 'el límite es por partido: 21 faltas en 3 partidos = 7,0');
  ok(!hay(claves({ rival: { 7: { faltas: 30, pts: 1, segundos: 3 * 300 } } }), 'faltas_jugador'), 'un jugador que no es de los importantes (poco anota y poco juega) no sale');
  const tlp = [0, 1, 2].map(() => conEst(50, { tl_int: 18 }));
  ok(hay(claves({ r: tlp }), 'tl_provocan')?.tipo === 'cuidado', 'tiros libres que provocan +50 %: Cuidado');
  ok(!hay(claves({ r: [0, 1, 2].map(() => conEst(50, { tl_int: 14 })) }), 'tl_provocan'), '+17 %: no sale');
}

console.log('\n== 3) Rotación');
{
  const pj = (...v) => { const c = {}; v.forEach((x, i) => { c[i] = { pj: x }; }); for (let i = v.length; i < 8; i++) c[i] = { pj: 0 }; return c; };
  const corto = hay(claves({ rival: pj(3, 3, 3, 3, 3, 2, 2) }), 'rotacion');   // 19 jugadores-partido / 3 = 6,33 (−20,8 %)
  ok(corto?.tipo === 'ojo' && corto.texto === 'Banquillo corto: 6,3 jugadores de media (media del grupo: 8,0)', 'banquillo corto: «6,3 jugadores de media»', JSON.stringify(corto));
  ok(!hay(claves({ rival: pj(3, 3, 3, 3, 3, 3, 2) }), 'rotacion'), '6,67 jugadores (−16,7 %): no sale');
  const jug = (n) => [...jugadoresDe(), ...Array.from({ length: n }, (_, i) => ({ ...plantilla('Rival', 3)[0], nombre: `EXTRA ${i}, X`, pts: 0, p3a: 0, tla: 0, tli: 0, faltas: 0 }))];
  const am = hay(claves({ entrada: { jugadores: jug(2) } }), 'rotacion');   // 10 jugadores (+25 %)
  ok(am?.tipo === 'contexto' && /^Rotación amplia: 10,0 jugadores de media/.test(am.texto), 'rotación amplia (+25 %): Contexto', JSON.stringify(am));

  const conc = (top, resto) => { const c = {}; for (let i = 0; i < 8; i++) c[i] = { segundos: i < 5 ? top : resto }; return c; };
  const m = hay(claves({ rival: conc(5700, 1000) }), 'minutos_concentrados');
  ok(m?.tipo === 'ojo' && /^Sus 5 primeros juegan el \d+ % de los minutos \(media del grupo: 63 %\)$/.test(m.texto), 'minutos concentrados en 5 jugadores: Ojo', JSON.stringify(m));
  ok(!hay(claves({ rival: conc(4500, 4500) }), 'minutos_concentrados'), 'reparto igual (63 %): no sale');

  // su jugador más peligroso ha venido a menos de 2 de cada 3 partidos (hacen falta 4 partidos: el mínimo de D169 es 2)
  const pe = (pj) => ({ 0: { pj, pts: 60, segundos: pj * 1500 } });
  const a = hay(claves({ jornadas: 4, rival: pe(2) }), 'peligroso_ausente');
  ok(a?.tipo === 'ojo' && a.texto === 'Nombre Rival Jugador1 (30,0 puntos por partido) ha venido a 2 de 4 partidos', '«X ha venido a 2 de 4 partidos»', a?.texto);
  ok(!hay(claves({ jornadas: 4, rival: pe(3) }), 'peligroso_ausente'), '3 de 4 (75 %): no sale');
  ok(!hay(claves({ jornadas: 3, rival: pe(2) }), 'peligroso_ausente'), '2 de 3 (justo 2 de cada 3): no sale');
  ok(!hay(claves({ jornadas: 4, rival: pe(1) }), 'peligroso_ausente'), 'con 1 partido no llega al mínimo de D169: no es «el más peligroso»');
}

console.log('\n== 4) Forma y contexto');
{
  const r3 = hay(claves({ r: marcadores([60], [60], [60]) }), 'racha');
  ok(r3?.tipo === 'contexto' && r3.texto === 'Llevan 3 victorias seguidas', 'racha de 3 victorias', JSON.stringify(r3));
  ok(hay(claves({ r: marcadores([40], [40], [40]) }), 'racha')?.texto === 'Llevan 3 derrotas seguidas', 'racha de 3 derrotas');
  ok(!hay(claves({ r: marcadores([60], [40], [60]) }), 'racha'), 'G, P, G: sin racha');
  ok(hay(claves({ jornadas: 4, r: marcadores([40], [60], [60], [60]) }), 'racha')?.texto === 'Llevan 3 victorias seguidas', 'la racha cuenta desde el último partido');
  ok(!hay(claves({ jornadas: 4, r: marcadores([60], [60], [40], [60]) }), 'racha'), 'una derrota en medio la corta');

  ok(hay(claves({ r: marcadores([65, 50], [65, 50], [65, 50]) }), 'paliza')?.texto === 'Ganan por 15 o más en 3 de 3 partidos', 'paliza: ganan por 15 o más (justo 15)');
  ok(hay(claves({ r: marcadores([50, 65], [50, 65], [50, 65]) }), 'paliza')?.texto === 'Pierden por 15 o más en 3 de 3 partidos', 'pierden por paliza');
  ok(!hay(claves({ r: marcadores([64, 50], [64, 50], [64, 50]) }), 'paliza'), '14 de diferencia: no es paliza');
  ok(!hay(claves({ r: marcadores([70, 50], [50, 50], [50, 50]) }), 'paliza'), 'una sola paliza: no sale (hacen falta 2 y la mitad)');
  ok(hay(claves({ jornadas: 4, r: marcadores([70, 50], [70, 50], [50, 50], [50, 50]) }), 'paliza'), '2 de 4 (la mitad): sale');
  ok(hay(claves({ r: marcadores([55, 50], [55, 50], [45, 50]) }), 'apretados')?.texto === '3 de sus 3 partidos se han decidido por 5 puntos o menos', 'partidos apretados (5 puntos o menos)', JSON.stringify(hay(claves({ r: marcadores([55, 50], [55, 50], [45, 50]) }), 'apretados')));
  ok(!hay(claves({ r: marcadores([56, 50], [56, 50], [56, 50]) }), 'apretados'), '6 de diferencia: no es apretado');

  // rivales comunes: Beta (Rival J1, MdA J3) y Delta (Rival J3, MdA J2). Con Beta, los márgenes iguales (+5 y +5).
  const nos = (j2) => ({ 1: { pf: 52, pc: 50 }, 2: j2, 3: { pf: 55, pc: 50 } });
  const rv = (j3) => marcadores([55, 50], [50, 50], j3);
  const c = hay(claves({ r: rv([70, 50]), nuestros: nos({ pf: 55, pc: 50 }) }), 'comunes');
  ok(c?.tipo === 'contexto' && c.texto === 'Ganaron a Delta de 20; nosotros ganamos de 5', 'rival común: «Ganaron a Delta de 20; nosotros ganamos de 5»', JSON.stringify(c));
  ok(!hay(claves({ r: rv([60, 50]), nuestros: nos({ pf: 55, pc: 50 }) }), 'comunes'), 'márgenes de 10 y 5 (5 de diferencia): no sale');
  ok(hay(claves({ r: rv([65, 50]), nuestros: nos({ pf: 55, pc: 50 }) }), 'comunes')?.texto === 'Ganaron a Delta de 15; nosotros ganamos de 5', 'márgenes de 15 y 5 (justo 10 de diferencia): sale');
  const dist = hay(claves({ r: rv([60, 50]), nuestros: nos({ pf: 49, pc: 50 }) }), 'comunes');
  ok(dist?.texto === 'Ganaron a Delta de 10; nosotros perdimos de 1', 'resultado distinto (ganaron ellos, perdimos nosotros): sale aunque la diferencia sea pequeña', dist?.texto);
  const perd = hay(claves({ r: rv([40, 50]), nuestros: nos({ pf: 60, pc: 50 }) }), 'comunes');
  ok(perd?.texto === 'Perdieron con Delta de 10; nosotros ganamos de 10', 'Perdieron con …; nosotros ganamos de …', perd?.texto);
  ok(!hay(claves({ r: rv([70, 50]), nuestros: nos({ pf: 55, pc: 50 }), entrada: { nuestro: 'Otro' } }), 'comunes'), 'sin partidos nuestros contra el mismo rival: no sale');

  const inc = hay(claves({ incomp: [[4, 'Rival']] }), 'incomparecencias');
  ok(inc?.tipo === 'contexto' && inc.texto === 'No se presentó a 1 partido (J4); sus puntos salen de la clasificación oficial', 'incomparecencia: lo dice y remite a la clasificación oficial (D74)', JSON.stringify(inc));
  ok(!hay(claves({ incomp: [[4, 'Zeta']] }), 'incomparecencias'), 'si no se presentó el otro equipo, no es del rival');
  ok(hay(claves({ incomp: [[4, 'Rival'], [5, 'Rival']] }), 'incomparecencias')?.texto.startsWith('No se presentó a 2 partidos (J4, J5)'), 'plural: «2 partidos (J4, J5)»');
  ok(!claves({ jornadas: 3 }).claves.some((x) => /casa|fuera/i.test(x.texto)), 'no hay clave de casa/fuera (todos juegan en Moratalaz, D129)');
}

console.log('\n== 5) Cruce con nosotros');
{
  // Rival mete 5 triples por partido y a MdA le meten 5 (rivales de MdA con t3 5 en sus partidos con nosotros)
  const rt3 = [0, 1, 2].map(() => conEst(50, { t3: 5 }));
  const contraNos = { 1: { rival: { t3: 5 } }, 2: { rival: { t3: 5 } }, 3: { rival: { t3: 5 } } };
  const x = hay(claves({ r: rt3, nuestros: contraNos }), 'cruce_triples');
  ok(x?.tipo === 'cuidado' && /^Meten 5,0 triples por partido y nosotros encajamos 5,0; media del grupo: 3,\d$/.test(x.texto), 'cruce de triples: «Meten 5,0 triples por partido y nosotros encajamos 5,0; media del grupo: 3,x»', JSON.stringify(x));
  ok(!hay(claves({ r: rt3 }), 'cruce_triples'), 'ellos meten muchos pero nosotros encajamos lo normal: sin cruce');
  ok(!hay(claves({ nuestros: contraNos }), 'cruce_triples'), 'nosotros encajamos mucho pero ellos meten lo normal: sin cruce');
  ok(!!hay(claves({ r: rt3 }), 'triples'), '(sigue saliendo su propia clave de triples)');
  const rtl = [0, 1, 2].map(() => conEst(50, { tl_int: 18 }));
  const tlNos = { 1: { rival: { tl_int: 18 } }, 2: { rival: { tl_int: 18 } }, 3: { rival: { tl_int: 18 } } };
  const y = hay(claves({ r: rtl, nuestros: tlNos }), 'cruce_tl');
  ok(y?.tipo === 'cuidado' && /^Provocan 18,0 tiros libres por partido y nosotros concedemos 18,0; media del grupo: /.test(y.texto), 'cruce de tiros libres', JSON.stringify(y));
  ok(!hay(claves({ r: rtl }), 'cruce_tl'), 'sin que nosotros concedamos de más, no hay cruce de libres');
  const rf = [0, 1, 2].map(() => conEst(50, { faltas: 20 }));
  const fNos = { 1: { est: { faltas: 20 } }, 2: { est: { faltas: 20 } }, 3: { est: { faltas: 20 } } };
  const z = hay(claves({ r: rf, nuestros: fNos }), 'cruce_faltas');
  ok(z?.tipo === 'ojo' && /^Cometen 20,0 faltas por partido y nosotros 20,0; media del grupo: 1\d,\d$/.test(z.texto), 'cruce de faltas', JSON.stringify(z));
  ok(!hay(claves({ r: rf }), 'cruce_faltas'), 'sin que nosotros cometamos de más, no hay cruce de faltas');
  // El cruce pesa más que su clave suelta
  const todo = claves({ r: rt3, nuestros: contraNos });
  ok(todo.claves.findIndex((c) => c.regla === 'cruce_triples') < todo.claves.findIndex((c) => c.regla === 'triples'), 'el cruce va por delante de la clave suelta de triples');
}

console.log('\n== 5) Historial contra ellos (solo si el rival se identifica con seguridad)');
{
  const buenos = [
    { fecha: '2026-03-22', pf: 60, pc: 37 }, { fecha: '2025-12-14', pf: 62, pc: 53 }, { fecha: '2025-02-01', pf: 40, pc: 50 },
  ];
  const h = (o) => hay(claves({ entrada: { historial: { partidos: buenos, homonimos: 0, sinRastro: false, ...o } } }), 'historial');
  const x = h({});
  ok(x?.tipo === 'contexto' && x.texto === 'Contra ellos en temporadas anteriores: 2 victorias y 1 derrota; último: ganamos 60-37 (22/3/2026); diferencia media: +7,3', 'historial seguro: victorias y derrotas, último resultado y diferencia media', x?.texto);
  ok(h({ partidos: [{ fecha: '2025-02-01', pf: 40, pc: 50 }] })?.texto === 'Contra ellos en temporadas anteriores: 0 victorias y 1 derrota; último: perdimos 40-50 (1/2/2025); diferencia media: -10,0', 'una derrota: singular y signo');
  ok(h({ partidos: [{ fecha: null, pf: 50, pc: 40 }] })?.texto === 'Contra ellos en temporadas anteriores: 1 victoria y 0 derrotas; diferencia media: +10,0', 'sin fecha no se inventa el último resultado', h({ partidos: [{ fecha: null, pf: 50, pc: 40 }] })?.texto);
  ok(!h({ sinRastro: true }), 'sin rastro en los JDM: no sale');
  ok(!h({ homonimos: 1 }), 'el mismo nombre en otro distrito (homónimos): no sale');
  ok(!h({ partidos: [...buenos, { fecha: '2024-01-01', pf: 50, pc: 40, nota: 'Sólo en el histórico propio del club; el nombre del rival es el que anotó el club.' }] }), 'un partido identificado solo por el nombre: no sale (si hay duda, nada)');
  ok(!h({ partidos: [{ fecha: '2024-01-01', pf: 50, pc: 40, nota: 'Ficha dudosa: el histórico propio anota un partido contra el propio club.' }] }), 'ficha dudosa: no sale');
  ok(!h({ partidos: [] }), 'sin partidos: no sale');
  ok(!hay(claves({}), 'historial'), 'sin historial: no sale');
}

console.log('\n== Orden, tope y determinismo');
{
  // Un rival con muchas cosas a la vez
  const e = { t3: 5, tl: 12, tl_int: 18, faltas: 20 };
  const o = { r: [conEst(70, e, 50), conEst(70, e, 50), conEst(70, e, 50)], nuestros: { 1: { rival: { t3: 5, tl_int: 18 }, est: { faltas: 20 } }, 2: { rival: { t3: 5, tl_int: 18 }, est: { faltas: 20 } }, 3: { rival: { t3: 5, tl_int: 18 }, est: { faltas: 20 } } } };
  const todo = claves(o);
  const pag = clavesRival(entrada(o));
  ok(todo.claves.length > AJUSTES.topPagina && pag.claves.length === AJUSTES.topPagina && pag.disponibles === todo.claves.length, `salen ${todo.claves.length} claves; la página enseña como mucho ${AJUSTES.topPagina}`, `${todo.claves.length}/${pag.claves.length}/${pag.disponibles}`);
  ok(todo.claves.every((c, i, a) => i === 0 || a[i - 1].peso >= c.peso), 'ordenadas por peso, de mayor a menor');
  ok(JSON.stringify(pag.claves) === JSON.stringify(todo.claves.slice(0, 5)), 'la página enseña las 5 primeras');
  ok(primerasClaves(pag).length === 2 && JSON.stringify(primerasClaves(pag)) === JSON.stringify(todo.claves.slice(0, 2)), 'las tarjetas, las 2 primeras');
  ok(JSON.stringify(clavesRival(entrada(o))) === JSON.stringify(clavesRival(entrada(o))), 'determinista: misma entrada, mismas claves');
  const orig = entrada(o), copia = JSON.stringify(orig);
  clavesRival(orig);
  ok(JSON.stringify(orig) === copia, 'no modifica la entrada');
  const baraja = { ...entrada(o), partidos: [...entrada(o).partidos].reverse(), jugadores: [...entrada(o).jugadores].reverse() };
  ok(JSON.stringify(clavesRival(baraja)) === JSON.stringify(clavesRival(entrada(o))), 'el orden de los datos de entrada no cambia el resultado');
  ok(todo.claves.every((c) => c.regla && c.texto && ['cuidado', 'aprovechar', 'ojo', 'contexto'].includes(c.tipo) && typeof c.peso === 'number' && 'valor' in c && 'referencia' in c), 'cada clave lleva tipo, texto, valor, referencia y peso');
  ok(lineaClave(todo.claves[0]).startsWith(`${todo.claves[0].etiqueta}: `), 'la línea lleva delante la etiqueta («Cuidado: …»)');
}

console.log('\n== Textos: solo datos, coma decimal, sin adjetivos sobre personas');
{
  const e = { t3: 5, tl: 12, tl_int: 18, faltas: 20 };
  const o = { r: [conEst(70, e, 50), conEst(70, e, 50), conEst(70, e, 50)], rival: { 0: { pts: 60, tla: 4, tli: 12, faltas: 11 } } };
  const textos = claves(o).claves.map((c) => c.texto);
  ok(textos.length > 4, `${textos.length} textos para revisar`);
  ok(textos.every((t) => !/\d\.\d/.test(t)), 'ninguna cifra con punto decimal');
  const MALOS = /\b(malo|mala|malos|flojo|floja|flojos|torpe|peor|mejor|bueno|buena|pésimo|horrible|terrible|vago|lento|débil|inútil|fatal)\b/i;
  ok(textos.every((t) => !MALOS.test(t)), 'ningún adjetivo sobre personas', textos.filter((t) => MALOS.test(t)).join(' | '));
}

console.log('\n== La función es pura y no toca nada interno');
{
  const src = fs.readFileSync(new URL('../src/lib/scouting/claves.ts', import.meta.url), 'utf8');
  const imports = [...src.matchAll(/^import .* from "(.*)";/gm)].map((m) => m[1]);
  ok(imports.length === 1 && imports[0] === '../jugadoresLiga.ts', 'solo importa jugadoresLiga (sin red, sin base, sin servidor)', imports.join(', '));
  ok(!/fetch\(|supabase|server-only|process\.env|Date\.now|new Date|Math\.random/.test(src), 'sin red, sin base, sin fechas ni azar');
  ok(!/\b(nivel|reserva|dobla|privado|jugadores_privado)\b/i.test(src.replace(/\/\/.*$/gm, '')), 'no menciona niveles ni datos internos (reserva, dobla)');
}

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
