#!/usr/bin/env node
/**
 * separar_asistencia.js — una sola vez (D82): saca los motivos de ausencia de los data/season_*.json ya publicados.
 *
 * Por cada temporada con asistencia: guarda el detalle completo en privado/asistencia/asistencia_<t>.json (fuera de
 * git; si ya existe con otro contenido, para sin tocar nada) y deja en el JSON público solo { fueron, total, pct }.
 * La 2025/26 no se regenera (D43): solo se le quitan esos campos, el resto queda byte a byte igual.
 *
 *   node scripts/separar_asistencia.js            separa
 *   node scripts/separar_asistencia.js --dry      solo cuenta
 */
const fs = require('fs');
const path = require('path');
const { publica, detalle, buscarMotivos, DIR_PRIVADO } = require('./estadisticas/asistencia_privacidad');

const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry');
const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'index.json'), 'utf8'));

for (const s of idx.seasons) {
  const f = path.join(ROOT, s.file);
  const texto = fs.readFileSync(f, 'utf8');
  const t = JSON.parse(texto);
  const con = (t.players || []).filter(p => p.asist_part || p.asist_entr);
  if (!con.length || !buscarMotivos(t.players).length) { console.log(`${s.id}: sin motivos de ausencia, nada que hacer.`); continue; }
  const privado = {
    temporada: s.id,
    generado: new Date().toISOString().slice(0, 10),
    fuente: `Separado de ${s.file} (D82); los datos originales vienen de SportEasy.`,
    jugadores: con.map(p => ({ person_id: p.person_id, display: p.display, partidos: detalle(p.asist_part), entrenos: detalle(p.asist_entr) }))
      .sort((a, b) => (a.person_id < b.person_id ? -1 : 1)),
  };
  const destino = path.join(DIR_PRIVADO, `asistencia_${s.id}.json`);
  if (fs.existsSync(destino)) {
    const previo = JSON.parse(fs.readFileSync(destino, 'utf8'));
    if (JSON.stringify(previo.jugadores) !== JSON.stringify(privado.jugadores)) {
      console.error(`${s.id}: ${path.relative(ROOT, destino)} ya existe con otro contenido. No toco nada (D41).`); process.exit(1);
    }
  }
  for (const p of con) { p.asist_part = publica(p.asist_part); p.asist_entr = publica(p.asist_entr); }
  const bonito = /^\{\s*\n/.test(texto);
  const salida = (bonito ? JSON.stringify(t, null, texto.match(/^\{\n( +)/)?.[1].length ?? 1) : JSON.stringify(t)) + '\n';
  console.log(`${s.id}: ${con.length} jugadores con asistencia -> ${path.relative(ROOT, destino)}; público solo con fueron/total/pct.`);
  if (DRY) continue;
  fs.mkdirSync(DIR_PRIVADO, { recursive: true });
  fs.writeFileSync(destino, JSON.stringify(privado, null, 1) + '\n', 'utf8');
  fs.writeFileSync(f, salida, 'utf8');
}
