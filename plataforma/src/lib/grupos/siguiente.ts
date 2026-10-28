import "server-only";
import { cargarEventos, type Cliente } from "@/lib/eventos/datos";
import { cargarContexto } from "@/lib/convocatoria/datos";
import { entradaDe } from "@/lib/convocatoria/vista";
import { proponer, type Convocatoria } from "@/lib/convocatoria/motor";
import type { Juntos } from "./sugerir";

// Criterio 4 de «Sugerir grupos» (D147, opcional y el ultimo): quien juega con quien el siguiente partido despues del
// entreno. Con la sesion del GESTOR (RLS de convocatorias: is_gestor). Manda la convocatoria aprobada; si no la hay, el
// borrador que salio de «Usar propuesta» (la del motor, con lo que Ivan haya tocado); si tampoco (sin convocatoria o un
// borrador «en blanco», que puede estar a medias), lo que propone el motor con las respuestas de hoy. Sin partido o sin
// nadie convocado, null (el criterio no se aplica). Solo viaja a la pantalla de Gestion, nunca a la plantilla.

export type Siguiente = { fecha: string; dia: string; origen: "aprobada" | "propuesta" | "motor"; juntos: Juntos };

const aJuntos = (c: Convocatoria | null | undefined): Juntos => {
  const out: Juntos = {};
  for (const [eq, xs] of Object.entries(c ?? {})) for (const x of xs ?? []) (out[x.person_id] ??= []).push(eq);
  return out;
};

export async function siguientePartido(sb: Cliente, fechaEntreno: string): Promise<Siguiente | null> {
  try {
    const fecha = (await cargarEventos(sb))
      .filter((e) => e.tipo === "liga" && e.estado === "programado" && (e.equipo === "MdA" || e.equipo === "MdL") && e.fecha > fechaEntreno)
      .map((e) => e.fecha).sort()[0];
    if (!fecha) return null;
    const dia = new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-ES", { timeZone: "UTC", weekday: "long" });
    const { data } = await sb.from("convocatorias").select("estado, origen, equipos").eq("fecha", fecha).maybeSingle();
    const fila = data as { estado: "borrador" | "aprobada"; origen: "propuesta" | "blanco" | null; equipos: Convocatoria } | null;
    let origen: Siguiente["origen"] = "motor";
    let juntos = fila && (fila.estado === "aprobada" || fila.origen === "propuesta") ? aJuntos(fila.equipos) : {};
    if (fila && Object.keys(juntos).length) origen = fila.estado === "aprobada" ? "aprobada" : "propuesta";
    else {
      const ctx = await cargarContexto(sb, fecha);
      juntos = ctx && ctx.fecha === fecha ? aJuntos(proponer(entradaDe(ctx)).convocatoria) : {};
    }
    return Object.keys(juntos).length ? { fecha, dia, origen, juntos } : null;
  } catch (e) {
    console.warn("grupos: sin convocatoria del siguiente partido", e);
    return null;
  }
}
