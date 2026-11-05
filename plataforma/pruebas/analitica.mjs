#!/usr/bin/env node
// Analitica de Vercel (D188), lista pero apagada: lo que saldria hacia Vercel (src/lib/analitica.ts) va sin consulta,
// sin fragmento, sin el enlace secreto del calendario y sin eventos propios; el layout solo la monta con
// NEXT_PUBLIC_ANALITICA=1; la CSP la deja pasar sin abrir nada nuevo (mismo dominio, /_vercel/insights).
//
//   npm run pruebas:analitica
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { limpiarUrl, antesDeEnviar } from '../src/lib/analitica.ts';

const PLAT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };
const W = 'https://maccabis.vercel.app';

console.log('\n== La URL que se manda');
ok(limpiarUrl(`${W}/liga?grupos=G1,G2&t=resultados`) === `${W}/liga`, 'sin consulta');
ok(limpiarUrl(`${W}/inicio?hoy=2026-11-08&persona=sint-zeta`) === `${W}/inicio`, 'sin ?hoy= ni ?persona=');
ok(limpiarUrl(`${W}/auth/confirm?token_hash=abc&type=email`) === `${W}/auth/confirm`, 'sin el token del enlace del correo');
ok(limpiarUrl(`${W}/entrar#access_token=abc&refresh_token=def`) === `${W}/entrar`, 'sin fragmento (los tokens de sesión que pueda llevar)');
const token = 'a'.repeat(43);
ok(limpiarUrl(`${W}/cal/${token}.ics`) === `${W}/cal/[enlace]`, 'el calendario personal: la plantilla, nunca el enlace');
ok(!String(limpiarUrl(`${W}/cal/${token}.ics?x=1`)).includes(token), 'ni con consulta');
ok(limpiarUrl(`${W}/jugador/sint-zeta`) === `${W}/jugador/sint-zeta` && limpiarUrl(`${W}/`) === `${W}/`, 'el resto de rutas, igual');
ok(limpiarUrl('no es una url') === null, 'una URL ilegible no sale');

console.log('\n== Qué eventos salen');
const v = antesDeEnviar({ type: 'pageview', url: `${W}/cal/${token}.ics?x=1#y` });
ok(v?.type === 'pageview' && v.url === `${W}/cal/[enlace]`, 'la visita de página sale, con la URL limpia');
ok(antesDeEnviar({ type: 'event', url: `${W}/`, name: 'algo', data: { correo: 'zeta@pruebas.local' } }) === null, 'ningún evento propio (ni sus datos)');
ok(antesDeEnviar({ type: 'pageview', url: '::' }) === null, 'una visita con URL ilegible no sale');

console.log('\n== Apagada por defecto y la CSP');
const layout = fs.readFileSync(path.join(PLAT, 'src', 'app', 'layout.tsx'), 'utf8');
ok(/\{ANALITICA_ACTIVA && <Analitica \/>\}/.test(layout), 'el layout raíz solo la monta si ANALITICA_ACTIVA');
const lib = fs.readFileSync(path.join(PLAT, 'src', 'lib', 'analitica.ts'), 'utf8');
ok(/ANALITICA_ACTIVA = process\.env\.NEXT_PUBLIC_ANALITICA === "1"/.test(lib), 'y ANALITICA_ACTIVA solo con NEXT_PUBLIC_ANALITICA=1');
const comp = fs.readFileSync(path.join(PLAT, 'src', 'components', 'analitica', 'Analitica.tsx'), 'utf8');
ok(/from "@vercel\/analytics\/next"/.test(comp) && /beforeSend=\{antesDeEnviar\}/.test(comp), '<Analytics /> de @vercel/analytics/next con beforeSend');
const conf = fs.readFileSync(path.join(PLAT, 'next.config.ts'), 'utf8');
const csp = (n) => conf.match(new RegExp(`"${n} ([^"]*)"`))?.[1] ?? '';
ok(/'self'/.test(csp('script-src')) && /'self'/.test(csp('connect-src')), "script-src y connect-src permiten 'self' (/_vercel/insights)");
ok(!/vercel-scripts|vercel-insights|vitals\.vercel/.test(conf), 'la CSP no abre ningún dominio de Vercel');
const pkg = JSON.parse(fs.readFileSync(path.join(PLAT, 'package.json'), 'utf8'));
ok(/^\d+\.\d+\.\d+$/.test(pkg.dependencies['@vercel/analytics'] ?? ''), '@vercel/analytics con versión exacta', pkg.dependencies['@vercel/analytics']);

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exitCode = fallos ? 1 : 0;
