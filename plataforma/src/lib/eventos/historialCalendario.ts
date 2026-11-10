// «Últimos cambios del calendario» de Gestión (D189, bloque 4): el historial real, con fecha, de las importaciones del
// calendario (rutina B o a mano: con cambios aplicados o «revisado, sin cambios») y de los cambios avisados a los
// jugadores (cambio de fecha, hora o pista de un evento: `cambio_visible`). Funciones PURAS.

export type ImportacionHist = { id: string; en: string; por_nombre: string | null; lineas: number | null; aceptadas: number | null; bloqueadas: number | null; detalle: { cambios?: { evento?: string; campo?: string; de?: string; a?: string }[] } | null };
export type EventoHist = { id: string; clave: string | null; fecha: string; titulo: string; cambio_visible_en: string | null; cambio_visible: { antes?: string | null; campos?: string[] } | null };
export type EntradaHist =
  | { tipo: "importacion"; id: string; en: string; titulo: string; por: string | null; cambios: string[]; errores: number }
  | { tipo: "aviso"; id: string; en: string; titulo: string; fecha: string; cambios: string[]; href: string };

const CAMPO: Record<string, string> = { fecha: "fecha", hora: "hora", inicio: "hora", pista: "pista", lugar: "pista", quedada: "encuentro", estado: "estado" };

/** Todo junto, de lo más reciente a lo más antiguo. `limite`: cuántas entradas (por defecto, 40). */
export function historialCalendario(importaciones: ImportacionHist[], eventos: EventoHist[], limite = 40): EntradaHist[] {
  const porClave = new Map(eventos.filter((e) => e.clave).map((e) => [e.clave!, e]));
  const imp: EntradaHist[] = importaciones.map((i) => {
    const n = i.aceptadas ?? 0;
    return {
      tipo: "importacion", id: i.id, en: i.en, por: i.por_nombre, errores: i.bloqueadas ?? 0,
      titulo: n ? `Importación del calendario: ${n} ${n === 1 ? "cambio aplicado" : "cambios aplicados"}` : "Calendario revisado, sin cambios",
      cambios: (i.detalle?.cambios ?? []).map((c) => {
        const ev = c.evento ? porClave.get(c.evento) : undefined;
        return `${ev?.titulo ?? c.evento ?? "evento"}: ${CAMPO[c.campo ?? ""] ?? c.campo ?? "cambio"}${c.de || c.a ? ` ${c.de ?? "—"} → ${c.a ?? "—"}` : ""}`;
      }),
    };
  });
  const av: EntradaHist[] = eventos.filter((e) => e.cambio_visible_en).map((e) => ({
    tipo: "aviso", id: e.id, en: e.cambio_visible_en!, fecha: e.fecha, href: `/gestion/eventos/${e.id}`,
    titulo: `Aviso a los jugadores: ${e.titulo}`,
    cambios: [`cambia ${(e.cambio_visible?.campos ?? []).map((c) => CAMPO[c] ?? c).join(", ") || "el evento"}${e.cambio_visible?.antes ? ` (antes: ${e.cambio_visible.antes})` : ""}`],
  }));
  return [...imp, ...av].sort((a, b) => (a.en < b.en ? 1 : a.en > b.en ? -1 : 0)).slice(0, limite);
}
