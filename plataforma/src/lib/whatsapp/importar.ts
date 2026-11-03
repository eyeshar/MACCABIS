// Importar teléfonos (D178): funciones PURAS (`node` carga este fichero tal cual en las pruebas).
//
// Gestión → Importar teléfonos acepta un CSV con columnas mote, whatsapp_contacto, telefono, estado (teléfonos ya en
// formato internacional: +34…, +54…). El archivo se lee en el navegador y en memoria: no se sube ni se guarda en ningún
// sitio. Solo se guardan `whatsapp_contacto` y `telefono` de cada jugador (public.jugadores, RLS: solo gestores).
// Cruce: por whatsapp_contacto y, si no encaja, por mote. Cualquier coincidencia dudosa (varios jugadores posibles, o
// el mismo jugador en varias filas) queda sin asignar. Antes de guardar, una tabla de revisión con el teléfono
// enmascarado; nada se sobrescribe sin confirmar. Nunca un teléfono en un mensaje de error ni en un log.

export type FilaCsv = { linea: number; mote: string; whatsapp_contacto: string; telefono: string; estado: string };
export type JugadorTel = { person_id: string; nombre_visible: string; whatsapp_contacto: string | null; telefono: string | null; activo?: boolean };
export type Estado = "nuevo" | "igual" | "distinto" | "sin_coincidencia";
export type Revision = {
  linea: number; mote: string; contacto: string; enmascarado: string; estado: Estado; nota_archivo: string;
  person_id: string | null; jugador: string | null; por: "contacto" | "mote" | null;
  /** Por qué no se asigna (sin coincidencia, dudosa, teléfono no válido…). Nunca lleva el teléfono. */
  motivo: string | null;
};
export const TEXTO_ESTADO: Record<Estado, string> = { nuevo: "Nuevo", igual: "Igual", distinto: "Distinto al actual", sin_coincidencia: "Sin coincidencia" };

/** Minúsculas, sin tildes ni espacios de más (para cruzar nombres). */
export const normal = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** «+34 612 345 678» → «+34612345678». Null si no es un teléfono internacional válido (+ y de 8 a 15 cifras). */
export function telefonoInternacional(t: string | null | undefined) {
  const s = (t ?? "").replace(/[\s().-]/g, "");
  const m = s.match(/^(?:\+|00)(\d{8,15})$/);
  return m ? `+${m[1]}` : null;
}

/** «+34 6** *** 678»: prefijo (2 cifras), la primera cifra y las 3 últimas; el resto, asteriscos en grupos de 3. */
export function enmascarar(t: string | null | undefined) {
  const i = telefonoInternacional(t);
  if (!i) return "—";
  const d = i.slice(1), cc = d.slice(0, 2), resto = d.slice(2);
  const tapado = resto[0] + "*".repeat(Math.max(0, resto.length - 4)) + resto.slice(-3);
  const grupos: string[] = [];
  for (let k = tapado.length; k > 0; k -= 3) grupos.unshift(tapado.slice(Math.max(0, k - 3), k));
  return `+${cc} ${grupos.join(" ")}`;
}

/** Una línea de CSV con comillas («"a, b"», «""» dentro). Separador: coma o punto y coma (el del Excel en español). */
function partir(linea: string, sep: string) {
  const out: string[] = [];
  let cur = "", dentro = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (dentro) {
      if (c === '"' && linea[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') dentro = false;
      else cur += c;
    } else if (c === '"') dentro = true;
    else if (c === sep) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

const COLUMNAS = ["mote", "whatsapp_contacto", "telefono", "estado"] as const;

/** El CSV → filas. Cabecera obligatoria con las 4 columnas (en cualquier orden; «teléfono» con tilde también vale). */
export function leerCsv(texto: string): { filas: FilaCsv[]; error: string | null } {
  const lineas = texto.replace(/^﻿/, "").split(/\r?\n/);
  const iCab = lineas.findIndex((l) => l.trim() !== "");
  if (iCab === -1) return { filas: [], error: "El archivo está vacío." };
  const sep = (lineas[iCab].match(/;/g) ?? []).length > (lineas[iCab].match(/,/g) ?? []).length ? ";" : ",";
  const cab = partir(lineas[iCab], sep).map((c) => normal(c).replace(/\s+/g, "_"));
  const pos = Object.fromEntries(COLUMNAS.map((c) => [c, cab.indexOf(c)])) as Record<(typeof COLUMNAS)[number], number>;
  const faltan = COLUMNAS.filter((c) => pos[c] === -1);
  if (faltan.length) return { filas: [], error: `Faltan columnas en la cabecera: ${faltan.join(", ")}. Tiene que llevar: ${COLUMNAS.join(", ")}.` };
  const filas: FilaCsv[] = [];
  for (let i = iCab + 1; i < lineas.length; i++) {
    if (lineas[i].trim() === "") continue;
    const v = partir(lineas[i], sep);
    filas.push({ linea: i + 1, mote: v[pos.mote] ?? "", whatsapp_contacto: v[pos.whatsapp_contacto] ?? "", telefono: v[pos.telefono] ?? "", estado: v[pos.estado] ?? "" });
  }
  return { filas, error: filas.length ? null : "El archivo no tiene filas debajo de la cabecera." };
}

/** Cruza cada fila con los jugadores de la base y dice qué pasaría al guardar (sin guardar nada). */
export function revisar(filas: FilaCsv[], jugadores: JugadorTel[]): Revision[] {
  const porContacto = (c: string) => (normal(c) ? jugadores.filter((j) => normal(j.whatsapp_contacto) === normal(c)) : []);
  const porMote = (m: string) => (normal(m) ? jugadores.filter((j) => normal(j.nombre_visible) === normal(m)) : []);
  const base = filas.map((f): Revision => {
    const r: Revision = { linea: f.linea, mote: f.mote, contacto: f.whatsapp_contacto, enmascarado: enmascarar(f.telefono), estado: "sin_coincidencia", nota_archivo: f.estado, person_id: null, jugador: null, por: null, motivo: null };
    const tel = telefonoInternacional(f.telefono);
    if (!tel) return { ...r, motivo: f.telefono.trim() ? "teléfono no válido (tiene que ir con + y prefijo del país)" : "sin teléfono" };
    const c = porContacto(f.whatsapp_contacto);
    if (c.length > 1) return { ...r, motivo: "dudosa: ese contacto lo tienen varios jugadores" };
    let j = c[0] ?? null, por: Revision["por"] = j ? "contacto" : null;
    if (!j) {
      const m = porMote(f.mote);
      if (m.length > 1) return { ...r, motivo: "dudosa: ese mote lo tienen varios jugadores" };
      j = m[0] ?? null; por = j ? "mote" : null;
    }
    if (!j) return { ...r, motivo: "ningún jugador con ese contacto ni ese mote" };
    // Encaja por mote pero el jugador ya tiene OTRO contacto guardado: dudosa (puede ser otra persona con el mismo mote).
    if (por === "mote" && normal(j.whatsapp_contacto) && normal(f.whatsapp_contacto) && normal(j.whatsapp_contacto) !== normal(f.whatsapp_contacto)) {
      return { ...r, motivo: `dudosa: encaja por mote con ${j.nombre_visible}, que ya tiene otro contacto guardado` };
    }
    const actual = telefonoInternacional(j.telefono);
    const contactoNuevo = f.whatsapp_contacto.trim() || j.whatsapp_contacto || "";
    const estado: Estado = !j.telefono?.trim() ? "nuevo"
      : actual === tel && normal(contactoNuevo) === normal(j.whatsapp_contacto) ? "igual" : "distinto";
    return { ...r, estado, person_id: j.person_id, jugador: j.nombre_visible, por, contacto: contactoNuevo };
  });
  // El mismo jugador en varias filas: ninguna se asigna.
  const veces = new Map<string, number>();
  for (const r of base) if (r.person_id) veces.set(r.person_id, (veces.get(r.person_id) ?? 0) + 1);
  return base.map((r) => (r.person_id && veces.get(r.person_id)! > 1
    ? { ...r, estado: "sin_coincidencia" as const, person_id: null, jugador: null, por: null, motivo: `dudosa: ${r.jugador} sale en varias filas` }
    : r));
}

/** Lo que se guardaría al confirmar: solo filas asignadas y que cambian algo («nuevo» o «distinto al actual»). */
export function aGuardar(filas: FilaCsv[], jugadores: JugadorTel[]): { person_id: string; whatsapp_contacto: string | null; telefono: string }[] {
  const rev = revisar(filas, jugadores);
  return rev.flatMap((r, i) => (r.person_id && (r.estado === "nuevo" || r.estado === "distinto")
    ? [{ person_id: r.person_id, whatsapp_contacto: r.contacto.trim() || null, telefono: telefonoInternacional(filas[i].telefono)! }]
    : []));
}

/** Jugadores activos que se quedan sin teléfono (ni el que ya tenían ni uno del archivo). */
export function quedanSinTelefono(filas: FilaCsv[], jugadores: JugadorTel[]) {
  const asignados = new Set(revisar(filas, jugadores).filter((r) => r.person_id).map((r) => r.person_id));
  return jugadores.filter((j) => j.activo !== false && !j.telefono?.trim() && !asignados.has(j.person_id)).map((j) => j.nombre_visible);
}
