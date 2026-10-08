import Link from "next/link";
import { Calendario } from "@/components/Iconos";
import Responder from "@/components/respuestas/Responder";
import { madrid } from "@/lib/avisos/horario";
import { sumarDias } from "@/lib/dias";
import {
  estadoDe, horario, nombreCorto, pistaTexto, tituloDe, unidades,
  type MiAusencia, type MiEvento, type MiRespuesta, type MotivoJugador, type Unidad,
} from "@/lib/respuestas/dominio";

const abierta = (u: Unidad, ahora: Date) => u.eventos.some((e) => e.estado === "programado" && madrid(e.fecha, e.inicio ? String(e.inicio).slice(0, 5) : "00:00") > ahora);
const DIA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
function Fecha({ f }: { f: string }) {
  return <div className="mz-fecha"><small>{DIA[new Date(`${f}T12:00:00Z`).getUTCDay()]}</small><b>{+f.slice(8)}</b></div>;
}
const tituloUnidad = (u: Unidad) => (u.tipo === "domingo" && u.eventos.length > 1 ? `Partidos del domingo · J${u.eventos[0].jornada ?? ""}` : tituloDe(u.eventos[0]));
const horaUnidad = (u: Unidad) => (u.tipo === "domingo" && u.eventos.length > 1
  ? u.eventos.map((e) => `${String(e.inicio ?? "").slice(0, 5)} ${e.equipo}`).join(" · ")
  : `${horario(u.eventos[0])} · ${pistaTexto(u.eventos[0])}`);

/** «Te faltan N respuestas», «Tu agenda» y «Marcar días que no estoy» (D99, 3.2). Apagado: solo la informacion, sin
 *  botones, con «Por ahora, responde en SportEasy» (3.7). */
export default function Agenda({ eventos, respuestas, ausencias, encendido, hoy }: {
  eventos: MiEvento[]; respuestas: MiRespuesta[]; ausencias: MiAusencia[]; encendido: boolean; hoy: string;
}) {
  const ahora = new Date();
  const todas = unidades(eventos);
  const limite = sumarDias(hoy, 14);
  const pendientes = encendido ? todas.filter((u) => u.fecha <= limite && abierta(u, ahora) && estadoDe(u, respuestas, ausencias).pendiente) : [];
  const agenda = todas.filter((u) => abierta(u, ahora) || u.eventos.every((e) => e.estado === "cancelado")).slice(0, 6);
  return (
    <>
      {pendientes.length > 0 && (
        <section className="mz-sec rw-faltan" aria-labelledby="t-faltan">
          <div className="mz-sec-cab"><h2 id="t-faltan">{pendientes.length === 1 ? "Te falta 1 respuesta" : `Te faltan ${pendientes.length} respuestas`}</h2></div>
          <div className="rw-tarjetas">
            {pendientes.map((u) => {
              const e = u.eventos[0];
              const r = respuestas.find((x) => x.evento_id === e.id);
              return (
                <article key={u.clave} className="rw-tarjeta" data-tipo={e.tipo}>
                  <Link href={u.url} className="rw-tarjeta-cab">
                    <Fecha f={u.fecha} />
                    <span className="rw-tarjeta-que"><strong>{tituloUnidad(u)}</strong><span>{horaUnidad(u)}</span></span>
                  </Link>
                  <Responder eventoId={e.id} fecha={u.fecha} domingo={u.tipo === "domingo"} actual={null} nombre={u.tipo === "domingo" ? `partido del domingo ${+u.fecha.slice(8)}` : nombreCorto(e)}
                    urlDomingo={u.modo === "distintas" ? u.url : undefined} motivo={(r?.motivo as MotivoJugador) ?? null} detalle={r?.detalle ?? null} />
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="mz-sec" id="agenda" aria-labelledby="t-agenda">
        <div className="mz-sec-cab">
          <h2 id="t-agenda">Tu agenda</h2>
          <Link href="/#calendario" className="pequeno" style={{ fontWeight: 600 }}>Calendario completo</Link>
        </div>
        <div className="mz-lista">
          {agenda.map((u) => {
            const est = estadoDe(u, respuestas, ausencias);
            return (
              <Link key={u.clave} href={u.url} className="mz-fila rw-fila" data-tipo={u.eventos[0].tipo}>
                <Fecha f={u.fecha} />
                <div className="mz-que"><strong>{tituloUnidad(u)}</strong><span>{horaUnidad(u)}</span></div>
                {encendido || est.clase === "cancelado"
                  ? <span className={`rw-estado rw-estado-${est.clase}`}>{est.texto}</span>
                  : <span className="pastilla pastilla-pendiente">Ver</span>}
              </Link>
            );
          })}
          {!agenda.length && <div className="mz-fila"><span className="suave">No hay nada en el calendario.</span></div>}
        </div>
        {!encendido && <p className="mz-nota rw-sporteasy">Por ahora, responde en SportEasy.</p>}
      </section>

      {encendido && (
        <Link href="/mi-zona/ausencias" className="rw-marcar">
          <span aria-hidden="true" className="rw-marcar-icono"><Calendario size={24} /></span>
          <span><strong>Marcar días que no estoy</strong><small>{ausencias.length ? `Tienes ${ausencias.length} ${ausencias.length === 1 ? "ausencia" : "ausencias"} marcada${ausencias.length === 1 ? "" : "s"}` : "Viajes, lesiones… y no te preguntamos esos días"}</small></span>
          <span aria-hidden="true">›</span>
        </Link>
      )}
    </>
  );
}
