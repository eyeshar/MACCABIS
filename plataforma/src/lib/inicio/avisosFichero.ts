// Filtro PURO de los avisos de data/avisos.json (D117): los vigentes ese dia (desde y hasta incluidos) para alguno de
// esos equipos. Lo usan el inicio personal (con hoy) y el mensaje de WhatsApp de la convocatoria (con el domingo).
export type AvisoFichero = { id: string; texto: string; desde: string; hasta: string; para: "todos" | "MdA" | "MdL" };

export function vigentes(avisos: AvisoFichero[], dia: string, equipos: ("MdA" | "MdL")[]): AvisoFichero[] {
  return avisos.filter((a) => a.desde <= dia && dia <= a.hasta && (a.para === "todos" || equipos.includes(a.para)));
}
