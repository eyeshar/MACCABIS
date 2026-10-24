import "server-only";
import { clienteServicio, configuradoEnvio, encolar, enviarPendientes, estadoInterruptor, type FilaAviso } from "@/lib/avisos/servidor";
import { horaDeEnvio, madrid } from "@/lib/avisos/horario";
import { EQUIPOS, type Convocatoria, type Equipo } from "./motor";
import { textoEstasConvocado, type PartidoMensaje } from "./mensajes";

// Aviso «Estás convocado» en la web (D107): preparado siempre, pero SOLO sale con el interruptor de «respuestas en la
// web» encendido (D99); si no, queda «en espera». Va a quien entra en la convocatoria respecto a la ultima vez que se
// aviso (aviso_base): aprobar avisa a todos; un cambio despues, solo a los nuevos. Pasa por las horas de silencio.
// Usa el registro de avisos del paso 3 (clave unica: repetir no duplica) con tipo «cambio» y clave «convocatoria:…».

export async function avisarConvocados(fecha: string, conv: Convocatoria, base: Convocatoria | null, partidos: PartidoMensaje[]) {
  if (!configuradoEnvio()) return { estado: "en_espera" as const, avisados: 0, motivo: "sin_configurar" };
  const sb = clienteServicio();
  if (!(await estadoInterruptor(sb)).encendido) return { estado: "en_espera" as const, avisados: 0, motivo: "apagado" };
  const antes = new Set(EQUIPOS.flatMap((e) => (base?.[e] ?? []).map((c) => `${e}|${c.person_id}`)));
  const nuevos = new Map<string, Equipo[]>();
  for (const e of EQUIPOS) for (const c of conv[e] ?? []) if (!antes.has(`${e}|${c.person_id}`)) nuevos.set(c.person_id, [...(nuevos.get(c.person_id) ?? []), e]);
  const primero = partidos.filter((p) => p.inicio).map((p) => p.inicio!).sort()[0] ?? "10:00";
  const ahora = new Date();
  const inicio = madrid(fecha, primero);
  const envio = horaDeEnvio(ahora, inicio);
  const filas: FilaAviso[] = [...nuevos.entries()].map(([person_id, equipos]) => ({
    ...textoEstasConvocado(fecha, partidos, equipos), clave: `convocatoria:${fecha}:${ahora.getTime()}:${person_id}`, tipo: "cambio",
    person_id, eventos: [], url: "/mi-zona#domingo", programado_para: envio,
  }));
  await encolar(sb, filas);
  await enviarPendientes(sb, ahora);
  return { estado: "enviado" as const, avisados: filas.length, motivo: envio > ahora ? "silencio" : "enviado" };
}
