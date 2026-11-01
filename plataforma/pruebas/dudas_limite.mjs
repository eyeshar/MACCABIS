#!/usr/bin/env node
// Visibilidad para jugadores y dudas con hora límite (D141), en la pila local y en la web compilada de verdad:
//   - PRIVACIDAD: un jugador ve nombre y estado (va, duda, no va, sin responder) de los eventos a los que está invitado, nunca el
//     motivo, el detalle ni el origen; no ve eventos ajenos; anónimo, nada;
//   - HORA LÍMITE: `_limite_dudas` (base) y `limiteDudas` (web) dan la misma hora en más de 600 eventos, con el cambio de hora de
//     octubre y el de marzo; desde el límite la base rechaza «duda» (jugador, «responder por él», tablero, plan);
//   - CIERRE: `cerrar_dudas` pasa a «no va · no confirmó» (origen sistema) con hora simulada, es idempotente, no toca lo que no
//     toca (antes del límite, empezado, cancelado, interruptor apagado) y solo la ejecuta el rol de servicio;
//   - TAREA DE AVISOS de extremo a extremo (cada 15 minutos): cierra, avisa una sola vez, y volver a «voy» no avisa;
//   - PANTALLAS: «Si dudas, tienes hasta…», sin botón «Duda» pasado el límite, «Dudas: N · límite…» y «pasaron a no va» en
//     Gestión, «posibles» en la convocatoria, y ningún motivo en el HTML del jugador;
//   - la migración 20261028100000 se revierte limpia (D111) y se vuelve a aplicar.
//
//   npm run pruebas:dudas
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import webpush from 'web-push';
import { preparar, sinteticos, personas, contador, visto, RAIZ } from './comun_e2e.mjs';
import { firmar } from './pila.mjs';
import { migrar } from '../scripts/db.mjs';
import * as H from '../src/lib/avisos/horario.ts';
import { trasAccion, hasta } from './infra/esperas.mjs';

const { ok, fallos } = contador();
const vapid = webpush.generateVAPIDKeys();
const secreto = crypto.randomBytes(32).toString('hex');
const servicio = await firmar({ role: 'service_role', iss: 'supabase-local' }, 3600 * 24);
const e = await preparar({
  envExtra: {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey, VAPID_SUBJECT: 'mailto:pruebas@maccabis.invalid',
    SUPABASE_SERVICE_ROLE_KEY: servicio, AVISOS_SECRETO: secreto, NODE_TLS_REJECT_UNAUTHORIZED: '0',
  },
});
const { sql, APP, pila } = e;
const iso = (t) => new Date(t).toISOString();
const madridDe = (ms) => { const f = new Date(Date.now() + ms).toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }); return { fecha: f.slice(0, 10), hora: f.slice(11, 16) }; };
const api = async (ruta, { metodo = 'GET', cuerpo, token } = {}) => {
  const r = await fetch(`${pila.url}/rest/v1${ruta}`, { method: metodo, headers: { apikey: pila.anonKey, authorization: `Bearer ${token ?? pila.anonKey}`, 'content-type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  let datos = null; try { datos = await r.json(); } catch {}
  return { status: r.status, datos };
};
const rpc = (f, args, token) => api(`/rpc/${f}`, { metodo: 'POST', cuerpo: args, token });
const msg = (r) => JSON.stringify(r.datos ?? '');

try {
  await sinteticos(sql, [['sint-uno', 'Uno', true, true], ['sint-dos', 'Dos', true, true], ['sint-tres', 'Tres', true, false], ['sint-cuatro', 'Cuatro', false, true]]);
  const P = await personas(pila, {
    jugadores: [['sint-uno', 'uno@pruebas.local'], ['sint-dos', 'dos@pruebas.local'], ['sint-tres', 'tres@pruebas.local'], ['sint-cuatro', 'cuatro@pruebas.local']],
    gestores: [['Iván', 'gestor@pruebas.local', 'villaescusa-silva-ivan']],
  });
  const uno = P['sint-uno'].token, dos = P['sint-dos'].token, tres = P['sint-tres'].token, cuatro = P['sint-cuatro'].token, gestor = P['gestor@pruebas.local'].token;
  await sql`update public.respuestas_web_config set encendido = true, encendido_desde = now() - interval '1 day', dudas_desde = now() - interval '30 days' where id = 1`;

  // Eventos de prueba: uno lejano (límite en el futuro), uno que empieza dentro de 20 h (su límite pasó hace 4 h), un
  // partido solo del MdA y un plan que empieza dentro de 12 h.
  const lejos = madridDe(10 * 86400000);
  const pronto = madridDe(20 * 3600000);
  const plazo = madridDe(12 * 3600000);
  const nuevo = async (clave, tipo, equipo, f, hora, extra = {}) => (await sql`insert into public.eventos (clave, tipo, equipo, titulo, fecha, inicio, oficial, creado_por) values (${clave}, ${tipo}, ${equipo}, ${clave}, ${f}, ${hora}, ${extra.oficial ?? true}, ${extra.creado_por ?? null}) returning id`)[0].id;
  const E = {
    fut: await nuevo('x-fut', 'amistoso', 'ambos', lejos.fecha, '18:00'),
    pronto: await nuevo('x-pronto', 'amistoso', 'ambos', pronto.fecha, pronto.hora),
    ma: await nuevo('x-solo-mda', 'amistoso', 'MdA', lejos.fecha, '19:00'),
    plan: await nuevo('x-plan', 'quedada', 'ambos', plazo.fecha, plazo.hora, { oficial: false, creado_por: 'sint-uno' }),
  };
  const limiteBase = async (id) => (await sql`select public._limite_dudas(${id}) l, public._inicio_evento(${id}) i`)[0];
  const fut = await limiteBase(E.fut), pro = await limiteBase(E.pronto);
  ok(pro.l.getTime() < Date.now() && pro.i.getTime() > Date.now() && fut.l.getTime() > Date.now(), 'los eventos de prueba: «pronto» ya pasó su límite sin haber empezado y «fut» no', `${iso(pro.l)} ${iso(fut.l)}`);

  // ---------------------------------------------------------------------------------------------- base = web
  console.log('\n== La hora límite de la base y la de la web son la misma (cambio de hora incluido)');
  let comprobados = 0, distintos = [];
  const dias = [];
  for (const [desde, hasta] of [['2026-10-19', '2026-11-03'], ['2027-03-22', '2027-03-31']]) {
    for (let d = new Date(`${desde}T12:00:00Z`); d <= new Date(`${hasta}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) dias.push(d.toISOString().slice(0, 10));
  }
  for (const [tipo, oficial] of [['entreno', true], ['liga', true], ['amistoso', true], ['torneo', true], ['interno', true], ['entreno', false]]) {
    for (const hora of ['09:00', '10:15', '20:30', null]) {
      for (const f of dias) {
        const clave = `cmp-${tipo}-${oficial ? 'o' : 'p'}-${f}-${hora ?? 'sh'}`;
        const [{ id }] = await sql`insert into public.eventos (clave, tipo, equipo, rival, fecha, inicio, oficial, creado_por) values (${clave}, ${tipo}, 'ambos', ${tipo === 'liga' ? 'Rival' : null}, ${f}, ${hora}, ${oficial}, ${oficial ? null : 'sint-uno'}) returning id`;
        const base = (await sql`select public._limite_dudas(${id}) l`)[0].l;
        const web = H.limiteDudas({ tipo, fecha: f, inicio: hora, oficial });
        comprobados++;
        if (base.getTime() !== web.getTime()) distintos.push(`${clave}: base ${iso(base)} web ${iso(web)}`);
      }
    }
  }
  ok(distintos.length === 0 && comprobados > 600, `${comprobados} eventos (entreno, liga, amistoso, torneo, entre nosotros y plan; 27/10 y 28/3 incluidos): misma hora en la base y en la web`, distintos.slice(0, 3).join(' | '));
  await sql`delete from public.eventos where clave like 'cmp-%'`;

  // ---------------------------------------------------------------------------------------------- privacidad
  console.log('\n== Privacidad: nombre y estado sí; motivo, detalle y origen no; eventos ajenos, no');
  await sql`insert into public.respuestas (evento_id, person_id, respuesta, fuente, origen) values (${E.fut}, 'sint-uno', 'duda', 'web', 'jugador')`;
  await sql`insert into public.respuestas (evento_id, person_id, respuesta, motivo, detalle, fuente, origen) values (${E.fut}, 'sint-dos', 'no', 'trabajo', 'secreto-xyz', 'web', 'jugador')`;
  await sql`insert into public.respuestas (evento_id, person_id, respuesta, fuente, origen) values (${E.fut}, 'sint-tres', 'va', 'web', 'jugador')`;
  let r = await api(`/v_quien_va?select=*&evento_id=eq.${E.fut}`, { token: uno });
  const porNombre = Object.fromEntries((r.datos ?? []).map((x) => [x.nombre, x.estado]));
  ok(r.status === 200 && porNombre.Uno === 'duda' && porNombre.Dos === 'no' && porNombre.Tres === 'va' && porNombre.Cuatro === 'sin_responder', 'un jugador ve quién va, quién duda, quién no va y quién NO HA CONTESTADO (por nombre)', msg(r).slice(0, 300));
  ok((r.datos ?? []).every((x) => JSON.stringify(Object.keys(x).sort()) === JSON.stringify(['estado', 'evento_id', 'nombre'])), 'la vista solo da evento, nombre y estado (ni motivo, ni detalle, ni origen, ni quién la puso)');
  ok(!/secreto-xyz|trabajo|jugador|sistema/.test(msg(r)), 'ni rastro del motivo («trabajo») ni del detalle en lo que recibe el jugador');
  r = await api('/respuestas?select=*', { token: uno });
  ok(r.status === 200 && (r.datos ?? []).every((x) => x.person_id === 'sint-uno'), 'y la tabla de respuestas solo le deja leer las suyas');
  r = await api(`/v_quien_va?select=*&evento_id=eq.${E.ma}`, { token: cuatro });
  ok(r.status === 200 && r.datos.length === 0, 'Cuatro (solo MdL) NO ve «quién va» de un evento del MdA al que no está invitado');
  r = await api(`/v_mis_eventos?select=id&id=eq.${E.ma}`, { token: cuatro });
  ok(r.datos.length === 0, 'ni ese evento en su lista de eventos');
  r = await api(`/v_quien_va?select=*&evento_id=eq.${E.ma}`, { token: tres });
  ok(r.datos.length > 0 && r.datos.every((x) => x.nombre !== 'Cuatro'), 'Tres (MdA) sí lo ve, y Cuatro no aparece en la lista de ese evento');
  r = await api(`/v_quien_va?select=*`);
  ok(r.status === 401 || r.status === 403 || (Array.isArray(r.datos) && r.datos.length === 0), 'anónimo, nada', String(r.status));

  // ---------------------------------------------------------------------------------------------- límite en la base
  console.log('\n== Desde el límite la base rechaza «duda» (jugador, gestor, tablero y plan); «voy» y «no voy» siguen');
  r = await rpc('responder', { p_evento: E.pronto, p_respuesta: 'duda' }, uno);
  ok(/limite_dudas/.test(msg(r)), 'el jugador no puede poner «duda» pasado el límite', msg(r));
  r = await rpc('responder', { p_evento: E.fut, p_respuesta: 'duda' }, dos);
  ok(r.status === 200, 'antes del límite sí puede', msg(r));
  r = await rpc('responder_por', { p_evento: E.pronto, p_person: 'sint-uno', p_respuesta: 'duda' }, gestor);
  ok(/limite_dudas/.test(msg(r)), '«Responder por él» tampoco', msg(r));
  r = await rpc('tablero_responder', { p_evento: E.pronto, p_personas: ['sint-uno'], p_respuesta: 'duda' }, gestor);
  ok(/limite_dudas/.test(msg(r)), 'ni el tablero', msg(r));
  r = await rpc('responder_plan', { p_evento: E.plan, p_respuesta: 'duda' }, dos);
  ok(/limite_dudas/.test(msg(r)), 'ni un plan (24 h antes)', msg(r));
  r = await rpc('responder', { p_evento: E.pronto, p_respuesta: 'va' }, uno);
  ok(r.status === 200, '«Voy» pasado el límite, sí', msg(r));
  r = await rpc('responder', { p_evento: E.pronto, p_respuesta: 'no', p_motivo: 'trabajo' }, tres);
  ok(r.status === 200, '«No voy» pasado el límite, sí (con su motivo)', msg(r));

  // ---------------------------------------------------------------------------------------------- cierre con hora simulada
  console.log('\n== cerrar_dudas con la hora simulada: pasa a «no va · no confirmó», una sola vez');
  const poner = (ev, p, resp, extra = {}) => sql`insert into public.respuestas (evento_id, person_id, respuesta, fuente, origen) values (${ev}, ${p}, ${resp}, 'web', ${extra.origen ?? 'jugador'}) on conflict (evento_id, person_id) do update set respuesta = excluded.respuesta, motivo = null, detalle = null, origen = excluded.origen`;
  await poner(E.fut, 'sint-uno', 'duda'); await poner(E.fut, 'sint-dos', 'duda'); await poner(E.fut, 'sint-tres', 'va');
  await sql`delete from public.respuestas where evento_id = ${E.fut} and person_id = 'sint-cuatro'`;
  const lim = fut.l.getTime();
  const cerrar = async (ms) => sql`select * from public.cerrar_dudas(${new Date(ms).toISOString()}::timestamptz)`;
  const estado = async (ev) => Object.fromEntries((await sql`select person_id, respuesta, motivo, origen, puesto_por_nombre from public.respuestas where evento_id = ${ev}`).map((x) => [x.person_id, x]));
  let rows = await cerrar(lim - 3600000);
  let s = await estado(E.fut);
  ok(rows.filter((x) => x.r_evento === E.fut).length === 0 && s['sint-uno'].respuesta === 'duda', 'una hora ANTES del límite: no cambia nada');
  rows = await cerrar(lim);
  s = await estado(E.fut);
  ok(rows.filter((x) => x.r_evento === E.fut).length === 2, 'en el límite exacto: cierra las dos dudas', String(rows.length));
  ok(s['sint-uno'].respuesta === 'no' && s['sint-uno'].motivo === 'no_confirmo' && s['sint-uno'].origen === 'sistema' && s['sint-uno'].puesto_por_nombre === 'Sistema', 'Uno: «no va», motivo interno «no_confirmo», origen «sistema»');
  ok(s['sint-tres'].respuesta === 'va' && s['sint-tres'].origen === 'jugador', 'quien dijo «voy» no se toca');
  rows = await cerrar(lim + 60000);
  ok(rows.filter((x) => x.r_evento === E.fut).length === 0, 'repetirlo no cambia nada (idempotente)');
  // volver a «voy» después: se puede
  r = await rpc('responder', { p_evento: E.fut, p_respuesta: 'va' }, uno);
  s = await estado(E.fut);
  ok(r.status === 200 && s['sint-uno'].respuesta === 'va' && s['sint-uno'].motivo === null && s['sint-uno'].origen === 'jugador', 'quien pasó a «no va» puede volver a decir «voy»: queda «va», origen jugador, sin motivo', msg(r));
  r = await api(`/v_quien_va?select=*&evento_id=eq.${E.fut}`, { token: tres });
  ok(!/no_confirmo|sistema|Sistema/.test(msg(r)) && r.datos.find((x) => x.nombre === 'Dos')?.estado === 'no', 'un compañero ve a Dos en «no va» pero NO el motivo interno');
  // casos que no se tocan
  await poner(E.fut, 'sint-dos', 'duda');
  rows = await cerrar(fut.i.getTime() + 60000);
  ok(rows.filter((x) => x.r_evento === E.fut).length === 0, 'con el evento ya empezado, no se toca');
  await sql`update public.eventos set estado = 'cancelado' where id = ${E.fut}`;
  rows = await cerrar(lim + 60000);
  ok(rows.filter((x) => x.r_evento === E.fut).length === 0, 'cancelado, no se toca');
  await sql`update public.eventos set estado = 'programado' where id = ${E.fut}`;
  await sql`update public.respuestas_web_config set encendido = false where id = 1`;
  rows = await cerrar(lim + 60000);
  ok(rows.filter((x) => x.r_evento === E.fut).length === 0, 'con el interruptor apagado, los eventos oficiales no se tocan (siguen las respuestas que ya tenían)');
  await poner(E.plan, 'sint-dos', 'duda');
  const plan = await limiteBase(E.plan);
  rows = await cerrar(plan.l.getTime() + 60000);
  ok(rows.some((x) => x.r_evento === E.plan && x.r_person === 'sint-dos'), 'pero los planes sí (solo existen en la web), también con el interruptor apagado');
  await sql`update public.respuestas_web_config set encendido = true where id = 1`;
  await sql`delete from public.respuestas where evento_id = ${E.plan}`;
  // ---------------------------------------------------------------------------------------------- sin retroactividad
  console.log('\n== Sin retroactividad: solo se cierran dudas cuyo límite es POSTERIOR a la activación (dudas_desde)');
  await poner(E.fut, 'sint-uno', 'duda'); await poner(E.pronto, 'sint-uno', 'duda');
  await sql`update public.respuestas_web_config set dudas_desde = now() where id = 1`;
  rows = await cerrar(Date.now() + 60000);
  s = await estado(E.pronto);
  ok(rows.filter((x) => x.r_evento === E.pronto).length === 0 && s['sint-uno'].respuesta === 'duda', 'duda con el límite ANTES de la activación: no se cierra (límite ' + iso(pro.l) + ')');
  rows = await cerrar(lim);
  s = await estado(E.fut);
  ok(rows.some((x) => x.r_evento === E.fut && x.r_person === 'sint-uno') && s['sint-uno'].respuesta === 'no' && s['sint-uno'].origen === 'sistema', 'duda con el límite DESPUÉS de la activación: se cierra');
  await sql`update public.respuestas_web_config set dudas_desde = now() - interval '30 days' where id = 1`;
  rows = await cerrar(Date.now() + 60000);
  ok(rows.some((x) => x.r_evento === E.pronto), 'con la activación más atrás, la misma duda sí se cierra (prueba de que era la fecha lo que la frenaba)');
  await poner(E.fut, 'sint-uno', 'va'); await poner(E.fut, 'sint-dos', 'duda');
  await sql`delete from public.respuestas where evento_id = ${E.pronto} and person_id = 'sint-uno'`;
  // el estado de la respuesta única del domingo
  console.log('\n== Quién puede ejecutarla');
  const priv = (await sql`select has_function_privilege('authenticated', 'public.cerrar_dudas(timestamptz)', 'execute') a, has_function_privilege('anon', 'public.cerrar_dudas(timestamptz)', 'execute') n, has_function_privilege('service_role', 'public.cerrar_dudas(timestamptz)', 'execute') s, has_function_privilege('authenticated', 'public._limite_dudas(uuid)', 'execute') l`)[0];
  ok(!priv.a && !priv.n && priv.s && !priv.l, 'cerrar_dudas: solo el rol de servicio; _limite_dudas: nadie desde la API');
  r = await rpc('cerrar_dudas', { p_ahora: new Date(Date.now() + 864000000).toISOString() }, gestor);
  ok(r.status >= 400, 'ni un gestor con sesión puede llamarla (no podría simular la hora)', String(r.status));
  r = await rpc('cerrar_dudas', {}, uno);
  ok(r.status >= 400, 'ni un jugador', String(r.status));

  // ---------------------------------------------------------------------------------------------- tarea de avisos
  console.log('\n== Tarea de avisos (cada 15 min) de extremo a extremo');
  await sql`delete from public.respuestas where evento_id = ${E.pronto}`;
  await poner(E.pronto, 'sint-uno', 'duda'); await poner(E.pronto, 'sint-dos', 'duda'); await poner(E.pronto, 'sint-tres', 'va');
  const tarea = async () => { const t = await fetch(`${APP}/api/avisos/tarea`, { method: 'POST', headers: { authorization: `Bearer ${secreto}` } }); return { status: t.status, json: await t.json() }; };
  let t = await tarea();
  s = await estado(E.pronto);
  ok(t.status === 200 && t.json.cerradas >= 2, 'la tarea cierra las dudas pasadas de límite', JSON.stringify(t));
  ok(s['sint-uno'].respuesta === 'no' && s['sint-uno'].motivo === 'no_confirmo' && s['sint-dos'].origen === 'sistema' && s['sint-tres'].respuesta === 'va', 'Uno y Dos pasan a «no va · no confirmó»; Tres sigue en «va»');
  const avisos = async () => await sql`select clave, person_id, titulo, cuerpo from public.avisos_registro where clave like 'rec:paso:%' order by person_id`;
  let av = await avisos();
  ok(av.length === 2 && av.every((x) => x.titulo === 'Tu «duda» ha pasado a «no va»' && /No confirmaste a tiempo/.test(x.cuerpo)) && av.map((x) => x.person_id).join() === 'sint-dos,sint-uno', 'cada uno recibe UN aviso «tu duda ha pasado a no va»', JSON.stringify(av));
  ok(!/trabajo|lesi|motivo/i.test(av.map((x) => x.cuerpo).join(' ')), 'el aviso no lleva motivos');
  t = await tarea();
  av = await avisos();
  ok(t.json.cerradas === 0 && av.length === 2, 'repetir la tarea: nada nuevo ni duplicado', JSON.stringify(t));
  ok((await sql`select count(*)::int n from public.alertas_gestores where evento_id = ${E.pronto}`)[0].n === 0, 'el paso automático no dispara la banda roja de Gestión');
  // Un fallo REAL de la llamada (aquí: sin permiso, mensaje con «cerrar_dudas») no se traga: la tarea falla a la vista
  await sql`revoke execute on function public.cerrar_dudas(timestamptz) from service_role`;
  t = await tarea();
  ok(t.status === 500 && /cerrar dudas/.test(t.json.error ?? ''), 'error de cerrar_dudas distinto de «no existe»: la tarea devuelve 500 con el motivo (antes se escondía)', JSON.stringify(t));
  await sql`grant execute on function public.cerrar_dudas(timestamptz) to service_role`;
  t = await tarea();
  ok(t.status === 200 && t.json.cerradas === 0, 'devuelto el permiso, la tarea vuelve a 200 e informa de cuántas dudas cerró', JSON.stringify(t));
  // Uno vuelve a «voy» y la tarea no le avisa de nada más
  r = await rpc('responder', { p_evento: E.pronto, p_respuesta: 'va' }, uno);
  t = await tarea();
  av = await avisos();
  ok(r.status === 200 && av.length === 2 && (await estado(E.pronto))['sint-uno'].respuesta === 'va', 'Uno vuelve a «voy»: queda «va» y la tarea no repite ni cambia nada');

  // ---------------------------------------------------------------------------------------------- pantallas
  console.log('\n== Pantallas del jugador (375 px)');
  const hoy = madridDe(0).fecha;
  await sql`delete from public.respuestas where evento_id = ${E.fut}`;
  await poner(E.fut, 'sint-uno', 'duda'); await poner(E.fut, 'sint-dos', 'no'); await sql`update public.respuestas set motivo = 'trabajo', detalle = 'secreto-xyz' where evento_id = ${E.fut} and person_id = 'sint-dos'`;
  await poner(E.fut, 'sint-tres', 'va');
  const pu = await e.sesion('uno@pruebas.local', 375);
  await pu.goto(`${APP}/mi-zona/evento/${E.fut}`);
  const textoLim = H.textoLimite(fut.l, new Date());
  ok(await visto(pu.getByTestId('limite-dudas')), 'evento abierto: se ve el aviso del límite');
  const ltxt = await pu.getByTestId('limite-dudas').innerText();
  ok(ltxt.startsWith(`Si dudas, tienes hasta ${textoLim} para confirmar`), `«Si dudas, tienes hasta ${textoLim} para confirmar…»`, ltxt);
  ok(await pu.getByRole('button', { name: 'Duda', exact: true }).count() === 1, 'y el botón «Duda» está');
  await pu.getByTestId('quien-va-numeros-sin').click();
  const nombresDe = async () => (await pu.getByTestId('quien-va-numeros-lista').innerText()).split(String.fromCharCode(10)).map((x) => x.trim()).filter(Boolean);
  const lSin = await nombresDe();
  ok(lSin.includes('Cuatro') && !['Uno', 'Dos', 'Tres'].some((n) => lSin.includes(n)), '«sin responder» se despliega con el NOMBRE de quien no ha contestado (Cuatro, y no Uno, Dos ni Tres)', lSin.join(', ').slice(0, 200));
  await pu.getByTestId('quien-va-numeros-no').click();
  await pu.waitForFunction(() => document.querySelector('[data-testid="quien-va-numeros-lista"]')?.getAttribute('aria-label')?.startsWith('no van'));
  ok((await nombresDe()).includes('Dos'), '«no van» muestra a Dos');
  const html = await (await pu.request.get(`${APP}/mi-zona/evento/${E.fut}`)).text();
  ok(!/secreto-xyz|no_confirmo|No confirmó|Sistema/.test(html), 'el HTML que recibe el jugador no lleva el detalle («secreto-xyz») ni el motivo interno de ningún compañero');
  const ajeno = await pu.goto(`${APP}/mi-zona/evento/${E.ma}`);
  ok(ajeno?.status() === 200, 'Uno (MdA y MdL) sí ve el evento del MdA');
  await pu.close();
  const pc = await e.sesion('cuatro@pruebas.local', 375);
  const r404 = await pc.goto(`${APP}/mi-zona/evento/${E.ma}`);
  ok(r404?.status() === 404, 'Cuatro (solo MdL) recibe un 404 en un evento al que no está invitado');
  await pc.close();

  // pasado el límite: sin botón «Duda» y con la nota del paso a «no va»
  const pd = await e.sesion('dos@pruebas.local', 375);
  await pd.goto(`${APP}/mi-zona/evento/${E.pronto}`);
  ok(await pd.getByRole('button', { name: 'Voy', exact: true }).count() === 1 && await pd.getByRole('button', { name: 'No voy', exact: true }).count() === 1 && await pd.getByRole('button', { name: 'Duda', exact: true }).count() === 0, 'pasado el límite: quedan «Voy» y «No voy»; «Duda» desaparece');
  ok(await pd.getByTestId('limite-dudas').count() === 0, 'y ya no dice «Si dudas, tienes hasta…»');
  const paso = await pd.getByTestId('paso-no-va').innerText();
  ok(/pasó a «no va» porque no confirmaste a tiempo/.test(paso), 'Dos ve que su «duda» pasó a «no va» por no confirmar', paso);
  ok(/No vas · no confirmaste a tiempo/.test(await pd.locator('.rw-etiqueta').first().innerText()), 'y la etiqueta lo dice');
  await trasAccion(pd, () => pd.getByRole('button', { name: 'Voy', exact: true }).click());
  ok((await estado(E.pronto))['sint-dos'].respuesta === 'va', 'desde la pantalla puede volver a decir «Voy»');
  await pd.close();

  // la página del domingo: respuestas de cada partido y límite según la hora real
  const [dom] = await sql`select fecha::text f from public.eventos where tipo = 'liga' and estado = 'programado' and oficial and fecha > ${hoy} order by fecha limit 1`;
  const liga = await sql`select id, equipo, tipo, fecha::text f, inicio::text i from public.eventos where tipo = 'liga' and estado = 'programado' and fecha = ${dom.f}`;
  for (const ev of liga) await poner(ev.id, 'sint-uno', 'duda');
  const pu2 = await e.sesion('uno@pruebas.local', 375);
  await pu2.goto(`${APP}/mi-zona/domingo/${dom.f}`);
  const abierta = liga.every((ev) => H.dudaAbierta({ tipo: ev.tipo, fecha: ev.f, inicio: ev.i }, new Date()));
  const hayDuda = (await pu2.getByRole('button', { name: 'Duda', exact: true }).count()) === 1;
  ok(hayDuda === abierta && (await pu2.getByTestId('limite-dudas').count()) === (abierta ? 1 : 0), `domingo ${dom.f}: el límite ${abierta ? 'no ha llegado: hay «Duda» y el aviso' : 'ya pasó: no hay «Duda» ni aviso'}`);
  if (abierta) ok(/Si dudas, tienes hasta (hoy|mañana|el martes( \d+)?) a las 20:00 para confirmar/.test(await pu2.getByTestId('limite-dudas').innerText()), '«Si dudas, tienes hasta el martes a las 20:00 para confirmar»');
  ok(await pu2.getByTestId(`respuestas-${liga[0].equipo}`).count() === 1, 'cada partido del domingo trae su bloque «Respuestas al partido» (quién va, duda, no va, sin responder)');
  await pu2.getByTestId(`respuestas-numeros-${liga[0].equipo}-duda`).click();
  ok(/Uno/.test(await pu2.getByTestId(`respuestas-numeros-${liga[0].equipo}-lista`).innerText()), 'y «dudan» lleva a Uno por su nombre');
  ok(await pu2.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'sin desbordamiento horizontal a 375 px');
  await pu2.close();

  console.log('\n== Gestión: «Dudas: N · límite…», «pasaron a no va» y «posibles»');
  const pg = await e.sesion('gestor@pruebas.local', 1280);
  // Alarma de la tarea: con el esquema `net` falso de la pila local (en el real es pg_net)
  await sql`create schema if not exists net`;
  await sql`create table if not exists net._http_response (id bigserial primary key, status_code int, created timestamptz default now())`;
  await sql`delete from net._http_response`;
  await pg.goto(`${APP}/gestion`);
  ok((await pg.getByTestId('alarma-tarea').count()) === 0, 'alarma de la tarea: sin historial no aparece');
  await sql`insert into net._http_response (status_code, created) values (401, now() - interval '15 minutes'), (401, now())`;
  await pg.goto(`${APP}/gestion`);
  const al = await pg.getByTestId('alarma-tarea').innerText().catch(() => '');
  ok(/La tarea de avisos está fallando/.test(al) && /401 y 401/.test(al), 'dos 401 seguidos: banda roja en Gestión', al);
  await pg.goto(`${APP}/gestion/eventos`);
  ok((await pg.getByTestId('alarma-tarea').count()) === 1, 'y se ve en todas las pantallas de Gestión');
  await sql`insert into net._http_response (status_code, created) values (200, now() + interval '1 minute')`;
  await pg.goto(`${APP}/gestion`);
  ok((await pg.getByTestId('alarma-tarea').count()) === 0, 'con la última pasada en 200, desaparece');
  r = await rpc('estado_tarea_avisos', {}, uno);
  ok(r.status >= 400, 'un jugador no puede leer el estado de la tarea', String(r.status));
  // /api/avisos/salud (lo consulta un workflow de GitHub Actions)
  await sql`delete from net._http_response`;
  let sa = await fetch(`${APP}/api/avisos/salud`); let ja = await sa.json();
  ok(sa.status === 503 && ja.estado === 'fallando' && ja.ultima_pasada_ok === null, 'salud: sin ninguna pasada correcta, 503 «fallando»', JSON.stringify(ja));
  await sql`insert into net._http_response (status_code, created) values (401, now()), (200, now() - interval '5 minutes')`;
  sa = await fetch(`${APP}/api/avisos/salud`); ja = await sa.json();
  ok(sa.status === 200 && ja.estado === 'ok' && !!ja.ultima_pasada_ok && Object.keys(ja).sort().join() === 'estado,ultima_pasada_ok', 'salud: con una pasada 200 reciente, 200 «ok», y solo el estado y la hora (sin datos personales)', JSON.stringify(ja));
  await sql`delete from net._http_response`; await sql`insert into net._http_response (status_code, created) values (200, now() - interval '50 minutes')`;
  sa = await fetch(`${APP}/api/avisos/salud`); ja = await sa.json();
  ok(sa.status === 503 && ja.estado === 'fallando', 'salud: la última pasada correcta de hace 50 minutos, «fallando»', JSON.stringify(ja));
  await sql`drop table net._http_response`; await sql`drop schema net`;
  await pg.goto(`${APP}/gestion`);
  ok((await pg.getByTestId('alarma-tarea').count()) === 0, 'sin esquema net (pila local) no falla ni avisa');
  await pg.goto(`${APP}/gestion/eventos/${E.fut}/respuestas`);
  const lg = await pg.getByTestId('limite-dudas').innerText();
  ok(/^Dudas: 1 · límite \S+ \d\d\/\d\d \d\d:\d\d/.test(lg) && !/pasa/.test(lg), 'evento abierto: «Dudas: 1 · límite <día hora>»', lg);
  await pg.goto(`${APP}/gestion/eventos/${E.pronto}/respuestas`);
  await sql`update public.respuestas set respuesta = 'no', motivo = 'no_confirmo', origen = 'sistema', puesto_por_nombre = 'Sistema' where evento_id = ${E.pronto} and person_id = 'sint-tres'`;
  await pg.goto(`${APP}/gestion/eventos/${E.pronto}/respuestas`);
  const lg2 = await pg.getByTestId('limite-dudas').innerText();
  ok(/Dudas: 0 · límite/.test(lg2) && /1 pasó a «no va» por no confirmar/.test(lg2), 'pasado el límite: «Dudas: 0 · límite… · 1 pasó a «no va» por no confirmar»', lg2);
  const fila = await pg.locator('tr', { hasText: 'Tres' }).first().innerText();
  ok(/No confirmó/.test(fila) && /automático/.test(fila), 'la tabla de gestión lo marca: motivo «No confirmó», origen «automático»', fila);
  await pg.goto(`${APP}/gestion/eventos`);
  ok(await pg.getByTestId('linea-dudas').count() > 0 && /Dudas: \d+ · límite/.test(await pg.getByTestId('linea-dudas').first().innerText()), 'la lista de Eventos trae «Dudas: N · límite…» en la celda de respuestas');
  await pg.goto(`${APP}/gestion/convocatoria?fecha=${dom.f}`);
  ok(await visto(pg.getByTestId('cv-posibles')), 'Convocatoria: la sección «Posibles (dudas)»');
  const pos = await pg.getByTestId('cv-posibles').innerText();
  ok(/Uno/.test(pos) && /Duda al MdA y al MdL|Duda al MdA|Duda al MdL/.test(pos), 'con Uno, que duda a los partidos', pos.slice(0, 200));
  const sinConv = await pg.getByTestId('cv-sin-convocar').innerText();
  ok(!/Uno/.test(sinConv), 'y Uno no está en «Disponibles sin convocar» ni convocado: las dudas no se convocan');
  const nota = await pg.getByTestId('cv-posibles-nota').count();
  ok(nota === (abierta ? 1 : 0), abierta ? 'antes del límite: nota «Propuesta provisional… hasta el martes… la definitiva se hace después»' : 'pasado el límite no hay nota de propuesta provisional');
  await pg.close();
  ok(e.errores.length === 0, 'sin errores de JavaScript en ninguna pantalla', e.errores.slice(0, 3).join(' | '));

  // ---------------------------------------------------------------------------------------------- migración reversible
  console.log('\n== Migración 20261028100000 reversible (D111)');
  const texto = fs.readFileSync(path.join(RAIZ, 'supabase', 'migrations', '20261028100000_dudas_limite.sql'), 'utf8').replace(/--.*$/gm, '');
  ok(!/\bdrop table\b|\btruncate\b|\bdelete\b|\bcreate table\b|\bdrop column\b/i.test(texto), 'sin tablas nuevas ni borrados: solo relaja dos CHECK, cambia una función y añade dos');
  await sql.unsafe(fs.readFileSync(path.join(RAIZ, 'supabase', 'migrations', '20261028220000_ultima_pasada_avisos.revertir.sql'), 'utf8'));
  await sql.unsafe(fs.readFileSync(path.join(RAIZ, 'supabase', 'migrations', '20261028210000_estado_tarea_avisos.revertir.sql'), 'utf8'));
  ok(!(await sql`select 1 from pg_proc where proname = 'estado_tarea_avisos'`).length, 'revertida la alarma (20261028210000): se va estado_tarea_avisos');
  await sql.unsafe(fs.readFileSync(path.join(RAIZ, 'supabase', 'migrations', '20261028200000_dudas_activacion.revertir.sql'), 'utf8'));
  ok(!(await sql`select 1 from information_schema.columns where table_name = 'respuestas_web_config' and column_name = 'dudas_desde'`).length, 'revertida la de la activación (20261028200000): se va la columna dudas_desde');
  await sql.unsafe(fs.readFileSync(path.join(RAIZ, 'supabase', 'migrations', '20261028100000_dudas_limite.revertir.sql'), 'utf8'));
  const quedan = (await sql`select proname from pg_proc where proname in ('cerrar_dudas', '_limite_dudas')`).length;
  const sist = (await sql`select count(*)::int n from public.respuestas where origen = 'sistema' or motivo = 'no_confirmo'`)[0].n;
  ok(quedan === 0 && sist === 0 && !(await sql`select 1 from supabase_migrations.schema_migrations where version = '20261028100000'`).length, 'revertida: sin las dos funciones, las respuestas del sistema quedan como «gestor / otro» y se borra su registro');
  r = await rpc('responder', { p_evento: E.pronto, p_respuesta: 'duda' }, uno);
  ok(r.status === 200, 'y la base vuelve a admitir «duda» sin límite (como antes)', msg(r));
  await migrar(sql, { log: () => {} });
  ok((await sql`select count(*)::int n from pg_proc where proname in ('cerrar_dudas', '_limite_dudas')`)[0].n === 2, 'vuelta a aplicar: las dos funciones están otra vez');
} catch (err) {
  console.log(`  FALLO excepción -> ${err.stack ?? err}`);
  process.exitCode = 1;
} finally {
  await e.parar();
}
const n = fallos();
console.log(n || process.exitCode ? `\n${n} FALLO(S)` : '\nTodo OK');
process.exit(n || process.exitCode ? 1 : 0);
