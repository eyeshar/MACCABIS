import "server-only";
import { clienteServicio, configuradoEnvio, encolar, enviarPendientes, type FilaAviso } from "@/lib/avisos/servidor";
import { horaDeEnvio, madrid } from "@/lib/avisos/horario";
import type { Convocatoria, Equipo } from "./motor";
import { destinatariosAviso, firmaConvocatoria, textoParaPersona, type PartidoMensaje } from "./mensajes";

// Aviso de la convocatoria en el móvil (D107, D127, D173). Sale al pulsar «Aprobar y avisar» (D173: aprobar ya avisa; ya
// no hay «Enviar ahora» aparte) o al aplicar un cambio tras aprobar («Aplicar y avisar», «Avisar del cambio»). Al aprobar:
// UN aviso por jugador según su caso (convocado con un equipo pudiendo ir a los dos, convocado, o dijo «voy» y no entra).
// Tras un cambio: a quien entra, cambia de equipo o sale respecto a lo ya avisado (aviso_base). Horas de silencio. La clave
// de cada aviso lleva la firma de la convocatoria: pulsar dos veces o repetir con la misma convocatoria no manda nada doble.

export type ResultadoAviso = {
  estado: "enviado" | "sin_configurar"; destinatarios: string[]; conAvisos: string[]; fallidos: string[]; programado: Date | null; cambio: boolean;
};

export async function avisarConvocados(fecha: string, conv: Convocatoria, base: Convocatoria | null, partidos: PartidoMensaje[], disponibles: Map<string, Equipo[]> = new Map()): Promise<ResultadoAviso> {
  const { cambio, personas } = destinatariosAviso(conv, base, disponibles);
  const ids = personas.map((p) => p.person_id);
  if (!configuradoEnvio()) return { estado: "sin_configurar", destinatarios: ids, conAvisos: [], fallidos: [], programado: null, cambio };
  const sb = clienteServicio();
  const primero = partidos.filter((p) => p.inicio).map((p) => p.inicio!).sort()[0] ?? "10:00";
  const ahora = new Date();
  const envio = horaDeEnvio(ahora, madrid(fecha, primero));
  const firma = firmaConvocatoria(conv);
  const filas: FilaAviso[] = personas.map((x) => ({
    ...textoParaPersona(fecha, partidos, cambio, x),
    clave: `convocatoria:${fecha}:${firma}:${x.person_id}`, tipo: "cambio", person_id: x.person_id, eventos: [], url: `/mi-zona/domingo/${fecha}`, programado_para: envio,
  }));
  await encolar(sb, filas);
  await enviarPendientes(sb, ahora);
  const [{ data: subs }, { data: reg }] = await Promise.all([
    ids.length ? sb.from("suscripciones_avisos").select("person_id").eq("activa", true).in("person_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? sb.from("avisos_registro").select("person_id, resultado").like("clave", `convocatoria:${fecha}:${firma}:%`) : Promise.resolve({ data: [] }),
  ]);
  const con = new Set(((subs ?? []) as { person_id: string }[]).map((s) => s.person_id));
  const fallidos = ((reg ?? []) as { person_id: string; resultado: string | null }[]).filter((r) => r.resultado === "fallido").map((r) => r.person_id);
  return { estado: "enviado", destinatarios: ids, conAvisos: ids.filter((id) => con.has(id)), fallidos, programado: envio > ahora ? envio : null, cambio };
}

/** «Reenviar» (D173): solo los avisos de esta convocatoria que fallaron (con avisos activados pero el envío dio error). Se
 *  vuelven a poner sin enviar y salen ya. */
export async function reenviarFallidos(fecha: string, conv: Convocatoria) {
  if (!configuradoEnvio()) return { reenviados: 0 };
  const sb = clienteServicio();
  const { data } = await sb.from("avisos_registro").update({ enviado_en: null, resultado: null, programado_para: new Date().toISOString() })
    .like("clave", `convocatoria:${fecha}:${firmaConvocatoria(conv)}:%`).eq("resultado", "fallido").select("id");
  await enviarPendientes(sb, new Date());
  return { reenviados: data?.length ?? 0 };
}
