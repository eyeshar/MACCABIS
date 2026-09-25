/**
 * leer_acta.js
 *
 * Lee un acta digital de la FBM (Indalweb, instancia "JDM Madrid": Acta-Partido-<nº>.pdf)
 * y devuelve sólo lo que el pipeline necesita: nº de partido, fecha, hora, pista, equipos,
 * tanteo final y parciales por cuarto (con prórrogas, si las hay).
 *
 * NO devuelve ni guarda nombres de jugadores, licencias, dorsales ni árbitros: el acta los
 * trae, pero los puntos por jugador salen de la hoja XLSX (el "tanteo arrastrado" del acta no
 * es fiable para eso, ver ESTADO) y el resto es dato personal de terceros.
 */
const fs = require('fs');

const limpia = s => String(s || '').replace(/\s+/g, ' ').trim();

async function leerActa(fichero) {
  const { PDFParse } = require('pdf-parse');
  const r = await new PDFParse({ data: fs.readFileSync(fichero) }).getText();
  return parseActa(r.text || '', fichero);
}

function parseActa(texto, fichero = '') {
  const t = String(texto).replace(/\r/g, '');
  const m = (re, i = 1) => { const x = t.match(re); return x ? limpia(x[i]) : null; };
  const num = m(/Partido nº:\s*(\d+)/);
  const fecha = m(/Fecha:\s*(\d{2}\/\d{2}\/\d{4})/);
  const hora = m(/Hora:\s*(\d{1,2}:\d{2})/);
  const pista = m(/Localidad:\s*(.+?)\s*(?:\t|Arb\.|$)/m);
  const equipoA = m(/Equipo A:\s*(.+?)\s*(?:\t|Equipo B:|$)/m);
  const equipoB = m(/Equipo B:\s*(.+?)\s*$/m);
  const fin = t.match(/Tanteo final:\s*Equipo A:\s*(\d+)\s*Equipo B:\s*(\d+)/);
  // En una incomparecencia el acta sale a 0-0 y sin vencedor: esa línea queda vacía.
  const vencedor = m(/Equipo vencedor:[ \t]*(.*)$/m) || null;
  // Pie del acta: "Cuarto n  A: x  B: y" y, si hubo, "Prórroga n  A: x  B: y"
  const cuartos = [];
  const re = /^(Cuarto|Pr[oó]rroga)\s*(\d*)\s*A:\s*(\d+)\s*B:\s*(\d+)/gim;
  let c;
  while ((c = re.exec(t))) cuartos.push({ periodo: /^Cuarto/i.test(c[1]) ? 'Q' + c[2] : 'OT' + (c[2] || ''), a: +c[3], b: +c[4] });
  const [d, mes, a] = fecha ? fecha.split('/') : [];
  return {
    fichero: fichero ? require('path').basename(fichero) : undefined,
    num,
    fecha: fecha ? `${a}-${mes}-${d}` : null,
    hora,
    pista,
    equipoA, equipoB,
    tanteoA: fin ? +fin[1] : null,
    tanteoB: fin ? +fin[2] : null,
    vencedor,
    cuartos,
  };
}

module.exports = { leerActa, parseActa };

if (require.main === module) {
  (async () => {
    for (const f of process.argv.slice(2)) console.log(JSON.stringify(await leerActa(f)));
  })();
}
