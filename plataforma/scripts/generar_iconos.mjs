#!/usr/bin/env node
// Iconos de la web instalable a partir del escudo (public/escudo.png): favicon, icono de Apple y los del manifiesto
// (192, 512 y "maskable" con margen de seguridad). Fondo #0E0D12, el de la web publica.
//
//   node scripts/generar_iconos.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ESCUDO = path.join(RAIZ, 'public', 'escudo.png');
const FONDO = '#0E0D12';

async function icono(lado, destino, ocupa) {
  const dentro = Math.round(lado * ocupa);
  const escudo = await sharp(ESCUDO).resize(dentro, dentro, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({ create: { width: lado, height: lado, channels: 4, background: FONDO } })
    .composite([{ input: escudo, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(RAIZ, destino));
  console.log(`${destino} (${lado}x${lado})`);
}

await icono(192, 'public/iconos/icono-192.png', 0.86);
await icono(512, 'public/iconos/icono-512.png', 0.86);
await icono(512, 'public/iconos/icono-maskable-512.png', 0.66); // zona segura de los iconos adaptativos de Android
await icono(180, 'src/app/apple-icon.png', 0.8);
await icono(64, 'src/app/icon.png', 0.94);
