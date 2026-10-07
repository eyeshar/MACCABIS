import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirGestor } from "@/lib/sesion";
import { diaYNumero, hoyMadrid, sumarDias } from "@/lib/dias";
import { fechaHora } from "@/lib/fechas";
import { cargarEvento, cargarJugadores, cargarPistas } from "@/lib/eventos/datos";
import {
  contarRespuestas, convocadosDe, diaCorto, fechaDMA, ordenarRespuestas, pistaEfectiva, rangoHoras, recordatorio, TEXTO_MOTIVO, TEXTO_RESPUESTA, tituloEvento,
  type Motivo, type Periodo, type Respuesta,
} from "@/lib/eventos/dominio";
import CopiarTexto from "../../CopiarTexto";

export const metadata = { title: "Respuestas y motivos · Gestión Maccabis" };
const SEMANAS = 12;

export default async function RespuestasEvento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await exigirGestor();
  const [evento, pistas, jugadores] = await Promise.all([cargarEvento(supabase, id), cargarPistas(supabase), cargarJugadores(supabase)]);
  if (!evento) notFound();
  const hoy = hoyMadrid();
  const desde = evento.fecha < hoy ? evento.fecha : hoy, hasta = sumarDias(desde, SEMANAS * 7);
  const [{ data: resp }, { data: periodosDB }] = await Promise.all([
    supabase.from("respuestas").select("person_id, respuesta, motivo, detalle, leido_en").eq("evento_id", id),
    supabase.from("ausencias_periodo").select("person_id, desde, hasta, motivo").lte("desde", hasta).gte("hasta", desde),
  ]);
  const periodos = (periodosDB ?? []) as Periodo[];
  const convocados = convocadosDe(evento, jugadores);
  const filas = ordenarRespuestas(evento, convocados, (resp ?? []) as { person_id: string; respuesta: Respuesta; motivo: Motivo | null; detalle: string | null; leido_en: string | null }[], periodos);
  const c = contarRespuestas(filas);
  const pe = pistaEfectiva(evento, pistas);
  const rec = recordatorio(evento, filas, pistas);
  const ultima = (resp ?? []).map((r) => r.leido_en as string).sort().at(-1);
  const nombre = new Map(jugadores.map((j) => [j.person_id, j.nombre_visible]));
  const enFranja = periodos.filter((p) => nombre.has(p.person_id)).sort((a, b) => (nombre.get(a.person_id)! < nombre.get(b.person_id)! ? -1 : 1));
  const dias = SEMANAS * 7;
  const pos = (f: string) => Math.min(100, Math.max(0, ((new Date(`${f}T12:00Z`).getTime() - new Date(`${desde}T12:00Z`).getTime()) / 86400000 / dias) * 100));
  const grupos: { id: Respuesta; texto: string }[] = [
    { id: "no", texto: "No van" }, { id: "duda", texto: "Dudan" }, { id: "sin_responder", texto: "Sin responder" }, { id: "va", texto: "Van" },
  ];

  return (
    <>
      <div className="gs-titulo">
        <div>
          <div className="gs-eyebrow"><Link href={`/gestion/eventos/${evento.id}`}>← Evento</Link> · Respuestas y motivos</div>
          <h1 style={{ fontSize: 44 }}>{tituloEvento(evento)}</h1>
          <span className="suave">{diaCorto(evento.fecha)} · {rangoHoras(evento)} · {pe.porConfirmar ? `pista por confirmar${pe.motivo ? ` (${pe.motivo})` : ""}` : pe.texto}</span>
        </div>
        <div className="ev-botones"><Link className="boton boton-contorno" href="/gestion/eventos/importar?t=respuestas">Importar respuestas</Link></div>
      </div>

      <div className="gs-cifras" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginBottom: 20 }} data-testid="contadores">
        <div><b className="ev-no">{c.no}</b><span>no van</span></div>
        <div><b className="ev-duda">{c.duda}</b><span>dudan</span></div>
        <div><b>{c.sin_responder}</b><span>sin responder</span></div>
        <div><b className="ev-ok">{c.va}</b><span>van</span></div>
      </div>
      <p className="pequeno suave">
        {convocados.length} convocados. {ultima ? <>Última lectura de SportEasy: <b>{fechaHora(ultima)}</b>.</> : "Todavía no se han leído las respuestas de SportEasy para este evento: aparecen todos como «sin responder»."} Los jugadores siguen respondiendo en SportEasy (fase puente). Solo lo ven los gestores.
      </p>

      <div className="gs-dos">
        <section className="gs-bloque gs-izq" style={{ flex: "3 1 560px" }} aria-labelledby="t-resp">
          <h2 id="t-resp">Respuestas</h2>
          <div className="tabla-desplazable">
            <table className="gs-tabla ev-tabla" data-testid="tabla-respuestas">
              <thead><tr><th>Jugador</th><th>Respuesta</th><th>Motivo</th><th>Detalle</th></tr></thead>
              <tbody>
                {grupos.flatMap((g) => filas.filter((f) => f.respuesta === g.id).map((f) => (
                  <tr key={f.person_id} data-respuesta={f.respuesta}>
                    <td data-label="Jugador"><span className={`ev-resp ev-resp-${f.respuesta === "sin_responder" ? "sin" : f.respuesta}`}><b>{f.nombre}</b></span></td>
                    <td data-label="Respuesta"><span className={f.respuesta === "no" ? "ev-no" : f.respuesta === "va" ? "ev-ok" : f.respuesta === "duda" ? "ev-duda" : "suave"}>{TEXTO_RESPUESTA[f.respuesta]}</span>{f.porPeriodo && f.respuesta !== "no" && <span className="ev-sub" style={{ color: "var(--tinta-tenue)" }}>ausente por periodo</span>}</td>
                    <td data-label="Motivo">{f.motivo ? TEXTO_MOTIVO[f.motivo] : f.porPeriodo ? <span className="suave">{TEXTO_MOTIVO[f.porPeriodo.motivo]} (periodo)</span> : <span className="suave">—</span>}</td>
                    <td data-label="Detalle">{f.detalle ?? (f.porPeriodo ? `${fechaDMA(f.porPeriodo.desde).slice(0, 5)} → ${fechaDMA(f.porPeriodo.hasta).slice(0, 5)}` : "")}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="gs-der ev-lateral" style={{ flex: "1 1 320px" }}>
          <section className="gs-bloque" aria-labelledby="t-rec">
            <h2 id="t-rec" style={{ fontSize: 22 }}>Recordatorio</h2>
            <details data-testid="recordatorio">
              <summary className="boton boton-amarillo" style={{ listStyle: "none", cursor: "pointer" }}>Pedir recordatorio a Claude</summary>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                {rec.faltan.length ? (
                  <>
                    <p className="pequeno" style={{ margin: 0 }}><b>Faltan por responder ({rec.faltan.length}):</b> {rec.faltan.join(", ")}.</p>
                    <CopiarTexto texto={rec.texto} etiqueta="Copiar texto" />
                  </>
                ) : <p className="pequeno suave" style={{ margin: 0 }}>Todos han respondido o están ausentes por periodo: no hace falta recordatorio.</p>}
                <p className="pequeno suave" style={{ margin: 0 }}>Esto solo prepara la lista y el texto. El envío lo hace Claude desde SportEasy, con tu OK.</p>
              </div>
            </details>
          </section>
        </aside>
      </div>

      <section className="gs-bloque" style={{ marginTop: 20 }} aria-labelledby="t-aus" data-testid="franja-ausencias">
        <div className="gs-bloque-cab"><h2 id="t-aus">Ausencias por periodo</h2><span className="gs-eyebrow">próximas {SEMANAS} semanas desde el {fechaDMA(desde).slice(0, 5)}</span></div>
        {enFranja.length === 0 ? <p className="suave" style={{ margin: 0 }}>Nadie ha avisado de ausencias por periodo en estas semanas.</p> : (
          <div className="ev-gantt" role="list">
            {enFranja.map((p) => (
              <div key={`${p.person_id}-${p.desde}`} className="ev-gantt-fila" role="listitem">
                <span><b>{nombre.get(p.person_id)}</b></span>
                <div>
                  <div className="ev-gantt-pista" aria-hidden="true">
                    <i style={{ left: `${pos(p.desde < desde ? desde : p.desde)}%`, width: `${Math.max(1, pos(p.hasta > hasta ? hasta : p.hasta) - pos(p.desde < desde ? desde : p.desde))}%` }} />
                    <b style={{ left: `${pos(evento.fecha)}%` }} />
                  </div>
                  <span className="pequeno suave">{TEXTO_MOTIVO[p.motivo]} · {fechaDMA(p.desde).slice(0, 5)} → {fechaDMA(p.hasta).slice(0, 5)}{p.desde <= evento.fecha && evento.fecha <= p.hasta ? <b style={{ color: "var(--error)" }}> · cubre este evento ({diaYNumero(evento.fecha)})</b> : ""}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="pequeno suave" style={{ margin: 0 }}>La línea amarilla marca la fecha de este evento. Los periodos los lee Claude de SportEasy (D87).</p>
      </section>
    </>
  );
}
