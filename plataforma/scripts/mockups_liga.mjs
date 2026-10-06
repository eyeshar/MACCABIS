#!/usr/bin/env node
// Mockups de la liga 26/27 (D73), SIN PUBLICAR: HTML estatico + capturas a 375 px y escritorio.
//
//   node scripts/mockups_liga.mjs          (o: npm run mockups:liga)
//
// Sale a privado/mockups_liga/ (fuera de git: las pantallas de gestion llevan nombres de jugadores de otros
// equipos, que son de terceros). Los datos son los reales de las hojas de la J1.
//   a) web publica, pestana "Liga 26/27"      (solo datos por equipo)
//   b) gestion, "Scouting rivales"            (por jugador, solo gestores)
//   c) gestion, "Liga consolidada"            (ranking de equipos de los dos grupos y lideres individuales)

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SALIDA = path.join(RAIZ, 'privado', 'mockups_liga');
const require = createRequire(import.meta.url);
const { construir } = require(path.join(RAIZ, 'scripts', 'estadisticas', 'liga.js'));
const { pyTitle } = require(path.join(RAIZ, 'scripts', 'estadisticas', 'util.js'));
const calendario = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'calendario_2026-27.json'), 'utf8'));
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

const { publico, privado } = construir('2026-27');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const dec = (v, n = 1) => (v === null || v === undefined || !isFinite(v) ? '–' : v.toFixed(n).replace('.', ','));
const fechaCorta = (f) => { const [y, m, d] = f.split('-'); return `${+d}/${+m}`; };
const bonito = (n) => pyTitle(n.replace(/\s+/g, ' ').replace(/\s*,\s*/, ', ')).replace(/ ,/g, ',');

// ---- agregados por jugador (todos los equipos) ----
const jugadores = new Map();
for (const p of privado) for (const e of p.equipos) for (const j of e.jugadores) {
  const k = `${p.grupo}|${e.equipo}|${j.nombre}`;
  const a = jugadores.get(k) || { grupo: p.grupo, equipo: e.equipo, nombre: j.nombre, num: j.num, pj: 0, sec: 0, pts: 0, p2a: 0, p3a: 0, tla: 0, tli: 0, fc: 0 };
  if (j.sec > 0) a.pj++;
  a.sec += j.sec; a.pts += j.pts; a.p2a += j.p2a; a.p3a += j.p3a; a.tla += j.tla; a.tli += j.tli; a.fc += j.fc;
  jugadores.set(k, a);
}
const todos = [...jugadores.values()];
const deEquipo = (g, eq) => todos.filter((j) => j.grupo === g && j.equipo === eq);

// ---- proximo partido contra nosotros ----
function proximoContraNosotros(g, equipo, hoy = '2026-10-06') {
  const nuestro = publico.grupos[g].nuestro;
  return calendario.partidos.filter((p) => p.equipo === nuestro && p.fase === 'liga' && !p.descansa && norm(p.rival) === norm(equipo) && p.fecha > hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))[0] || null;
}

// =============================== a) WEB PUBLICA ===============================
function paginaPublica() {
  const G = publico.grupos;
  const bloqueGrupo = (k) => {
    const g = G[k];
    const filas = g.clasificacion.map((x) => `<tr class="${x.nuestro ? 'nos' : ''}"><td class="mono">${x.pos}</td><td class="eq">${esc(x.equipo)}${x.nuestro ? ' <span class="chip">Nosotros</span>' : ''}</td>
      <td class="mono">${x.pj}</td><td class="mono">${x.g}</td><td class="mono">${x.p}</td><td class="mono h">${x.pf}</td><td class="mono h">${x.pc}</td><td class="mono">${x.dif > 0 ? '+' : ''}${x.dif}</td><td class="mono pts">${x.pts}</td></tr>`).join('');
    const jornadas = g.jornadas_cargadas;
    const res = jornadas.map((jn) => {
      const rs = g.resultados.filter((r) => r.jornada === jn);
      const cal = rs[0]?.fecha ? ` · ${fechaCorta(rs[0].fecha)}` : '';
      return `<div class="jor"><h3>Jornada ${jn}<span>${cal}</span></h3>${rs.map((r) => {
        const nos = G[k].nuestro && [r.local, r.visitante].some((n) => n === (k === 'G1' ? 'MdA' : 'MdL'));
        return `<div class="part ${nos ? 'nos' : ''}"><span class="l ${r.pl > r.pv ? 'gan' : ''}">${esc(r.local)}</span><span class="m mono">${r.pl} – ${r.pv}</span><span class="v ${r.pv > r.pl ? 'gan' : ''}">${esc(r.visitante)}</span></div>`;
      }).join('')}${g.descansan[jn] ? `<div class="desc">Descansa: ${g.descansan[jn].map(esc).join(', ')}</div>` : ''}</div>`;
    }).join('');
    const ids = Object.keys(g.equipos);
    const mostrar = ids.includes('litros-de-mahou') && k === 'G1' ? 'litros-de-mahou' : (k === 'G2' ? 'quinto-tiempo' : ids[0]);
    const ficha = (id) => {
      const e = g.equipos[id];
      const pill = (c) => `<span class="pill ${c}">${c}</span>`;
      const bl = (t, c) => `<div class="mini"><div class="t">${t}</div><div class="v mono">${c.g}–${c.p}</div><div class="s mono">${dec(c.media_pf)} / ${dec(c.media_pc)}</div></div>`;
      return `<div class="ficha"><h3>${esc(e.nombre)}</h3>
        <div class="kpis"><div class="kpi"><div class="lab">Puntos a favor</div><div class="val">${dec(e.media_pf)}</div><div class="foot">media por partido</div></div>
        <div class="kpi"><div class="lab">En contra</div><div class="val">${dec(e.media_pc)}</div><div class="foot">media por partido</div></div>
        <div class="kpi"><div class="lab">Diferencia</div><div class="val">${e.media_dif > 0 ? '+' : ''}${dec(e.media_dif)}</div><div class="foot">por partido</div></div>
        <div class="kpi"><div class="lab">Racha</div><div class="val">${e.racha ? e.racha.n + e.racha.tipo : '–'}</div><div class="foot">${e.ultimos.length ? e.ultimos.map(pill).join('') : 'sin partidos'}</div></div></div>
        <div class="dos">${bl('En casa', e.casa)}${bl('Fuera', e.fuera)}</div>
        <p class="nota">Casa y fuera: ganados–perdidos y media de puntos a favor / en contra.</p></div>`;
    };
    return `<div class="grupo" data-g="${k}"><div class="aviso">Clasificación <b>calculada</b> a partir de las hojas de la FBM, <b>pendiente de contrastar con la oficial</b>. Victoria 2 pts, derrota 1 pt (Bases del 47 JDM). Las incomparecencias restan y no generan hoja.</div>
      <div class="sec"><h2>Clasificación</h2><span class="tag">${esc(g.nombre)}</span><span class="rule"></span></div>
      <div class="tbl"><table><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>P</th><th class="h">PF</th><th class="h">PC</th><th>Dif</th><th>Pts</th></tr></thead><tbody>${filas}</tbody></table></div>
      <div class="sec"><h2>Resultados</h2><span class="tag">por jornada</span><span class="rule"></span></div>
      <div class="chips">${jornadas.map((j, i) => `<span class="jchip ${i === jornadas.length - 1 ? 'on' : ''}">J${j}</span>`).join('')}<span class="jchip off">J2 · 18/10</span></div>${res}
      <div class="sec"><h2>Ficha por equipo</h2><span class="tag">solo datos de equipo</span><span class="rule"></span></div>
      <div class="sel"><select>${ids.map((id) => `<option ${id === mostrar ? 'selected' : ''}>${esc(g.equipos[id].nombre)}</option>`).join('')}</select></div>${ficha(mostrar)}</div>`;
  };
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Mockup · Liga 26/27 (web pública)</title><style>
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap');
:root{--bg:#12101c;--bg2:#1b1830;--line:#2c2748;--line2:#3d365f;--grape:#4b2fb3;--grape2:#6a4fe0;--ball:#e8722c;--ball2:#f4954f;--gold:#f3c519;--chalk:#f0eef7;--dim:#948fb0;--win:#3fb98a;--loss:#e05561}
*{box-sizing:border-box;margin:0;padding:0}body{background:var(--bg);color:var(--chalk);font-family:'Barlow',sans-serif;line-height:1.5;padding:0 0 50px}
.wrap{max-width:1000px;margin:0 auto;padding:0 16px}
header{border-bottom:3px solid var(--ball);background:radial-gradient(120% 140% at 88% -20%,rgba(75,47,179,.55),transparent 55%),linear-gradient(180deg,#1a1630,#12101c);padding:22px 0 18px}
.eyebrow{font-family:'Barlow Condensed';text-transform:uppercase;letter-spacing:.3em;color:var(--gold);font-size:12px;font-weight:600}
h1{font-family:'Barlow Condensed';font-weight:800;font-size:clamp(30px,6vw,52px);line-height:.95;margin:4px 0 4px}h1 span{color:var(--ball2)}
.tabs{display:flex;gap:6px;margin:18px 0 0;flex-wrap:wrap}.tab{flex:none;background:var(--bg2);border:1px solid var(--line);border-bottom:0;color:var(--dim);padding:9px 14px;font-family:'Barlow Condensed';font-weight:700;font-size:15px;text-transform:uppercase;letter-spacing:.05em;border-radius:9px 9px 0 0}
.tab.on{background:var(--grape);color:#fff;border-color:var(--grape)}.tab.nuevo{border-color:var(--ball);color:var(--ball2)}
.controls{display:flex;gap:14px;align-items:center;margin:20px 0;padding:14px;background:var(--bg2);border:1px solid var(--line);border-radius:12px}
.controls label{font-family:'Barlow Condensed';text-transform:uppercase;letter-spacing:.14em;font-size:12px;color:var(--dim);font-weight:600}
.segment{display:flex;border:1px solid var(--line2);border-radius:9px;overflow:hidden}.segment span{padding:8px 22px;font-family:'Barlow Condensed';font-weight:700;font-size:17px;color:var(--dim)}.segment .on{background:var(--grape);color:#fff}
.aviso{background:rgba(243,197,25,.08);border:1px solid rgba(243,197,25,.35);color:#e9dca0;border-radius:10px;padding:10px 14px;font-size:13.5px;margin-bottom:6px}.aviso b{color:var(--gold)}
.sec{display:flex;align-items:baseline;gap:12px;margin:28px 0 12px}.sec h2{font-family:'Barlow Condensed';font-weight:700;font-size:22px;text-transform:uppercase}.sec .tag{font-family:'JetBrains Mono';font-size:11px;color:var(--dim)}.sec .rule{flex:1;height:1px;background:var(--line)}
.tbl{background:var(--bg2);border:1px solid var(--line);border-radius:12px;overflow:auto}table{width:100%;border-collapse:collapse;font-size:14px}
th{font-family:'Barlow Condensed';text-transform:uppercase;letter-spacing:.08em;font-size:12px;color:var(--dim);text-align:left;padding:10px 8px;border-bottom:1px solid var(--line)}td{padding:9px 8px;border-bottom:1px solid rgba(44,39,72,.6);white-space:nowrap}tr:last-child td{border-bottom:0}
td.eq{font-weight:600;white-space:normal}.mono{font-family:'JetBrains Mono';font-size:13px}.pts{font-weight:600;color:var(--ball2)}tr.nos td{background:rgba(75,47,179,.22)}
.chip{font-family:'Barlow Condensed';font-size:11px;background:var(--ball);color:#fff;border-radius:5px;padding:0 6px;margin-left:4px;text-transform:uppercase}
.chips{display:flex;gap:6px;margin-bottom:12px}.jchip{font-family:'Barlow Condensed';font-weight:700;padding:5px 12px;border-radius:8px;border:1px solid var(--line2);color:var(--dim)}.jchip.on{background:var(--grape);color:#fff;border-color:var(--grape)}.jchip.off{opacity:.45}
.jor h3{font-family:'Barlow Condensed';font-size:17px;text-transform:uppercase;color:var(--ball2);margin:6px 0}.jor h3 span{color:var(--dim);font-weight:400}
.part{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;background:var(--bg2);border:1px solid var(--line);border-radius:10px;padding:9px 12px;margin-bottom:7px;font-size:14.5px}
.part .l{text-align:right}.part .v{text-align:left}.part .gan{font-weight:700}.part .m{font-size:15px;background:var(--bg);padding:3px 10px;border-radius:7px}.part.nos{border-color:var(--grape2)}
.desc{font-size:12.5px;color:var(--dim);margin:2px 0 10px}
select{background:var(--bg2);color:var(--chalk);border:1px solid var(--line2);border-radius:9px;padding:9px 12px;font-size:15px;width:100%;max-width:340px}.sel{margin-bottom:12px}
.ficha h3{font-family:'Barlow Condensed';font-size:26px;margin-bottom:10px}.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:12px}
.kpi{background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:12px 14px}.kpi .lab{font-family:'Barlow Condensed';text-transform:uppercase;letter-spacing:.12em;font-size:11px;color:var(--dim)}.kpi .val{font-family:'Barlow Condensed';font-weight:800;font-size:34px;line-height:1.1;color:var(--ball2)}.kpi .foot{font-size:12px;color:var(--dim)}
.pill{display:inline-flex;width:24px;height:24px;border-radius:6px;align-items:center;justify-content:center;font-family:'Barlow Condensed';font-weight:700;margin-right:3px}.pill.G{background:rgba(63,185,138,.16);color:var(--win);border:1px solid rgba(63,185,138,.4)}.pill.P{background:rgba(224,85,97,.16);color:var(--loss);border:1px solid rgba(224,85,97,.4)}
.dos{display:grid;grid-template-columns:1fr 1fr;gap:10px}.mini{background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:10px 14px}.mini .t{font-family:'Barlow Condensed';text-transform:uppercase;letter-spacing:.12em;font-size:12px;color:var(--dim)}.mini .v{font-size:22px;font-weight:600}.mini .s{font-size:12px;color:var(--dim)}
.nota{font-size:12px;color:var(--dim);margin-top:8px}.pie{margin-top:34px;font-size:12px;color:var(--dim)}
@media(max-width:560px){.h{display:none}th,td{padding:9px 5px}.dos{grid-template-columns:1fr 1fr}}
</style></head><body>
<header><div class="wrap"><div class="eyebrow">Maccabis · Estadísticas</div><h1>Liga <span>26/27</span></h1>
<div class="tabs"><span class="tab">Equipo</span><span class="tab">Jugadores</span><span class="tab">Rankings</span><span class="tab">MdA</span><span class="tab">Rivales 26/27</span><span class="tab on nuevo">Liga 26/27</span></div></div></header>
<div class="wrap"><div class="controls"><label>Grupo</label><div class="segment"><span class="on">G1 · MdA</span><span>G2 · MdL</span></div></div>
${bloqueGrupo('G1')}
<p class="pie">Datos: hojas de estadística de la FBM, jornada ${publico.grupos.G1.jornadas_cargadas.at(-1)}. Solo datos por equipo; nada por jugador de otros equipos.</p></div></body></html>`;
}

// =============================== b) y c) GESTION ===============================
const CSS_GESTION = `
:root{--fondo:#f4f1ea;--tinta:#16150f;--suave:#5b584d;--amarillo:#f2c200;--amarillo-claro:#fbefb8;--tarjeta:#fff;--borde:#e3ded3;--ok:#1f6b3a;--ok-fondo:#e4f2e8;--mal:#a3261b}
*{box-sizing:border-box}body{margin:0;background:var(--fondo);color:var(--tinta);font-family:system-ui,'Segoe UI',sans-serif;font-size:16px;line-height:1.45}
.cab{background:var(--tinta);color:#fff;padding:16px 16px 18px;border-bottom:6px solid var(--amarillo)}.cab .dentro{max-width:1100px;margin:0 auto}.marca{font-weight:700;letter-spacing:.18em;font-size:.85rem;color:var(--amarillo);text-transform:uppercase}.cab h1{margin:4px 0 0;font-size:1.5rem}
.nav{display:flex;gap:6px;overflow-x:auto;margin-top:12px}.nav span{flex:none;padding:7px 12px;border-radius:8px;background:#2a2820;color:#ddd;font-size:.9rem}.nav .on{background:var(--amarillo);color:var(--tinta);font-weight:700}
main{max-width:1100px;margin:0 auto;padding:16px 16px 60px}.privado{background:#fff4d6;border:1px solid #e7c75a;border-radius:10px;padding:9px 12px;font-size:.88rem;margin-bottom:14px}.privado b{color:#7a5a00}
.tarjeta{background:var(--tarjeta);border:1px solid var(--borde);border-radius:10px;padding:14px;margin:14px 0}.tarjeta h2{margin:0 0 8px;font-size:1.15rem}.tarjeta h3{margin:0 0 6px;font-size:1rem}
select{font-size:1rem;padding:9px 10px;border:1px solid var(--borde);border-radius:8px;background:#fff;min-height:44px;width:100%;max-width:360px}
.tab{overflow:auto}table{width:100%;border-collapse:collapse;font-size:.92rem}th{font-size:.74rem;text-transform:uppercase;letter-spacing:.06em;color:var(--suave);text-align:right;padding:8px 7px;border-bottom:2px solid var(--borde);white-space:nowrap}th:first-child,td:first-child,th.t,td.t{text-align:left}
td{padding:8px 7px;border-bottom:1px solid var(--borde);text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}tr:last-child td{border-bottom:0}tr.top td{background:var(--amarillo-claro);font-weight:600}tr.nos td{background:#e8e4ff}
.pos{display:inline-flex;width:22px;height:22px;border-radius:50%;background:var(--tinta);color:var(--amarillo);align-items:center;justify-content:center;font-size:.75rem;font-weight:700;margin-right:6px}
.cabeq{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start;justify-content:space-between}.cabeq h2{font-size:1.5rem;margin:0}.sub{color:var(--suave);font-size:.9rem}
.prox{background:var(--tinta);color:#fff;border-radius:10px;padding:12px 14px;min-width:230px}.prox .e{font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--amarillo)}.prox .f{font-size:1.15rem;font-weight:700}.prox .d{font-size:.85rem;color:#cfcab8}
.tres{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0}.max{background:#fff;border:2px solid var(--amarillo);border-radius:10px;padding:10px 12px}.max .n{font-size:.78rem;color:var(--suave)}.max .nom{font-weight:700;font-size:.98rem;line-height:1.2;margin:2px 0 4px}.max .p{font-size:1.7rem;font-weight:800;line-height:1}.max .p small{font-size:.8rem;font-weight:500;color:var(--suave)}.max .x{font-size:.78rem;color:var(--suave);margin-top:3px}
.rk{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.rk .tarjeta{margin:0}.rk ol{list-style:none;margin:0;padding:0}.rk li{display:grid;grid-template-columns:22px 1fr auto;gap:8px;align-items:baseline;padding:6px 0;border-bottom:1px solid var(--borde);font-size:.9rem}.rk li:last-child{border:0}.rk li b{font-variant-numeric:tabular-nums}.rk li .eqn{display:block;font-size:.74rem;color:var(--suave)}
.nota{font-size:.82rem;color:var(--suave);margin-top:8px}.g1{background:#e8e4ff;color:#3a2a99}.g2{background:#d9f0e6;color:#14663f}.gp{font-size:.7rem;font-weight:700;padding:1px 6px;border-radius:5px;margin-left:5px}
@media(max-width:620px){table{font-size:.8rem}td.t{white-space:normal;min-width:120px}th,td{padding:7px 4px}.cons th:nth-child(n+6):nth-child(-n+8),.cons td:nth-child(n+6):nth-child(-n+8){display:none}.tres{grid-template-columns:1fr}.prox{width:100%}}
`;
const cabGestion = (activo) => `<div class="cab"><div class="dentro"><div class="marca">Maccabis · Gestión</div><h1>${activo}</h1><div class="nav"><span>Jugadores</span><span>Pedido de ropa</span><span class="${activo === 'Scouting rivales' ? 'on' : ''}">Scouting rivales</span><span class="${activo === 'Liga consolidada' ? 'on' : ''}">Liga consolidada</span></div></div></div>`;
const AVISO_PRIV = '<div class="privado"><b>Solo gestores.</b> Datos por jugador de otros equipos: son de terceros y no se publican ni se enseñan a los jugadores (D73).</div>';

function paginaScouting() {
  const g = 'G1', eq = 'LITROS DE MAHOU';
  const pub = publico.grupos[g];
  const fila = pub.clasificacion.find((x) => norm(x.equipo) === norm(eq));
  const js = deEquipo(g, eq).sort((a, b) => b.pts - a.pts || b.sec - a.sec);
  const top3 = js.slice(0, 3);
  const prox = proximoContraNosotros(g, eq);
  const rows = js.map((j, i) => `<tr class="${i < 3 ? 'top' : ''}"><td class="t">${i < 3 ? `<span class="pos">${i + 1}</span>` : ''}<b>${esc(bonito(j.nombre))}</b> <span class="sub">#${esc(j.num)}</span></td>
    <td>${j.pj}</td><td>${mmss(j.sec)}</td><td><b>${j.pts}</b></td><td>${dec(j.pj ? j.pts / j.pj : null)}</td><td>${j.p2a}</td><td>${j.p3a}</td><td>${j.tla}/${j.tli}</td><td>${j.tli ? Math.round(100 * j.tla / j.tli) + '%' : '–'}</td><td>${j.fc}</td><td>${dec(j.pj ? j.fc / j.pj : null)}</td></tr>`).join('');
  const T = (t, k) => t.reduce((s, j) => s + j[k], 0);
  const opciones = Object.entries(publico.grupos).flatMap(([k, G]) => Object.values(G.equipos).filter((e) => !e.nuestro).map((e) => `<option ${e.nombre === pub.equipos['litros-de-mahou'].nombre && k === g ? 'selected' : ''}>${esc(e.nombre)} (${k})</option>`)).join('');
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Mockup · Scouting rivales</title><style>${CSS_GESTION}</style></head><body>${cabGestion('Scouting rivales')}<main>${AVISO_PRIV}
<div class="tarjeta"><label class="sub" for="e">Equipo rival</label><br><select id="e">${opciones}</select></div>
<div class="tarjeta"><div class="cabeq"><div><h2>${esc(pub.equipos['litros-de-mahou'].nombre)} <span class="gp g1">${g}</span></h2>
<div class="sub">${fila.pos}º del grupo · ${fila.g} ganado, ${fila.p} perdidos · ${fila.pf}–${fila.pc} (${fila.dif > 0 ? '+' : ''}${fila.dif}) · ${fila.pts} pts <i>(clasificación calculada)</i></div></div>
${prox ? `<div class="prox"><div class="e">Próximo partido contra nosotros</div><div class="f">MdA ${prox.local ? 'vs' : 'en'} ${esc(pub.equipos['litros-de-mahou'].nombre)}</div><div class="d">J${prox.jornada} · ${fechaCorta(prox.fecha)} · ${prox.hora} · pista ${prox.campo} · ${prox.local ? 'en casa' : 'fuera'}</div></div>` : ''}</div>
<div class="tres">${top3.map((j, i) => `<div class="max"><div class="n">${i + 1}.º máximo anotador</div><div class="nom">${esc(bonito(j.nombre))}</div><div class="p">${j.pts}<small> pts</small></div><div class="x">${j.p2a} dobles · ${j.p3a} triples · TL ${j.tla}/${j.tli} · ${j.fc} faltas</div></div>`).join('')}</div>
<div class="tab"><table><thead><tr><th class="t">Jugador</th><th>PJ</th><th>Min</th><th>Pts</th><th>Media</th><th>2P</th><th>3P</th><th>TL</th><th>TL%</th><th>Faltas</th><th>F/p</th></tr></thead><tbody>${rows}
<tr><td class="t"><b>Equipo</b></td><td>${fila.pj}</td><td>${mmss(T(js, 'sec'))}</td><td><b>${T(js, 'pts')}</b></td><td></td><td>${T(js, 'p2a')}</td><td>${T(js, 'p3a')}</td><td>${T(js, 'tla')}/${T(js, 'tli')}</td><td></td><td>${T(js, 'fc')}</td><td></td></tr></tbody></table></div>
<p class="nota">2P y 3P: canastas anotadas (la hoja de la FBM no recoge los intentos de campo). TL: anotados/intentados. Los minutos son los de la hoja y pueden no cuadrar con el reloj. Con más jornadas, las medias se calculan sobre sus partidos jugados.</p></div>
</main></body></html>`;
}

function paginaConsolidada() {
  const filas = Object.entries(publico.grupos).flatMap(([k, g]) => g.clasificacion.filter((x) => x.pj > 0).map((x) => ({ ...x, grupo: k, e: g.equipos[x.id] })));
  filas.sort((a, b) => (b.g / b.pj) - (a.g / a.pj) || (b.dif / b.pj) - (a.dif / a.pj) || b.pf / b.pj - a.pf / a.pj);
  const tabla = filas.map((x, i) => `<tr class="${x.nuestro ? 'nos' : ''}"><td class="t"><span class="pos">${i + 1}</span><b>${esc(x.equipo)}</b><span class="gp ${x.grupo.toLowerCase()}">${x.grupo}</span></td>
    <td>${x.pj}</td><td>${x.g}</td><td>${x.p}</td><td>${Math.round(100 * x.g / x.pj)}%</td><td>${dec(x.e.media_pf)}</td><td>${dec(x.e.media_pc)}</td><td>${x.dif > 0 ? '+' : ''}${dec(x.e.media_dif)}</td><td>${x.pts}</td></tr>`).join('');
  const lider = (titulo, clave, fmt, lista = todos, nota = '') => {
    const l = [...lista].sort((a, b) => clave(b) - clave(a) || b.pts - a.pts).slice(0, 8);
    return `<div class="tarjeta"><h3>${titulo}</h3><ol>${l.map((j, i) => `<li><span>${i + 1}</span><span><b>${esc(bonito(j.nombre))}</b><span class="eqn">${esc(j.equipo)} · ${j.grupo}</span></span><b>${fmt(j)}</b></li>`).join('')}</ol>${nota ? `<p class="nota">${nota}</p>` : ''}</div>`;
  };
  const conTL = todos.filter((j) => j.tli >= 3);
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Mockup · Liga consolidada</title><style>${CSS_GESTION}</style></head><body>${cabGestion('Liga consolidada')}<main>${AVISO_PRIV}
<div class="tarjeta"><h2>Ranking de equipos · G1 y G2</h2><p class="sub">Los grupos tienen rivales distintos, así que no se comparan puntos de clasificación: se ordena por % de victorias, luego diferencia y puntos a favor por partido.</p>
<div class="tab cons"><table><thead><tr><th class="t">Equipo</th><th>PJ</th><th>G</th><th>P</th><th>%V</th><th>PF/p</th><th>PC/p</th><th>Dif/p</th><th>Pts</th></tr></thead><tbody>${tabla}</tbody></table></div>
<p class="nota">Solo equipos con partidos jugados. Los puntos son los de la clasificación calculada (pendiente de contrastar con la oficial).</p></div>
<h2 style="margin:22px 0 4px">Líderes individuales de la liga</h2><p class="sub">${todos.length} jugadores de los 20 equipos, con datos de la jornada ${publico.grupos.G1.jornadas_cargadas.at(-1)}.</p>
<div class="rk">${lider('Puntos', (j) => j.pts, (j) => `${j.pts}`)}${lider('Media de puntos', (j) => (j.pj ? j.pts / j.pj : 0), (j) => dec(j.pj ? j.pts / j.pj : 0), todos.filter((j) => j.pj >= 1), 'Mínimo 1 partido; cuando haya más jornadas, el mínimo será la mitad de los partidos del equipo.')}${lider('Triples', (j) => j.p3a, (j) => `${j.p3a}`)}${lider('Tiros libres', (j) => j.tla, (j) => `${j.tla}/${j.tli}`, conTL, 'Con al menos 3 tiros libres intentados.')}${lider('Faltas', (j) => j.fc, (j) => `${j.fc}`, todos, 'Faltas cometidas (5 = eliminado).')}</div>
</main></body></html>`;
}

// =============================== salida y capturas ===============================
fs.mkdirSync(SALIDA, { recursive: true });
const paginas = [
  ['a_liga_publica', paginaPublica()],
  ['b_scouting_rivales', paginaScouting()],
  ['c_liga_consolidada', paginaConsolidada()],
];
for (const [n, html] of paginas) fs.writeFileSync(path.join(SALIDA, `${n}.html`), html, 'utf8');

const nav = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const [n] of paginas) {
    for (const [etiqueta, ancho, alto] of [['375', 375, 800], ['escritorio', 1280, 900]]) {
      const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: ancho === 375 ? 2 : 1 });
      const pag = await ctx.newPage();
      await pag.goto('file:///' + path.join(SALIDA, `${n}.html`).replace(/\\/g, '/'));
      await pag.waitForTimeout(700);
      const desborda = await pag.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      await pag.screenshot({ path: path.join(SALIDA, `${n}_${etiqueta}.png`), fullPage: true });
      console.log(`${n}_${etiqueta}.png${desborda ? '  (!) desborda en horizontal' : ''}`);
      await ctx.close();
    }
  }
} finally { await nav.close(); }
console.log(`\nMockups en ${SALIDA}`);
