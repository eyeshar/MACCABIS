import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Volver from "@/components/nav/Volver";
import { exigirSesion, esGestorActual, origenMensajes } from "@/lib/sesion";
import { cargarMiEvento, cargarMisEventosDelDia } from "@/lib/respuestas/jugador";
import { enlaceLugar, enlaceMapa, fechaLarga, hhmm as hhmmJ, lineaCambio, pistaTexto, restar20, TEXTO_TIPO, tituloDe, type MiEvento } from "@/lib/respuestas/dominio";
import { cargarEvento, cargarPistas } from "@/lib/eventos/datos";
import { accionMensajeDe, cambiosDeVisible, hhmm, mensajeWhatsApp, pistaEfectiva, textoTipo, tituloEvento, type EventoFila } from "@/lib/eventos/dominio";
import { lineaEquipacion } from "@/lib/equipacion";
import { resumenConvocatorias } from "@/lib/convocatoria/resumen";
import CopiarTexto from "@/app/gestion/(panel)/eventos/CopiarTexto";
import CabeceraEvento from "./Cabecera";
import VistaJugador from "./VistaJugador";
import RespuestasGestor from "./RespuestasGestor";
import "@/components/respuestas/respuestas.css";
import "@/components/inicio/inicio.css";
import "@/app/gestion/(panel)/eventos/eventos.css";
import "./evento.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Evento · Maccabis", robots: { index: false, follow: false } };

type Pestana = { id: "respuestas" | "convocatoria" | "grupos" | "whatsapp" | "mia"; texto: string };

const mayus = (t: string) => t.replace(/^./, (c) => c.toUpperCase());

/** Evento (D189, estructura nueva). Una sola pantalla para el jugador (antes /mi-zona/evento/<id>, que redirige aqui) y,
 *  solo para los gestores, pestañas: Respuestas (por defecto; antes /gestion/eventos/<id>/respuestas), Convocatoria
 *  (partidos) o Grupos (entrenos), WhatsApp y Mi respuesta (si también juega). La pestaña va en la URL (?tab=). */
export default async function Evento({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  const { supabase } = await exigirSesion();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [gestor, mio] = await Promise.all([esGestorActual(), cargarMiEvento(id)]);

  if (!gestor) {
    if (!mio) notFound();
    if (mio.oficial === false) redirect(`/planes/${mio.id}`);
    // Un domingo con dos partidos suyos a horas distintas se responde una sola vez: al domingo.
    if (mio.tipo === "liga") {
      const delDia = (await cargarMisEventosDelDia(mio.fecha)).filter((x) => x.tipo === "liga" && x.estado === "programado");
      if (delDia.length === 2 && String(delDia[0].inicio) !== String(delDia[1].inicio)) redirect(`/mi-zona/domingo/${mio.fecha}`);
    }
    return (
      <main className="pagina rw-evento ev2" data-vista="jugador">
        <Volver defecto="/calendario" etiqueta="Calendario" />
        <CabeceraJugador e={mio} />
        <VistaJugador e={mio} />
      </main>
    );
  }

  const [ev, pistas] = await Promise.all([cargarEvento(supabase, id), cargarPistas(supabase)]);
  if (!ev) notFound();
  if (ev.oficial === false) redirect(`/planes/${ev.id}`);
  const pestanas: Pestana[] = [
    { id: "respuestas", texto: "Respuestas" },
    ...(ev.tipo === "liga" ? [{ id: "convocatoria" as const, texto: "Convocatoria" }] : ev.tipo === "entreno" ? [{ id: "grupos" as const, texto: "Grupos" }] : []),
    { id: "whatsapp", texto: "WhatsApp" },
    ...(mio ? [{ id: "mia" as const, texto: "Mi respuesta" }] : []),
  ];
  const actual = pestanas.find((p) => p.id === tab)?.id ?? "respuestas";
  const pe = pistaEfectiva(ev, pistas);
  const dir = pe.pista?.direccion ?? null;
  const ini = hhmm(ev.inicio);
  return (
    <main className="pagina rw-evento ev2 ev2-gestor" data-vista="gestor">
      <Volver defecto="/calendario" etiqueta="Calendario" />
      <CabeceraEvento tipo={ev.tipo} etiqueta={`${textoTipo(ev.tipo)}${ev.tipo === "liga" && ev.jornada ? ` · J${ev.jornada}` : ""}${ev.equipo !== "ambos" ? ` · ${ev.equipo}` : ""}`}
        titulo={tituloEvento(ev)} fecha={mayus(fechaLarga(ev.fecha))} quedada={hhmm(ev.quedada) ?? (ini ? restar20(ini) : null)} inicio={ini} fin={hhmm(ev.fin)}
        pista={pe.porConfirmar ? `Pista por confirmar${pe.motivo ? ` (${pe.motivo})` : ""}` : pe.texto} direccion={dir} mapa={dir ? enlaceMapa(dir) : null}
        cambio={null} cancelado={ev.estado === "cancelado"} />
      <nav className="ev2-pestanas" aria-label="Pestañas del evento" data-testid="pestanas-evento">
        {pestanas.map((p) => <Link key={p.id} href={p.id === "respuestas" ? `/evento/${ev.id}` : `/evento/${ev.id}?tab=${p.id}`} aria-current={actual === p.id ? "page" : undefined} replace>{p.texto}</Link>)}
      </nav>
      <div className="ev2-panel" data-pestana={actual}>
        {actual === "respuestas" && <RespuestasGestor id={ev.id} />}
        {actual === "convocatoria" && <ConvocatoriaResumen ev={ev} />}
        {actual === "grupos" && <GruposResumen ev={ev} />}
        {actual === "whatsapp" && <Mensajes ev={ev} pistas={pistas} />}
        {actual === "mia" && mio && <VistaJugador e={mio} soloRespuesta />}
      </div>
    </main>
  );
}

function CabeceraJugador({ e }: { e: MiEvento }) {
  const ini = hhmmJ(e.inicio);
  return (
    <CabeceraEvento tipo={e.tipo} etiqueta={`${TEXTO_TIPO[e.tipo]}${e.tipo === "liga" && e.jornada ? ` · J${e.jornada}` : ""}${e.equipo !== "ambos" ? ` · ${e.equipo}` : ""}`}
      titulo={tituloDe(e)} fecha={mayus(fechaLarga(e.fecha))} quedada={hhmmJ(e.quedada) ?? (ini ? restar20(ini) : null)} inicio={ini} fin={hhmmJ(e.fin)}
      pista={e.pista_nombre || !e.lugar_nombre ? pistaTexto(e) : e.lugar_nombre} direccion={e.lugar_direccion ?? e.pista_direccion} mapa={enlaceLugar(e)}
      cambio={lineaCambio(e)} cancelado={e.estado === "cancelado"} />
  );
}

/** Pestaña «Convocatoria» (partidos): el estado de la del domingo y cuántos van en cada equipo, con su enlace. */
async function ConvocatoriaResumen({ ev }: { ev: EventoFila }) {
  const { supabase } = await exigirSesion();
  const [c] = await resumenConvocatorias(supabase, [ev.fecha]);
  const estado = !c ? "Sin propuesta todavía" : c.estado === "aprobada" ? "Aprobada" : "Propuesta (sin aprobar)";
  return (
    <section className="gs-bloque" aria-labelledby="t-conv" data-testid="pestana-convocatoria">
      <h2 id="t-conv" className="ev2-h2">Convocatoria del domingo</h2>
      <p style={{ margin: 0 }}><span className="pastilla">{estado}</span></p>
      {c && (
        <ul className="lista-limpia">
          {(["MdA", "MdL"] as const).map((eq) => <li key={eq}><b>{eq}</b>: {(c.equipos[eq] ?? []).length} convocados</li>)}
        </ul>
      )}
      <Link className="boton boton-amarillo" href={`/gestion/convocatoria?fecha=${ev.fecha}`}>Abrir la convocatoria</Link>
    </section>
  );
}

/** Pestaña «Grupos» (entrenos): el reparto del entreno (nivelado, D122) y la vista para el equipo, en su pantalla. */
async function GruposResumen({ ev }: { ev: EventoFila }) {
  return (
    <section className="gs-bloque" aria-labelledby="t-grupos" data-testid="pestana-grupos">
      <h2 id="t-grupos" className="ev2-h2">Grupos del entreno</h2>
      <p className="suave" style={{ margin: 0 }}>Reparto nivelado (1 base, 2 exteriores y 2 interiores por grupo) y la vista para el equipo, sin niveles.</p>
      <div className="botones" style={{ margin: 0 }}>
        <Link className="boton boton-amarillo" href={`/gestion/grupos/${ev.id}`}>Preparar los grupos</Link>
        <Link className="boton boton-claro" href={`/gestion/tablero?evento=${ev.id}`}>Abrir el tablero</Link>
      </div>
    </section>
  );
}

/** Pestaña «WhatsApp»: el mensaje listo del evento (nuevo, cambio de hora o pista, o cancelado; D160 con la equipación en
 *  los partidos) y «Editar el evento». El recordatorio a quien falta está en Respuestas. */
async function Mensajes({ ev, pistas }: { ev: EventoFila; pistas: Awaited<ReturnType<typeof cargarPistas>> }) {
  const web = await origenMensajes();
  const accion = accionMensajeDe(ev, false);
  const aviso = ev.tipo === "liga" && ev.rival && ev.jornada != null && ev.equipo !== "ambos"
    ? { equipo: ev.equipo === "MdA" ? ("MDA" as const) : ("MDL" as const), jornada: ev.jornada, fecha: ev.fecha, hora: ev.inicio ? ev.inicio.slice(0, 5) : null, local: ev.es_local, descansa: false, rival: ev.rival, campo: ev.numero_pista ? String(ev.numero_pista) : null }
    : null;
  const mensaje = mensajeWhatsApp(ev, pistas, accion, {
    cambios: accion === "cambio" ? cambiosDeVisible(ev.cambio_visible) : [], lineaEquipacion: ev.tipo === "liga" ? lineaEquipacion(aviso) : null, respondeEnLaWeb: `${web}/mi-zona`,
  });
  return (
    <section className="gs-bloque" aria-labelledby="t-wa" data-testid="pestana-whatsapp">
      <h2 id="t-wa" className="ev2-h2">{accion === "cancelado" ? "Cancelación" : accion === "nuevo" ? "Mensaje del evento" : "Cambio de hora o pista"}</h2>
      <CopiarTexto texto={mensaje} />
      <div className="botones" style={{ margin: 0 }}>
        {ev.tipo === "liga" && <Link className="boton boton-claro" href={`/gestion/convocatoria/salida?fecha=${ev.fecha}`}>Mensajes de la convocatoria</Link>}
        <Link className="boton boton-claro" href={`/gestion/eventos/${ev.id}`} data-testid="editar-evento">Editar el evento</Link>
      </div>
    </section>
  );
}
