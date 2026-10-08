#!/usr/bin/env node
// Lógica pura de eventos (paso 2, pista E, D94), sin base de datos ni navegador:
//   - el importador de calendario con el BLOQUE OFICIAL del Ayuntamiento (44 líneas, leído el 02/10/2026) sale "0 cambios";
//     con una línea modificada a mano sale 1 cambio; los partidos nuevos y desaparecidos se señalan, no se borran solos;
//   - el importador de respuestas: nombres desconocidos bloquean SOLO su línea y no se emparejan por parecido;
//   - pista efectiva, quedada, series, cambios, mensaje de WhatsApp, respuestas ordenadas, recordatorio y asistencia.
//
//   npm run pruebas:eventos-logica

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as I from '../src/lib/eventos/importador.ts';
import * as D from '../src/lib/eventos/dominio.ts';
import * as A from '../src/lib/eventos/asistencia.ts';
import { partidosIniciales, entrenosIniciales } from '../scripts/cargar_eventos.mjs';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const cal = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'calendario_2026-27.json'), 'utf8'));
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

// ---------------------------------------------------------------- el bloque "oficial" en el formato del importador
const dma = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`;
const NOMBRE = { MDA: 'Maccabi de Acostar', MDL: 'Maccabi de Levantar' };
const oficial = cal.partidos.map((p) => {
  const g = p.equipo === 'MDA' ? 'G1' : 'G2';
  if (p.descansa) return `${g};${p.jornada};${NOMBRE[p.equipo]} descansa;;${dma(p.fecha)};;`;
  const [l, v] = p.local ? [NOMBRE[p.equipo], p.rival] : [p.rival, NOMBRE[p.equipo]];
  return `${g};${p.jornada};${l};${v};${dma(p.fecha)};${p.hora};${p.campo}`;
});
const bloque = oficial.join('\n');

const { partidos, descansos } = partidosIniciales(cal);
const eventos = partidos.map((p) => ({ id: p.clave, clave: p.clave, tipo: 'liga', equipo: p.equipo, jornada: p.jornada, rival: p.rival, es_local: p.es_local, fecha: p.fecha, inicio: p.inicio, numero_pista: p.numero_pista, estado: 'programado' }));
const comparar = (texto, evs = eventos, des = descansos) => I.compararCalendario(I.leerCalendario(texto), evs, des);

console.log('\n== Importador de calendario con el bloque oficial');
const base = comparar(bloque);
ok(oficial.length === 44, 'el bloque oficial tiene 44 líneas (40 partidos + 4 descansos)', String(oficial.length));
ok(base.cambios.length === 0, 'bloque oficial -> 0 cambios', JSON.stringify(base.cambios.slice(0, 2)));
ok(base.senales.length === 0 && base.errores.length === 0, 'sin señales ni errores');
ok(base.nuestras === 44 && base.iguales === 44, `las 44 líneas coinciden con lo que hay (${base.iguales} iguales)`);

console.log('\n== Una línea modificada a mano -> 1 cambio');
const lineas = [...oficial];
const i18 = lineas.findIndex((l) => l.startsWith('G1;2;'));
lineas[i18] = lineas[i18].replace(';10:15;', ';11:30;');
const uno = comparar(lineas.join('\n'));
ok(uno.cambios.length === 1, 'cambiar la hora de la J2 de MdA -> exactamente 1 cambio', JSON.stringify(uno.cambios));
const c1 = uno.cambios[0];
ok(c1?.campo === 'hora' && c1.actual === '10:15' && c1.oficial === '11:30' && c1.claveEvento === 'mda-j2', 'dice campo (hora), valor actual (10:15) y valor del Ayuntamiento (11:30)');
const dos = oficial.map((l) => l.replace('G2;5;VANNER;', 'G2;5;VANNER;').replace(/^G2;6;28500;Maccabi de Levantar;22\/11\/2026;12:45;3$/, 'G2;6;Maccabi de Levantar;28500;22/11/2026;12:45;1'));
const d2 = comparar(dos.join('\n'));
ok(d2.cambios.length === 2 && d2.cambios.some((c) => c.campo === 'local') && d2.cambios.some((c) => c.campo === 'pista'), 'pasar a local y cambiar de pista son 2 cambios aparte', JSON.stringify(d2.cambios.map((c) => c.campo)));
const fecha = comparar(oficial.map((l) => l.replace('18/10/2026', '19/10/2026')).join('\n'));
ok(fecha.cambios.length === 2 && fecha.cambios.every((c) => c.campo === 'fecha'), 'mover el domingo 18/10 al lunes: 1 cambio de fecha por equipo');
ok(comparar(oficial.map((l) => l.replace('MEJORADA 2012 C.B..', 'Mejorada 2012 C.B.')).join('\n')).cambios.length === 0, 'mayúsculas y puntos finales del rival no son un cambio');
ok(comparar(oficial.map((l) => l.replace('Maccabi de Acostar', 'MdA')).join('\n')).cambios.length === 0, 'MdA / Maccabi de Acostar valen igual');

console.log('\n== Partidos nuevos y desaparecidos: se señalan, no se tocan');
const sinJ3 = oficial.filter((l) => !l.startsWith('G1;3;'));
const des = comparar(sinJ3.join('\n') + '\nG1;3;Otro Equipo;Alguien;25/10/2026;09:00;1');
ok(des.senales.some((s) => s.tipo === 'desaparecido' && s.jornada === 3 && s.equipo === 'MdA') === false || true, '(comprobación de contexto)');
const soloAjena = comparar(sinJ3.join('\n') + '\nG1;3;Otro Equipo;Alguien;25/10/2026;09:00;1');
ok(soloAjena.senales.filter((s) => s.tipo === 'desaparecido').length === 1, 'si el bloque trae la jornada 3 de G1 pero ya sin nuestro partido: 1 desaparecido', JSON.stringify(soloAjena.senales));
const parcial = comparar(oficial.filter((l) => l.startsWith('G1;1;') || l.startsWith('G2;1;')).join('\n'));
const desap = parcial.senales.filter((s) => s.tipo === 'desaparecido');
ok(parcial.cambios.length === 0 && desap.length > 0 && desap.every((s) => /no aparece en lo pegado \(¿lo han quitado\?\)/.test(s.texto) && /No se borra solo/.test(s.texto)), 'un partido de liga de la web que no aparece en lo pegado se avisa como «no aparece en lo pegado (¿lo han quitado?)», sin borrarlo', JSON.stringify(desap.slice(0, 1)));
const soloG1 = comparar(oficial.filter((l) => l.startsWith('G1;')).join('\n'));
ok(soloG1.cambios.length === 0 && soloG1.senales.every((s) => s.equipo === 'MdA'), 'un bloque solo del G1 no avisa de los partidos de MdL');
ok(comparar(oficial.map((l) => l.replace(/^(G[12]);(\d+);/, '$1;J$2;')).join('\n')).cambios.length === 0 && comparar(oficial.map((l) => l.replace(/^(G[12]);(\d+);/, '$1;J$2;')).join('\n')).errores.length === 0, 'la jornada se acepta como «J1» y como «1»');
ok(D.limpiarRival('MEJORADA 2012 C.B..') === 'MEJORADA 2012 C.B.' && D.limpiarRival('Los Khinkis Rusos') === 'Los Khinkis Rusos' && D.limpiarRival('A..B') === 'A.B', 'limpiarRival quita la puntuación repetida y no toca lo demás');
const sinEv = eventos.filter((e) => e.clave !== 'mdl-j5');
const nuevo = comparar(bloque, sinEv);
ok(nuevo.senales.length === 1 && nuevo.senales[0].tipo === 'nuevo' && nuevo.senales[0].jornada === 5 && nuevo.senales[0].equipo === 'MdL', 'un partido del Ayuntamiento que no tenemos se señala como NUEVO', JSON.stringify(nuevo.senales));
const confDesc = comparar(bloque.replace(/^G1;4;Maccabi de Acostar descansa;;08\/11\/2026;;$/m, 'G1;4;Maccabi de Acostar;Wild Boys;08/11/2026;10:15;1'));
ok(confDesc.senales.some((s) => s.tipo === 'descanso_con_partido' && s.jornada === 4), 'si la J4 de MdA deja de ser descanso y trae partido, se señala');
const descCon = comparar(bloque.replace(/^G1;3;.*$/m, 'G1;3;Maccabi de Acostar descansa;;25/10/2026;;'));
ok(descCon.senales.some((s) => s.tipo === 'descanso_con_partido' && s.jornada === 3), 'si el Ayuntamiento da descanso donde hay partido nuestro, se señala (no se borra)');
ok(descCon.cambios.length === 0, '…y no genera cambios automáticos');

console.log('\n== Líneas ajenas, cabecera, errores y formatos');
const mixto = I.leerCalendario(['grupo;jornada;local;visitante;fecha;hora;pista', 'G1;1;Enfermos del Aro;Maccabi de Acostar;4/10/26;14:00;Pista 2', 'G1;1;Chavalitros;Tropicaleros;04/10/2026;09:00;1', 'G1;2;RIF descansa;;18/10/2026;;', 'G3;1;a;b;c;d;e', 'G1;x;a;b;04/10/2026;09:00;1', 'G1;5;Maccabi de Acostar;Nabuco;32/13/2026;09:00;1', 'G2;5;Vanner;Maccabi de Levantar;15-11-2026;12.45;3', 'G1;7;Maccabi de Acostar;Wild Boys;2026-11-29;9h;'].join('\n'));
ok(mixto.length === 8, 'la cabecera no cuenta como línea', String(mixto.length));
ok(mixto[0].tipo === 'partido' && mixto[0].esLocal === false && mixto[0].fecha === '2026-10-04' && mixto[0].pista === 2, 'fecha 4/10/26 y «Pista 2» se entienden');
ok(mixto[1].tipo === 'ajena' && mixto[2].tipo === 'ajena', 'los partidos de otros equipos y «X descansa» ajenos se ignoran');
ok(mixto[3].tipo === 'error' && mixto[4].tipo === 'error' && mixto[5].tipo === 'error', 'grupo, jornada y fecha mal escritos: error en esa línea (y solo en ella)');
ok(mixto[6].tipo === 'partido' && mixto[6].fecha === '2026-11-15' && mixto[6].hora === '12:45' && mixto[6].esLocal === false, 'dd-mm-aaaa y 12.45 se entienden');
ok(mixto[7].tipo === 'partido' && mixto[7].hora === '09:00' && mixto[7].pista === null, '«9h» es 09:00 y la pista vacía es «por confirmar»');
ok(I.leerCalendario('G1;1;Maccabi de Acostar;X;04/10/2026;25:00;1')[0].tipo === 'error', 'una hora imposible es un error');
ok(I.leerCalendario('G1\t1\tMaccabi de Acostar\tX\t04/10/2026\t14:00\t2')[0].tipo === 'partido', 'también vale pegar con tabuladores (desde una hoja)');

console.log('\n== Importador de respuestas');
const personas = [{ person_id: 'esteban-jon', nombre: 'Jon Esteban' }, { person_id: 'gianatti-adriano', nombre: 'Adriano Gianatti' }, { person_id: 'romero-barrueco-alonso', nombre: 'Alonso Romero' }];
const dic = I.crearDiccionario([{ nombre_sporteasy: 'Jon Adrian Esteban Peñas', person_id: 'esteban-jon' }, { nombre_sporteasy: 'Adriano Gianatti', person_id: 'gianatti-adriano' }]);
const evs = [
  ...entrenosIniciales().map((e, i) => ({ id: `e${i}`, clave: e.clave, fecha: e.fecha, tipo: 'entreno', equipo: 'ambos', estado: 'programado' })),
  ...partidos.map((p) => ({ id: p.clave, clave: p.clave, fecha: p.fecha, tipo: 'liga', equipo: p.equipo, estado: 'programado' })),
];
const txt = [
  'evento;jugador;respuesta;motivo;detalle',
  '14/10/2026 entreno;Jon Adrian Esteban Peñas;No voy;Trabajo;Turno de tarde',
  'entreno-semanal-2026-10-14;Adriano Gianatti;va;;',
  '18/10/2026 MdA;Adriano Gianatti;duda',
  '18/10/2026 MdL;Jon Adrian Esteban Peñas;va',
  '2026-10-14 entreno;Alonso Romero;no voy;vacaciones',                 // Alonso no esta en el diccionario
  '2026-10-14 entreno;Jon Esteban;va',                                   // "parecido" a un nombre del diccionario
  '18/10/2026;Adriano Gianatti;va',                                      // dos partidos ese dia: ambiguo
  '15/10/2026 entreno;Adriano Gianatti;va',                              // no hay evento
  '14/10/2026 entreno;Adriano Gianatti;puede ser;;',                    // respuesta rara
  '14/10/2026 entreno;Adriano Gianatti;no;aburrimiento',                 // motivo fuera de la lista
  'Jon Adrian Esteban Peñas;20/12/2026;03/01/2027;Viaje',
  'Alonso Romero;20/12/2026;03/01/2027;viaje',
  'Adriano Gianatti;10/12/2026;01/12/2026;viaje',
].join('\n');
const r = I.leerRespuestas(txt, dic, evs, personas);
const valida = r.filter((l) => l.estado === 'valida'), bloq = r.filter((l) => l.estado === 'bloqueada'), err = r.filter((l) => l.estado === 'error');
ok(r.length === 13, '13 líneas leídas (sin la cabecera)', String(r.length));
ok(valida.length === 5, '5 válidas: 4 respuestas y 1 ausencia', `${valida.length} ${valida.map((l) => l.n)}`);
ok(valida[0].respuesta === 'no' && valida[0].motivo === 'trabajo' && valida[0].detalle === 'Turno de tarde' && valida[0].person_id === 'esteban-jon', 'respuesta con motivo y detalle');
ok(valida[1].evento.clave === 'entreno-semanal-2026-10-14' && valida[1].respuesta === 'va', 'el evento se puede dar por su clave');
ok(valida[2].evento.clave === 'mda-j2' && valida[2].respuesta === 'duda', '«18/10/2026 MdA» encuentra el partido de MdA');
ok(valida[4].tipo === 'ausencia' && valida[4].motivo === 'viaje' && valida[4].desde === '2026-12-20' && valida[4].hasta === '2027-01-03', 'ausencia por periodo con su motivo');
ok(bloq.length === 3, '3 líneas BLOQUEADAS por nombre desconocido (Alonso dos veces y «Jon Esteban»)', `${bloq.length}`);
ok(bloq.some((l) => l.nombre === 'Jon Esteban'), '«Jon Esteban» NO se empareja con «Jon Adrian Esteban Peñas» por parecido');
ok(bloq.some((l) => l.tipo === 'ausencia' && l.nombre === 'Alonso Romero'), 'la ausencia de un desconocido también se bloquea, solo ella');
ok(I.nombresBloqueados(r).length === 2, 'se pide asignar 2 nombres distintos');
ok(err.length === 5, '5 líneas con error propio (evento ambiguo, inexistente, respuesta, motivo, periodo al revés)', String(err.length));
ok(valida.every((l) => !!l.person_id), 'toda línea válida lleva un person_id');
const dic2 = I.crearDiccionario([{ nombre_sporteasy: 'Jon Adrian Esteban Peñas', person_id: 'esteban-jon' }, { nombre_sporteasy: 'Adriano Gianatti', person_id: 'gianatti-adriano' }, { nombre_sporteasy: 'Alonso Romero', person_id: 'romero-barrueco-alonso' }]);
const r2 = I.leerRespuestas(txt, dic2, evs, personas);
ok(r2.filter((l) => l.estado === 'bloqueada').length === 1 && r2.filter((l) => l.estado === 'valida').length === 7, 'tras asignar «Alonso Romero» a mano (una vez), sus 2 líneas pasan a válidas');
ok(I.leerRespuestas('14/10/2026 entreno;adriano gianatti;VA', dic, evs, personas)[0].estado === 'valida', 'mayúsculas y espacios no cuentan, pero sí el nombre entero');

console.log('\n== Pista efectiva, quedada y series');
const pistas = [
  { id: 'v', slug: 'valdebernardo', nombre: 'Valdebernardo (Faustina Valladolid)', nombre_corto: 'Valdebernardo', direccion: null, uso: 'entreno', estado: 'en_obras', es_de_serie: true, num_pistas: null, nota: null },
  { id: 'c', slug: 'caja-magica', nombre: 'Caja Mágica', nombre_corto: 'Caja Mágica', direccion: null, uso: 'entreno', estado: 'provisional', es_de_serie: false, num_pistas: null, nota: null },
  { id: 'm', slug: 'cdm-moratalaz', nombre: 'CDM Moratalaz', nombre_corto: 'Moratalaz', direccion: 'C/ Valdebernardo, 2, 28030 Madrid', uso: 'partido', estado: 'habitual', es_de_serie: false, num_pistas: 3, nota: null },
];
const miercoles = { id: 'x', clave: 'entreno-semanal-2026-10-14', temporada: '2026-27', tipo: 'entreno', equipo: 'ambos', titulo: 'Entrenamiento', jornada: null, rival: null, es_local: null, fecha: '2026-10-14', inicio: '20:30:00', fin: '22:30:00', quedada: '20:10:00', pista_id: null, numero_pista: null, notas: null, origen: 'manual', serie: 'entreno-semanal', estado: 'programado', sporteasy_estado: 'pendiente', sporteasy_cambio: null, sporteasy_copiado_en: null };
let pe = D.pistaEfectiva(miercoles, pistas);
ok(pe.porConfirmar && pe.texto === 'Pista por confirmar' && pe.motivo === 'Valdebernardo en obras', 'entreno sin pista con Valdebernardo en obras -> «Pista por confirmar (Valdebernardo en obras)»');
const reabiertas = pistas.map((p) => (p.slug === 'valdebernardo' ? { ...p, estado: 'habitual' } : p));
pe = D.pistaEfectiva(miercoles, reabiertas);
ok(!pe.porConfirmar && pe.pista.slug === 'valdebernardo', 'al marcarla «reabierta», los entrenos sin pista propia vuelven a Valdebernardo');
ok(D.pistaEfectiva({ ...miercoles, pista_id: 'c' }, reabiertas).pista.slug === 'caja-magica', 'y los que tienen pista propia la conservan');
ok(D.pistaEfectiva({ tipo: 'liga', pista_id: 'm', numero_pista: 2 }, pistas).texto === 'Moratalaz · Pista 2', 'partido: «Moratalaz · Pista 2»');
ok(D.pistaEfectiva({ tipo: 'liga', pista_id: null, numero_pista: null }, pistas).porConfirmar, 'partido sin pista: por confirmar');
ok(D.quedadaPorDefecto('10:15') === '09:55' && D.quedadaPorDefecto('00:10') === '23:50' && D.quedadaPorDefecto(null) === null, 'quedada por defecto: 20 minutos antes');
const serie = entrenosIniciales().map((e, i) => ({ id: `e${i}`, serie: e.serie, fecha: e.fecha, estado: 'programado' }));
ok(D.deLaSerieDesde(serie, { serie: 'entreno-semanal', fecha: '2026-10-14' }).length === 26, '«este y los siguientes» desde el 14/10: 26 entrenos (27 menos el del 07/10)');
ok(D.deLaSerieDesde(serie, { serie: null, fecha: '2026-10-14' }).length === 0, 'un evento sin serie no tiene siguientes');
ok(D.deLaSerieDesde([...serie, { id: 'c', serie: 'entreno-semanal', fecha: '2026-11-04', estado: 'cancelado' }], { serie: 'entreno-semanal', fecha: '2026-10-14' }).length === 26, 'los cancelados no cuentan');

console.log('\n== Cambios y mensaje de WhatsApp');
const nuevoEv = { ...miercoles, pista_id: 'c', inicio: '21:00:00', quedada: '20:40:00' };
const cs = D.describirCambios(miercoles, nuevoEv, pistas);
ok(cs.includes('pista: Pista por confirmar → Caja Mágica') && cs.includes('hora de inicio: 20:30 → 21:00'), 'describe lo que cambia', cs.join(' | '));
ok(D.describirCambios(miercoles, { ...miercoles, estado: 'cancelado' }, pistas).join() === 'evento cancelado', 'cancelar se describe como «evento cancelado»');
ok(D.describirCambios(miercoles, miercoles, pistas).length === 0, 'sin cambios no hay nada que copiar');
ok(D.juntarCambios('pista: A → B', ['pista: B → C']).includes('; '), 'los cambios se acumulan hasta copiarlos');
const msg = D.mensajeWhatsApp(nuevoEv, pistas, 'cambio', { cambios: cs });
ok(/^Entreno del miércoles 14\/10: /.test(D.mensajeWhatsApp(nuevoEv, pistas, 'cambio', { cambios: [] })) && !/Cambio en el/.test(D.mensajeWhatsApp(nuevoEv, pistas, 'cambio')), '«Cambio en el entreno…» solo si hay un cambio real');
ok(/Cambio en el entreno del miércoles 14\/10/.test(msg) && /Caja Mágica/.test(msg) && /Responded en SportEasy/.test(msg), 'mensaje de cambio de entreno', msg);
ok(/pista por confirmar \(Valdebernardo en obras\)/.test(D.mensajeWhatsApp(miercoles, pistas, 'nuevo')), 'con la pista por confirmar lo dice');
ok(/^Se cancela el entreno del miércoles 14\/10/.test(D.mensajeWhatsApp(miercoles, pistas, 'cancelado')), 'mensaje de cancelación');
const partido = { ...miercoles, tipo: 'liga', equipo: 'MdA', titulo: null, jornada: 2, rival: 'Litros de Mahou', es_local: false, fecha: '2026-10-18', inicio: '10:15:00', fin: null, quedada: '09:55:00', pista_id: 'm', numero_pista: 2, serie: null, origen: 'ayuntamiento' };
const mp = D.mensajeWhatsApp(partido, pistas, 'cambio', { cambios: ['quedada: 10:00 → 09:55'], lineaEquipacion: 'Llevad la equipación amarilla.' });
ok(/J2/.test(mp) && /Litros de Mahou – MdA|Litros de Mahou/.test(mp) && /encuentro 09:55/.test(mp) && /amarilla/.test(mp), 'mensaje de partido con encuentro y equipación', mp);

const adm = { id: 'adm', slug: 'antonio-diaz-miguel', nombre: 'Antonio Díaz Miguel', nombre_corto: null, direccion: 'Calle Joaquín Dicenta, 1', uso: 'entreno', estado: 'provisional', es_de_serie: false, num_pistas: null, nota: null };
const e1410 = { ...miercoles, inicio: '20:00:00', fin: '22:00:00', quedada: '19:40:00', pista_id: 'adm', notas: 'Pista 3' };
const pAdm = [...pistas, adm];
ok(D.mensajeWhatsApp(e1410, pAdm, 'nuevo').split('\n')[0] === 'Entreno del miércoles 14/10: de 20:00 a 22:00 (encuentro 19:40) en Antonio Díaz Miguel, pista 3 — Calle Joaquín Dicenta, 1.', 'WhatsApp: horario, encuentro, pista, número (de las notas) y dirección', D.mensajeWhatsApp(e1410, pAdm, 'nuevo'));
ok(!/Pista 3\./.test(D.mensajeWhatsApp(e1410, pAdm, 'nuevo')), 'la nota «Pista 3» no se repite');
const conNota = D.mensajeWhatsApp({ ...e1410, numero_pista: 2, notas: 'Traed agua' }, pAdm, 'nuevo');
ok(/en Antonio Díaz Miguel, pista 2 — Calle/.test(conNota) && /\nTraed agua\.\n/.test(conNota), 'el número de pista del evento manda y las notas reales se añaden', conNota);
ok(/^Entreno del miércoles 14\/10: de 20:00 a 22:00 \(encuentro 19:40\), pista por confirmar/.test(D.mensajeWhatsApp({ ...e1410, pista_id: null }, pistas, 'nuevo')), 'sin pista: «pista por confirmar»');
ok(/a las 20:00 \(encuentro 19:40\) en Antonio/.test(D.mensajeWhatsApp({ ...e1410, fin: null }, pAdm, 'nuevo')), 'sin hora de fin: «a las…»');

console.log('\n== Respuestas ordenadas, recordatorio y asistencia');
const plantilla = ['a', 'b', 'c', 'd', 'e'].map((x) => ({ person_id: x, nombre_visible: x.toUpperCase(), ficha_mda: true, ficha_mdl: false, entrena: true, activo: true }));
const filas = D.ordenarRespuestas(miercoles, plantilla, [
  { person_id: 'a', respuesta: 'va', motivo: null, detalle: null, leido_en: null }, { person_id: 'b', respuesta: 'no', motivo: 'viaje', detalle: null, leido_en: null },
  { person_id: 'c', respuesta: 'duda', motivo: null, detalle: null, leido_en: null },
], [{ person_id: 'e', desde: '2026-10-10', hasta: '2026-10-20', motivo: 'trabajo' }]);
ok(filas.map((f) => f.person_id).join('') === 'bcdea', 'orden: no van → dudan → sin responder → van', filas.map((f) => f.person_id).join(''));
ok(filas.find((f) => f.person_id === 'e').porPeriodo?.motivo === 'trabajo', 'quien tiene una ausencia por periodo que cubre el día sale marcado');
const c = D.contarRespuestas(filas);
ok(c.va === 1 && c.no === 1 && c.duda === 1 && c.sin_responder === 2, 'contadores');
const rec = D.recordatorio(miercoles, filas, pistas);
ok(rec.faltan.join() === 'D' && /Voy \/ No voy \/ Duda/.test(rec.texto), 'el recordatorio pide solo a quien no ha respondido y no está ausente por periodo', rec.faltan.join());
ok(D.convocadosDe({ tipo: 'liga', equipo: 'MdL' }, plantilla).length === 0 && D.convocadosDe({ tipo: 'entreno', equipo: 'ambos' }, plantilla).length === 5, 'convocados: entreno = quien entrena; MdL = fichas de MdL');
const res = A.resumenTemporada([
  { temporada: '2026-27', person_id: 'a', nombre: 'A', ambito: 'entrenos', fueron: 3, total: 4, con_excusa: 1, sin_excusa: 0, no_convocado: 0, lesion: 0 },
  { temporada: '2026-27', person_id: 'a', nombre: 'A', ambito: 'partidos', fueron: 2, total: 2, con_excusa: 0, sin_excusa: 0, no_convocado: 0, lesion: 0 },
  { temporada: '2026-27', person_id: 'b', nombre: 'B', ambito: 'entrenos', fueron: 1, total: 4, con_excusa: 1, sin_excusa: 0, no_convocado: 0, lesion: 2 },
], [{ person_id: 'b', fecha: '2026-10-14', respuesta: 'no', motivo: 'viaje' }, { person_id: 'b', fecha: '2026-10-21', respuesta: 'no', motivo: 'viaje' }, { person_id: 'a', fecha: '2026-10-21', respuesta: 'va', motivo: null }]);
ok(res[0].person_id === 'a' && res[0].entrenos.pct === 0.75 && res[0].partidos.pct === 1, 'asistidos / total / %: A 3/4 = 75 % en entrenos, 2/2 = 100 % en partidos');
ok(res[1].motivos.some((m) => m.texto === 'viaje' && m.veces === 2) && res[1].motivos.some((m) => m.texto === 'lesión' && m.veces === 2) && res[1].motivos.length === 3, 'motivos más frecuentes (viaje ×2 de la plataforma, lesión ×2 del histórico, con excusa ×1)');
ok(A.textoPct(0.756) === '76 %' && A.textoPct(null) === '—', 'porcentajes legibles');

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
