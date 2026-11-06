import Link from "next/link";
import Responder from "@/components/respuestas/Responder";
import QuienVaJugador from "@/components/numeros/QuienVa";
import { cargarMiZona } from "@/app/mi-zona/datos";
import { dudaAbierta, limiteDudas, madrid, plazoSemanal, textoLimite } from "@/lib/avisos/horario";
import { cargarMisAusencias, cargarMisRespuestas, cargarQuienVa, misEntrenosPorDefecto } from "@/lib/respuestas/jugador";
import { ausenciaQueCubre, nombreCorto, TEXTO_MOTIVO_TODO, type MiEvento, type MotivoJugador } from "@/lib/respuestas/dominio";
import { TEXTO_POR_DEFECTO_EXPLICACION, TEXTO_POR_DEFECTO_JUGADOR } from "@/lib/disponibilidad/porDefecto";
import { avisoDeEvento } from "@/lib/eventos/datos";
import { avisosDelFichero } from "@/lib/inicio/avisos";
import { temporadaDe } from "@/lib/publico";
import ElRival from "./ElRival";

/** La línea de equipación (D160) en singular y la de siempre si no hay aviso. */
const LINEA_SIN_AVISO = "Jugamos de negro. Lleva la amarilla por si acaso.";
const enSingular = (l: string) => l.replace(/Llevad/g, "Lleva");

/** Lo que ve un jugador de su evento (D189; antes /mi-zona/evento/<id>, D99 3.3): equipación, avisos plegados, Voy · Duda ·
 *  No voy, «Quién va» con solo nombres (D46, norma 13.2) y «El rival» con sus colores y su scouting (D174). Lo usan la vista
 *  de jugador y la pestaña «Mi respuesta» de un gestor que también juega. */
export default async function VistaJugador({ e, soloRespuesta = false }: { e: MiEvento; soloRespuesta?: boolean }) {
  const [respuestas, ausencias, zona] = await Promise.all([cargarMisRespuestas(), cargarMisAusencias(), cargarMiZona().catch(() => null)]);
  const r = respuestas.find((x) => x.evento_id === e.id) ?? null;
  const aus = ausenciaQueCubre(e.fecha, ausencias);
  const ahora = new Date();
  const abierto = e.estado === "programado" && madrid(e.fecha, e.inicio ? String(e.inicio).slice(0, 5) : "00:00") > ahora;
  const conDuda = dudaAbierta(e, ahora);
  const actual = r && r.respuesta !== "sin_responder" ? r.respuesta : null;
  // D152 y D177: «No vas (puesto por defecto)» con «No voy» marcado (solo lo suyo, con respuestaEfectiva).
  const porDefecto = abierto && (await misEntrenosPorDefecto([e], respuestas, ausencias).catch(() => new Set<string>())).has(e.id);
  const etiqueta = e.estado === "cancelado" ? "Cancelado"
    : porDefecto ? TEXTO_POR_DEFECTO_JUGADOR
    : !actual && aus ? `Ausente · ${TEXTO_MOTIVO_TODO[aus.motivo]}`
    : actual === "va" ? "Vas" : actual === "duda" ? "Duda" : actual === "no" ? `No vas${r?.motivo === "no_confirmo" ? " · no confirmaste a tiempo" : r?.motivo ? ` · ${TEXTO_MOTIVO_TODO[r.motivo]}` : ""}` : "Aún no has respondido";

  const responder = (
    <section className="tarjeta rw-vas" aria-labelledby="t-vas">
      <div className="mz-sec-cab"><h2 id="t-vas">¿Vas?</h2><span className={`rw-etiqueta${actual || porDefecto ? "" : " sin"}`}>{etiqueta}</span></div>
      {abierto && porDefecto ? (
        <>
          {/* D177: «No voy» marcado (la respuesta que cuenta) y los botones de siempre para cambiarlo. */}
          <Responder eventoId={e.id} fecha={e.fecha} actual="no" nombre={nombreCorto(e)} grande sinDuda={!conDuda} />
          <p style={{ margin: 0 }} data-testid="por-defecto">{TEXTO_POR_DEFECTO_EXPLICACION}</p>
        </>
      ) : abierto ? (
        <>
          <Responder eventoId={e.id} fecha={e.fecha} domingo={e.tipo === "liga"} actual={r?.motivo === "no_confirmo" ? null : actual} nombre={nombreCorto(e)} grande sinDuda={!conDuda} motivo={r?.motivo === "no_confirmo" ? null : ((r?.motivo as MotivoJugador) ?? null)} detalle={r?.detalle ?? null} />
          {r?.motivo !== "no_confirmo" && <p className="suave pequeno" style={{ margin: 0 }}>Si no vas, te pedimos el motivo. Puedes cambiar tu respuesta cuando quieras.</p>}
          {!actual && plazoSemanal(e) && ahora < limiteDudas(e) && <p className="suave pequeno" style={{ margin: 0 }} data-testid="plazo-respuesta">Tienes hasta {textoLimite(limiteDudas(e), ahora)} para decir si vas{plazoSemanal(e) === "partido" ? "; si no, te quedas fuera de la convocatoria" : ""}.</p>}
          {conDuda && <p className="suave pequeno" style={{ margin: 0 }} data-testid="limite-dudas">Si dudas, tienes hasta {textoLimite(limiteDudas(e), ahora)} para confirmar; si no, contarás como «no va».</p>}
          {r?.motivo === "no_confirmo" && <p className="suave pequeno" style={{ margin: 0 }} data-testid="paso-no-va">Tu «duda» pasó a «no va» porque no confirmaste a tiempo. Elige «No voy» para decir el motivo (una sola vez) o «Voy» si al final puedes.</p>}
          {r?.origen === "gestor" && r.puesto_por_nombre && <p className="tenue pequeno" style={{ margin: 0 }}>Respuesta puesta por {r.puesto_por_nombre}.</p>}
        </>
      ) : <p className="suave" style={{ margin: 0 }}>{e.estado === "cancelado" ? "No hace falta que hagas nada." : "El evento ya empezó: no se puede cambiar la respuesta."}</p>}
    </section>
  );
  if (soloRespuesta) return responder;

  const quien = (await cargarQuienVa([e.id])).get(e.id);
  // Equipación (D160) y el rival, solo en los partidos de liga con rival y jornada.
  const aviso = avisoDeEvento(e);
  const temporada = zona ? temporadaDe(zona.jugador.person_id) : null;
  const dorsal = temporada?.dorsales.length === 1 ? temporada.dorsales[0] : null;
  const equipos = e.equipo === "ambos" ? (["MdA", "MdL"] as const).filter((x) => (x === "MdA" ? zona?.jugador.ficha_mda : zona?.jugador.ficha_mdl)) : [e.equipo];
  const avisos = avisosDelFichero(e.fecha, [...equipos]);
  return (
    <>
      {e.tipo === "liga" && (
        <section className="tarjeta ev2-equipacion" aria-labelledby="t-equipacion" data-testid="te-pones">
          <h2 id="t-equipacion" className="ev2-h2">Equipación</h2>
          <b>{aviso?.tipo === "nos_toca" ? "Amarilla" : "Negra"}{dorsal ? ` con tu dorsal ${dorsal}` : ""}</b>
          <span className="pequeno" data-testid="linea-equipacion">{aviso?.convocatoria ? enSingular(aviso.convocatoria) : LINEA_SIN_AVISO}</span>
        </section>
      )}
      {avisos.length > 0 && (
        <details className="tarjeta ev2-avisos" data-testid="avisos-evento">
          <summary>⚠ {avisos[0].texto.split(/[.:]/)[0]}{avisos.length > 1 ? ` y ${avisos.length - 1} más` : ""} · ver</summary>
          {avisos.map((a) => <p key={a.id} className="pequeno">{a.texto}</p>)}
        </details>
      )}
      {responder}
      {quien && (
        <section className="tarjeta rw-quien" aria-labelledby="t-quien">
          <h2 id="t-quien">Quién va</h2>
          <QuienVaJugador quien={quien} />
        </section>
      )}
      <ElRival e={e} />
      <p><Link href="/mi-zona/ausencias/nueva" className="rw-enlace">¿Vas a faltar varios días? Marca los días que no estás</Link></p>
    </>
  );
}
