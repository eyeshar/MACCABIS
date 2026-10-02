#!/usr/bin/env node
// Herramienta de base de datos de la plataforma. Lee la conexion de .env.local
// (SUPABASE_DB_URL), que NUNCA se sube a git.
//
//   npm run db:migrar                  aplica las migraciones pendientes de supabase/migrations
//   npm run db:semilla                 carga la plantilla 26/27 y la campana de ropa
//   npm run db:gestor -- <email> <nombre>   reserva o vincula una plaza de gestor por correo (D68)
//   npm run db:correos -- <fichero>    importa los correos de SportEasy a jugadores.email (scripts/importar_correos.mjs)
//   npm run db:correo -- <person_id> <correo_nuevo>   cambia el correo de UN jugador, sincronizando
//                                       su cuenta de auth (si ya existe) y la de gestores (si lo es)
//   npm run db:estado                  resumen (sin mostrar telefonos)
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
  const [{ n }] = await sql`select count(*)::int as n from public.campanas_ropa`;
  if (n === 0) {
    await sql`insert into public.campanas_ropa (nombre, proveedor, estado, precios, guia_tallas_url)
              values (${CAMPANA_INICIAL.nombre}, 'VIVE', 'cerrada', ${sql.json(CAMPANA_INICIAL.precios)}, ${CAMPANA_INICIAL.guia})`;
    log('  campana de ropa creada (cerrada: se abre desde la zona de gestion)');
  }
  log(`Semilla: ${nuevos} jugadores nuevos.`);
}

// Reserva (o vincula, si el usuario ya entro alguna vez) una plaza de gestor
// por correo (D68): no hace falta que el usuario exista antes en Supabase Auth,
// la vinculacion la hace sola el trigger vincular_gestor_nuevo_usuario() cuando
// esa persona entre por primera vez.
export async function altaGestor(sql, email, nombre, { log = console.log } = {}) {
  const correo = email.trim().toLowerCase();
  const [existente] = await sql`select id from auth.users where lower(email) = ${correo}`;
  const r = await sql`
    insert into public.gestores (email, nombre, user_id)
    values (${correo}, ${nombre}, ${existente?.id ?? null})
    on conflict (lower(email)) do update set nombre = excluded.nombre,
      user_id = coalesce(public.gestores.user_id, excluded.user_id)
    returning user_id`;
  log(existente
    ? `Gestor dado de alta y vinculado a su cuenta ya existente: ${nombre} <${correo}>.`
    : `Plaza de gestor reservada para ${nombre} <${correo}>. Se vinculará sola la primera vez que entre.`);
  return Boolean(r.length);
}

// Cambia el correo de UN jugador (por person_id), llamando a la misma funcion
// SQL que usa la web (public.cambiar_correo_jugador): sincroniza su cuenta de
// auth (si ya existe, la renombra en vez de dejarla huerfana) y la de
// gestores (si esa persona es ademas gestor con el mismo correo). Fuera de la
// web no hay sesion (auth.uid() es null con esta conexion), asi que la
// funcion no exige is_gestor() aqui: ver el propio SQL para el porque.
export async function cambiarCorreo(sql, personId, correoNuevo, { log = console.log } = {}) {
  const [jugador] = await sql`select id, nombre_oficial, email from public.jugadores where person_id = ${personId}`;
  if (!jugador) throw new Error(`No existe ningun jugador con person_id "${personId}".`);
  const correo = correoNuevo.trim().toLowerCase();
  const [{ cambiar_correo_jugador: r }] = await sql`
    select public.cambiar_correo_jugador(${jugador.id}::uuid, ${correo}) as cambiar_correo_jugador`;
  if (!r.ok) throw new Error(`No se pudo cambiar el correo de ${jugador.nombre_oficial}: ${r.error}`);
  if (r.sin_cambios) {
    log(`${jugador.nombre_oficial}: el correo ya era "${correo}", sin cambios.`);
    return r;
  }
  log(`${jugador.nombre_oficial}: correo cambiado de "${jugador.email ?? '(sin correo)'}" a "${correo}".`);
  if (r.auth_renombrado) log('  Su cuenta de Supabase Auth ya existia: renombrada al correo nuevo (misma cuenta, sin huerfanos ni duplicados).');
  if (r.gestor_sincronizado) log('  Es tambien gestor con ese correo: su fila en "gestores" se actualizo igual.');
  return r;
}

async function estado(sql) {
  const q = async (t) => (await sql.unsafe(`select count(*)::int as n from ${t}`))[0].n;
  console.log({
    jugadores: await q('public.jugadores'),
    jugadores_con_correo: await q("public.jugadores where email is not null"),
    gestores: await q('public.gestores'),
    gestores_vinculados: await q('public.gestores where user_id is not null'),
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
    } else if (orden === 'correo') {
      const [personId, correoNuevo] = args;
      if (!personId || !correoNuevo) throw new Error('Uso: npm run db:correo -- <person_id> <correo_nuevo>');
      await cambiarCorreo(sql, personId, correoNuevo);
    } else if (orden === 'estado') await estado(sql);
    else console.log('Ordenes: migrar | semilla | gestor <email> <nombre> | correo <person_id> <correo_nuevo> | estado');
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}
