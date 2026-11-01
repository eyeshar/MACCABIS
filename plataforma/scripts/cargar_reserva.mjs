#!/usr/bin/env node
// Carga de D158 (31/10/2026, Claude por orden de Ivan): marca «Reserva» para Fernando M. y Guillermo. Necesita la
// migracion 20261031180000_reserva aplicada. (El paso de Fernando M. de «solo entreno» a «jugador» ya estaba hecho en el
// real antes de esta carga: aqui solo se comprueba.)
//
//   node scripts/cargar_reserva.mjs            SOLO LEE: enseña el estado actual y lo que cambiaria (no escribe)
//   node scripts/cargar_reserva.mjs --aplicar  escribe, en una transaccion, y comprueba el resultado
//
// Repetible. Si algo no cuadra (falta una persona, la columna no existe), no escribe nada. No imprime niveles ni notas.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { conectar } from './db.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FERNANDO_M = 'mendez-escandon-fernando';
export const GUILLERMO = 'galan-domingo-guillermo';
export const RESERVAS = [FERNANDO_M, GUILLERMO];
const POR = 'Claude (D158, orden de Iván)';

async function estado(sql) {
  return sql`select j.person_id, j.nombre_visible, j.rol, j.ficha_mda, j.ficha_mdl, j.activo,
                    p.person_id is not null as tiene_privado, coalesce(p.reserva, false) as reserva, coalesce(p.nunca_partidos, false) as nunca_partidos
             from public.jugadores j left join public.jugadores_privado p using (person_id)
             where j.person_id in ${sql(RESERVAS)} order by j.person_id`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { config } = await import('dotenv');
  config({ path: path.join(RAIZ, '.env.local') });
  const aplicar = process.argv.includes('--aplicar');
  const sql = conectar();
  try {
    const [{ hay }] = await sql`select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'jugadores_privado' and column_name = 'reserva') hay`;
    if (!hay) { console.error('Falta la columna jugadores_privado.reserva: aplica antes la migración 20261031180000_reserva.'); process.exit(1); }
    const antes = await estado(sql);
    console.table(antes);
    if (antes.length !== RESERVAS.length) { console.error(`No encuentro a las ${RESERVAS.length} personas en jugadores: no se escribe nada.`); process.exit(1); }
    const [{ n: reservasAntes }] = await sql`select count(*)::int n from public.jugadores_privado where reserva`;
    console.log(`Reservas ahora: ${reservasAntes}. Tras la carga: ${reservasAntes + antes.filter((x) => !x.reserva).length} (${RESERVAS.join(', ')}).`);
    if (antes.find((x) => x.person_id === FERNANDO_M)?.rol !== 'jugador') console.log(`OJO: ${FERNANDO_M} no tiene rol «jugador»; esta carga no lo cambia (decide Iván).`);
    if (antes.some((x) => x.nunca_partidos)) console.log('OJO: alguno tiene «Solo entreno: nunca a partidos»; la carga no lo cambia (decide Iván).');
    if (!aplicar) { console.log('Solo lectura (sin --aplicar): no se ha escrito nada.'); process.exit(0); }
    await sql.begin(async (tx) => {
      for (const id of RESERVAS) {
        await tx`insert into public.jugadores_privado (person_id, reserva, cambiado_por_nombre) values (${id}, true, ${POR})
                 on conflict (person_id) do update set reserva = true, cambiado_en = now(), cambiado_por_nombre = ${POR}
                 where public.jugadores_privado.reserva is distinct from true`;
      }
      const [{ n }] = await tx`select count(*)::int n from public.jugadores_privado where reserva`;
      if (n !== reservasAntes + antes.filter((x) => !x.reserva).length) throw new Error(`No cuadra (reservas ${n}): se deshace todo.`);
    });
    console.table(await estado(sql));
    console.log('Hecho.');
  } finally { await sql.end(); }
}
