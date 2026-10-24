#!/usr/bin/env node
// Estado efectivo de la campaña de ropa (Panel y /gestion/ropa usan la misma funcion): abierta solo si estado = abierta y la
// fecha limite, incluida, no ha pasado en hora de Madrid. Sin base de datos ni navegador.
//
//   npm run pruebas:campana
import { campanaAbiertaAhora as abierta } from '../src/lib/fechas.ts';
import { finDeDiaMadrid } from '../src/lib/fechas.ts';

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
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
