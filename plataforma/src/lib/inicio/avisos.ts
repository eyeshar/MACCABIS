import avisosJson from "@/data/avisos.json";

// Avisos de la jornada del inicio personal (D116): los del fichero data/avisos.json (copiado a src/data con
// npm run datos:sync) vigentes hoy y para su equipo, mas el automatico «pista por confirmar» del proximo entreno.
type AvisoFichero = { id: string; texto: string; desde: string; hasta: string; para: "todos" | "MdA" | "MdL" };
export type AvisoJornada = { id: string; texto: string; tipo: "fichero" | "pista" };

export function avisosDeLaJornada(hoy: string, equipos: ("MdA" | "MdL")[], entreno: { fecha: string; porConfirmar: boolean; motivo: string | null } | null): AvisoJornada[] {
  const lista: AvisoJornada[] = ((avisosJson as unknown as { avisos: AvisoFichero[] }).avisos ?? [])
    .filter((a) => a.desde <= hoy && hoy <= a.hasta && (a.para === "todos" || equipos.includes(a.para)))
    .map((a) => ({ id: a.id, texto: a.texto, tipo: "fichero" as const }));
  if (entreno?.porConfirmar) {
    const dia = new Date(`${entreno.fecha}T12:00:00Z`).toLocaleDateString("es-ES", { timeZone: "UTC", weekday: "long", day: "numeric" });
    lista.push({ id: `pista-${entreno.fecha}`, texto: `Pista por confirmar para el entreno del ${dia}${entreno.motivo ? ` (${entreno.motivo})` : ""}: te avisamos en cuanto se sepa.`, tipo: "pista" });
  }
  return lista;
}
