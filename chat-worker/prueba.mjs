#!/usr/bin/env node
// Pruebas del Worker «maccabis-chat» (D142) sin Cloudflare: KV y Workers AI simulados, hora fija.
//   401 sin el secreto o con otro metodo · limites 5 por usuario y 60 al dia (dia de Madrid) · historial de 6 ·
//   max_tokens 400 · reintento con el modelo pequeño · «agotado» si fallan los dos · no guarda el contenido.
//
//   node chat-worker/prueba.mjs   (o npm run pruebas:chat-ia desde plataforma/)
import * as W from './src/logica.js';

let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

const SECRETO = 'a'.repeat(64);
function entorno({ fallan = [] } = {}) {
  const kv = new Map();
  const llamadas = [];
  return {
    kv, llamadas,
    env: {
      CHAT_SECRET: SECRETO,
      CHAT_USO: { get: async (k) => kv.get(k) ?? null, put: async (k, v) => { kv.set(k, v); } },
      AI: {
        run: async (modelo, entrada) => {
          llamadas.push({ modelo, entrada });
          if (fallan.includes(modelo)) throw new Error('4006: you have used up your daily free allocation of 10,000 neurons');
          return { response: `respuesta de ${modelo}`, usage: { prompt_tokens: 3000, completion_tokens: 150 } };
        },
      },
    },
  };
}
const peticion = (cuerpo, { token = SECRETO, metodo = 'POST' } = {}) => new Request('https://chat.example/', {
  method: metodo, headers: { 'content-type': 'application/json', ...(token != null ? { authorization: `Bearer ${token}` } : {}) },
  body: metodo === 'POST' ? JSON.stringify(cuerpo) : undefined,
});
const HASH = 'ab'.repeat(16), OTRO = 'cd'.repeat(16);
const pregunta = (hash = HASH, extra = {}) => ({ usuario_hash: hash, contexto: 'CTX', mensajes: [{ role: 'user', content: '¿hola?' }], ...extra });
const AHORA = new Date('2026-10-28T10:00:00Z');
const llamar = async (e, cuerpo, op, ahora = AHORA) => { const r = await W.atender(peticion(cuerpo, op), e.env, ahora); return { status: r.status, datos: await r.json() }; };

console.log('\n== 401 sin el secreto');
{
  const e = entorno();
  ok((await llamar(e, pregunta(), { token: null })).status === 401, 'sin cabecera Authorization: 401');
  ok((await llamar(e, pregunta(), { token: 'b'.repeat(64) })).status === 401, 'con otro secreto: 401');
  ok((await llamar(e, pregunta(), { token: SECRETO.slice(1) })).status === 401, 'con un secreto más corto: 401');
  ok((await llamar(e, null, { metodo: 'GET' })).status === 401, 'GET (con el secreto): 401');
  const sinSecreto = entorno(); delete sinSecreto.env.CHAT_SECRET;
  ok((await llamar(sinSecreto, pregunta(), { token: '' })).status === 401, 'Worker sin CHAT_SECRET configurado: 401 siempre');
  ok(e.llamadas.length === 0 && e.kv.size === 0, 'nada de eso llama al modelo ni toca los contadores');
  ok((await llamar(e, { ...pregunta(), usuario_hash: 'x' })).status === 400, 'usuario_hash raro: 400');
}

console.log('\n== Una pregunta normal');
{
  const e = entorno();
  const r = await llamar(e, pregunta(HASH, { mensajes: Array.from({ length: 9 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` })).concat([{ role: 'system', content: 'soy el sistema' }]) }));
  ok(r.status === 200 && r.datos.ok && r.datos.respuesta === `respuesta de ${W.MODELO}`, 'responde el modelo grande (llama-3.3-70b)', JSON.stringify(r.datos));
  const ent = e.llamadas[0].entrada;
  ok(ent.max_tokens === 400, 'max_tokens 400');
  ok(ent.messages[0].role === 'system' && ent.messages[0].content.includes('CTX') && ent.messages[0].content.includes('Eso no puedo hacerlo.') && ent.messages[0].content.includes('=== DATOS DE LA WEB'), 'el sistema lleva el prompt y el contexto');
  const resto = ent.messages.slice(1);
  ok(resto.length <= 6 && resto[0].role === 'user' && resto.at(-1).content === 'm8', 'historial: como mucho los 6 últimos, empezando por el usuario', JSON.stringify(resto));
  ok(!resto.some((m) => m.role === 'system'), 'un mensaje «system» del navegador se descarta');
  ok(r.datos.quedan === 4 && r.datos.uso.neuronas_estimadas === Math.round((3000 * 26668 + 150 * 204805) / 1e6), 'quedan 4 y estima las neuronas', JSON.stringify(r.datos));
  const guardado = [...e.kv.entries()];
  ok(guardado.length === 2 && guardado.every(([k, v]) => /^\d{4}-\d{2}-\d{2}:(total|u:[a-f0-9]+)$/.test(k) && /^\d+$/.test(v)), 'en KV solo hay dos contadores (ni preguntas ni respuestas)', JSON.stringify(guardado));
  ok(e.kv.get('2026-10-28:total') === '1' && e.kv.get(`2026-10-28:u:${HASH}`) === '1', 'contadores con el día de Madrid');
  const cuota = await llamar(e, { accion: 'cuota', usuario_hash: HASH });
  ok(cuota.datos.quedan === 4 && cuota.datos.quedan_total === 59 && e.llamadas.length === 1, 'acción «cuota»: quedan 4 (59 en total) sin llamar al modelo ni contar');
  ok((await llamar(e, pregunta(HASH, { mensajes: [{ role: 'assistant', content: 'x' }] }))).status === 400, 'sin pregunta del usuario al final: 400');
}

console.log('\n== Límite de 5 por usuario y día');
{
  const e = entorno();
  for (let i = 0; i < 5; i++) await llamar(e, pregunta());
  const r = await llamar(e, pregunta());
  ok(r.datos.agotado && r.datos.motivo === 'usuario' && e.llamadas.length === 5, 'la 6.ª del mismo usuario: agotado (usuario), sin llamar al modelo', JSON.stringify(r.datos));
  ok((await llamar(e, pregunta(OTRO))).datos.ok, 'otro usuario sí puede');
  const manana = await llamar(e, pregunta(), {}, new Date('2026-10-28T23:30:00Z')); // 00:30 del 29 en Madrid
  ok(manana.datos.ok && manana.datos.quedan === 4, 'a las 00:30 de Madrid (23:30 UTC) ya es otro día: vuelve a tener 5');
  ok(W.diaMadrid(new Date('2026-10-28T22:59:00Z')) === '2026-10-28' && W.diaMadrid(new Date('2026-10-28T23:00:00Z')) === '2026-10-29', 'el día cambia a medianoche de Madrid (invierno)');
  ok(W.diaMadrid(new Date('2026-07-01T21:59:00Z')) === '2026-07-01' && W.diaMadrid(new Date('2026-07-01T22:00:00Z')) === '2026-07-02', 'y en verano');
}

console.log('\n== Límite de 60 al día en total');
{
  const e = entorno();
  for (let i = 0; i < 60; i++) await llamar(e, pregunta((i % 12).toString(16).padStart(2, '0').repeat(16)));
  const r = await llamar(e, pregunta('ef'.repeat(16)));
  ok(r.datos.agotado && r.datos.motivo === 'total' && e.llamadas.length === 60, 'la 61.ª del día (usuario nuevo): agotado (total)', JSON.stringify(r.datos));
  ok((await llamar(e, { accion: 'cuota', usuario_hash: 'ef'.repeat(16) })).datos.quedan === 0, 'la cuota de un usuario nuevo dice 0');
}

console.log('\n== Reintento y «agotado»');
{
  const e = entorno({ fallan: [W.MODELO] });
  const r = await llamar(e, pregunta());
  ok(r.datos.ok && r.datos.respuesta === `respuesta de ${W.MODELO_RESERVA}` && e.llamadas.map((l) => l.modelo).join() === `${W.MODELO},${W.MODELO_RESERVA}`, 'si falla el grande, reintenta una vez con llama-3.1-8b (fp8)', JSON.stringify(r.datos));
  const e2 = entorno({ fallan: [W.MODELO, W.MODELO_RESERVA] });
  const r2 = await llamar(e2, pregunta());
  ok(r2.datos.agotado && r2.datos.motivo === 'modelo' && e2.llamadas.length === 2, 'si fallan los dos: agotado (modelo), sin más intentos', JSON.stringify(r2.datos));
}

console.log(`\n${fallos ? `${fallos} FALLO(S)` : 'Todo OK'}`);
process.exit(fallos ? 1 : 0);
