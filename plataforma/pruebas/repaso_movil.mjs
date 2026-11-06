#!/usr/bin/env node
// Repaso de visibilidad en el movil (fix/visibilidad-movil): pila local, web compilada y Chrome a 360 y 390 px, como jugador
// y como gestor, por todas las pantallas. NO es una suite (no falla): mide y lo deja en un informe JSON.
//   - desborde de la pagina; por tabla: cuantas columnas se ven enteras sin desplazar y si la primera va fija;
//   - botones, pestañas, casillas y selectores de menos de 44 px; textos que se salen de su caja; titulos a dos lineas.
// Con REPASO_CAPTURAS=<carpeta>, capturas a 390 px de cada pantalla (solo en local: privado/ no va a git).
//   npm run repaso:movil -- <informe.json>   (REPASO_RUTAS=a,b para unas pantallas; REPASO_ANCHOS=360,390)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { preparar, personas, REPO } from './comun_e2e.mjs';
import { hoyMadrid } from './fechas_prueba.mjs';
import { hasta } from './infra/esperas.mjs';
import { ligaParaPruebas } from './infra/liga.mjs';
import { cargarLiga } from '../scripts/cargar_liga.mjs';

const salida = process.argv[2] ?? 'repaso_movil.json';
const CAP = process.env.REPASO_CAPTURAS;
const soloRutas = process.env.REPASO_RUTAS?.split(',');
const anchos = (process.env.REPASO_ANCHOS ?? '360,390').split(',').map(Number);

const medir = () => {
  const vw = window.innerWidth;
  const visible = (x) => x.getClientRects().length > 0 && getComputedStyle(x).visibility !== 'hidden' && x.getBoundingClientRect().width > 0;
  const scrollPadre = (x) => { for (let n = x.parentElement; n; n = n.parentElement) { const o = getComputedStyle(n).overflowX; if ((o === 'auto' || o === 'scroll') && n !== document.documentElement && n !== document.body) return n; } return null; };
  const txt = (x) => (x.textContent || x.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const cls = (x) => x.tagName.toLowerCase() + (typeof x.className === 'string' && x.className ? '.' + x.className.trim().split(/\s+/)[0] : '');
  const res = { desborda: document.documentElement.scrollWidth > vw + 1, tablas: [], pequenos: [], salen: [], dosLineas: [] };
  for (const t of document.querySelectorAll('#contenido table')) {
    if (!visible(t)) continue;
    const caja = scrollPadre(t);
    const cr = (caja ?? document.documentElement).getBoundingClientRect();
    const der = Math.min(cr.right, vw), izq = Math.max(cr.left, 0);
    const fila = t.tHead?.rows[t.tHead.rows.length - 1] ?? t.rows[0];
    if (!fila) continue;
    const celdas = [...fila.cells].filter(visible);
    const enteras = celdas.filter((c) => { const r = c.getBoundingClientRect(); return r.left >= izq - 1 && r.right <= der + 1; }).length;
    const fija = celdas.slice(0, 2).some((c) => getComputedStyle(c).position === 'sticky');
    res.tablas.push({ id: t.dataset.testid || t.id || cls(t), columnas: celdas.length, enteras, desplaza: caja ? caja.scrollWidth > caja.clientWidth + 1 : t.scrollWidth > vw + 1, fija, cabeceras: celdas.map(txt).join('|').slice(0, 120) });
  }
  const objetivos = '#contenido button, #contenido summary, #contenido select, #contenido [role="button"], #contenido input[type="checkbox"], #contenido input[type="radio"], #contenido nav a, #contenido a.boton, #contenido a[class*="boton"], #contenido a[class*="chip"]';
  for (const x of document.querySelectorAll(objetivos)) {
    if (!visible(x)) continue;
    const zona = (x.matches('input') && x.closest('label')) || x;   // una casilla cuenta por su etiqueta (lo que se toca)
    const r = zona.getBoundingClientRect();
    if (r.height < 43.5 || r.width < 43.5) res.pequenos.push({ t: txt(zona) || x.tagName, h: Math.round(r.height), w: Math.round(r.width), sel: cls(zona) });
  }
  for (const x of document.querySelectorAll('#contenido *')) {
    if (!visible(x) || x.closest('table, .solo-lectores') || x.matches('.solo-lectores') || scrollPadre(x) || x.children.length) continue;
    const r = x.getBoundingClientRect();
    if (r.right > vw + 1 && txt(x)) res.salen.push({ t: txt(x), der: Math.round(r.right), sel: cls(x) });
    else if (x.scrollWidth > x.clientWidth + 1 && ['hidden', 'clip'].includes(getComputedStyle(x).overflowX) && getComputedStyle(x).textOverflow !== 'ellipsis') res.salen.push({ t: txt(x), cortado: true, sel: cls(x) });
  }
  for (const h of document.querySelectorAll('#contenido h1, #contenido h2, #contenido h3, #contenido summary, #contenido .e-eqp-t')) {
    if (!visible(h)) continue;
    const rng = document.createRange(); rng.selectNodeContents(h);
    // Una linea nueva empieza por debajo de lo ya visto (una etiqueta mas pequeña en la misma linea no cuenta)
    let lineas = 0, fondo = -Infinity;
    for (const r of [...rng.getClientRects()].filter((x) => x.width > 1).sort((x, y) => x.top - y.top)) { if (r.top >= fondo - 2) { lineas++; fondo = r.bottom; } else fondo = Math.max(fondo, r.bottom); }
    if (lineas > 1) res.dosLineas.push({ t: txt(h), sel: cls(h) });
  }
  return res;
};

// El mismo cerrojo de suite pesada que pruebas:rapidas (D167): nunca dos pesadas a la vez en el equipo.
const CERROJO = path.join(os.tmpdir(), 'maccabis-pruebas-pesada');
const vivo = (pid) => { try { process.kill(pid, 0); return true; } catch (x) { return x.code === 'EPERM'; } };
for (let avisado = false; ;) {
  try { fs.mkdirSync(CERROJO); fs.writeFileSync(path.join(CERROJO, 'dueno.json'), JSON.stringify({ pid: process.pid, worktree: REPO, suite: 'repaso-movil', desde: new Date().toISOString() })); break; }
  catch (x) {
    if (x.code !== 'EEXIST') throw x;
    let d = null; try { d = JSON.parse(fs.readFileSync(path.join(CERROJO, 'dueno.json'), 'utf8')); } catch { /* recien creada */ }
    if (d && !vivo(d.pid)) { fs.rmSync(CERROJO, { recursive: true, force: true }); continue; }
    if (!avisado && d) { console.log(`  (esperando: ${d.suite} en ${path.basename(d.worktree)})`); avisado = true; }
    await new Promise((r) => setTimeout(r, 2000));
  }
}
process.on('exit', () => { try { fs.rmSync(CERROJO, { recursive: true, force: true }); } catch {} });

const e = await preparar();
const { sql, APP } = e;
const informe = [];
try {
  await cargarLiga(sql, ligaParaPruebas('2026-27'), '2026-27', { log: () => {} });
  await personas(e.pila, {
    jugadores: [['esteban-jon', 'jon@pruebas.local']],
    gestores: [['Iván', 'ivan@pruebas.local', 'villaescusa-silva-ivan']],
  });
  await sql`update public.jugadores set ficha_mda = true where person_id = 'villaescusa-silva-ivan'`;
  const hoy = hoyMadrid();
  const [ent] = await sql`select id from public.eventos where tipo = 'entreno' and estado = 'programado' and fecha >= ${hoy} order by fecha limit 1`;
  const [par] = await sql`select id from public.eventos where tipo = 'liga' and estado = 'programado' and fecha >= ${hoy} order by fecha limit 1`;
  const liga = JSON.parse(fs.readFileSync(path.join(REPO, 'plataforma', 'src', 'data', 'liga.json'), 'utf8'));
  const partido = liga.grupos.G1.resultados[0]?.id;
  const [consol] = await sql`select id from public.liga_partidos where grupo = 'G5' order by jornada nulls last limit 1`;
  const T = '2026-27';
  const comunes = [
    ['liga-clasificacion', '/liga'], ['liga-clasificacion-g2', '/liga?g=G2'], ['liga-clasificacion-g5', '/liga?g=G5'], ['liga-rivales', '/liga/rivales'], ['liga-scouting', '/liga/scouting'],
    ['liga-jugadores', '/liga/consolidada'], ['liga-jugadores-resultados', '/liga/consolidada?vista=resultados'],
    ...(consol ? [['liga-jugadores-partido', `/liga/consolidada/partido/${consol.id}`]] : []),
    ...['equipo', 'jugadores', 'rankings', 'cuartos', 'asistencia', 'mda'].map((p) => [`liga-temporadas-${p}`, `/liga/${T}/${p}`]),
    ...(partido ? [['liga-partido', `/liga/${T}/partido/${encodeURIComponent(partido)}`]] : []),
    ['club-plantilla', '/club'], ['club-historia', '/club/historia'], ['club-el-club', '/club/el-club'], ['jugador-ficha', `/jugador/esteban-jon?t=${T}`],
    ['semana', '/'], ['calendario', '/calendario'], ['evento-entreno', `/evento/${ent.id}`], ['evento-partido', `/evento/${par.id}`], ['yo', '/yo'],
  ];
  const gestion = [
    ['gestion', '/gestion'], ['gestion-convocatoria', '/gestion/convocatoria'], ['gestion-eventos', '/gestion/eventos'], ['gestion-jugadores', '/gestion/jugadores'],
    ['gestion-asistencia', '/gestion/asistencia'], ['gestion-clasificacion', '/gestion/clasificacion'], ['gestion-tablero', '/gestion/tablero'], ['gestion-ropa', '/gestion/ropa'],
    ['evento-gestor-respuestas', `/evento/${ent.id}`], ['evento-gestor-convocatoria', `/evento/${par.id}?tab=convocatoria`],
  ];
  for (const [rol, email, rutas] of [['jugador', 'jon@pruebas.local', comunes], ['gestor', 'ivan@pruebas.local', [...comunes, ...gestion]]]) {
    for (const ancho of anchos) {
      const p = await e.sesion(email, ancho);
      for (const [nombre, ruta] of rutas) {
        if (soloRutas && !soloRutas.includes(nombre)) continue;
        try {
          await p.goto(`${APP}${ruta}`, { waitUntil: 'networkidle' });
          await hasta(async () => (await p.locator('html').getAttribute('data-sesion')) !== 'pendiente').catch(() => {});
          const m = await p.evaluate(medir);
          informe.push({ rol, ancho, nombre, ruta, url: p.url().replace(APP, ''), ...m });
          if (CAP && ancho === Number(process.env.REPASO_ANCHO_CAPTURA ?? 390)) {
            fs.mkdirSync(CAP, { recursive: true });
            await p.screenshot({ path: path.join(CAP, `${nombre}-${rol}.png`), fullPage: true });
          }
        } catch (x) { informe.push({ rol, ancho, nombre, ruta, error: x.message.slice(0, 200) }); }
      }
      await p.context().close();
    }
  }
} finally {
  fs.writeFileSync(salida, JSON.stringify(informe, null, 1));
  await e.parar();
}
console.log(`informe: ${salida} (${informe.length} pantallas)`);
