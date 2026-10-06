#!/usr/bin/env node
// Prueba que una copia de db:backup SE PUEDE RESTAURAR: levanta el Postgres local (con nuestras migraciones),
// vacia las tablas de datos, carga la copia y comprueba fila a fila (huella) que queda igual.
//
//   node pruebas/restaurar_backup.mjs <privado/backups/backup_public_....json>

import fs from 'node:fs';
import { arrancar } from './pila.mjs';
import { TABLAS, huella } from '../scripts/backup_public.mjs';

const f = process.argv[2];
if (!f) { console.error('Uso: node pruebas/restaurar_backup.mjs <fichero>'); process.exit(2); }
const copia = JSON.parse(fs.readFileSync(f, 'utf8'));
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : ' -> ' + d}`); if (!c) fallos++; };

// Las marcas de tiempo son el mismo instante aunque el servidor las escriba con otra zona horaria.
const n = (v) => (typeof v === 'string' && /^\d{4}-\d\d-\d\dT[\d:.]+[+-]\d\d:\d\d$/.test(v) ? new Date(v).toISOString() : v);

const pila = await arrancar();
try {
  const { sql } = pila;
  await sql.unsafe('truncate public.pedidos_ropa, public.campanas_ropa, public.gestores, public.jugadores cascade');
  for (const u of copia.auth_gestores) await sql`insert into auth.users (id, email, encrypted_password) values (${u.id}, ${u.email}, 'restaurado') on conflict (id) do nothing`;
  for (const t of ['jugadores', 'gestores', 'campanas_ropa', 'pedidos_ropa']) {
    await sql.unsafe(`insert into public.${t} select * from jsonb_populate_recordset(null::public.${t}, $copia$${JSON.stringify(copia.tablas[t])}$copia$::jsonb)`);
  }
  for (const t of TABLAS) {
    const cuantas = (await sql.unsafe(`select count(*)::int n from public.${t}`))[0].n;
    ok(cuantas === copia.tablas[t].length, `${t}: ${cuantas} filas restauradas de ${copia.tablas[t].length}`);
    const filas = (await sql.unsafe(`select to_jsonb(t) as r from public.${t} t`)).map((x) => x.r);
    const dif = [];
    for (const o of copia.tablas[t]) {
      const r = filas.find((x) => x.id === o.id);
      if (!r) { dif.push(`falta ${o.id}`); continue; }
      for (const k of new Set([...Object.keys(o), ...Object.keys(r)])) if (JSON.stringify(n(o[k])) !== JSON.stringify(n(r[k]))) dif.push(`${k}: ${JSON.stringify(o[k])} / ${JSON.stringify(r[k])}`);
    }
    ok(!dif.length, `${t}: contenido identico a la copia`, [...new Set(dif.map((d) => d.replace(/:.*/, '')))].join(', ') + ' | ej: ' + dif[0]);
  }
} finally { await pila.parar(); }
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nLa copia se restaura entera y identica.');
process.exit(fallos ? 1 : 0);
