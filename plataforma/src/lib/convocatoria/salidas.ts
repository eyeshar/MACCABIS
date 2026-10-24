import "server-only";
import type { Cliente } from "@/lib/eventos/datos";
import { avisarConvocados } from "./avisos";
import { cargarContexto } from "./datos";

/** Si la convocatoria del domingo esta aprobada, avisa «Estás convocado» a los nuevos (solo con el interruptor
 *  encendido; si no, queda «en espera»). La usan la pantalla de convocatoria y el tablero (D121), igual que hasta ahora.
 *  Si el envio falla, la convocatoria sigue aprobada y el aviso queda en espera para «Enviar ahora». */
export async function avisarSiAprobada(sb: Cliente, fecha: string) {
  const ctx = await cargarContexto(sb, fecha);
  const c = ctx?.convocatoria;
  if (!ctx || !c || c.estado !== "aprobada") return null;
  const r = await avisarConvocados(fecha, c.equipos, c.aviso_base, ctx.partidos)
    .catch((e: Error) => ({ estado: "en_espera" as const, avisados: 0, motivo: `error: ${e.message}` }));
  await sb.rpc("convocatoria_marcar", { p_fecha: fecha, p_que: r.estado === "enviado" ? "aviso_enviado" : "aviso_en_espera" });
  return r;
}
