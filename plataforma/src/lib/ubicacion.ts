// Ubicacion de los eventos (D119): funciones PURAS (las usan las pantallas, el servidor y las pruebas con `node`). Sin
// mapas incrustados ni claves de pago: los enlaces abren Google Maps con una busqueda; las sugerencias salen de
// OpenStreetMap (Nominatim) desde el servidor.

export type Lugar = {
  nombre: string;
  direccion: string | null;
  lat: number | null;
  lng: number | null;
  /** Enlace corto de Google Maps (maps.app.goo.gl) que no trae coordenadas: se guarda tal cual. */
  enlace: string | null;
};

const num = (x: string | null | undefined) => {
  const n = x == null ? NaN : Number(x);
  return Number.isFinite(n) ? n : null;
};
const valida = (lat: number | null, lng: number | null) => lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/** «Ver en Google Maps» / «Cómo llegar»: coordenadas; si no, la dirección o el nombre; si no, el enlace guardado. */
export function enlaceGoogle(l: Partial<Lugar> | null | undefined): string | null {
  if (!l) return null;
  if (valida(l.lat ?? null, l.lng ?? null)) return `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}`;
  const q = [l.nombre, l.direccion].filter(Boolean).join(", ");
  if (l.direccion) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  if (l.enlace) return l.enlace;
  if (l.nombre) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.nombre)}`;
  return null;
}

/** ¿Es un enlace de Google Maps? (largo o corto) */
export const esEnlaceGoogle = (t: string) => /^https?:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(t.trim());
export const esEnlaceCorto = (t: string) => /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(t.trim());

/** Lee un enlace de Google Maps pegado: nombre y coordenadas si vienen en el enlace. Un enlace corto (maps.app.goo.gl)
 *  no las trae: se guarda el enlace tal cual. null = no es un enlace de Google Maps. */
export function leerEnlaceGoogle(texto: string): Lugar | null {
  const t = texto.trim();
  if (!esEnlaceGoogle(t)) return null;
  if (esEnlaceCorto(t)) return { nombre: "Ubicación de Google Maps", direccion: null, lat: null, lng: null, enlace: t.slice(0, 500) };
  let u: URL;
  try { u = new URL(t); } catch { return null; }
  const ruta = decodeURIComponent(u.pathname);
  let lat: number | null = null, lng: number | null = null;
  // !3d<lat>!4d<lng> (el punto exacto del sitio) manda sobre @<lat>,<lng> (el centro del mapa).
  const d = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(t);
  const a = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(ruta);
  const q = u.searchParams.get("query") ?? u.searchParams.get("q") ?? u.searchParams.get("ll") ?? u.searchParams.get("destination");
  const qc = q ? /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(q) : null;
  if (d) { lat = num(d[1]); lng = num(d[2]); }
  else if (qc) { lat = num(qc[1]); lng = num(qc[2]); }
  else if (a) { lat = num(a[1]); lng = num(a[2]); }
  if (!valida(lat, lng)) { lat = null; lng = null; }
  const lugar = /\/place\/([^/@]+)/.exec(ruta)?.[1]?.replace(/\+/g, " ").trim();
  const nombre = lugar || (q && !qc ? q.trim() : null) || (lat != null ? "Ubicación de Google Maps" : null);
  if (!nombre) return null;
  return { nombre: nombre.slice(0, 120), direccion: null, lat, lng, enlace: lat == null ? t.slice(0, 500) : null };
}

// ---------------------------------------------------------------- respuesta de OpenStreetMap (Nominatim)
export type FilaNominatim = {
  lat: string; lon: string; name?: string; display_name: string;
  address?: Record<string, string>;
};

/** Una sugerencia de Nominatim, en corto: nombre del sitio y una direccion legible (calle, numero, barrio, ciudad). */
export function deNominatim(f: FilaNominatim): Lugar {
  const a = f.address ?? {};
  const calle = [a.road ?? a.pedestrian ?? a.footway, a.house_number].filter(Boolean).join(", ");
  const zona = a.suburb ?? a.neighbourhood ?? a.city_district ?? a.quarter;
  const ciudad = a.city ?? a.town ?? a.village ?? a.municipality;
  const partes = [calle, zona, ciudad].filter(Boolean) as string[];
  const nombre = (f.name && f.name.trim()) || f.display_name.split(",")[0].trim();
  const direccion = partes.length ? partes.filter((p) => p !== nombre).join(", ") : f.display_name.split(",").slice(1, 4).join(",").trim();
  return { nombre: nombre.slice(0, 120), direccion: direccion ? direccion.slice(0, 240) : null, lat: num(f.lat), lng: num(f.lon), enlace: null };
}
