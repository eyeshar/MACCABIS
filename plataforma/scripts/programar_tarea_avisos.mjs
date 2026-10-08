#!/usr/bin/env node
// Programa la tarea de avisos (D99.5) en Supabase: pg_cron llama cada 15 minutos, con pg_net, a
// https://maccabis.vercel.app/api/avisos/tarea con el secreto AVISOS_SECRETO, que se guarda CIFRADO en Supabase Vault
// (no aparece en el texto del trabajo de pg_cron ni en este repositorio).
//
//   npm run avisos:programar              enseña lo que haría (sin el secreto) y no toca nada
//   npm run avisos:programar -- --aplicar lo aplica (SOLO con el OK de Ivan, D94)
//   npm run avisos:programar -- --quitar  quita el trabajo programado (los avisos dejan de salir solos)
//
// pg_cron y pg_net estan disponibles en el plan gratuito de Supabase (comprobado en el proyecto el 08/10/2026:
// pg_cron 1.6.4 y pg_net 0.20.4, sin instalar; supabase_vault 0.3.1 instalada).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { conectar } from './db.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(RAIZ, '.env.local') });
const URL_TAREA = process.env.AVISOS_URL_TAREA || 'https://maccabis.vercel.app/api/avisos/tarea';
const NOMBRE = 'maccabis-avisos';
const aplicar = process.argv.includes('--aplicar');
const quitar = process.argv.includes('--quitar');

const ORDEN = `select net.http_post(
    url := '${URL_TAREA}',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'avisos_secreto')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000)`;

console.log(`Tarea: cada 15 minutos -> ${URL_TAREA}`);
if (!aplicar && !quitar) {
  console.log('\nLo que se aplicaría (el secreto va a Vault y no se muestra):\n');
  console.log("create extension if not exists pg_cron;\ncreate extension if not exists pg_net with schema extensions;");
  console.log("select vault.create_secret('<AVISOS_SECRETO de .env.local>', 'avisos_secreto');   -- o update_secret si ya existe");
  console.log(`select cron.schedule('${NOMBRE}', '*/15 * * * *', $$${ORDEN}$$);`);
  console.log('\nNo se ha tocado nada. Para aplicarlo: npm run avisos:programar -- --aplicar');
  process.exit(0);
}
const secreto = process.env.AVISOS_SECRETO;
if (aplicar && (!secreto || secreto.length < 32)) { console.error('Falta AVISOS_SECRETO en .env.local (npm run avisos:claves).'); process.exit(1); }
const sql = conectar();
try {
  if (quitar) {
    await sql`select cron.unschedule(${NOMBRE}) where exists (select 1 from cron.job where jobname = ${NOMBRE})`;
    console.log('Trabajo quitado: los avisos ya no salen solos (el envío al guardar y el aviso de prueba siguen).');
  } else {
    await sql.unsafe('create extension if not exists pg_cron');
    await sql.unsafe('create extension if not exists pg_net with schema extensions');
    const [ya] = await sql`select id from vault.secrets where name = 'avisos_secreto'`;
    if (ya) await sql`select vault.update_secret(${ya.id}, ${secreto})`;
    else await sql`select vault.create_secret(${secreto}, 'avisos_secreto')`;
    await sql`select cron.schedule(${NOMBRE}, '*/15 * * * *', ${ORDEN})`;
    const [j] = await sql`select jobid, schedule, active from cron.job where jobname = ${NOMBRE}`;
    console.log(`Programada: trabajo ${j.jobid}, «${j.schedule}», activo=${j.active}. Revisa las ejecuciones en cron.job_run_details y net._http_response.`);
  }
} finally {
  await sql.end();
}
