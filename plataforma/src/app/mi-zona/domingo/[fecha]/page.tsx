import type { Metadata } from "next";
import Volver from "@/components/nav/Volver";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirSesion } from "@/lib/sesion";
import ElegirDomingo from "@/components/respuestas/ElegirDomingo";
import Numeros from "@/components/numeros/Numeros";
import QuienVaJugador from "@/components/numeros/QuienVa";
import { AvisoCaja } from "@/components/ProximoPartido";
import { dudaAbierta, limiteDudas, madrid, textoLimite } from "@/lib/avisos/horario";
import { textoColores } from "@/lib/colores";
import { coloresDe } from "@/lib/equipacion";
import { avisoDeEvento } from "@/lib/eventos/datos";
import { temporadaDe } from "@/lib/publico";
import { cargarMiZona } from "@/app/mi-zona/datos";
import {
  cargarConvocadosDomingo, cargarMiConvocatoria, cargarMiDomingo, cargarMisAusencias, cargarMisEventosDelDia, cargarMisRespuestas, cargarQuienVa, respuestasWebEncendido,
} from "@/lib/respuestas/jugador";
import {
  enlaceMapa, estadoDe, fechaLarga, hhmm, lineaCambio, opcionActual, opcionesDomingo, pistaTexto, restar20, unidades,
  type MiEvento, type MotivoJugador,
} from "@/lib/respuestas/dominio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Domingo · Maccabis", robots: { index: false, follow: false } };

const limpiar = (r: string | null) => (r ? r.replace(/([.,;:!?])\1+/g, "$1").trim() : "");
const hora = (h: string | null) => (h ? h.replace(/^0/, "") : "—");
type Eq = "MdA" | "MdL";

// Domingo del jugador (D99, 3.5; D128): arriba su situacion en una frase; las dos tarjetas de partido (la suya marcada
// si esta convocado), cada una con la equipacion nuestra y la del rival por separado y «Quién va» (los convocados de la
// convocatoria APROBADA, solo nombres); «¿Puedes jugar?» con la respuesta en la web (interruptor encendido) o, apagado,
// el aviso de que las respuestas en la web estan desactivadas (con la respuesta que ya tenga guardada, si la hay). Estar
// disponible no es estar convocado (D46). Nada de niveles, posiciones, motivos ni respuestas de otros.
export default async function Domingo({ params }: { params: Promise<{ fecha: string }> }) {
  const { fecha } = await params;
  await exigirSesion();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) notFound();
  const partidos = (await cargarMisEventosDelDia(fecha)).filter((e) => e.tipo === "liga");
  if (!partidos.length) notFound();
  const u = unidades(partidos).find((x) => x.tipo === "domingo");
  const [encendido, respuestas, ausencias, miDomingo, zona, convocados, misConv] = await Promise.all([
    respuestasWebEncendido(), cargarMisRespuestas(), cargarMisAusencias(), cargarMiDomingo(fecha), cargarMiZona(), cargarConvocadosDomingo(fecha), cargarMiConvocatoria(),
  ]);
  const ahora = new Date();
  const conDuda = partidos.every((e) => dudaAbierta(e, ahora));
  // D141: quien va, quien duda, quien no va y quien no ha contestado, partido a partido (solo nombres; la base no da motivos).
  const quienVa = encendido ? await cargarQuienVa(partidos.map((e) => e.id)) : null;
  const abierto = !!u && u.eventos.every((e) => madrid(e.fecha, e.inicio ? String(e.inicio).slice(0, 5) : "00:00") > new Date());
  const est = u ? estadoDe(u, respuestas, ausencias) : null;
  const rNo = respuestas.find((r) => partidos.some((e) => e.id === r.evento_id) && r.respuesta === "no" && r.motivo !== "horario" && r.motivo !== "no_confirmo");
  const pasoNoVa = respuestas.some((r) => partidos.some((e) => e.id === r.evento_id) && r.respuesta === "no" && r.motivo === "no_confirmo");
  const direccion = partidos.find((e) => e.pista_direccion)?.pista_direccion ?? null;

  // Su situacion: convocado (y con quien), no convocado, convocatoria pendiente o no va.
  const yo = zona?.jugador.nombre_visible ?? null;
  const aprobada = convocados != null;
  // Sus equipos, de mi_convocatoria (por su person_id); para un domingo ya pasado, por su nombre en la lista.
  const suya = misConv.find((c) => c.fecha === fecha);
  const misEquipos = (!aprobada ? [] : suya ? suya.equipos : yo ? (["MdA", "MdL"] as Eq[]).filter((e) => (convocados[e] ?? []).includes(yo)) : []) as Eq[];
  const resp = (e: MiEvento) => respuestas.find((r) => r.evento_id === e.id)?.respuesta ?? "sin_responder";
  const noVa = partidos.every((e) => resp(e) === "no");
  const situacion = misEquipos.length
    ? { clase: "convocado", texto: `Estás convocado ${misEquipos.map((eq) => { const e = partidos.find((x) => x.equipo === eq)!; const ini = hhmm(e.inicio); return `con el ${eq} · ${hora(ini)}, quedada ${ini ? hora(hhmm(e.quedada) ?? restar20(ini)) : "—"}`; }).join(" y ")}` }
    : noVa ? { clase: "novas", texto: "No vas" }
    : aprobada ? { clase: "fuera", texto: "No estás convocado este domingo" }
    : { clase: "pendiente", texto: "Convocatoria pendiente" };

  // Su dorsal de cada equipo (como en el inicio).
  const temporada = zona ? temporadaDe(zona.jugador.person_id) : null;
  const dorsales = temporada?.dorsales ?? [];
  const dorsalDe = (eq: string) => {
    const eqs = (["MdA", "MdL"] as const).filter((x) => (x === "MdA" ? zona?.jugador.ficha_mda : zona?.jugador.ficha_mdl));
    if (dorsales.length > 1 && dorsales.length === eqs.length) return dorsales[eqs.indexOf(eq as Eq)] ?? dorsales[0];
    return dorsales[0] ?? null;
  };

  // Apagado: la respuesta que ya tenga guardada, partido a partido.
  const guardadas = partidos.filter((e) => respuestas.some((r) => r.evento_id === e.id && r.respuesta !== "sin_responder"));
  const textoResp = (e: MiEvento) => {
    const r = resp(e);
    return r === "va" ? `vas al ${e.equipo}` : r === "no" ? `no al ${e.equipo}` : r === "duda" ? `duda al ${e.equipo}` : `sin responder al ${e.equipo}`;
  };

  return (
    <main className="pagina rw-evento rw-domingo">
      <Volver defecto="/agenda" etiqueta="Agenda" />
      <header className="rw-ev-cab" data-tipo="liga">
        <span className="rw-ev-tipo">Partidos de liga{partidos[0].jornada ? ` · J${partidos[0].jornada}` : ""}</span>
        <h1>{fechaLarga(fecha).replace(/^./, (c) => c.toUpperCase())}</h1>
      </header>
      <p className={`rw-situacion rw-sit-${situacion.clase}`} data-testid="situacion" role="status">{situacion.texto}</p>

      <div className="rw-partidos">
        {partidos.map((e) => {
          const eq = e.equipo as Eq;
          const mio = misEquipos.includes(eq);
          const otro = misEquipos.length > 0 && !mio;
          const a = avisoDeEvento(e);
          const amarilla = a?.tipo === "nos_toca";
          const dorsal = mio ? dorsalDe(eq) : null;
          const rival = e.rival ? coloresDe(limpiar(e.rival)) : null;
          const lista = aprobada ? [...(convocados[eq] ?? [])].sort((x, y) => x.localeCompare(y, "es")) : null;
          return (
            <article key={e.id} className={`rw-partido${mio ? " rw-partido-mio" : ""}${otro ? " rw-partido-otro" : ""}`} data-equipo={e.equipo} data-testid={`partido-${e.equipo}`}>
              <span className="rw-partido-eq">{e.equipo}{mio && <span className="rw-tu-juegas"> · Tú juegas aquí</span>}</span>
              <strong className="mono rw-partido-hora">{hhmm(e.inicio) ?? "Hora por confirmar"}</strong>
              <span>{e.es_local === false ? `${limpiar(e.rival)} – ${e.equipo}` : `${e.equipo} – ${limpiar(e.rival)}`}</span>
              <span className="suave pequeno">{pistaTexto(e)} · quedada {hhmm(e.quedada) ?? (e.inicio ? restar20(String(e.inicio)) : "—")}</span>
              <div className="rw-equipaciones" data-testid={`equipacion-${e.equipo}`}>
                <span><small className="mono tenue">Nosotros</small> {mio ? `La ${amarilla ? "amarilla" : "negra"}${dorsal ? `, con tu dorsal ${dorsal}` : ""}` : amarilla ? "Amarilla" : "Negra"}</span>
                {rival && <span><small className="mono tenue">Rival</small> <i className="eq-punto" style={{ background: rival.css }} aria-hidden="true" /> {textoColores(rival)}</span>}
              </div>
              {a?.hay && <AvisoCaja a={a} />}
              {lineaCambio(e) && <span className="rw-cambio">{lineaCambio(e)}</span>}
              {e.estado === "cancelado" && <span className="aviso aviso-error">Cancelado</span>}
              {quienVa?.get(e.id) && (
                <div className="rw-quien-resp" data-testid={`respuestas-${e.equipo}`}>
                  <b>Respuestas al partido</b>
                  <QuienVaJugador quien={quienVa.get(e.id)!} prueba={`respuestas-numeros-${e.equipo}`} />
                </div>
              )}
              <div className="rw-quien-va" data-testid={`quien-va-${e.equipo}`}>
                <b>Quién va</b>
                {lista ? (
                  <Numeros variante="linea" prueba={`convocados-${e.equipo}`} etiqueta={`Convocados del ${e.equipo}`} grupos={[{ k: "convocados", etiqueta: "convocados", n: lista.length, personas: lista.map((n) => ({ nombre: n, nota: mio && n === yo ? "tú" : null })), vacio: "Nadie convocado." }]} />
                ) : <p className="suave">Convocatoria pendiente: la verás aquí cuando esté hecha.</p>}
              </div>
            </article>
          );
        })}
      </div>
      {u?.modo === "misma" && <p className="suave">Los dos partidos son a la misma hora: esta jornada no se puede doblar.</p>}
      <section className="tarjeta rw-pista" aria-labelledby="t-inst">
        <h2 id="t-inst" className="solo-lectores">Instalación</h2>
        <strong>{partidos[0].pista_nombre ?? "Pista por confirmar"}</strong>
        {direccion && <span className="suave">{direccion}</span>}
        {direccion && <a className="boton boton-claro rw-mapa" href={enlaceMapa(direccion)} target="_blank" rel="noopener noreferrer">Abrir en el mapa</a>}
      </section>

      <section className="tarjeta rw-vas" aria-labelledby="t-puedes">
        <div className="mz-sec-cab"><h2 id="t-puedes">¿Puedes jugar?</h2>{encendido && est && <span className={`rw-etiqueta${est.pendiente ? " sin" : ""}`}>{est.pendiente ? "Aún no has respondido" : est.texto}</span>}</div>
        {encendido && u ? (
          abierto ? (
            <ElegirDomingo fecha={fecha} opciones={opcionesDomingo(u, conDuda)} actual={opcionActual(u, respuestas, miDomingo)} nombre={`partido del domingo ${+fecha.slice(8)}`}
              motivo={(rNo?.motivo as MotivoJugador) ?? null} detalle={rNo?.detalle ?? null} />
          ) : <p className="suave" style={{ margin: 0 }}>Los partidos ya empezaron: no se puede cambiar la respuesta.</p>
        ) : (
          <div className="rw-apagado-estado" data-testid="respuestas-apagadas">
            {guardadas.length > 0 && <p className="rw-segun"><b>Tu respuesta: {partidos.map(textoResp).join(" · ")}</b></p>}
            <p className="suave" style={{ margin: 0 }}>Las respuestas en la web están desactivadas.</p>
          </div>
        )}
        {encendido && u && abierto && conDuda && <p className="suave pequeno" style={{ margin: "0 0 .5rem" }} data-testid="limite-dudas">Si dudas, tienes hasta {textoLimite(limiteDudas(partidos[0]), ahora)} para confirmar; si no, contarás como «no va».</p>}
        {pasoNoVa && <p className="suave pequeno" style={{ margin: "0 0 .5rem" }} data-testid="paso-no-va">Tu «duda» pasó a «no va» porque no confirmaste a tiempo. Si al final puedes, pon «Voy».</p>}
        <p className="rw-nota-conv">Estar disponible no es estar convocado: en la convocatoria te decimos en qué equipo juegas.</p>
      </section>
      {encendido && <p><Link href="/mi-zona/ausencias/nueva" className="rw-enlace">¿Vas a faltar varios días? Marca una ausencia</Link></p>}
    </main>
  );
}
