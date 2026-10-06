#!/usr/bin/env node
// Copia de seguridad de los DATOS del esquema public (jugadores, gestores, campanas_ropa, pedidos_ropa) del
// proyecto de .env.local, en privado/backups/backup_public_<fecha-hora>.json (fuera de git: lleva datos personales).
// Solo lee. Guarda tambien, para poder restaurar, id y correo de las cuentas de auth que referencian los gestores
// (nunca contrasenas) y las versiones de migracion aplicadas.
//
//   npm run db:backup
//   node pruebas/restaurar_backup.mjs <fichero>     prueba la restauracion en el Postgres local

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { conectar } from './db.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TABLAS = ['jugadores', 'gestores', 'campanas_ropa', 'pedidos_ropa'];

export async function volcar(sql) {
  const datos = {};
  for (const t of TABLAS) datos[t] = (await sql.unsafe(`select to_jsonb(t) as r from public.${t} t order by 1`)).map((x) => x.r);
  const auth = await sql`select id, email, created_at from auth.users where id in (select user_id from public.gestores where user_id is not null)`;
  const versiones = (await sql`select version from supabase_migrations.schema_migrations order by 1`).map((x) => x.version);
  return { generado: new Date().toISOString(), migraciones: versiones, auth_gestores: auth, tablas: datos };
}

export const huella = (filas) => crypto.createHash('sha256').update(JSON.stringify(filas.map((f) => JSON.stringify(Object.fromEntries(Object.entries(f).sort())))
  .sort())).digest('hex').slice(0, 16);

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dotenv = await import('dotenv');
  dotenv.config({ path: path.join(RAIZ, '.env.local') });
  const sql = conectar();
  try {
    const v = await volcar(sql);
    const dir = path.join(RAIZ, '..', 'privado', 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, `backup_public_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`);
    fs.writeFileSync(f, JSON.stringify(v, null, 1), { flag: 'wx' });
    console.log(`Copia guardada: ${f}`);
    for (const t of TABLAS) console.log(`  ${t}: ${v.tablas[t].length} filas (huella ${huella(v.tablas[t])})`);
  } finally { await sql.end(); }
}
