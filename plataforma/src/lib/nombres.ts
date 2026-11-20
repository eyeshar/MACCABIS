// Nombres visibles de la plantilla (jugadores.nombre_visible: el mote, «Fernando T.», «Víctor M.»). Es la fuente ÚNICA
// del nombre de un jugador en toda la web: listas de convocados, el WhatsApp de la convocatoria, «Quién va», Gestión →
// Jugadores... Dos jugadores no pueden llevar el mismo: en un mensaje del grupo no se sabría quién es quién.
// Funciones puras (sin alias «@/»: las importan tal cual las pruebas de lógica).

/** Clave para comparar nombres visibles: sin tildes, en minúsculas y sin puntos ni espacios de más («Víctor M.» =
 *  «victor m»). Solo para comparar: lo que se enseña es siempre el nombre visible tal cual, con sus tildes. */
export function claveNombre(nombre: string | null | undefined) {
  return String(nombre ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[.\s]+/g, " ").trim();
}

/** Grupos de personas con el mismo nombre visible (comparando con claveNombre). Vacío si todos son distintos. */
export function nombresRepetidos<T extends { person_id: string; nombre: string }>(personas: T[]): T[][] {
  const grupos = new Map<string, T[]>();
  for (const p of personas) grupos.set(claveNombre(p.nombre), [...(grupos.get(claveNombre(p.nombre)) ?? []), p]);
  return [...grupos.values()].filter((g) => g.length > 1);
}

/** El jugador activo (otro que `personId`) que ya lleva ese nombre visible, o null. */
export function nombreOcupado<T extends { person_id: string; nombre: string }>(nombre: string, personId: string, activos: T[]): T | null {
  const k = claveNombre(nombre);
  return activos.find((j) => j.person_id !== personId && claveNombre(j.nombre) === k) ?? null;
}
