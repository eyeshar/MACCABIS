import Link from "next/link";
import Responder from "@/components/respuestas/Responder";
import { ResponderPlan } from "@/app/planes/[id]/AccionesPlan";
import {
  enlaceLugar, esPlan, estadoDe, fechaAgenda, fechaTarjeta, hhmm, lugarTexto, nombreCorto, restar20, TEXTO_TIPO, tituloDe,
  type MiAusencia, type MiRespuesta, type MotivoJugador, type Unidad,
} from "@/lib/respuestas/dominio";
import { SPORTEASY_CALENDARIO } from "@/lib/web";

// Piezas del inicio personal y de la Agenda (D116): la tarjeta de «Te faltan N respuestas» y la fila de «Tu agenda».

export type Convocatorias = { fecha: string; equipos: ("MdA" | "MdL")[] }[];

/** Pastilla de estado de una unidad: Convocado, Vas, No vas, Duda, Sin responder (o Cancelado). */
export function pastillaDe(u: Unidad, respuestas: MiRespuesta[], ausencias: MiAusencia[], convocatorias: Convocatorias) {
  const est = estadoDe(u, respuestas, ausencias);
  if (est.clase === "cancelado") return { clase: "cancelado", texto: "Cancelado" };
  if (u.tipo === "domingo") {
    const c = convocatorias.find((x) => x.fecha === u.fecha);
    if (c?.equipos.length) return { clase: "convocado", texto: `Convocado · ${c.equipos.join(" y ")}` };
  }
  if (est.clase === "vas") return { clase: "vas", texto: est.texto };
  if (est.clase === "duda") return { clase: "duda", texto: "Duda" };
  if (est.clase === "novas" || est.clase === "ausente") return { clase: "novas", texto: est.clase === "ausente" ? est.texto : "No vas" };
  return { clase: "responde", texto: "Sin responder" };
}

/** Horas de una unidad: la de empezar (o las de los dos partidos) y la quedada (siempre 20 min antes, D98). */
export function horasDe(u: Unidad) {
  const ps = u.eventos.filter((e) => e.estado === "programado");
  const lista = (ps.length ? ps : u.eventos);
  const inicios = lista.map((e) => hhmm(e.inicio)).filter(Boolean) as string[];
  const primero = lista[0];
  const quedada = hhmm(primero?.quedada) ?? (inicios[0] ? restar20(inicios[0]) : null);
  return { inicio: inicios.length ? [...new Set(inicios)].join(" · ") : null, quedada };
}

export const tituloUnidad = (u: Unidad) => (u.tipo === "domingo" && u.eventos.length > 1 ? `Partidos del domingo · J${u.eventos[0].jornada ?? ""}` : tituloDe(u.eventos[0]));

/** Una fila de «Tu agenda»: a la izquierda el dia y la hora en grande y la quedada en amarillo; a la derecha el titulo,
 *  la pastilla de estado y el sitio. Los planes llevan «Plan no oficial»; un entreno con grupos publicados, «Tu grupo». */
export function FilaAgenda({ u, respuestas, ausencias, convocatorias, grupo, encendido }: {
  u: Unidad; respuestas: MiRespuesta[]; ausencias: MiAusencia[]; convocatorias: Convocatorias; grupo?: { grupo: string; companeros: string[] } | null; encendido: boolean;
}) {
  const e = u.eventos[0];
  const h = horasDe(u);
  const p = pastillaDe(u, respuestas, ausencias, convocatorias);
  const plan = esPlan(e);
  // Apagado (fase puente) y sin respuesta: el estado de un evento oficial sale de SportEasy.
  const pastilla = !encendido && !plan && p.clase === "responde" ? { clase: "responde", texto: "Sin responder" } : p;
  return (
    <Link href={u.url} className={`in-fila${plan ? " es-plan" : ""}`} data-tipo={e.tipo} data-testid="fila-agenda">
      <div className="in-fila-cuando">
        <b className="in-fila-dia">{fechaAgenda(u.fecha)}</b>
        <b className="in-fila-hora cifra">{h.inicio ?? "—"}</b>
        {h.quedada && <span className="in-fila-quedada cifra">quedada {h.quedada}</span>}
      </div>
      <div className="in-fila-que">
        {plan && <span className="pl-etq-plan">Plan no oficial</span>}
        <strong>{tituloUnidad(u)}</strong>
        <span className={`in-pastilla in-p-${pastilla.clase}`}>{pastilla.texto}</span>
        <span className="in-fila-lugar suave">{lugarTexto(e)}</span>
        {grupo && <span className="in-grupo" data-testid="tu-grupo">Tu grupo: <b>{grupo.grupo}</b>{grupo.companeros.length ? ` · con ${grupo.companeros.join(", ")}` : ""}</span>}
      </div>
    </Link>
  );
}

/** Tarjeta de «Te faltan N respuestas»: tipo, fecha en grande, casillas Quedada / Empieza (o Partido), titulo y sitio.
 *  Encendido: Voy / No voy / Duda (No voy con su hoja de motivo). Apagado (fase puente): «Responder en SportEasy».
 *  Los planes se responden aqui siempre (D117). */
export function TarjetaPendiente({ u, encendido, respuestas, plazasLlenas }: { u: Unidad; encendido: boolean; respuestas: MiRespuesta[]; plazasLlenas?: boolean }) {
  const e = u.eventos[0];
  const h = horasDe(u);
  const plan = esPlan(e);
  const r = respuestas.find((x) => x.evento_id === e.id);
  const mapa = enlaceLugar(e);
  const tipo = u.tipo === "domingo" ? `Partido${u.eventos.length > 1 ? "s" : ""} · J${e.jornada ?? ""}` : TEXTO_TIPO[e.tipo];
  return (
    <article className={`in-pendiente${plan ? " es-plan" : ""}`} data-tipo={e.tipo} data-testid="tarjeta-pendiente">
      <div className="in-pendiente-cab">
        <span className="mono">{tipo}</span>
        {plan && <span className="pl-etq-plan">Plan no oficial</span>}
      </div>
      <Link href={u.url} className="in-pendiente-fecha">{fechaTarjeta(u.fecha)}</Link>
      <div className="in-casillas">
        {h.quedada && <div className="in-casilla in-casilla-quedada"><small>Quedada</small><b className="cifra">{h.quedada}</b></div>}
        <div className="in-casilla"><small>{u.tipo === "domingo" ? "Partido" : "Empieza"}</small><b className="cifra">{h.inicio ?? "—"}</b></div>
      </div>
      <strong className="in-pendiente-titulo">{tituloUnidad(u)}</strong>
      <span className="suave in-pendiente-lugar">{lugarTexto(e)}</span>
      {mapa && <a className="in-mas in-llegar-mini" href={mapa} target="_blank" rel="noopener noreferrer">Cómo llegar</a>}
      {plan ? (
        <ResponderPlan id={e.id} actual={null} completo={Boolean(plazasLlenas)} nombre={e.titulo ?? "el plan"} />
      ) : encendido ? (
        <Responder eventoId={e.id} fecha={u.fecha} domingo={u.tipo === "domingo"} actual={null} nombre={u.tipo === "domingo" ? `partido del domingo ${+u.fecha.slice(8)}` : nombreCorto(e)}
          urlDomingo={u.modo === "distintas" ? u.url : undefined} motivo={(r?.motivo as MotivoJugador) ?? null} detalle={r?.detalle ?? null} />
      ) : (
        <a className="boton boton-amarillo in-sporteasy" href={SPORTEASY_CALENDARIO} target="_blank" rel="noopener noreferrer" data-testid="responder-sporteasy">Responder en SportEasy</a>
      )}
    </article>
  );
}
