/**
 * build_rivales_web.js
 *
 * Genera data/rivales_2026-27_web.json, la versión ligera que pinta la pestaña "Rivales 26/27"
 * del dashboard, a partir de data/rivales_2026-27.json (que genera scripts/build_rivales_2026_27.py).
 *
 * Sólo lleva lo que se pinta: los 20 rivales, su grupo, los nombres anteriores CONFIRMADOS, la
 * trayectoria, el cara a cara y "Lo esencial". Los candidatos sin confirmar y la verificación se
 * quedan en docs/RIVALES_2026-27.md.
 *
 * Fuente: Ayuntamiento de Madrid, datos abiertos, CC BY 4.0.
 *
 * USO:  npm run build:rivales
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'data', 'rivales_2026-27.json');
const OUT = path.join(ROOT, 'data', 'rivales_2026-27_web.json');

// Eje del gráfico: temporadas consecutivas, incluidas las que no están en el portal (quedan vacías).
const EJE = ['2014-15', '2015-16', '2016-17', '2017-18', '2018-19', '2019-20', '2020-21',
  '2021-22', '2022-23', '2023-24', '2024-25', '2025-26'];

const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const esLiga = f => f.tipo === 'liga' || f.tipo === 'liga_2';
const descuadre = f => f.pj != null && f.g != null && f.pj !== f.g + f.p
  ? `La clasificación oficial no cuadra: PJ ${f.pj} ≠ G+P ${f.g + f.p}. Se muestra tal cual, sin corregir.` : null;

/** Puesto relativo en una liga: 1 = primero, 0 = último. */
const relativo = (pos, n) => pos === 1 ? 1 : (n > 1 ? (n - pos) / (n - 1) : 0);

function fila(s, i, f) {
  return {
    t: s.temporada, nombre: i.nombre, distrito: f.distrito, fase: f.fase, grupo: f.grupo,
    pos: f.eliminatoria ? null : (f.posicion || null), n: f.eliminatoria ? null : (f.equipos_en_grupo || null),
    pj: f.pj, g: f.g, p: f.p, pf: f.pf, pc: f.pc,
    hasta: f.eliminatoria ? f.eliminatoria.texto : null,
    calculado: f.fuente !== 'clasificacion' || undefined,
    aviso: descuadre(f) || undefined,
  };
}

/** Un punto por temporada: la primera liga regular (1ª fase), que es la que mide el nivel del equipo. */
function grafico(tray) {
  const porT = {};
  for (const s of tray) {
    const ligas = s.inscripciones.flatMap(i => i.fases.map(f => ({ i, f })))
      .filter(x => x.f.tipo === 'liga' && x.f.posicion && x.f.equipos_en_grupo);
    if (!ligas.length) continue;
    const { i, f } = ligas[0];
    porT[s.temporada] = {
      pos: f.posicion, n: f.equipos_en_grupo, rel: +relativo(f.posicion, f.equipos_en_grupo).toFixed(4),
      nombre: i.nombre, grupo: f.grupo, varias: ligas.length > 1 || undefined, aviso: descuadre(f) || undefined,
    };
  }
  return EJE.map(t => ({ t, ...(porT[t] || {}) }));
}

function main() {
  const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const rivales = src.rivales.map(r => {
    const tp = r.temporada_pasada_2025_26;
    const ligas25 = tp ? tp.fases.filter(f => f.fase.startsWith('Liga') && f.posicion) : [];
    const l = ligas25[0];
    const h = r.cara_a_cara;
    return {
      id: slug(r.rival),
      nombre: r.rival.replace(/^"|"$/g, ''),
      grupo: r.grupo_club,
      antes: r.nombres_anteriores_confirmados,
      sin_rastro: !!r.sin_rastro,
      temporadas_jdm: r.temporadas_en_jdm,
      temporadas_disponibles: r.temporadas_disponibles,
      mejor: r.mejor_resultado,
      t2526: l ? {
        nombre: tp.nombre, distrito: l.distrito, grupo: l.grupo, pos: l.posicion, n: l.equipos_en_grupo,
        g: l.g, p: l.p, pf: l.pf, pc: l.pc, rel: +relativo(l.posicion, l.equipos_en_grupo).toFixed(4),
        aviso: descuadre(l) || undefined,
        extra: tp.fases.filter(f => f.eliminatoria).map(f => `${f.fase}: ${f.eliminatoria}`),
      } : null,
      h2h: {
        g: h.resumen.g, p: h.resumen.p, pf: h.resumen.pf, pc: h.resumen.pc,
        partidos: h.partidos.map(p => ({
          t: p.temporada, fecha: p.fecha, ficha: p.ficha, rival: p.rival, fase: p.fase, pf: p.pf, pc: p.pc, res: p.res,
          nota: [p.incomparecencia && 'Incomparecencia: resultado administrativo según el portal.',
            p.marcador_historico_propio && `En el histórico propio figura ${p.marcador_historico_propio}.`,
            p.origen.startsWith('season_') && 'Sólo en el histórico propio del club; el nombre del rival es el que anotó el club.',
            p.aviso_ficha && 'Ficha dudosa: el histórico propio de esa temporada anota un partido contra el propio club.']
            .filter(Boolean).join(' ') || undefined,
        })),
      },
      trayectoria: r.trayectoria.flatMap(s => s.inscripciones.flatMap(i => i.fases.map(f => fila(s, i, f)))),
      homonimos: r.trayectoria.filter(s => s.aviso_homonimos).map(s => ({ t: s.temporada, aviso: s.aviso_homonimos })),
      grafico: grafico(r.trayectoria),
    };
  });
  const ids = new Set();
  for (const r of rivales) {
    if (ids.has(r.id)) throw new Error('id de rival repetido: ' + r.id);
    ids.add(r.id);
  }
  const out = {
    generado: src._meta.generado,
    fuente: 'Ayuntamiento de Madrid, datos abiertos (datos.madrid.es), CC BY 4.0',
    temporadas_eje: EJE,
    lo_esencial: src.lo_esencial,
    rivales,
  };
  fs.writeFileSync(OUT, JSON.stringify(out));
  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log(`rivales_2026-27_web.json: ${rivales.length} rivales · ${kb} KB`);
}

main();
