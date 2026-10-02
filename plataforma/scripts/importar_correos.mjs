#!/usr/bin/env node
// Importa correos a jugadores.email desde un fichero exportado de SportEasy
// (miembros/plantilla), para la lista blanca del login (D68).
//
//   npm run db:correos -- <ruta-al-fichero.csv-o-xlsx>
//
// El fichero NUNCA entra en git: pasalo desde Descargas o desde privado/.
// Casa por NOMBRE, de forma exacta (sin acentos, mayusculas ni espacios de
// mas), probando "Nombre Apellidos" y "Apellidos, Nombre". NUNCA adivina: lo
// que no case exacto, o case con mas de un jugador, se lista aparte para que
// lo resuelva Ivan a mano (editando el correo en "Jugadores y enlaces" o
// corrigiendo el fichero y repitiendo la importacion).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { conectar } from './db.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --- normalizacion de nombres: sin acentos, sin dobles espacios, minusculas ---
function normaliza(s) {
  return (s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
    .toLowerCase()
    .replace(/[^a-z0-9, ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// "Apellidos, Nombre" <-> "Nombre Apellidos", las dos variantes normalizadas.
function variantes(nombreCompleto) {
  const n = normaliza(nombreCompleto);
  const out = new Set([n]);
  if (n.includes(',')) {
    const [ap, nom] = n.split(',').map((s) => s.trim());
    if (nom) out.add(`${nom} ${ap}`.replace(/\s+/g, ' ').trim());
  } else {
    // sin coma: no sabemos cual es el apellido, no se inventa una variante.
  }
  return [...out].filter(Boolean);
}

// --- lectura del fichero: CSV simple o XLSX (exceljs, ya es dependencia) ---
function parseCsv(texto) {
  const filas = [];
  let fila = [], campo = '', entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') entreComillas = false;
      else campo += c;
    } else if (c === '"') entreComillas = true;
    else if (c === ',' || c === ';') { fila.push(campo); campo = ''; }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; }
    else if (c === '\r') { /* ignorar */ }
    else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter((f) => f.some((c) => c.trim() !== ''));
}

async function leerFichero(ruta) {
  const ext = path.extname(ruta).toLowerCase();
  if (ext === '.csv') {
    return parseCsv(fs.readFileSync(ruta, 'utf8'));
  }
  if (ext === '.xlsx' || ext === '.xls') {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.readFile(ruta);
    const hoja = libro.worksheets[0];
    const filas = [];
    hoja.eachRow((fila) => filas.push(fila.values.slice(1).map((v) => (v == null ? '' : String(v.text ?? v)))));
    return filas;
  }
  throw new Error(`Formato no soportado: ${ext}. Usa .csv o .xlsx.`);
}

// Heuristica de cabeceras: columna de correo y de nombre (completo, o nombre+apellidos sueltos).
const PATRON_EMAIL = /mail|correo/i;
const PATRON_NOMBRE_COMPLETO = /^(nombre completo|full ?name|jugador|member|miembro|participante)$/i;
const PATRON_NOMBRE = /^(nombre|first ?name|name)$/i;
const PATRON_APELLIDOS = /^(apellidos?|last ?name|surname)$/i;

function detectarColumnas(cabecera) {
  const idx = (patron) => cabecera.findIndex((c) => patron.test((c || '').trim()));
  const email = idx(PATRON_EMAIL);
  const completo = idx(PATRON_NOMBRE_COMPLETO);
  const nombre = idx(PATRON_NOMBRE);
  const apellidos = idx(PATRON_APELLIDOS);
  return { email, completo, nombre, apellidos };
}

async function main() {
  const [rutaArg] = process.argv.slice(2);
  if (!rutaArg) {
    console.error('Uso: npm run db:correos -- <ruta-al-fichero.csv-o-xlsx>');
    process.exitCode = 1;
    return;
  }
  const ruta = path.isAbsolute(rutaArg) ? rutaArg : path.resolve(process.cwd(), rutaArg);
  if (!fs.existsSync(ruta)) throw new Error(`No existe el fichero: ${ruta}`);

  const dotenv = await import('dotenv');
  dotenv.config({ path: path.join(RAIZ, '.env.local') });
  const sql = conectar();

  try {
    const filas = await leerFichero(ruta);
    if (filas.length < 2) throw new Error('El fichero no tiene filas de datos.');
    const [cabecera, ...datos] = filas;
    const { email: cEmail, completo: cCompleto, nombre: cNombre, apellidos: cApellidos } = detectarColumnas(cabecera);
    if (cEmail === -1) throw new Error(`No encuentro una columna de correo. Cabeceras: ${cabecera.join(' | ')}`);
    if (cCompleto === -1 && (cNombre === -1 || cApellidos === -1)) {
      throw new Error(`No encuentro el nombre (ni "nombre completo" ni "nombre"+"apellidos"). Cabeceras: ${cabecera.join(' | ')}`);
    }
    console.log(`Columnas detectadas: correo="${cabecera[cEmail]}", nombre=${cCompleto !== -1 ? `"${cabecera[cCompleto]}"` : `"${cabecera[cNombre]}" + "${cabecera[cApellidos]}"`}`);

    const personas = datos
      .map((f) => ({
        nombre: cCompleto !== -1 ? (f[cCompleto] || '').trim() : [f[cNombre], f[cApellidos]].filter(Boolean).join(' ').trim(),
        email: (f[cEmail] || '').trim(),
      }))
      .filter((p) => p.nombre && p.email);

    const jugadores = await sql`select id, nombre_oficial, nombre_visible, email from public.jugadores where activo`;
    // Indice: nombre normalizado (nombre_oficial y sus variantes) -> lista de jugadores que casan.
    const indice = new Map();
    for (const j of jugadores) {
      for (const v of variantes(j.nombre_oficial)) {
        if (!indice.has(v)) indice.set(v, []);
        indice.get(v).push(j);
      }
    }

    const casados = [];
    const sinCasar = [];
    const ambiguos = [];
    const vistos = new Set();
    for (const p of personas) {
      const candidatos = new Set();
      for (const v of variantes(p.nombre)) for (const j of indice.get(v) ?? []) candidatos.add(j);
      const lista = [...candidatos];
      if (lista.length === 0) sinCasar.push(p);
      else if (lista.length > 1) ambiguos.push({ ...p, candidatos: lista.map((j) => j.nombre_oficial) });
      else {
        casados.push({ jugador: lista[0], email: p.email });
        vistos.add(lista[0].id);
      }
    }
    const jugadoresSinFila = jugadores.filter((j) => !vistos.has(j.id));

    let actualizados = 0;
    for (const { jugador, email } of casados) {
      if (jugador.email && jugador.email.toLowerCase() === email.toLowerCase()) continue;
      await sql`update public.jugadores set email = ${email.toLowerCase()} where id = ${jugador.id}`;
      actualizados++;
    }

    console.log(`\nCasados: ${casados.length} (${actualizados} correos nuevos o cambiados).`);
    if (ambiguos.length) {
      console.log(`\nAMBIGUOS (${ambiguos.length}) — casan con más de un jugador, no se ha tocado nada, decide Iván:`);
      for (const a of ambiguos) console.log(`  "${a.nombre}" (${a.email}) -> ${a.candidatos.join(' / ')}`);
    }
    if (sinCasar.length) {
      console.log(`\nSIN CASAR en el fichero (${sinCasar.length}) — ningún jugador con ese nombre exacto:`);
      for (const p of sinCasar) console.log(`  "${p.nombre}" (${p.email})`);
    }
    if (jugadoresSinFila.length) {
      console.log(`\nJUGADORES SIN FILA en el fichero (${jugadoresSinFila.length}) — no se ha tocado su correo:`);
      for (const j of jugadoresSinFila) console.log(`  ${j.nombre_visible} (${j.nombre_oficial})${j.email ? ` — ya tenía correo: ${j.email}` : ''}`);
    }
  } finally {
    await sql.end();
  }
}

await main();
