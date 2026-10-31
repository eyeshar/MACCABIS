import type { Metadata } from "next";
import Volver from "@/components/nav/Volver";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { exigirSesion } from "@/lib/sesion";
import Responder from "@/components/respuestas/Responder";
import SiVoy from "@/components/respuestas/SiVoy";
import QuienVaJugador from "@/components/numeros/QuienVa";
import { dudaAbierta, limiteDudas, madrid, textoLimite } from "@/lib/avisos/horario";
import { cargarMiEvento, cargarMisAusencias, cargarMisEventosDelDia, cargarMisRespuestas, cargarQuienVa, misEntrenosPorDefecto, respuestasWebEncendido } from "@/lib/respuestas/jugador";
import {
  ausenciaQueCubre, enlaceLugar, enlaceMapa, fechaLarga, horario, lineaCambio, nombreCorto, pistaTexto, TEXTO_MOTIVO_TODO, TEXTO_TIPO, tituloDe,
  type MotivoJugador,
} from "@/lib/respuestas/dominio";
import { TEXTO_POR_DEFECTO_JUGADOR } from "@/lib/disponibilidad/porDefecto";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Evento · Maccabis", robots: { index: false, follow: false } };

const TIPO = TEXTO_TIPO;

// Evento del jugador (D99, 3.3): se abre al tocar un aviso. Tipo, fecha, horas y encuentro, pista con mapa, linea
// amarilla si cambio algo, «¿Vas?» y «Quién va» (solo nombres, D46). Apagado: solo la informacion (3.7).
export default async function MiEvento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await exigirSesion();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const e = await cargarMiEvento(id);
  if (!e) notFound();
  // Un domingo con dos partidos suyos a horas distintas se responde una sola vez: al domingo.
  if (e.tipo === "liga") {
    const delDia = (await cargarMisEventosDelDia(e.fecha)).filter((x) => x.tipo === "liga" && x.estado === "programado");
    if (delDia.length === 2 && String(delDia[0].inicio) !== String(delDia[1].inicio)) redirect(`/mi-zona/domingo/${e.fecha}`);
  }
  const [encendido, respuestas, ausencias] = await Promise.all([respuestasWebEncendido(), cargarMisRespuestas(), cargarMisAusencias()]);
  const r = respuestas.find((x) => x.evento_id === e.id) ?? null;
  const aus = ausenciaQueCubre(e.fecha, ausencias);
  const abierto = e.estado === "programado" && madrid(e.fecha, e.inicio ? String(e.inicio).slice(0, 5) : "00:00") > new Date();
  const ahora = new Date();
  const conDuda = dudaAbierta(e, ahora);
  const quien = encendido ? (await cargarQuienVa([e.id])).get(e.id)! : null;
  const cambio = lineaCambio(e);
  const actual = r && r.respuesta !== "sin_responder" ? r.respuesta : null;
  // D152: «No vas (puesto por defecto)» con «Sí voy» (solo lo suyo, con respuestaEfectiva; nunca se nombra la marca).
  const porDefecto = abierto && (await misEntrenosPorDefecto([e], respuestas, ausencias, encendido).catch(() => new Set<string>())).has(e.id);
  const etiqueta = e.estado === "cancelado" ? "Cancelado"
    : porDefecto ? TEXTO_POR_DEFECTO_JUGADOR
    : !actual && aus ? `Ausente · ${TEXTO_MOTIVO_TODO[aus.motivo]}`
    : actual === "va" ? "Vas" : actual === "duda" ? "Duda" : actual === "no" ? `No vas${r?.motivo === "no_confirmo" ? " · no confirmaste a tiempo" : r?.motivo ? ` · ${TEXTO_MOTIVO_TODO[r.motivo]}` : ""}` : "Aún no has respondido";

  return (
    <main className="pagina rw-evento">
      <Volver defecto="/agenda" etiqueta="Agenda" />
      <header className="rw-ev-cab" data-tipo={e.tipo}>
        <span className="rw-ev-tipo">{TIPO[e.tipo]}{e.tipo === "liga" && e.jornada ? ` · J${e.jornada}` : ""}{e.equipo !== "ambos" ? ` · ${e.equipo}` : ""}</span>
        <h1>{tituloDe(e)}</h1>
        <p className="rw-ev-fecha">{fechaLarga(e.fecha).replace(/^./, (c) => c.toUpperCase())}</p>
        <p className="rw-ev-horas mono">{horario(e)}</p>
      </header>
      {e.estado === "cancelado" && <p className="aviso aviso-error">Este evento está cancelado.</p>}
      {cambio && <p className="rw-cambio" role="note">{cambio}</p>}

      <section className="tarjeta rw-pista" aria-labelledby="t-pista">
        <h2 id="t-pista" className="solo-lectores">Pista</h2>
        <strong>{e.pista_nombre || !e.lugar_nombre ? pistaTexto(e) : e.lugar_nombre}</strong>
        {(e.lugar_direccion ?? e.pista_direccion) && <span className="suave">{e.lugar_direccion ?? e.pista_direccion}</span>}
        {/* D119: «Cómo llegar» abre Google Maps con las coordenadas (o la dirección); nada de mapas incrustados. */}
        {enlaceLugar(e) && <a className="boton boton-claro rw-mapa" href={enlaceLugar(e)!} target="_blank" rel="noopener noreferrer">Cómo llegar</a>}
        {e.notas && !/^\s*pista\s+\d+\s*\.?\s*$/i.test(e.notas) && <span className="pequeno">{e.notas}</span>}
      </section>

      <section className="tarjeta rw-vas" aria-labelledby="t-vas">
        <div className="mz-sec-cab"><h2 id="t-vas">¿Vas?</h2><span className={`rw-etiqueta${actual || porDefecto ? "" : " sin"}`}>{etiqueta}</span></div>
        {encendido ? (
          abierto && porDefecto ? (
            <>
              <p style={{ margin: 0 }} data-testid="por-defecto">Te hemos puesto que no vas. Si vienes, cámbialo aquí:</p>
              <SiVoy eventoId={e.id} nombre={nombreCorto(e)} grande />
            </>
          ) : abierto ? (
            <>
              <Responder eventoId={e.id} fecha={e.fecha} domingo={e.tipo === "liga"} actual={actual} nombre={nombreCorto(e)} grande sinDuda={!conDuda} motivo={r?.motivo === "no_confirmo" ? null : ((r?.motivo as MotivoJugador) ?? null)} detalle={r?.detalle ?? null} />
              <p className="suave pequeno" style={{ margin: 0 }}>Si no vas, te pedimos el motivo. Puedes cambiar tu respuesta cuando quieras.</p>
              {conDuda && <p className="suave pequeno" style={{ margin: 0 }} data-testid="limite-dudas">Si dudas, tienes hasta {textoLimite(limiteDudas(e), ahora)} para confirmar; si no, contarás como «no va».</p>}
              {r?.motivo === "no_confirmo" && <p className="suave pequeno" style={{ margin: 0 }} data-testid="paso-no-va">Tu «duda» pasó a «no va» porque no confirmaste a tiempo. Si al final puedes, pon «Voy».</p>}
              {r?.origen === "gestor" && r.puesto_por_nombre && <p className="tenue pequeno" style={{ margin: 0 }}>Respuesta puesta por {r.puesto_por_nombre}.</p>}
            </>
          ) : <p className="suave" style={{ margin: 0 }}>{e.estado === "cancelado" ? "No hace falta que hagas nada." : "El evento ya empezó: no se puede cambiar la respuesta."}</p>
        ) : <p className="rw-apagado" style={{ margin: 0 }}>Las respuestas en la web están desactivadas.</p>}
      </section>

      {quien && (
        <section className="tarjeta rw-quien" aria-labelledby="t-quien">
          <h2 id="t-quien">Quién va</h2>
          <QuienVaJugador quien={quien} />
        </section>
      )}
      {encendido && <p><Link href="/mi-zona/ausencias/nueva" className="rw-enlace">¿Vas a faltar varios días? Marca una ausencia</Link></p>}
    </main>
  );
}
