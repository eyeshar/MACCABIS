import "server-only";
import type { Cliente } from "@/lib/eventos/datos";
import { avisarConvocados } from "./avisos";
import { cargarContexto } from "./datos";
import type { Equipo } from "./motor";
import type { Contexto } from "./vista";

/** Quién dijo «voy» a cada partido del domingo con ficha de ese equipo (sin sancionados ni «nunca a partidos»): para el
 *  aviso «Estás convocado con el MdL (no con el MdA)» y el «Esta vez no entras…» (D173). */
export function disponiblesDe(ctx: Pick<Contexto, "partidos" | "jugadores">) {
  const m = new Map<string, Equipo[]>();
  for (const j of ctx.jugadores) {
    if (j.sancionado || j.privado?.nunca_partidos) continue;
    const eqs = ctx.partidos.map((p) => p.equipo).filter((e) => j.respuesta[e] === "va" && j.ficha[e]);
    if (eqs.length) m.set(j.person_id, eqs);
  }
  return m;
}

/** Manda el aviso de la convocatoria aprobada (D173: al aprobar, «Aprobar y avisar»; después, con cada cambio aplicado) a
 *  quien toca respecto a lo ya avisado y deja la salida «enviado». */
export async function enviarAvisoConvocatoria(sb: Cliente, fecha: string) {
  const ctx = await cargarContexto(sb, fecha);
  const c = ctx?.convocatoria;
  if (!ctx || !c || c.estado !== "aprobada") return null;
  const r = await avisarConvocados(fecha, c.equipos, c.aviso_estado === "enviado" ? c.aviso_base : null, ctx.partidos, disponiblesDe(ctx));
  if (r.estado === "enviado") await sb.rpc("convocatoria_marcar", { p_fecha: fecha, p_que: "aviso_enviado" });
  const nombre = (id: string) => ctx.jugadores.find((j) => j.person_id === id)?.nombre ?? id;
  return { ...r, nombres: { sinAvisos: r.destinatarios.filter((id) => !r.conAvisos.includes(id)).map(nombre) } };
}
