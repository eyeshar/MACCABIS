import "server-only";
import type { Cliente } from "@/lib/eventos/datos";
import { avisarConvocados } from "./avisos";
import { cargarContexto } from "./datos";

/** «Enviar ahora» (D127): con la convocatoria aprobada, manda el aviso «Estás convocado» (o «Cambio en la convocatoria»)
 *  a quien toca, con o sin el interruptor de respuestas en la web, y deja la salida «enviado». Ya no se manda solo al
 *  aprobar ni al cambiar: tras un cambio la salida vuelve a pendiente hasta que un gestor la envie. */
export async function enviarAvisoConvocatoria(sb: Cliente, fecha: string) {
  const ctx = await cargarContexto(sb, fecha);
  const c = ctx?.convocatoria;
  if (!ctx || !c || c.estado !== "aprobada") return null;
  const r = await avisarConvocados(fecha, c.equipos, c.aviso_base, ctx.partidos);
  if (r.estado === "enviado") await sb.rpc("convocatoria_marcar", { p_fecha: fecha, p_que: "aviso_enviado" });
  const nombre = (id: string) => ctx.jugadores.find((j) => j.person_id === id)?.nombre ?? id;
  return { ...r, nombres: { sinAvisos: r.destinatarios.filter((id) => !r.conAvisos.includes(id)).map(nombre) } };
}
