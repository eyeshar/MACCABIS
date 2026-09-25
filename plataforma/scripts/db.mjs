#!/usr/bin/env node
// Herramienta de base de datos de la plataforma. Lee la conexion de .env.local
// (SUPABASE_DB_URL), que NUNCA se sube a git.
//
//   npm run db:migrar                  aplica las migraciones pendientes de supabase/migrations
//   npm run db:semilla                 carga la plantilla 26/27, crea los enlaces y la campana de ropa
//   npm run db:gestor -- <email> <nombre>   da de alta a un gestor (el usuario ya existe en Supabase Auth)
//   npm run db:estado                  resumen (sin mostrar enlaces ni telefonos)
//
// Las migraciones se registran en supabase_migrations.schema_migrations, la misma
// tabla que usa la CLI de Supabase, para que las dos vias sean compatibles.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { PLANTILLA_2026_27, CAMPANA_INICIAL } from './plantilla_2026_27.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_MIGRACIONES = path.join(RAIZ, 'supabase', 'migrations');
const PERSONAS = path.join(RAIZ, '..', 'data', 'personas.json');

export function conectar(url = process.env.SUPABASE_DB_URL) {
  if (!url) {
    console.error('Falta SUPABASE_DB_URL. Copia .env.example a .env.local y rellena la cadena de conexion (ver LEEME.md).');
    process.exit(1);
  }
  const local = /localhost|127\.0\.0\.1/.test(url);
  return postgres(url, { ssl: local ? false : 'require', onnotice: () => {}, max: 1 });
}

export async function migrar(sql, { log = console.log } = {}) {
  await sql`create schema if not exists supabase_migrations`;
  await sql`create table if not exists supabase_migrations.schema_migrations (
    version text primary key, statements text[], name text)`;
  const hechas = new Set((await sql`select version from supabase_migrations.schema_migrations`).map(r => r.version));
  const ficheros = fs.readdirSync(DIR_MIGRACIONES).filter(f => /^\d+_.+\.sql$/.test(f)).sort();
  let aplicadas = 0;
  for (const f of ficheros) {
    const [version, ...resto] = f.replace(/\.sql$/, '').split('_');
    if (hechas.has(version)) continue;
    const texto = fs.readFileSync(path.join(DIR_MIGRACIONES, f), 'utf8');
    await sql.begin(async tx => {
      await tx.unsafe(texto);
      await tx`insert into supabase_migrations.schema_migrations (version, name, statements)
               values (${version}, ${resto.join('_')}, ${[texto]})`;
    });
    log(`  aplicada ${f}`);
    aplicadas++;
  }
  log(aplicadas ? `Migraciones aplicadas: ${aplicadas}.` : 'No habia migraciones pendientes.');
}

export async function semilla(sql, { log = console.log } = {}) {
  const personas = JSON.parse(fs.readFileSync(PERSONAS, 'utf8')).personas;
  const porId = new Map(personas.map(p => [p.person_id, p]));
  let nuevos = 0;
  for (const j of PLANTILLA_2026_27) {
    const p = porId.get(j.person_id);
    if (!p) throw new Error(`person_id desconocido en data/personas.json: ${j.person_id}`);
    const r = await sql`
      insert into public.jugadores (person_id, nombre_oficial, nombre_visible, ficha_mda, ficha_mdl, rol, entrena)
      values (${j.person_id}, ${p.formal}, ${j.visible}, ${j.mda}, ${j.mdl}, ${j.rol}, true)
      on conflict (person_id) do nothing
      returning id`;
    nuevos += r.length;
  }
  // Un enlace vivo para quien no lo tenga.
  const enlaces = await sql`
    insert into public.enlaces (jugador_id, token)
    select j.id, public.nuevo_token() from public.jugadores j
    where not exists (select 1 from public.enlaces e where e.jugador_id = j.id and e.anulado_en is null)
    returning id`;
  const [{ n }] = await sql`select count(*)::int as n from public.campanas_ropa`;
  if (n === 0) {
    await sql`insert into public.campanas_ropa (nombre, proveedor, estado, precios, guia_tallas_url)
              values (${CAMPANA_INICIAL.nombre}, 'VIVE', 'cerrada', ${sql.json(CAMPANA_INICIAL.precios)}, ${CAMPANA_INICIAL.guia})`;
    log('  campana de ropa creada (cerrada: se abre desde la zona de gestion)');
  }
  log(`Semilla: ${nuevos} jugadores nuevos, ${enlaces.length} enlaces creados.`);
}

export async function altaGestor(sql, email, nombre, { log = console.log } = {}) {
  const r = await sql`
    insert into public.gestores (user_id, nombre)
    select id, ${nombre} from auth.users where lower(email) = lower(${email})
    on conflict (user_id) do update set nombre = excluded.nombre
    returning user_id`;
  if (!r.length) {
    log(`No existe ningun usuario con el correo ${email} en Supabase Auth. Crealo antes (Authentication > Users > Add user).`);
    return false;
  }
  log(`Gestor dado de alta: ${nombre}.`);
  return true;
}

async function estado(sql) {
  const q = async (t) => (await sql.unsafe(`select count(*)::int as n from ${t}`))[0].n;
  console.log({
    jugadores: await q('public.jugadores'),
    enlaces_vivos: await q('public.enlaces where anulado_en is null'),
    gestores: await q('public.gestores'),
    campanas: await q('public.campanas_ropa'),
    pedidos: await q('public.pedidos_ropa'),
  });
}

// --- linea de comandos ---
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dotenv = await import('dotenv');
  dotenv.config({ path: path.join(RAIZ, '.env.local') });
  const [orden, ...args] = process.argv.slice(2);
  const sql = conectar();
  try {
    if (orden === 'migrar') await migrar(sql);
    else if (orden === 'semilla') await semilla(sql);
    else if (orden === 'gestor') {
      const [email, ...nombre] = args;
      if (!email || !nombre.length) throw new Error('Uso: npm run db:gestor -- <email> <nombre>');
      await altaGestor(sql, email, nombre.join(' '));
    } else if (orden === 'estado') await estado(sql);
    else console.log('Ordenes: migrar | semilla | gestor <email> <nombre> | estado');
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}
