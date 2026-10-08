import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirGestor, origenMensajes } from "@/lib/sesion";
import { lineaEquipacion } from "@/lib/equipacion";
import { convocadosDe, diaCorto } from "@/lib/eventos/dominio";
import { avisoDeEvento, cargarEvento, cargarEventos, cargarJugadores, cargarPistas } from "@/lib/eventos/datos";
import { cambioParaVer, deLaSerieDesde, mensajeWhatsApp, pistaEfectiva, textoTipo, tituloEvento } from "@/lib/eventos/dominio";
import { fechaHora } from "@/lib/fechas";
import BotonConfirmar from "@/components/BotonConfirmar";
import FormularioEvento from "../FormularioEvento";
import CopiarTexto from "../CopiarTexto";
import { cancelarEvento } from "../acciones";

export const metadata = { title: "Editar evento · Gestión Maccabis" };

export default async function EditarEvento({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ guardado?: string; alcance?: string; avisados?: string }> }) {
  const { id } = await params;
  const { guardado, alcance, avisados } = await searchParams;
  const { supabase } = await exigirGestor();
  const [evento, pistas, todos, jugadores, { data: encendido }, { data: subs }] = await Promise.all([
    cargarEvento(supabase, id), cargarPistas(supabase), cargarEventos(supabase), cargarJugadores(supabase),
    supabase.rpc("respuestas_web_encendido"), supabase.from("suscripciones_avisos").select("person_id").eq("activa", true),
  ]);
  if (!evento) notFound();
  const invitadosPor = {
    entreno: convocadosDe({ tipo: "entreno", equipo: "ambos" }, jugadores).length,
    MdA: convocadosDe({ tipo: "liga", equipo: "MdA" }, jugadores).length,
    MdL: convocadosDe({ tipo: "liga", equipo: "MdL" }, jugadores).length,
    ambos: convocadosDe({ tipo: "liga", equipo: "ambos" }, jugadores).length,
  };
  const conAvisos = new Set(((subs ?? []) as { person_id: string | null }[]).map((s) => s.person_id));
  const sinAvisos = convocadosDe(evento, jugadores).filter((j) => !conAvisos.has(j.person_id));
  const web = await origenMensajes();
  const siguientes = deLaSerieDesde(todos, evento).length;
  const pe = pistaEfectiva(evento, pistas);
  const nuevo = (evento.sporteasy_cambio ?? "").startsWith("Evento nuevo");
  const accionMensaje = evento.estado === "cancelado" ? "cancelado" : nuevo ? "nuevo" : "cambio";
  const cambios = evento.sporteasy_estado === "pendiente" && evento.sporteasy_cambio && !nuevo && !evento.sporteasy_cambio.startsWith("Carga inicial") ? cambioParaVer(evento.sporteasy_cambio)!.split("; ") : [];
  const mensaje = mensajeWhatsApp(evento, pistas, accionMensaje, {
    cambios, lineaEquipacion: evento.tipo === "liga" ? lineaEquipacion(avisoPartidoDe(evento)) : null,
    respondeEnLaWeb: encendido ? `${web}/mi-zona` : null,
  });
  const titulo = evento.tipo === "entreno" ? `Entreno · ${diaCorto(evento.fecha)}` : `${textoTipo(evento.tipo)} · ${diaCorto(evento.fecha)}`;
  const g = guardado ?? "";
  const textoGuardado = g === "nuevo" ? "Evento creado." : g === "nada" ? "No había nada que cambiar." : g === "recordatorios" ? "Recordatorios guardados." : g.startsWith("serie-") ? `Guardado en este y en los siguientes (${g.slice(6)} sesiones).` : g === "cambio" ? "Cambios guardados." : g.startsWith("cancelado") ? "Evento cancelado." : g.startsWith("restablecido") ? "Evento restablecido." : null;

  return (
    <>
      <div className="gs-titulo">
        <div>
          <div className="gs-eyebrow"><Link href="/gestion/eventos">← Eventos</Link> · Editar evento</div>
          <h1 style={{ fontSize: 44 }}>{titulo}</h1>
          <span className="suave">{tituloEvento(evento)} · {pe.porConfirmar ? "pista por confirmar" : pe.texto}</span>
        </div>
        <div className="ev-botones">
          <Link className="boton boton-contorno" href={`/gestion/eventos/${evento.id}/respuestas`}>Respuestas y motivos</Link>
        </div>
      </div>

      {textoGuardado && (
        <div className="aviso aviso-ok" role="status" data-testid="aviso-guardado">
          <b>{textoGuardado}</b>{" "}
          {evento.sporteasy_estado === "pendiente" ? "Queda «pendiente de copiar» a SportEasy." : ""}
          {avisados != null ? ` Aviso al móvil para ${avisados} ${avisados === "1" ? "invitado" : "invitados"} (de noche, sale a las 08:30).` : ""}
        </div>
      )}

      {evento.sporteasy_estado === "pendiente" && (
        <section className="gs-bloque" style={{ marginBottom: 16, maxWidth: 960 }} aria-labelledby="t-whatsapp" data-testid="mensaje-whatsapp">
          <h2 id="t-whatsapp" style={{ fontSize: 22 }}>{encendido ? `Mensaje de WhatsApp para quien no tiene avisos · ${sinAvisos.length}` : "Mensaje para WhatsApp"}</h2>
          {encendido && sinAvisos.length > 0 && <p className="pequeno" style={{ margin: 0 }}>Sin avisos: {sinAvisos.map((j) => j.nombre_visible).join(", ")}.</p>}
          <p className="pequeno suave" style={{ margin: 0 }}>
            {evento.estado === "cancelado" ? "Cancelación" : nuevo ? "Evento nuevo" : "Cambio"} pendiente de copiar a SportEasy{evento.sporteasy_cambio && !evento.sporteasy_cambio.startsWith("Carga inicial") ? `: ${cambioParaVer(evento.sporteasy_cambio)}` : ""}. Copia este texto al grupo; Claude copia el evento a SportEasy con tu OK.
          </p>
          <CopiarTexto texto={mensaje} />
        </section>
      )}
      {evento.sporteasy_estado === "copiado" && evento.sporteasy_copiado_en && (
        <p className="pequeno suave">Copiado a SportEasy el {fechaHora(evento.sporteasy_copiado_en)}.</p>
      )}

      {evento.estado === "cancelado" && <div className="aviso aviso-error">Este evento está <b>cancelado</b>.</div>}

      <FormularioEvento
        key={`${evento.id}-${evento.fecha}-${evento.inicio}-${evento.pista_id}-${evento.notas}-${evento.sporteasy_cambio}`}
        evento={evento} pistas={pistas} nSiguientes={siguientes}
        alcanceInicial={alcance === "siguientes" ? "siguientes" : "este"} volver="/gestion/eventos"
        encendido={Boolean(encendido)} invitadosPor={invitadosPor}
      />

      <section className="gs-bloque" style={{ marginTop: 16, maxWidth: 960 }} aria-labelledby="t-cancelar">
        <h2 id="t-cancelar" style={{ fontSize: 22 }}>{evento.estado === "cancelado" ? "Restablecer el evento" : `Cancelar ${evento.tipo === "entreno" ? "este entreno" : "este evento"}`}</h2>
        <p className="pequeno suave" style={{ margin: 0 }}>Un evento no se borra: se cancela y la cancelación queda pendiente de copiar a SportEasy.</p>
        <div className="botones" style={{ margin: 0 }}>
          <form action={cancelarEvento.bind(null, evento.id, "este", evento.estado === "cancelado")}>
            <BotonConfirmar className={evento.estado === "cancelado" ? "boton boton-claro" : "boton boton-peligro"} pregunta={evento.estado === "cancelado" ? "¿Restablecer este evento?" : "¿Cancelar este evento? Quedará pendiente de copiar a SportEasy."}>
              {evento.estado === "cancelado" ? "Restablecer solo este" : `Cancelar solo este${evento.tipo === "entreno" ? " entreno" : ""}`}
            </BotonConfirmar>
          </form>
          {evento.serie && siguientes > 1 && (
            <form action={cancelarEvento.bind(null, evento.id, "siguientes", evento.estado === "cancelado")}>
              <BotonConfirmar className="boton boton-peligro" pregunta={`¿${evento.estado === "cancelado" ? "Restablecer" : "Cancelar"} este y los ${siguientes - 1} siguientes?`}>
                {evento.estado === "cancelado" ? "Restablecer este y los siguientes" : "Cancelar este y los siguientes"}
              </BotonConfirmar>
            </form>
          )}
        </div>
      </section>
    </>
  );
}

function avisoPartidoDe(e: Parameters<typeof avisoDeEvento>[0]) {
  if (e.tipo !== "liga" || !e.rival || e.jornada == null || (e.equipo !== "MdA" && e.equipo !== "MdL")) return null;
  return {
    equipo: e.equipo === "MdA" ? ("MDA" as const) : ("MDL" as const), jornada: e.jornada, fecha: e.fecha, hora: e.inicio ? e.inicio.slice(0, 5) : null,
    local: e.es_local, descansa: false, rival: e.rival, campo: e.numero_pista ? String(e.numero_pista) : null,
  };
}
