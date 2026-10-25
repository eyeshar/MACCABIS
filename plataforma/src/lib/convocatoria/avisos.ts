import "server-only";
import { clienteServicio, configuradoEnvio, encolar, enviarPendientes, type FilaAviso } from "@/lib/avisos/servidor";
import { horaDeEnvio, madrid } from "@/lib/avisos/horario";
import type { Convocatoria } from "./motor";
import { destinatariosAviso, firmaConvocatoria, textoCambioConvocatoria, textoEstasConvocado, type PartidoMensaje } from "./mensajes";

// Aviso «Estás convocado» en la web (D107, D127). Desde D127 NO depende del interruptor de «respuestas en la web»:
// avisar de la convocatoria no pide respuestas (no choca con D64). Sale SOLO al pulsar «Enviar ahora» con la
// convocatoria aprobada. Va a los convocados (la primera vez) o a quien entra, cambia de equipo o sale respecto a lo ya
// avisado (aviso_base, «Cambio en la convocatoria»). Pasa por las horas de silencio. La clave de cada aviso lleva la
// firma de la convocatoria: pulsar dos veces o repetir con la misma convocatoria no manda nada doble.

export type ResultadoAviso = { estado: "enviado" | "sin_configurar"; destinatarios: string[]; conAvisos: string[]; programado: Date | null; cambio: boolean };

export async function avisarConvocados(fecha: string, conv: Convocatoria, base: Convocatoria | null, partidos: PartidoMensaje[]): Promise<ResultadoAviso> {
  const { cambio, personas } = destinatariosAviso(conv, base);
  if (!configuradoEnvio()) return { estado: "sin_configurar", destinatarios: personas.map((p) => p.person_id), conAvisos: [], programado: null, cambio };
  const sb = clienteServicio();
  const primero = partidos.filter((p) => p.inicio).map((p) => p.inicio!).sort()[0] ?? "10:00";
  const ahora = new Date();
  const envio = horaDeEnvio(ahora, madrid(fecha, primero));
  const firma = firmaConvocatoria(conv);
  const filas: FilaAviso[] = personas.map(({ person_id, equipos }) => ({
    ...(cambio ? textoCambioConvocatoria(fecha, partidos, equipos) : textoEstasConvocado(fecha, partidos, equipos)),
    clave: `convocatoria:${fecha}:${firma}:${person_id}`, tipo: "cambio", person_id, eventos: [], url: `/mi-zona/domingo/${fecha}`, programado_para: envio,
  }));
  await encolar(sb, filas);
  await enviarPendientes(sb, ahora);
  const ids = personas.map((p) => p.person_id);
  const { data } = ids.length ? await sb.from("suscripciones_avisos").select("person_id").eq("activa", true).in("person_id", ids) : { data: [] };
  const con = new Set(((data ?? []) as { person_id: string }[]).map((s) => s.person_id));
  return { estado: "enviado", destinatarios: ids, conAvisos: ids.filter((id) => con.has(id)), programado: envio > ahora ? envio : null, cambio };
}
