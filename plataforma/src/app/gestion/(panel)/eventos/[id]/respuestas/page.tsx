import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirGestor, origen as origenWeb } from "@/lib/sesion";
import { diaYNumero, hoyMadrid, sumarDias } from "@/lib/dias";
import { fechaHora } from "@/lib/fechas";
import { cargarEvento, cargarEventos, cargarJugadores, cargarPistas } from "@/lib/eventos/datos";
import {
  convocadosDe, diaCorto, fechaDMA, hhmm, ordenarRespuestas, pistaEfectiva, rangoHoras, recordatorio, TEXTO_MOTIVO, tituloEvento,
  type EventoFila, type Motivo, type Periodo, type Respuesta,
} from "@/lib/eventos/dominio";
import { calendarioRecordatorios, TEXTO_HUECO } from "@/lib/avisos/planificador";
import { sitioAviso } from "@/lib/avisos/servidor";
import { enMadrid } from "@/lib/avisos/horario";
import { MOTIVOS_JUGADOR } from "@/lib/respuestas/dominio";
import CopiarTexto from "../../CopiarTexto";
import { BotonRecordatorio, BotonVisto, ResponderPor } from "./ResponderPor";

export const metadata = { title: "Respuestas y motivos · Gestión Maccabis" };
const SEMANAS = 12;

type Fila = {
  respuesta: Respuesta; motivo: Motivo | "horario" | null; detalle: string | null; leido_en: string | null;
  origen: "sporteasy" | "jugador" | "gestor"; puesto_por_nombre: string | null; cambiado_en: string | null; ausencia_id: string | null;
};
type PeriodoW = { id?: string; person_id: string; desde: string; hasta: string | null; motivo: Motivo; origen?: string };

const TEXTO_R: Record<Respuesta, string> = { va: "Va", duda: "Duda", no: "No va", sin_responder: "Sin responder" };
const textoMotivo = (m: Fila["motivo"]) => (m === "horario" ? "Horario" : m ? TEXTO_MOTIVO[m] : null);
const ddmm = (f: string) => fechaDMA(f).slice(0, 5);
const franja = (p: { desde: string; hasta: string | null }) => (p.hasta ? `ausencia del ${ddmm(p.desde)} al ${ddmm(p.hasta)}` : `ausencia desde el ${ddmm(p.desde)}, sin fecha de vuelta`);

/** Respuestas del evento (D99, 4.1). Para un domingo con dos partidos, una vista de dia que los junta. */
export default async function RespuestasEvento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await exigirGestor();
  const [evento, pistas, jugadores, todos] = await Promise.all([cargarEvento(supabase, id), cargarPistas(supabase), cargarJugadores(supabase), cargarEventos(supabase)]);
  if (!evento) notFound();
  // Vista de dia: los partidos de liga de esa fecha.
  const delDia = evento.tipo === "liga" ? todos.filter((e) => e.tipo === "liga" && e.fecha === evento.fecha && e.estado === "programado").sort((a, b) => ((a.inicio ?? "") < (b.inicio ?? "") ? -1 : 1)) : [];
  const dia = delDia.length === 2 ? delDia : null;
  const eventos: EventoFila[] = dia ?? [evento];
  const distintas = !!dia && hhmm(dia[0].inicio) !== hhmm(dia[1].inicio);
  const ids = eventos.map((e) => e.id);

  const hoy = hoyMadrid();
  const desde = evento.fecha < hoy ? evento.fecha : hoy, hasta = sumarDias(desde, SEMANAS * 7);
  const [{ data: encendido }, { data: resp }, { data: periodosDB }, { data: subs }, { data: alertas }, { data: registro }] = await Promise.all([
    supabase.rpc("respuestas_web_encendido"),
    supabase.from("respuestas").select("evento_id, person_id, respuesta, motivo, detalle, leido_en, origen, puesto_por_nombre, cambiado_en, ausencia_id").in("evento_id", ids),
    supabase.from("ausencias_periodo").select("id, person_id, desde, hasta, motivo, origen").is("borrada_en", null).lte("desde", hasta).or(`hasta.is.null,hasta.gte.${desde}`),
    supabase.from("suscripciones_avisos").select("person_id").eq("activa", true),
    supabase.from("alertas_gestores").select("id, evento_id, person_id, antes, despues, en").in("evento_id", ids).is("visto_en", null).order("en"),
    supabase.from("avisos_registro").select("clave, tipo, enviado_en, resultado, programado_para").overlaps("eventos", ids).eq("tipo", "recordatorio"),
  ]);
  // La respuesta unica del domingo (D103): si sigue vigente, «Solo al de las 09:00» se lee tal cual, sin deducirlo.
  const { data: domingosDB } = dia ? await supabase.from("respuestas_domingo").select("person_id, opcion, solo_evento, origen, puesto_por_nombre, vigente").eq("fecha", evento.fecha).eq("vigente", true) : { data: [] };
  const domingoDe = new Map(((domingosDB ?? []) as { person_id: string; opcion: string; solo_evento: string | null; origen: string; puesto_por_nombre: string | null }[]).map((d) => [d.person_id, d]));
  const periodos = (periodosDB ?? []) as PeriodoW[];
  const conAvisos = new Set(((subs ?? []) as { person_id: string | null }[]).map((s) => s.person_id).filter(Boolean));
  const nombre = new Map(jugadores.map((j) => [j.person_id, j.nombre_visible]));
  const filasR = (resp ?? []) as (Fila & { evento_id: string; person_id: string })[];
  const de = (eid: string, p: string) => filasR.find((r) => r.evento_id === eid && r.person_id === p) ?? null;
  const periodoDe = (p: string, f: string) => periodos.find((x) => x.person_id === p && x.desde <= f && (x.hasta == null || x.hasta >= f)) ?? null;

  // Personas: invitadas a alguno de los eventos de la vista.
  const personas = [...new Map(eventos.flatMap((e) => convocadosDe(e, jugadores)).map((j) => [j.person_id, j])).values()];
  type Linea = { person_id: string; nombre: string; clase: "no" | "duda" | "sin_responder" | "va"; texto: string; motivo: string | null; origenTxt: string | null; periodo: PeriodoW | null; avisos: boolean; dos: boolean; solo: string | null };
  const lineas: Linea[] = personas.map((j) => {
    const suyos = eventos.filter((e) => convocadosDe(e, jugadores).some((x) => x.person_id === j.person_id));
    const rs = suyos.map((e) => de(e.id, j.person_id));
    const vals = rs.map((r) => r?.respuesta ?? "sin_responder");
    const per = periodoDe(j.person_id, evento.fecha);
    const rNo = rs.find((r) => r?.respuesta === "no" && r.motivo && r.motivo !== "horario");
    const ultimo = rs.filter(Boolean).sort((a, b) => ((a!.cambiado_en ?? a!.leido_en ?? "") < (b!.cambiado_en ?? b!.leido_en ?? "") ? 1 : -1))[0];
    const origenTxt = !ultimo || ultimo.respuesta === "sin_responder" ? null : ultimo.origen === "gestor" ? `puesto por ${ultimo.puesto_por_nombre ?? "un gestor"}` : ultimo.origen === "jugador" ? (ultimo.ausencia_id ? "por su ausencia" : "en la web") : "leído de SportEasy";
    let clase: Linea["clase"], texto: string, solo: string | null = null;
    if (vals.includes("sin_responder")) { clase = per ? "no" : "sin_responder"; texto = per ? "No va (ausencia)" : "Sin responder"; }
    else if (vals.every((v) => v === "va")) { clase = "va"; texto = suyos.length === 2 && distintas ? "A los dos" : "Va"; }
    else if (suyos.length === 2 && distintas && vals.includes("va")) { clase = "va"; const e = suyos[vals.indexOf("va")]; solo = e.id; texto = `Solo ${hhmm(e.inicio)} (${e.equipo})`; }
    else if (vals.includes("duda")) { clase = "duda"; texto = "Duda"; }
    else { clase = "no"; texto = "No va"; }
    if (dia && suyos.length === 1 && clase === "va") { solo = suyos[0].id; texto = `Solo ${hhmm(suyos[0].inicio)} (${suyos[0].equipo}, su ficha)`; }
    const dg = domingoDe.get(j.person_id);
    if (dg?.opcion === "solo" && suyos.length === 2) {
      const e = eventos.find((x) => x.id === dg.solo_evento);
      if (e) { clase = "va"; solo = e.id; texto = `Solo ${hhmm(e.inicio)} (${e.equipo})`; }
    }
    const horario = rs.find((r) => r?.motivo === "horario");
    const motivo = rNo ? `${textoMotivo(rNo.motivo)}${rNo.detalle ? ` · ${rNo.detalle}` : ""}` : per && clase === "no" ? `${TEXTO_MOTIVO[per.motivo]} · ${franja(per)}`
      : horario && solo ? `solo puede al de las ${hhmm(eventos.find((e) => e.id === solo)!.inicio)}` : null;
    return { person_id: j.person_id, nombre: j.nombre_visible, clase, texto, motivo, origenTxt, periodo: per, avisos: conAvisos.has(j.person_id), dos: suyos.length === 2, solo };
  });
  const ORDEN = { no: 0, duda: 1, sin_responder: 2, va: 3 } as const;
  lineas.sort((a, b) => ORDEN[a.clase] - ORDEN[b.clase] || a.nombre.localeCompare(b.nombre, "es"));

  const cajas = dia && distintas
    ? [
      { k: "dos", t: "a los dos", n: lineas.filter((l) => l.clase === "va" && !l.solo).length, c: "ev-ok" },
      ...dia.map((e) => ({ k: e.id, t: `solo ${hhmm(e.inicio)}`, n: lineas.filter((l) => l.solo === e.id).length, c: "ev-ok" })),
      { k: "duda", t: "dudan", n: lineas.filter((l) => l.clase === "duda").length, c: "ev-duda" },
      { k: "no", t: "no van", n: lineas.filter((l) => l.clase === "no").length, c: "ev-no" },
      { k: "sin", t: "sin responder", n: lineas.filter((l) => l.clase === "sin_responder").length, c: "" },
    ]
    : [
      { k: "va", t: "van", n: lineas.filter((l) => l.clase === "va").length, c: "ev-ok" },
      { k: "duda", t: "dudan", n: lineas.filter((l) => l.clase === "duda").length, c: "ev-duda" },
      { k: "no", t: "no van", n: lineas.filter((l) => l.clase === "no").length, c: "ev-no" },
      { k: "sin", t: "sin responder", n: lineas.filter((l) => l.clase === "sin_responder").length, c: "" },
    ];

  const pe = pistaEfectiva(evento, pistas);
  const ultimaLectura = filasR.filter((r) => r.origen === "sporteasy").map((r) => r.leido_en ?? "").sort().at(-1);
  const sinAvisos = lineas.filter((l) => !l.avisos);
  const web = await origenWeb();
  const msgSinAvisos = `Hola, ${sinAvisos.map((l) => l.nombre).join(", ")}: aún no tenéis activados los avisos de Maccabis en el móvil. Así os llega cuándo hay que responder y si cambia la hora o la pista (nunca de noche). Es un minuto: ${web}/avisos`;
  const opcionesPor = (l: Linea) => (dia && distintas && l.dos
    ? [{ id: "ambos", texto: "A los dos", opcion: "ambos" }, ...dia.map((e) => ({ id: `solo-${e.id}`, texto: `Solo al de las ${hhmm(e.inicio)} (${e.equipo})`, opcion: "solo", evento: e.id })), { id: "no", texto: "No va", opcion: "no" }, { id: "duda", texto: "Duda", opcion: "duda" }]
    : dia ? [{ id: "voy", texto: "Va", opcion: "voy" }, { id: "no", texto: "No va", opcion: "no" }, { id: "duda", texto: "Duda", opcion: "duda" }]
    : [{ id: "va", texto: "Va" }, { id: "no", texto: "No va" }, { id: "duda", texto: "Duda" }]);

  // Recordatorios automaticos de este evento (o del domingo): los que tocan segun el tipo y lo que ya salio.
  const plan = calendarioRecordatorios({ ...evento, sitio: sitioAviso(evento, pistas), sin_recordatorios: (evento as EventoFila & { sin_recordatorios?: boolean }).sin_recordatorios ?? false, creado_en: (evento as EventoFila & { creado_en?: string }).creado_en ?? new Date().toISOString() });
  const reg = (registro ?? []) as { clave: string; enviado_en: string | null; resultado: string | null }[];
  const enviadosDe = (tipo: string) => reg.filter((x) => x.clave.startsWith(`rec:${tipo}:`) && x.enviado_en && x.resultado === "enviado");
  const manuales = reg.filter((x) => x.clave.startsWith("rec:manual:") && x.enviado_en);
  const sinRecordatorios = (evento as EventoFila & { sin_recordatorios?: boolean }).sin_recordatorios;
  const rec = recordatorio(evento, ordenarRespuestas(evento, convocadosDe(evento, jugadores), filasR.filter((r) => r.evento_id === evento.id).map((r) => ({ ...r, motivo: r.motivo === "horario" ? "otro" : r.motivo })) as never, periodos.filter((p) => p.hasta) as Periodo[]), pistas);
  const alertasL = (alertas ?? []) as { id: string; evento_id: string; person_id: string; antes: Respuesta; despues: Respuesta; en: string }[];

  const enFranja = periodos.filter((p) => nombre.has(p.person_id)).sort((a, b) => (nombre.get(a.person_id)! < nombre.get(b.person_id)! ? -1 : 1));
  const dias = SEMANAS * 7;
  const pos = (f: string) => Math.min(100, Math.max(0, ((new Date(`${f}T12:00Z`).getTime() - new Date(`${desde}T12:00Z`).getTime()) / 86400000 / dias) * 100));

  return (
    <>
      <div className="gs-titulo">
        <div>
          <div className="gs-eyebrow"><Link href={`/gestion/eventos/${evento.id}`}>← Evento</Link> · Respuestas y motivos{dia ? " · vista del domingo" : ""}</div>
          <h1 style={{ fontSize: 44 }}>{dia ? `Domingo ${diaYNumero(evento.fecha).split(" ")[1]} · J${evento.jornada ?? ""}` : tituloEvento(evento)}</h1>
          <span className="suave">{dia ? dia.map((e) => `${hhmm(e.inicio)} ${tituloEvento(e)}`).join(" · ") : `${diaCorto(evento.fecha)} · ${rangoHoras(evento)} · ${pe.porConfirmar ? `pista por confirmar${pe.motivo ? ` (${pe.motivo})` : ""}` : pe.texto}`}</span>
        </div>
        <div className="ev-botones">
          <span className={`pastilla ${encendido ? "pastilla-ok" : "pastilla-info"}`} data-testid="origen-respuestas">{encendido ? "Respuestas en la web" : "Leído de SportEasy"}</span>
          {!encendido && <Link className="boton boton-contorno" href="/gestion/eventos/importar?t=respuestas">Importar respuestas</Link>}
        </div>
      </div>

      {alertasL.length > 0 && (
        <div className="ev-banda-roja" role="alert" data-testid="banda-roja">
          <div>
            <b>Cambios después de la convocatoria (martes 10:00):</b>{" "}
            {alertasL.map((a) => `${nombre.get(a.person_id) ?? a.person_id}: ${TEXTO_R[a.antes]} → ${TEXTO_R[a.despues]}${dia ? ` (${eventos.find((e) => e.id === a.evento_id)?.equipo})` : ""} · ${fechaHora(a.en)}`).join(" · ")}
          </div>
          <BotonVisto eventoId={evento.id} ids={alertasL.map((a) => a.id)} />
        </div>
      )}

      <div className="gs-cifras" style={{ gridTemplateColumns: `repeat(${cajas.length}, minmax(0, 1fr))`, marginBottom: 20 }} data-testid="contadores">
        {cajas.map((c) => <div key={c.k}><b className={c.c}>{c.n}</b><span>{c.t}</span></div>)}
      </div>
      <p className="pequeno suave">
        {personas.length} invitados.{" "}
        {encendido ? "Los jugadores responden en la web (D99); «no va» siempre con motivo. Solo lo ven los gestores."
          : <>{ultimaLectura ? <>Última lectura de SportEasy: <b>{fechaHora(ultimaLectura)}</b>.</> : "Todavía no se han leído las respuestas de SportEasy para este evento."} Los jugadores siguen respondiendo en SportEasy (fase puente). Solo lo ven los gestores.</>}
      </p>

      <div className="gs-dos">
        <section className="gs-bloque gs-izq" style={{ flex: "3 1 560px" }} aria-labelledby="t-resp">
          <h2 id="t-resp">Respuestas</h2>
          <div className="tabla-desplazable">
            <table className="gs-tabla ev-tabla" data-testid="tabla-respuestas">
              <thead><tr><th>Jugador</th><th>Respuesta</th><th>Motivo y detalle</th><th>Avisos</th><th><span className="solo-lectores">Responder por él</span></th></tr></thead>
              <tbody>
                {lineas.map((l) => (
                  <tr key={l.person_id} data-respuesta={l.clase}>
                    <td data-label="Jugador"><span className={`ev-resp ev-resp-${l.clase === "sin_responder" ? "sin" : l.clase}`}><b>{l.nombre}</b></span></td>
                    <td data-label="Respuesta"><span className={l.clase === "no" ? "ev-no" : l.clase === "va" ? "ev-ok" : l.clase === "duda" ? "ev-duda" : "suave"}>{l.texto}</span>{l.origenTxt && <span className="ev-sub" style={{ color: "var(--tinta-tenue)" }}>{l.origenTxt}</span>}</td>
                    <td data-label="Motivo y detalle">{l.motivo ?? <span className="suave">—</span>}</td>
                    <td data-label="Avisos">{l.avisos ? <span className="ev-ok">Sí</span> : <span className="suave">No</span>}</td>
                    <td data-label="">{l.clase === "sin_responder" && <ResponderPor eventoId={evento.id} personId={l.person_id} nombre={l.nombre} fecha={evento.fecha} domingo={!!dia} opciones={opcionesPor(l)} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="pequeno suave" style={{ margin: 0 }}>Motivos posibles: {MOTIVOS_JUGADOR.map((m) => m.texto.toLowerCase()).join(", ")}. «Horario» es interno: quien solo puede a uno de los dos partidos.</p>
        </section>

        <aside className="gs-der ev-lateral" style={{ flex: "1 1 320px" }}>
          <section className="gs-bloque" aria-labelledby="t-rec" data-testid="recordatorios-automaticos">
            <h2 id="t-rec" style={{ fontSize: 22 }}>Recordatorios automáticos</h2>
            {sinRecordatorios ? <p className="pequeno suave" style={{ margin: 0 }}>Este evento está marcado «Sin recordatorios».</p> : (
              <ul className="ev-rec-lista">
                {plan.map((h) => {
                  const env = enviadosDe(h.tipo);
                  const hora = enMadrid(h.envio);
                  return (
                    <li key={h.tipo} data-enviado={env.length > 0}>
                      <span aria-hidden="true">{env.length ? "✓" : "·"}</span>
                      <span><b>{TEXTO_HUECO[h.tipo]}</b><small>{env.length ? `Enviado el ${ddmm(hora.fecha)} a las ${hora.hora} · a ${env.length}` : `${h.envio < new Date() ? (encendido ? "No salió (todos habían respondido o estaba apagado)" : "Interruptor apagado") : `Falta: ${ddmm(hora.fecha)} a las ${hora.hora}`}`}</small></span>
                    </li>
                  );
                })}
                {manuales.length > 0 && <li data-enviado="true"><span aria-hidden="true">✓</span><span><b>Enviados a mano</b><small>{manuales.length} avisos</small></span></li>}
              </ul>
            )}
            {encendido ? <BotonRecordatorio eventoId={evento.id} /> : (
              <details data-testid="recordatorio">
                <summary className="boton boton-amarillo" style={{ listStyle: "none", cursor: "pointer" }}>Pedir recordatorio a Claude</summary>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                  {rec.faltan.length ? (
                    <>
                      <p className="pequeno" style={{ margin: 0 }}><b>Faltan por responder ({rec.faltan.length}):</b> {rec.faltan.join(", ")}.</p>
                      <CopiarTexto texto={rec.texto} etiqueta="Copiar texto" />
                    </>
                  ) : <p className="pequeno suave" style={{ margin: 0 }}>Todos han respondido o están ausentes por periodo: no hace falta recordatorio.</p>}
                  <p className="pequeno suave" style={{ margin: 0 }}>Esto solo prepara la lista y el texto. El envío lo hace Claude desde SportEasy, con tu OK (mientras «respuestas en la web» esté apagado).</p>
                </div>
              </details>
            )}
          </section>
          <section className="gs-bloque" aria-labelledby="t-sinav" data-testid="sin-avisos">
            <h2 id="t-sinav" style={{ fontSize: 22 }}>Sin avisos activados · {sinAvisos.length}</h2>
            {sinAvisos.length ? (
              <>
                <p className="pequeno" style={{ margin: 0 }}>{sinAvisos.map((l) => l.nombre).join(", ")}.</p>
                <CopiarTexto texto={msgSinAvisos} etiqueta="Copiar mensaje" />
              </>
            ) : <p className="pequeno suave" style={{ margin: 0 }}>Todos los invitados tienen los avisos activados.</p>}
          </section>
        </aside>
      </div>

      <section className="gs-bloque" style={{ marginTop: 20 }} aria-labelledby="t-aus" data-testid="franja-ausencias">
        <div className="gs-bloque-cab"><h2 id="t-aus">Ausencias por periodo</h2><span className="gs-eyebrow">próximas {SEMANAS} semanas desde el {ddmm(desde)}</span></div>
        {enFranja.length === 0 ? <p className="suave" style={{ margin: 0 }}>Nadie ha marcado ausencias por periodo en estas semanas.</p> : (
          <div className="ev-gantt" role="list">
            {enFranja.map((p) => {
              const fin = p.hasta ?? hasta;
              const cubre = p.desde <= evento.fecha && (p.hasta == null || evento.fecha <= p.hasta);
              return (
                <div key={`${p.person_id}-${p.desde}-${p.hasta}`} className="ev-gantt-fila" role="listitem">
                  <span><b>{nombre.get(p.person_id)}</b></span>
                  <div>
                    <div className="ev-gantt-pista" aria-hidden="true">
                      <i className={p.hasta ? undefined : "ev-gantt-abierta"} style={{ left: `${pos(p.desde < desde ? desde : p.desde)}%`, width: `${Math.max(1, pos(fin > hasta ? hasta : fin) - pos(p.desde < desde ? desde : p.desde))}%` }} />
                      <b style={{ left: `${pos(evento.fecha)}%` }} />
                    </div>
                    <span className="pequeno suave">{TEXTO_MOTIVO[p.motivo]} · {p.hasta ? `${ddmm(p.desde)} → ${ddmm(p.hasta)}` : `desde el ${ddmm(p.desde)}, sin fecha de vuelta`}{p.origen === "sporteasy" ? " · SportEasy" : p.origen === "gestor" ? " · puesta por un gestor" : p.origen === "jugador" ? " · en la web" : ""}{cubre ? <b style={{ color: "var(--error)" }}> · cubre este evento ({diaYNumero(evento.fecha)})</b> : ""}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="pequeno suave" style={{ margin: 0 }}>La línea amarilla marca la fecha de este evento. Una franja abierta hasta el borde es una ausencia sin fecha de vuelta.</p>
      </section>
    </>
  );
}
