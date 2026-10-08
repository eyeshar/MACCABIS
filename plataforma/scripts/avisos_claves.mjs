#!/usr/bin/env node
// Claves de los avisos (D99.5): genera, SOLO si faltan, las claves VAPID y el secreto de la tarea y las escribe en
// plataforma/.env.local (ignorado por git). No las imprime: solo dice que estan y enseña la PUBLICA (es publica por
// diseño: va en el navegador). Para Vercel, copia los valores de .env.local (pasos en plataforma/LEEME.md, apartado 8).
//
//   npm run avisos:claves

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV = path.join(RAIZ, '.env.local');
let texto = fs.existsSync(ENV) ? fs.readFileSync(ENV, 'utf8') : '';
const tiene = (k) => new RegExp(`^${k}=\\S+`, 'm').test(texto);
const nuevas = [];
if (!tiene('NEXT_PUBLIC_VAPID_PUBLIC_KEY') || !tiene('VAPID_PRIVATE_KEY')) {
  const v = webpush.generateVAPIDKeys();
  texto = texto.replace(/^(NEXT_PUBLIC_VAPID_PUBLIC_KEY|VAPID_PRIVATE_KEY)=.*\n?/gm, '');
  nuevas.push(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${v.publicKey}`, `VAPID_PRIVATE_KEY=${v.privateKey}`);
}
if (!tiene('VAPID_SUBJECT')) nuevas.push('VAPID_SUBJECT=https://maccabis.vercel.app');
if (!tiene('AVISOS_SECRETO')) nuevas.push(`AVISOS_SECRETO=${crypto.randomBytes(32).toString('hex')}`);
if (nuevas.length) {
  fs.writeFileSync(ENV, `${texto.replace(/\s*$/, '\n')}\n# Avisos al movil (D99). NUNCA a git ni al chat; copiar a Vercel (LEEME, apartado 8).\n${nuevas.join('\n')}\n`);
}
texto = fs.readFileSync(ENV, 'utf8');
const pub = texto.match(/^NEXT_PUBLIC_VAPID_PUBLIC_KEY=(\S+)/m)?.[1];
console.log(nuevas.length ? `Añadidas a .env.local: ${nuevas.map((x) => x.split('=')[0]).join(', ')}.` : 'Las claves ya estaban en .env.local: no se cambia nada.');
console.log(`Clave pública VAPID (no es secreta): ${pub}`);
console.log(`¿Falta SUPABASE_SERVICE_ROLE_KEY en .env.local? ${tiene('SUPABASE_SERVICE_ROLE_KEY') ? 'no' : 'SÍ: cópiala del panel de Supabase (LEEME, apartado 8)'}`);
