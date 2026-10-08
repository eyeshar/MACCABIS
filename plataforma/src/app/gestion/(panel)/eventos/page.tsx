import Link from "next/link";
import { exigirGestor } from "@/lib/sesion";
import { chipEquipacion } from "@/lib/publico";
import { diaYNumero, hoyMadrid } from "@/lib/dias";
import { fechaHora } from "@/lib/fechas";
import { avisoDeEvento, cargarEventos, cargarJugadores, cargarPistas } from "@/lib/eventos/datos";
import {
  contarRespuestas, convocadosDe, hhmm, pistaEfectiva, rangoHoras, resumenCopia, cambioParaVer, TEXTO_ESTADO_PISTA, textoTipo, tituloEvento,
  type EventoFila, type Pista, type Respuesta,
} from "@/lib/eventos/dominio";
import FormularioCopia, { MarcarTodos } from "./FormularioCopia";

export const metadata = { title: "Eventos · Gestión Maccabis" };

const FILTROS = [
  { id: "proximos", texto: "Próximos" },
  { id: "entrenos", texto: "Entrenos" },
  { id: "liga", texto: "Liga" },
  { id: "amistosos", texto: "Amistosos y torneos" },
  { id: "pendientes", texto: "Pendientes de SportEasy" },
  { id: "pasados", texto: "Pasados" },
] as const;
type Filtro = (typeof FILTROS)[number]["id"];

const MAX_PROXIMOS = 30;

export default async function Eventos({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const filtro: Filtro = FILTROS.some((x) => x.id === f) ? (f as Filtro) : "proximos";
  const { supabase } = await exigirGestor();
  const hoy = hoyMadrid();
  const [eventos, pistas, jugadores, { data: filasResp }, { data: importaciones }, { data: encendidoWeb }] = await Promise.all([
    cargarEventos(supabase), cargarPistas(supabase), cargarJugadores(supabase),
    supabase.from("respuestas").select("evento_id, respuesta, leido_en"),
    supabase.from("importaciones").select("id, tipo, por_nombre, en, lineas, aceptadas, bloqueadas").order("en", { ascending: false }).limit(4),
    supabase.rpc("respuestas_web_encendido"),
  ]);
  const resp = new Map<string, { respuesta: Respuesta }[]>();
  let ultimaLectura: string | null = null;
  for (const r of (filasResp ?? []) as { evento_id: string; respuesta: Respuesta; leido_en: string }[]) {
    resp.set(r.evento_id, [...(resp.get(r.evento_id) ?? []), r]);
    if (!ultimaLectura || r.leido_en > ultimaLectura) ultimaLectura = r.leido_en;
  }

  const futuros = eventos.filter((e) => e.fecha >= hoy);
  const sinPista = futuros.filter((e) => e.tipo === "entreno" && e.estado === "programado" && pistaEfectiva(e, pistas).porConfirmar);
  const { concretos, deSerie } = resumenCopia(eventos, hoy);
  const pendientesTodos = resumenCopia(eventos, hoy).pendientes;

  const lista = ((): EventoFila[] => {
    switch (filtro) {
      case "entrenos": return futuros.filter((e) => e.tipo === "entreno");
      case "liga": return eventos.filter((e) => e.tipo === "liga");
      case "amistosos": return eventos.filter((e) => ["amistoso", "torneo", "interno"].includes(e.tipo));
      case "pendientes": return pendientesTodos;
      case "pasados": return eventos.filter((e) => e.fecha < hoy).reverse();
      default: return futuros.slice(0, MAX_PROXIMOS);
    }
  })();
  const cuenta: Record<Filtro, number> = {
    proximos: futuros.length, entrenos: futuros.filter((e) => e.tipo === "entreno").length, liga: eventos.filter((e) => e.tipo === "liga").length,
    amistosos: eventos.filter((e) => ["amistoso", "torneo", "interno"].includes(e.tipo)).length, pendientes: pendientesTodos.length, pasados: eventos.filter((e) => e.fecha < hoy).length,
  };
  const proximoEntreno = futuros.find((e) => e.tipo === "entreno" && e.estado === "programado" && e.serie);
  const habitual = pistas.find((p) => p.es_de_serie && p.uso === "entreno");
  const primeraSinPista = sinPista[0];

  return (
    <>
      <div className="gs-titulo">
        <div>
          <div className="gs-eyebrow">Temporada 26/27</div>
          <h1>Calendario y eventos</h1>
        </div>
        <div className="ev-botones">
          {proximoEntreno && <Link className="boton boton-contorno" href={`/gestion/eventos/${proximoEntreno.id}?alcance=siguientes`}>Entreno semanal</Link>}
          <Link className="boton boton-contorno" href="/gestion/eventos/importar">Importar</Link>
          <Link className="boton boton-amarillo" href="/gestion/eventos/nuevo">+ Nuevo evento</Link>
        </div>
      </div>

      {sinPista.length > 0 && primeraSinPista && (
        <div className="ev-aviso" role="status" data-testid="aviso-sin-pista">
          <span>
            <strong>{habitual && habitual.estado === "en_obras" ? `${habitual.nombre.split(" (")[0]} está cerrado por obras.` : "Hay entrenos sin pista."}</strong>{" "}
            {habitual?.estado === "en_obras" ? "Hasta que reabra, cada miércoles hay que fijar pista. " : ""}
            Sin pista todavía: <strong>{sinPista.slice(0, 4).map((e) => diaYNumero(e.fecha).toLowerCase()).join(", ")}</strong>{sinPista.length > 4 ? ` y ${sinPista.length - 4} más` : ""}.
          </span>
          <Link className="boton boton-amarillo" href={`/gestion/eventos/${primeraSinPista.id}`}>Elegir pista del día {+primeraSinPista.fecha.slice(8)}</Link>
          {habitual?.estado === "en_obras" && <Link className="boton boton-contorno" href="/gestion/eventos/pistas">Valdebernardo reabierta…</Link>}
        </div>
      )}

      <div className="gs-dos">
        <section className="gs-bloque gs-izq" style={{ flex: "3 1 620px" }} aria-labelledby="t-lista">
          <h2 id="t-lista" className="solo-lectores">Lista de eventos</h2>
          <nav className="ev-filtros" aria-label="Filtrar eventos">
            {FILTROS.map((x) => (
              <Link key={x.id} href={x.id === "proximos" ? "/gestion/eventos" : `/gestion/eventos?f=${x.id}`} aria-current={filtro === x.id ? "true" : undefined}>
                {x.texto} {(x.id === "pendientes" || x.id === "pasados") && cuenta[x.id] > 0 && <small>{cuenta[x.id]}</small>}
              </Link>
            ))}
          </nav>
          {lista.length === 0 ? <p className="suave" style={{ margin: 0 }}>No hay eventos en esta vista.</p> : (
            <Envoltorio activo={filtro === "pendientes"}>
            <div className="tabla-desplazable">
              <table className="gs-tabla ev-tabla" data-testid="tabla-eventos">
                <thead><tr><th>Fecha</th><th>Evento</th><th>Pista</th><th>Respuestas</th><th>SportEasy</th></tr></thead>
                <tbody>
                  {lista.map((e) => <Fila key={e.id} casilla={filtro === "pendientes"} e={e} pistas={pistas} respuestas={resp.get(e.id) ?? []} convocados={convocadosDe(e, jugadores).length} />)}
                </tbody>
              </table>
            </div>
            {filtro === "pendientes" && (
              <div className="botones" style={{ margin: "12px 0 0" }}>
                <button className="boton boton-amarillo" type="submit" data-testid="marcar-copiado-lista">Marcar como copiado</button>
                <MarcarTodos />
                <span className="pequeno suave">Pulsa solo si ya está copiado en SportEasy. Te pedirá confirmación.</span>
              </div>
            )}
            </Envoltorio>
          )}
          {filtro === "proximos" && futuros.length > MAX_PROXIMOS && <p className="pequeno suave" style={{ margin: 0 }}>Se ven los próximos {MAX_PROXIMOS} de {futuros.length}. Para el resto, usa los filtros (Entrenos, Liga…).</p>}
          <p className="pequeno suave" style={{ margin: 0 }}>
            Fase puente: los eventos se crean y cambian aquí; Claude los copia a SportEasy con tu OK. Los jugadores siguen respondiendo en SportEasy y Claude trae sus respuestas.
          </p>
        </section>

        <aside className="gs-der ev-lateral" aria-label="Pistas y copia a SportEasy" style={{ flex: "1 1 300px" }}>
          <section className="gs-bloque ev-copiar" aria-labelledby="t-copia" data-testid="copia-sporteasy">
            <span className="gs-eyebrow" style={{ color: "var(--c-amarillo)" }}>Copia a SportEasy</span>
            <h2 id="t-copia" style={{ fontSize: 20 }}>
              {concretos.length === 0 && deSerie.length === 0 ? "Todo al día" : `${concretos.length} ${concretos.length === 1 ? "cambio pendiente" : "cambios pendientes"}${deSerie.length ? ` + ${deSerie.length} entrenos de la serie` : ""}`}
            </h2>
            {concretos.length === 0 && deSerie.length === 0 ? <p className="pequeno suave" style={{ margin: 0 }}>No hay nada que copiar.</p> : (
              <FormularioCopia style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <ul>
                  {concretos.map((e) => (
                    <li key={e.id}>
                      <label>
                        <input type="checkbox" name="id" value={e.id} defaultChecked />
                        <span><Link href={`/gestion/eventos/${e.id}`}>{e.estado === "cancelado" ? "CANCELADO · " : ""}{tituloEvento(e)} · {diaYNumero(e.fecha)}</Link><br /><span className="suave">{cambioParaVer(e.sporteasy_cambio) ?? "Cambio sin describir"}</span></span>
                      </label>
                    </li>
                  ))}
                  {deSerie.length > 0 && (
                    <li>
                      <label>
                        <input type="checkbox" name="serie" value="1" data-n={deSerie.length} />
                        <span><b>{deSerie.length} entrenos de la serie</b> (del {diaYNumero(deSerie[0].fecha)} al {diaYNumero(deSerie[deSerie.length - 1].fecha)}) sin confirmar en SportEasy.<br />
                          <span className="suave">Márcalos cuando la serie esté creada en SportEasy (o uno a uno desde el filtro «Pendientes de SportEasy»).</span></span>
                      </label>
                    </li>
                  )}
                </ul>
                <div className="botones" style={{ margin: 0 }}>
                  <button className="boton boton-amarillo" type="submit">Marcar como copiado</button>
                  <MarcarTodos />
                </div>
                <span className="pequeno suave">Pulsa solo si ya está copiado en SportEasy. Te pedirá confirmación.</span>
              </FormularioCopia>
            )}
            {encendidoWeb ? (
              <p className="pequeno" style={{ margin: 0 }} data-testid="copia-sin-notificar">
                <b>Respuestas en la web encendido (D104):</b> cada evento se crea en SportEasy con el formulario completo (<span className="mono">/calendar/create/</span>, «Ajustes avanzados»): <b>«Selección manual»</b> (nace sin participantes) y <b>«Enviar una notificación» apagado</b>. Nunca el formulario rápido de «Crear evento»: invita a todos y notifica.
              </p>
            ) : <p className="pequeno suave" style={{ margin: 0 }}>Fase puente: la copia sigue como hasta ahora.</p>}
          </section>

          <section className="gs-bloque" aria-labelledby="t-pistas">
            <div className="gs-bloque-cab"><h2 id="t-pistas" style={{ fontSize: 24 }}>Pistas</h2><Link href="/gestion/eventos/pistas" style={{ fontWeight: 600, fontSize: 14 }}>Gestionar</Link></div>
            {pistas.map((p) => (
              <div key={p.id} className="ev-pista">
                <strong>{p.nombre}</strong>
                <small style={p.estado === "en_obras" ? { color: "var(--amarillo-tinta)", fontWeight: 600 } : undefined}>
                  {p.uso === "partido" ? `Partidos de liga${p.num_pistas ? ` · pistas 1 a ${p.num_pistas}` : ""}` : `${p.es_de_serie ? "Habitual de entreno" : "Entreno"} · ${TEXTO_ESTADO_PISTA[p.estado].toLowerCase()}`}
                  {!p.direccion && p.uso === "entreno" ? " · sin dirección" : ""}
                </small>
              </div>
            ))}
          </section>

          <section className="gs-bloque" aria-labelledby="t-lecturas" data-testid="ultimas-lecturas">
            <div className="gs-bloque-cab"><h2 id="t-lecturas" style={{ fontSize: 22 }}>Últimas lecturas</h2><Link href="/gestion/eventos/importar?t=respuestas" style={{ fontWeight: 600, fontSize: 14 }}>Importar</Link></div>
            <p className="pequeno" style={{ margin: 0 }}>
              Respuestas de SportEasy: {ultimaLectura ? <b>{fechaHora(ultimaLectura)}</b> : <span className="suave">todavía no se ha leído ninguna</span>}
            </p>
            {(importaciones ?? []).length > 0 && (
              <ul className="gs-pendientes">
                {(importaciones ?? []).map((i) => (
                  <li key={i.id}><span>{i.tipo === "calendario" ? "Calendario" : "Respuestas"} · {fechaHora(i.en)} · {i.por_nombre}<br /><span className="suave">{i.lineas} líneas, {i.aceptadas} aceptadas{i.bloqueadas ? `, ${i.bloqueadas} bloqueadas` : ""}</span></span></li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

function Envoltorio({ activo, children }: { activo: boolean; children: React.ReactNode }) {
  return activo ? <FormularioCopia>{children}</FormularioCopia> : <>{children}</>;
}

function Fila({ e, pistas, respuestas, convocados, casilla }: { casilla?: boolean; e: EventoFila; pistas: Pista[]; respuestas: { respuesta: Respuesta }[]; convocados: number }) {
  const pe = pistaEfectiva(e, pistas);
  const aviso = chipEquipacion(avisoDeEvento(e));
  const cancelado = e.estado === "cancelado";
  const sinPista = !cancelado && e.tipo === "entreno" && pe.porConfirmar;
  const c = contarRespuestas([...respuestas, ...Array.from({ length: Math.max(0, convocados - respuestas.length) }, () => ({ respuesta: "sin_responder" as Respuesta }))]);
  const total = c.va + c.duda + c.no + c.sin_responder;
  const quedada = hhmm(e.quedada);
  const equipoClase = e.tipo === "liga" ? `ev-tipo-${e.equipo}` : "";
  return (
    <tr className={`${cancelado ? "ev-cancelado" : ""} ${sinPista ? "ev-sin-pista" : ""}`} data-evento={e.clave}>
      <td data-label="Fecha">
        {casilla && e.sporteasy_estado === "pendiente" && <input type="checkbox" name="id" value={e.id} aria-label={`Marcar como copiado: ${tituloEvento(e)} ${diaYNumero(e.fecha)}`} style={{ marginRight: 8 }} />}
        <strong>{diaYNumero(e.fecha)}</strong>
        <div className="ev-hora">{rangoHoras(e)}{e.tipo === "liga" && quedada ? ` · encuentro ${quedada}` : ""}</div>
      </td>
      <td data-label="Evento">
        <span className={`ev-tipo ${equipoClase}`}>{e.tipo === "liga" ? `${e.equipo}${e.jornada ? ` · J${e.jornada}` : ""}` : textoTipo(e.tipo).toUpperCase()}</span>
        {cancelado && <span className="ev-tipo" style={{ marginLeft: 6, background: "var(--error-fondo)", color: "var(--error)" }}>CANCELADO</span>}
        <span className="ev-titulo"><Link href={`/gestion/eventos/${e.id}`}>{tituloEvento(e)}</Link></span>
        {e.notas && <span className="ev-sub">{e.notas}</span>}
        {aviso && <span className="ev-sub ev-sub-info">{aviso.texto}</span>}
      </td>
      <td data-label="Pista">
        {pe.porConfirmar ? <><b style={{ color: "var(--amarillo-tinta)" }}>Pista por confirmar</b>{pe.motivo && <span className="ev-sub" style={{ color: "var(--tinta-tenue)" }}>{pe.motivo}</span>}</> : pe.texto}
      </td>
      <td data-label="Respuestas">
        {respuestas.length > 0 ? (
          <div>
            <div className="ev-cuentas"><span className="ev-ok">{c.va} van</span><span className="ev-duda">{c.duda + c.sin_responder} ?</span><span className="ev-no">{c.no} no</span></div>
            <div className="ev-barra" aria-hidden="true">
              <i style={{ flex: `${c.va} 1 0`, background: "var(--c-verde)" }} /><i style={{ flex: `${c.duda + c.sin_responder} 1 0`, background: "var(--c-amarillo)" }} /><i style={{ flex: `${c.no} 1 0`, background: "var(--error)" }} />
              {total === 0 && null}
            </div>
          </div>
        ) : e.tipo === "liga" ? <span className="suave">Convocatoria el martes</span> : <span className="suave">—</span>}
      </td>
      <td data-label="SportEasy">
        {e.sporteasy_estado === "copiado"
          ? <span className="ev-copia ev-ok"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l4 4 10-10" /></svg>Al día</span>
          : <span className="pastilla etiqueta-aviso" title={cambioParaVer(e.sporteasy_cambio) ?? undefined}>{cancelado ? "Cancelación pendiente" : "Pendiente de copiar"}</span>}
      </td>
    </tr>
  );
}
