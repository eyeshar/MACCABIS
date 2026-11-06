#!/usr/bin/env node
// Estado efectivo de la campaña de ropa (Panel y /gestion/ropa usan la misma funcion): abierta solo si estado = abierta y la
// fecha limite, incluida, no ha pasado en hora de Madrid. Sin base de datos ni navegador.
//
//   npm run pruebas:campana
import { campanaAbiertaAhora as abierta } from '../src/lib/fechas.ts';
import { finDeDiaMadrid } from '../src/lib/fechas.ts';
import { estadoPedido, pedidoVisibleParaJugadores } from '../src/lib/pedidoRopa.ts';

let fallos = 0;
const ok = (c, m) => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}`); if (!c) fallos++; };
const ahora = (iso) => new Date(iso);

// Los gestores guardan el fin del dia de Madrid (finDeDiaMadrid), con horario de invierno y de verano.
const limite = finDeDiaMadrid('2026-10-23');
ok(!abierta({ estado: 'abierta', fecha_limite: limite }, ahora('2026-10-24T08:00:00+02:00')), 'fecha pasada (ayer): cerrada');
ok(!abierta({ estado: 'abierta', fecha_limite: limite }, ahora('2026-10-23T22:30:00Z')), 'pasada la medianoche de Madrid (00:30 del 24): cerrada');
ok(abierta({ estado: 'abierta', fecha_limite: limite }, ahora('2026-10-23T08:00:00+02:00')), 'fecha de hoy, por la mañana: abierta');
ok(abierta({ estado: 'abierta', fecha_limite: limite }, ahora('2026-10-23T23:59:00+02:00')), 'fecha de hoy, a las 23:59 de Madrid: abierta (el dia limite cuenta)');
ok(abierta({ estado: 'abierta', fecha_limite: limite }, ahora('2026-10-20T12:00:00+02:00')), 'fecha futura: abierta');
ok(abierta({ estado: 'abierta', fecha_limite: null }, ahora('2030-01-01T12:00:00Z')), 'sin fecha: abierta');
ok(!abierta({ estado: 'cerrada', fecha_limite: null }, ahora('2026-10-20T12:00:00Z')), 'estado cerrada sin fecha: cerrada');
ok(!abierta({ estado: 'cerrada', fecha_limite: limite }, ahora('2026-10-20T12:00:00Z')), 'estado cerrada con fecha futura: cerrada');
const inv = finDeDiaMadrid('2026-12-15');
ok(abierta({ estado: 'abierta', fecha_limite: inv }, ahora('2026-12-15T22:30:00Z')), 'horario de invierno: 23:30 de Madrid del dia limite, abierta');
ok(!abierta({ estado: 'abierta', fecha_limite: inv }, ahora('2026-12-15T23:30:00Z')), 'horario de invierno: 00:30 del dia siguiente, cerrada');

// Bloque 5: un solo estado real con su causa y el interruptor «Abrir el pedido a los jugadores» (campanas_ropa.estado).
const hoyM = ahora('2026-10-20T12:00:00+02:00');
const apagado = estadoPedido({ estado: 'cerrada', fecha_limite: finDeDiaMadrid('2026-12-31') }, hoyM);
ok(!apagado.abierto && apagado.causa === 'interruptor' && apagado.texto === 'Cerrado a los jugadores' && apagado.detalle === 'interruptor apagado', 'interruptor apagado (aunque la fecha sea futura): «Cerrado a los jugadores · interruptor apagado»');
const vencida = estadoPedido({ estado: 'abierta', fecha_limite: finDeDiaMadrid('2026-10-19') }, hoyM);
ok(!vencida.abierto && vencida.causa === 'fecha' && vencida.interruptor && vencida.texto === 'Cerrado a los jugadores' && vencida.detalle === 'pasó la fecha límite (19 de octubre)', 'encendido con la fecha pasada: «Cerrado a los jugadores · pasó la fecha límite (19 de octubre)», nunca «Abierta» a la vez', vencida.detalle);
const abiertaM = estadoPedido({ estado: 'abierta', fecha_limite: finDeDiaMadrid('2026-12-31') }, hoyM);
ok(abiertaM.abierto && abiertaM.texto === 'Abierto a los jugadores' && abiertaM.detalle === 'hasta el 31 de diciembre', '«Abierto a los jugadores · hasta el 31 de diciembre»', abiertaM.detalle);
ok(estadoPedido({ estado: 'abierta', fecha_limite: null }, hoyM).detalle === 'sin fecha límite', 'abierta sin fecha: «sin fecha límite»');
ok(!pedidoVisibleParaJugadores(null, hoyM) && !pedidoVisibleParaJugadores({ estado: 'cerrada', fecha_limite: null }, hoyM) && !pedidoVisibleParaJugadores({ estado: 'abierta', fecha_limite: finDeDiaMadrid('2026-10-19') }, hoyM) && pedidoVisibleParaJugadores({ estado: 'abierta', fecha_limite: null }, hoyM),
  'pedidoVisibleParaJugadores: solo con el interruptor encendido y la fecha sin pasar (sin campaña, no)');
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
