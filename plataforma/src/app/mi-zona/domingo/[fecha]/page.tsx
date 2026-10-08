import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirSesion } from "@/lib/sesion";
import ElegirDomingo from "@/components/respuestas/ElegirDomingo";
import { Camiseta as ColorRival } from "@/components/ProximoPartido";
import { madrid } from "@/lib/avisos/horario";
import { cargarMisAusencias, cargarMisEventosDelDia, cargarMisRespuestas, cargarQuienVa, respuestasWebEncendido } from "@/lib/respuestas/jugador";
import {
  enlaceMapa, estadoDe, fechaLarga, hhmm, lineaCambio, opcionActual, opcionesDomingo, pistaTexto, restar20, unidades,
  type MotivoJugador,
} from "@/lib/respuestas/dominio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Domingo · Maccabis", robots: { index: false, follow: false } };

const limpiar = (r: string | null) => (r ? r.replace(/([.,;:!?])\1+/g, "$1").trim() : "");

// Domingo (D99, 3.5): las dos tarjetas de partido (MdA amarillo, MdL naranja), la instalacion con mapa y «¿Puedes
// jugar?» con una sola respuesta. Estar disponible no es estar convocado (D46).
export default async function Domingo({ params }: { params: Promise<{ fecha: string }> }) {
  const { fecha } = await params;
  await exigirSesion();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) notFound();
  const partidos = (await cargarMisEventosDelDia(fecha)).filter((e) => e.tipo === "liga");
  if (!partidos.length) notFound();
  const u = unidades(partidos).find((x) => x.tipo === "domingo");
  const [encendido, respuestas, ausencias] = await Promise.all([respuestasWebEncendido(), cargarMisRespuestas(), cargarMisAusencias()]);
  const abierto = !!u && u.eventos.every((e) => madrid(e.fecha, e.inicio ? String(e.inicio).slice(0, 5) : "00:00") > new Date());
  const est = u ? estadoDe(u, respuestas, ausencias) : null;
  const quien = encendido ? await cargarQuienVa(partidos.map((e) => e.id)) : null;
  const rNo = respuestas.find((r) => partidos.some((e) => e.id === r.evento_id) && r.respuesta === "no" && r.motivo !== "horario");
  const direccion = partidos.find((e) => e.pista_direccion)?.pista_direccion ?? null;

  return (
    <main className="pagina rw-evento rw-domingo">
      <p className="rw-volver"><Link href="/mi-zona">← Mi zona</Link></p>
      <header className="rw-ev-cab" data-tipo="liga">
        <span className="rw-ev-tipo">Partidos de liga{partidos[0].jornada ? ` · J${partidos[0].jornada}` : ""}</span>
        <h1>{fechaLarga(fecha).replace(/^./, (c) => c.toUpperCase())}</h1>
      </header>
      <div className="rw-partidos">
        {partidos.map((e) => (
          <article key={e.id} className="rw-partido" data-equipo={e.equipo}>
            <span className="rw-partido-eq">{e.equipo}</span>
            <strong className="mono rw-partido-hora">{hhmm(e.inicio) ?? "Hora por confirmar"}</strong>
            <span>{e.es_local === false ? `${limpiar(e.rival)} – ${e.equipo}` : `${e.equipo} – ${limpiar(e.rival)}`}</span>
            <span className="suave pequeno">{pistaTexto(e)} · encuentro {hhmm(e.quedada) ?? (e.inicio ? restar20(String(e.inicio)) : "—")}</span>
            {e.rival && <span><ColorRival rival={limpiar(e.rival)} /></span>}
            {lineaCambio(e) && <span className="rw-cambio">{lineaCambio(e)}</span>}
            {e.estado === "cancelado" && <span className="aviso aviso-error">Cancelado</span>}
          </article>
        ))}
      </div>
      {u?.modo === "misma" && <p className="suave">Los dos partidos son a la misma hora: esta jornada no se puede doblar.</p>}
      <section className="tarjeta rw-pista" aria-labelledby="t-inst">
        <h2 id="t-inst" className="solo-lectores">Instalación</h2>
        <strong>{partidos[0].pista_nombre ?? "Pista por confirmar"}</strong>
        {direccion && <span className="suave">{direccion}</span>}
        {direccion && <a className="boton boton-claro rw-mapa" href={enlaceMapa(direccion)} target="_blank" rel="noopener noreferrer">Abrir en el mapa</a>}
      </section>

      <section className="tarjeta rw-vas" aria-labelledby="t-puedes">
        <div className="mz-sec-cab"><h2 id="t-puedes">¿Puedes jugar?</h2>{est && <span className={`rw-etiqueta${est.pendiente ? " sin" : ""}`}>{est.pendiente ? "Aún no has respondido" : est.texto}</span>}</div>
        {encendido && u ? (
          abierto ? (
            <ElegirDomingo fecha={fecha} opciones={opcionesDomingo(u)} actual={opcionActual(u, respuestas)} nombre={`partido del domingo ${+fecha.slice(8)}`}
              motivo={(rNo?.motivo as MotivoJugador) ?? null} detalle={rNo?.detalle ?? null} />
          ) : <p className="suave" style={{ margin: 0 }}>Los partidos ya empezaron: no se puede cambiar la respuesta.</p>
        ) : <p className="rw-sporteasy" style={{ margin: 0 }}>Por ahora, responde en SportEasy.</p>}
        <p className="rw-nota-conv">Estar disponible no es estar convocado: en la convocatoria te decimos en qué equipo juegas.</p>
      </section>

      {quien && partidos.map((e) => {
        const q = quien.get(e.id)!;
        return (
          <section key={e.id} className="tarjeta rw-quien" aria-label={`Quién va al de las ${hhmm(e.inicio)}`}>
            <h2>Quién va · {e.equipo} {hhmm(e.inicio)}</h2>
            <dl>
              <div><dt className="rw-q-va">Van · {q.va.length}</dt><dd>{q.va.join(", ") || "—"}</dd></div>
              <div><dt className="rw-q-duda">Dudan · {q.duda.length}</dt><dd>{q.duda.join(", ") || "—"}</dd></div>
              <div><dt className="rw-q-no">No van · {q.no.length}</dt><dd>{q.no.join(", ") || "—"}</dd></div>
            </dl>
            <p className="suave pequeno" style={{ margin: 0 }}>{q.sin_responder === 1 ? "1 sin responder" : `${q.sin_responder} sin responder`}</p>
          </section>
        );
      })}
      {encendido && <p><Link href="/mi-zona/ausencias/nueva" className="rw-enlace">¿Vas a faltar varios días? Marca una ausencia</Link></p>}
    </main>
  );
}
