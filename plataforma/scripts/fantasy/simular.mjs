#!/usr/bin/env node
// MdFantasy (D196), fase 1: simulacion con los datos de 2026-27 ya extraidos (privado/fantasy/datos.json, que deja
// scripts/fantasy/extraer.mjs). NO se conecta a ninguna base. Usa el MISMO motor que la web (src/lib/fantasy).
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=ExperimentalWarning scripts/fantasy/simular.mjs
//
// Escribe privado/fantasy/simulacion_detalle.md (con nombres: fuera de git) y privado/fantasy/simulacion_resumen.json
// (sin nombres: las cifras que van a docs/MDFANTASY.md).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PARAMETROS } from '../../src/lib/fantasy/reglas.ts';
import { puntuarJornada } from '../../src/lib/fantasy/jornada.ts';
import { puntosManager, valor, copiasPorJugador, precioClausula } from '../../src/lib/fantasy/manager.ts';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = path.join(RAIZ, '..', 'privado', 'fantasy');
const datos = JSON.parse(fs.readFileSync(path.join(DIR, 'datos.json'), 'utf8'));
const P = { ...PARAMETROS };
const r1 = (n) => Math.round(n * 10) / 10;
const media = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const mediana = (a) => { const o = [...a].sort((x, y) => x - y); return o.length ? (o.length % 2 ? o[(o.length - 1) / 2] : (o[o.length / 2 - 1] + o[o.length / 2]) / 2) : 0; };

// 1) Puntos por jugador y jornada
const jugadas = datos.jornadas.filter((j) => j.publicada);
const nombres = new Map(jugadas[0].jugadores.map((j) => [j.person_id, j.nombre_visible]));
const porJornada = [];
const sinCasar = new Set(), aproximados = new Set();
for (const j of jugadas) {
  // los eventos sin ninguna respuesta guardada (epoca SportEasy) no puntuan respuesta: lo decide el propio motor (jornada.ts)
  const d = j;
  const r = puntuarJornada(d, P);
  r.sinCasar.forEach((x) => sinCasar.add(x)); r.aproximados.forEach((x) => aproximados.add(x));
  porJornada.push({ fecha: j.fecha, r, sinDatos: j.eventos_sin_datos.length, eventos: j.eventos.length, partidos: j.partidos });
}

// 2) Valor tras cada jornada (media de las ultimas N con datos)
const ids = [...nombres.keys()];
const historial = new Map(ids.map((id) => [id, []]));
const valores = [];
for (const pj of porJornada) {
  for (const id of ids) historial.get(id).unshift(pj.r.puntos.get(id).total);
  valores.push(new Map(ids.map((id) => [id, valor(historial.get(id), P)])));
}
const vFinal = valores.at(-1);
const listaV = ids.map((id) => vFinal.get(id)).sort((a, b) => a - b);
const vMedio = media(listaV), vMediano = mediana(listaV), vMax = Math.max(...listaV);

// 3) Managers simulados: plantillas al azar de valor parecido, alinean a los 5 de mas valor, capitan alterno
function azar(semilla) { let s = semilla; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
function simularManagers(n, semilla) {
  const rnd = azar(semilla);
  const copias = copiasPorJugador(n, ids.length, P);
  const libres = new Map(ids.map((id) => [id, copias]));
  const v0 = valores[0];
  const objetivo = P.plantilla * media(ids.map((id) => v0.get(id)));
  const equipos = [];
  for (let m = 0; m < n; m++) {
    let mejor = null;
    for (let intento = 0; intento < 400; intento++) {
      const pool = ids.filter((id) => libres.get(id) > 0).sort(() => rnd() - 0.5).slice(0, P.plantilla);
      const v = pool.reduce((s, id) => s + v0.get(id), 0);
      const dif = Math.abs(v - objetivo) / objetivo;
      if (!mejor || dif < mejor.dif) mejor = { pool, dif, v };
      if (dif <= P.margenInicio) break;
    }
    mejor.pool.forEach((id) => libres.set(id, libres.get(id) - 1));
    equipos.push(mejor);
  }
  const puntos = [];
  porJornada.forEach((pj, i) => {
    const vAntes = i ? valores[i - 1] : valores[0];
    for (const e of equipos) {
      const orden = [...e.pool].sort((a, b) => vAntes.get(b) - vAntes.get(a));
      const titulares = orden.slice(0, P.alineados);
      const a = { titulares, capitan: titulares[i % 2], vice: titulares[(i + 1) % 2] };
      puntos.push(puntosManager(a, pj.r.puntos, pj.partidos.length * 0.6, P).total);
    }
  });
  return { n, copias, objetivo: r1(objetivo), dentro: equipos.filter((e) => e.dif <= P.margenInicio).length, media: r1(media(puntos)), min: r1(Math.min(...puntos)), max: r1(Math.max(...puntos)) };
}
const escenarios = [12, 18, 25].map((n, i) => simularManagers(n, 20261121 + i));
const ptsManager = media(escenarios.map((e) => e.media));

// 4) Caja e ingresos: un clausulazo de un jugador medio cada tres jornadas; el del mas caro, solo vendiendo
const clausulaMedia = precioClausula(vMedio, P), clausulaMax = precioClausula(vMax, P);
const ingresoObjetivo = clausulaMedia / 3;
const ingresoFijo = Math.round((ingresoObjetivo * 0.4) * 2) / 2;
const ingresoPorPunto = Math.round(((ingresoObjetivo - ingresoFijo) / ptsManager) * 100) / 100;
const ingresoMedio = r1(ingresoFijo + ingresoPorPunto * ptsManager);
const cajaInicial = Math.round(clausulaMedia);
const jornadasParaElMasCaro = Math.ceil((clausulaMax - cajaInicial) / ingresoMedio);

// 5) Salidas
const todos = porJornada.flatMap((pj) => ids.map((id) => pj.r.puntos.get(id)));
const conMinutos = todos.filter((p) => p.minutos > 0);
const resumen = {
  generado: datos.generado, jornadas: porJornada.map((pj) => ({ fecha: pj.fecha, partidos: pj.partidos.length, eventos: pj.eventos, eventos_sin_respuestas: pj.sinDatos, con_minutos: ids.filter((id) => pj.r.puntos.get(id).minutos > 0).length, media_total: r1(media(ids.map((id) => pj.r.puntos.get(id).total))), max_total: Math.max(...ids.map((id) => pj.r.puntos.get(id).total)) })),
  elegibles: ids.length, sin_casar: [...sinCasar], aproximados: [...aproximados],
  rendimiento: { media_con_minutos: r1(media(conMinutos.map((p) => p.rendimiento))), mediana_con_minutos: mediana(conMinutos.map((p) => p.rendimiento)), max: Math.max(...conMinutos.map((p) => p.rendimiento)) },
  compromiso: { media: r1(media(todos.map((p) => p.compromiso))), min: Math.min(...todos.map((p) => p.compromiso)), max: Math.max(...todos.map((p) => p.compromiso)) },
  valor: { medio: r1(vMedio), mediano: r1(vMediano), max: vMax, en_el_minimo: listaV.filter((v) => v <= P.valorMinimo).length, lista: listaV },
  managers: escenarios, puntos_manager_medio: r1(ptsManager),
  economia: { clausula_media: clausulaMedia, clausula_max: clausulaMax, ingreso_objetivo: r1(ingresoObjetivo), ingresoFijo, ingresoPorPunto, ingreso_medio: ingresoMedio, cajaInicial, jornadas_para_el_mas_caro_sin_vender: jornadasParaElMasCaro },
  parametros: P,
};
fs.writeFileSync(path.join(DIR, 'simulacion_resumen.json'), JSON.stringify(resumen, null, 1));

const L = [`# MdFantasy · simulación 2026-27 (detalle con nombres, FUERA de git)`, ``, `Datos del ${datos.generado.slice(0, 10)}. Por jugador y jornada: rendimiento + compromiso = total.`, ``];
L.push(`| Jugador | ${porJornada.map((pj) => pj.fecha.slice(5)).join(' | ')} | Media | Valor |`, `|---|${porJornada.map(() => '---').join('|')}|---|---|`);
for (const id of [...ids].sort((a, b) => vFinal.get(b) - vFinal.get(a))) {
  const celdas = porJornada.map((pj) => { const p = pj.r.puntos.get(id); return `${p.rendimiento}${p.compromiso >= 0 ? '+' : ''}${p.compromiso}=**${p.total}**${p.doblete ? ' ②' : ''}`; });
  L.push(`| ${nombres.get(id)} | ${celdas.join(' | ')} | ${r1(media(porJornada.map((pj) => pj.r.puntos.get(id).total)))} | ${vFinal.get(id)} |`);
}
L.push('', '## Compromiso, unidad a unidad', '');
for (const pj of porJornada) {
  L.push(`### ${pj.fecha}`, '');
  for (const id of ids) { const p = pj.r.puntos.get(id); if (p.unidades.length) L.push(`- ${nombres.get(id)}: ${p.unidades.map((u) => `${u.texto}: ${u.respuesta >= 0 ? '+' : ''}${u.respuesta}${u.asistencia ? ` ${u.asistencia > 0 ? '+' : ''}${u.asistencia}` : ''} (${u.como || '—'})`).join(' · ')}`); }
  L.push('');
}
fs.writeFileSync(path.join(DIR, 'simulacion_detalle.md'), L.join('\n'));
console.log(JSON.stringify({ ...resumen, parametros: undefined }, null, 1));
