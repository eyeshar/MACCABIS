import Link from "next/link";
import { cargarFuente } from "@/lib/eventos/fuente";
import { cargarJugadores } from "@/lib/eventos/datos";
import { type Respuesta } from "@/lib/eventos/dominio";
import "./eventos/eventos.css";
import { exigirGestor, origenMensajes } from "@/lib/sesion";
import TarjetaActivar from "./TarjetaActivar";
import { cargarActivacionViva } from "@/lib/gestion/activacion";
import { AvisoCaja } from "@/components/ProximoPartido";
import { bonito, cargarLiga, dec, masPeligrosos, type DatosLiga } from "@/lib/liga";
import { clave } from "@/data/avisosEquipacion";
import {
  chipEquipacion, entrenoHabitual, estadoClasificacion, proximosPartidos, ultimosResultados, type Evento,
} from "@/lib/publico";
import { diaMes, diaSemanaCorto, hoyMadrid, textoSemana } from "@/lib/dias";
import { campanaAbiertaAhora } from "@/lib/fechas";
import { NOMBRE_EQUIPO } from "@/lib/web";
import { cargarPendientesSemana } from "@/lib/gestion/pendientes";
import { proximoEntreno } from "@/lib/gestion/entreno";
import { convocadosDe, hhmm, tituloEvento } from "@/lib/eventos/dominio";
import CuentasRespuestas from "@/components/gestion/CuentasRespuestas";
import Numeros, { type GrupoNum } from "@/components/numeros/Numeros";
import { gruposEvento, lineaDudas, sinFichaQueVan, type RespuestaPersona } from "@/lib/numeros/respuestas";
import AvisoSinFicha from "@/components/numeros/AvisoSinFicha";
import { hrefJugador } from "@/lib/numeros/enlaces";
import { cargarDefecto } from "@/lib/convocatoria/defecto";
import { ausenciaQueCubre, claveQuitado, noVaPorDefecto } from "@/lib/disponibilidad/porDefecto";
import PorDefectoEntreno from "./PorDefectoEntreno";

export const metadata = { title: "Gestión · Maccabis" };

const cruce = (e: Evento) => { const n = NOMBRE_EQUIPO[e.equipo!]; return e.local ? `${n} – ${e.rival}` : `${e.rival} – ${n}`; };

/** Tarjeta de scouting del proximo rival: puesto y sus 3 mas peligrosos, por media (D169; datos de terceros, D73). */
function scoutingDe(liga: DatosLiga | null, e: Evento) {
  if (!liga || !e.rival) return null;
  const fila = liga.clasificacion.find((c) => clave(c.equipo) === clave(e.rival));
  if (!fila) return null;
  const top = masPeligrosos(liga.jugadores.filter((j) => j.grupo === fila.grupo && j.equipo === fila.equipo), fila.pj);
  const apellido = (n: string) => bonito(n).split(",")[0].split(" ")[0];
  return {
    equipo: fila.equipo,
    texto: `${fila.equipo} · ${fila.pos}.º ${fila.grupo}`,
    detalle: top.length ? top.map((j) => `${apellido(j.nombre)} ${dec(j.pts / j.pj)}/p`).join(" · ") : "Aún sin partidos en las hojas de esta temporada",
  };
}

/** «Rival – Maccabis» con el rival como enlace a su scouting (D139), si esta en la liga; si no, solo el texto. */
function enlaceRival(liga: DatosLiga | null, e: Evento) {
  const s = scoutingDe(liga, e);
  const n = NOMBRE_EQUIPO[e.equipo!];
  const rival = s ? <Link href={`/liga/scouting?e=${encodeURIComponent(s.equipo)}${e.equipo === "MDL" ? "&v=mdl" : ""}`}>{e.rival}</Link> : <>{e.rival}</>;
  return e.local ? <>{n} – {rival}</> : <>{rival} – {n}</>;
}

// Panel de la semana (maqueta Gestion, D76): rutinas, partidos del domingo, el proximo entreno con sus respuestas y pendientes.
export default async function InicioGestion() {
  const { supabase } = await exigirGestor();
  const [{ count: jugadores }, { count: conCorreo }, { data: campanas }, liga] = await Promise.all([
    supabase.from("jugadores").select("id", { count: "exact", head: true }).eq("activo", true),
    supabase.from("jugadores").select("id", { count: "exact", head: true }).eq("activo", true).not("email", "is", null),
    supabase.from("campanas_ropa").select("id, nombre, estado, fecha_limite").order("creado_en", { ascending: false }).limit(1),
    cargarLiga(supabase).catch(() => null),
  ]);
  const campana = campanas?.[0];
  const { count: pedidos } = campana
    ? await supabase.from("pedidos_ropa").select("id", { count: "exact", head: true }).eq("campana_id", campana.id)
    : { count: 0 };

  const hoy = hoyMadrid();
  const fuente = await cargarFuente();
  const proximos = proximosPartidos(hoy, undefined, fuente);
  const fecha = proximos.map((p) => p.evento.fecha).sort()[0];
  const delDomingo = proximos.filter((p) => p.evento.fecha === fecha).map((p) => p.evento);
  const jornada = delDomingo[0]?.jornada;
  const mismaHora = delDomingo.length === 2 && delDomingo[0].inicio && delDomingo[0].inicio === delDomingo[1].inicio;
  const conAviso = delDomingo.filter((e) => e.aviso?.hay);
  // Convocatoria del domingo (D107): cuántos van por equipo y su estado (sin la migración aplicada, «Pendiente»).
  const { data: convDomingo } = fecha ? await supabase.from("convocatorias").select("estado, origen, equipos").eq("fecha", fecha).maybeSingle() : { data: null };
  const convocados = (e: Evento) => {
    const c = convDomingo as { estado: string; origen: string | null; equipos: Record<string, unknown[]> } | null;
    if (!c?.origen) return "Pendiente";
    return `${(c.equipos[NOMBRE_EQUIPO[e.equipo!]] ?? []).length} · ${c.estado === "aprobada" ? "aprobada" : "borrador"}`;
  };
  // Los convocados de cada partido con nombre y enlace a su ficha (D139).
  const gruposConvocados = (e: Evento): GrupoNum[] | null => {
    const c = convDomingo as { origen: string | null; equipos: Record<string, { person_id: string }[]> } | null;
    if (!c?.origen) return null;
    const lista = (c.equipos[NOMBRE_EQUIPO[e.equipo!]] ?? []).map((x) => { const j = js.find((y) => y.person_id === x.person_id); return { nombre: j?.nombre_visible ?? x.person_id, href: hrefJugador(x.person_id) }; })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    return [{ k: "convocados", etiqueta: "convocados", n: lista.length, personas: lista }];
  };
  const resultados = ultimosResultados(hoy);
  const sinActa = resultados.filter((r) => r.pendienteActa);
  // El proximo entreno sale de la tabla de eventos con su pista efectiva (ubicacion libre incluida), no del fichero.
  const proximo = await proximoEntreno(supabase, hoy);
  const entreno = proximo?.evento ?? null;
  const habitual = entrenoHabitual(fuente);
  const pistaHabitual = proximo?.serie ? { nombre: proximo.serie.nombre, enObras: proximo.serie.estado === "en_obras" } : { nombre: habitual.pista, enObras: habitual.enObras };
  const sinCorreo = (jugadores ?? 0) - (conCorreo ?? 0);
  // Respuestas al proximo entreno: van / dudan / no van / sin responder.
  // Y las de los partidos del domingo (por su clave, «mda-j4»), para enlazar a sus respuestas como en Eventos.
  const [js, { data: filasDomingo }] = await Promise.all([
    cargarJugadores(supabase),
    delDomingo.length ? supabase.from("eventos").select("id, clave, tipo, equipo, oficial, fecha, inicio").in("clave", delDomingo.map((e) => e.id)) : Promise.resolve({ data: [] }),
  ]);
  const evDomingo = (filasDomingo ?? []) as { id: string; clave: string; tipo: string; equipo: "MdA" | "MdL" | "ambos"; oficial: boolean; fecha: string; inicio: string | null }[];
  const ids = [...evDomingo.map((e) => e.id), ...(entreno ? [entreno.id] : [])];
  const [{ data: rsTodas }, defecto] = await Promise.all([
    ids.length ? supabase.from("respuestas").select("evento_id, person_id, respuesta, motivo, detalle").in("evento_id", ids) : Promise.resolve({ data: [] }),
    cargarDefecto(supabase, entreno ? [entreno.id] : []),
  ]);
  // Los cuatro contadores con sus nombres y motivos (D139, solo gestores).
  const cuentas = (ev: { id: string; tipo: string; equipo: "MdA" | "MdL" | "ambos"; oficial?: boolean; fecha: string; inicio: string | null; solo_con_ficha_en?: string | null }) => {
    const rs = ((rsTodas ?? []) as (RespuestaPersona & { evento_id: string })[]).filter((r) => r.evento_id === ev.id);
    const grupos = gruposEvento(ev as never, js, rs, true, defecto);
    const n = (k: string) => grupos.find((g) => g.k === k)!.n;
    // D148: quien dijo «voy» sin ficha a un entreno en una pista «solo con ficha»: aparte, con su aviso.
    // `respondidas`: las respuestas de verdad (sin los «no» por defecto ni por ausencia, D146 y D150).
    return { grupos, va: n("va"), duda: n("duda"), no: n("no"), sin: n("sin"), id: ev.id, hay: rs.length > 0, respondidas: rs.filter((r) => r.respuesta !== "sin_responder").length, dudas: lineaDudas({ ...ev, oficial: ev.oficial ?? true } as never, grupos, rs), sinFicha: sinFichaQueVan(ev as never, js, rs) };
  };
  const cuentasDomingo = new Map(evDomingo.map((e) => [e.clave, cuentas(e)]));
  const respEntreno = entreno ? cuentas(entreno) : null;
  // D146: quien «no suele entrenar» y no ha respondido a este entreno (por defecto, «no va») y a quien se le quito. Si
  // tiene una ausencia que cubre el dia, cuenta por la ausencia (D150) y no sale aqui.
  const sinMarca = (p: string) => ((rsTodas ?? []) as { evento_id: string; person_id: string; respuesta: Respuesta }[]).find((r) => r.evento_id === entreno?.id && r.person_id === p)?.respuesta ?? "sin_responder";
  const conMarca = entreno ? convocadosDe(entreno, js).filter((j) => noVaPorDefecto(entreno, defecto.marcas.get(j.person_id), sinMarca(j.person_id)) && !ausenciaQueCubre(j.person_id, entreno.fecha, defecto.ausencias)) : [];
  const quitado = (p: string) => !!entreno && defecto.quitados.has(claveQuitado(entreno.id, p));
  const porDefecto = conMarca.filter((j) => !quitado(j.person_id)).map((j) => ({ person_id: j.person_id, nombre: j.nombre_visible }));
  const quitadosEntreno = conMarca.filter((j) => quitado(j.person_id)).map((j) => ({ person_id: j.person_id, nombre: j.nombre_visible }));

  // «Respuestas en la web: activar» (D99.13): estado, condiciones y jornadas jugadas para marcarlas. Lo en vivo (D156) sale de cargarActivacionViva.
  const web = await origenMensajes();
  const [viva, { data: marcasDB }, { data: jugadas }] = await Promise.all([
    cargarActivacionViva(supabase, js, web),
    supabase.from("jornadas_control").select("jornada, estado").eq("temporada", "2026-27"),
    supabase.from("eventos").select("jornada").eq("tipo", "liga").lt("fecha", hoy).not("jornada", "is", null),
  ]);
  const ultimaJugada = Math.max(0, ...((jugadas ?? []) as { jornada: number }[]).map((x) => x.jornada));
  const jornadasJugadas = Array.from({ length: ultimaJugada }, (_, i) => i + 1);
  const marcas = Object.fromEntries(((marcasDB ?? []) as { jornada: number; estado: "limpia" | "con_arreglo" }[]).map((m) => [m.jornada, m.estado]));
  const mensajeActivar = `¡Novedad! Desde hoy las respuestas (Voy / No voy / Duda) se dan en la web de Maccabis: ${web}/mi-zona\nInstálala en el móvil y activa los avisos (te avisa si te falta responder o si cambia algo; de noche solo si el partido es en pocas horas): ${web}/avisos\nEn iPhone, ábrela con Safari → Compartir → «Añadir a pantalla de inicio», y entra desde el icono con tu correo.`;

  // «Pendiente esta semana»: la misma lista (con enlaces) que la banda «Gestión esta semana» del inicio (D117).
  const pendientes = await cargarPendientesSemana(supabase);
  const ropaAbierta = campana ? campanaAbiertaAhora(campana) : false;

  return (
    <>
      <div className="gs-titulo">
        <div>
          <div className="gs-eyebrow">Panel de gestión{fecha ? ` · ${textoSemana(fecha)}` : ""}</div>
          <h1>{jornada ? `Jornada ${jornada}` : "Temporada terminada"}</h1>
        </div>
      </div>

      <section aria-label="Rutinas semanales" className="gs-rutinas">
        <div className="gs-caja">
          <div className="gs-caja-cab"><span className="gs-eyebrow">A · Actas y estadísticas</span>
            {sinActa.length ? <span className="pastilla etiqueta-aviso">Esperando FBM</span> : <span className="pastilla pastilla-ok">Al día</span>}</div>
          <strong>{resultados.length ? `J${resultados[0].jornada ?? "?"} publicada${sinActa.length ? " sin acta" : ""}` : "Sin partidos jugados"}</strong>
          <span>{sinActa.length ? "Cuando la FBM suba las actas, se completan cuartos, hora y pista." : "Cada lunes, hojas de la FBM de los dos grupos."}</span>
        </div>
        <div className="gs-caja">
          <div className="gs-caja-cab"><span className="gs-eyebrow">B · Calendario</span><span className="pastilla">Jue 20:15</span></div>
          <strong>Revisión oficial del jueves</strong>
          <span>Horarios, pistas, clasificación oficial y colores de los rivales.</span>
        </div>
        <div className="gs-caja">
          <div className="gs-caja-cab"><span className="gs-eyebrow">C · Convocatoria</span><span className="pastilla">Lun–Mar</span></div>
          <strong>Reparto MdA / MdL</strong>
          <span>
            {mismaHora ? "Misma hora los dos: sin dobladores esta jornada." : delDomingo.length === 2 ? `MdA a las ${delDomingo.find((e) => e.equipo === "MDA")?.inicio ?? "?"} y MdL a las ${delDomingo.find((e) => e.equipo === "MDL")?.inicio ?? "?"}.` : delDomingo.length === 1 ? `Solo juega ${NOMBRE_EQUIPO[delDomingo[0].equipo!]}.` : "Sin partidos."}
            {conAviso.length ? ` Equipación: ${conAviso.length === 1 ? "1 aviso" : `${conAviso.length} avisos`}.` : ""}
          </span>
        </div>
      </section>

      {viva && <div style={{ marginBottom: 20 }}><TarjetaActivar inicial={viva} jornadas={jornadasJugadas} marcas={marcas} mensaje={mensajeActivar} /></div>}

      <div className="gs-dos">
        <div className="gs-izq">
          <section className="gs-bloque" aria-labelledby="t-prox">
            <div className="gs-bloque-cab">
              <h2 id="t-prox">Partidos del domingo</h2>
              {fecha && <span className="gs-eyebrow">{diaSemanaCorto(fecha)} {diaMes(fecha)}</span>}
            </div>
            {delDomingo.length ? (
              <div className="tabla-desplazable">
                <table className="gs-tabla gs-partidos">
                  <thead><tr><th>Equipo</th><th>Partido</th><th>Hora · pista</th><th>Equipación</th><th>Respuestas</th><th>Convocados</th></tr></thead>
                  <tbody>
                    {delDomingo.map((e) => {
                      const chip = chipEquipacion(e.aviso);
                      const r = cuentasDomingo.get(e.id);
                      return (
                        <tr key={e.id} className="eq-partido" data-equipo={e.equipo}>
                          <td><span className={`chip-eq chip-${e.equipo}`}>{NOMBRE_EQUIPO[e.equipo!]}</span></td>
                          <td style={{ fontWeight: 600 }}>{enlaceRival(liga, e)}</td>
                          <td className="cifra" style={{ whiteSpace: "nowrap" }}>{e.inicio ?? "¿?"} · P{e.partido?.campo ?? "?"}</td>
                          <td data-label="Equipación">{chip ? <span className={`pastilla pastilla-${chip.tipo}`}>{chip.texto}</span> : <span className="pastilla">Negra</span>}</td>
                          <td data-label="Respuestas" className={r?.hay ? "ev-celda-resp" : undefined}>{r?.hay ? <CuentasRespuestas id={r.id} grupos={r.grupos} nombre={cruce(e)} barra={false} dudas={r.dudas} /> : r ? <Link href={`/gestion/eventos/${r.id}/respuestas`} className="tenue">Sin respuestas</Link> : <span className="suave">—</span>}</td>
                          <td data-label="Convocados">
                            {gruposConvocados(e) && <Numeros variante="linea" prueba={`convocados-${e.id}`} etiqueta={`Convocados del ${NOMBRE_EQUIPO[e.equipo!]}`} grupos={gruposConvocados(e)!} />}
                            <Link href={`/gestion/convocatoria?fecha=${e.fecha}`} className={convDomingo ? undefined : "tenue"} style={{ display: "block" }}>{convocados(e)}</Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="suave" style={{ margin: 0 }}>No quedan partidos de liga en el calendario.</p>}
            {conAviso.map((e) => (
              <div key={e.id}>
                <p className="pequeno" style={{ margin: "0 0 4px", fontWeight: 600 }}>{cruce(e)}</p>
                <AvisoCaja a={e.aviso!} />
              </div>
            ))}
            {delDomingo.length > 0 && (
              <div className="gs-scouting">
                {delDomingo.map((e) => {
                  const s = scoutingDe(liga, e);
                  return (
                    <Link key={e.id} href={s ? `/liga/scouting?e=${encodeURIComponent(s.equipo)}${e.equipo === "MDL" ? "&v=mdl" : ""}` : "/liga/scouting"}>
                      <small>Scouting · próximo rival {NOMBRE_EQUIPO[e.equipo!]}</small>
                      <strong>{s?.texto ?? e.rival}</strong>
                      <span>{s?.detalle ?? "Sin datos de liga cargados"}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="gs-der">
          <section className="gs-bloque" aria-labelledby="t-entreno">
            <div className="gs-bloque-cab">
              <h2 id="t-entreno">Entreno del miércoles</h2>
              {entreno && <span className="gs-eyebrow">{diaSemanaCorto(entreno.fecha)} {+entreno.fecha.slice(8)} · {hhmm(entreno.inicio)}</span>}
            </div>
            {entreno && proximo ? (
              <span className="pequeno suave" data-testid="entreno-pista">
                {hhmm(entreno.inicio)}–{hhmm(entreno.fin)} · {proximo.pista.porConfirmar ? <b>pista por confirmar{proximo.pista.motivo ? ` (${proximo.pista.motivo})` : ""}</b> : <>{proximo.pista.texto}{entreno.notas ? `, ${entreno.notas.replace(/\.$/, "").toLowerCase()}` : ""}</>}
                {" "}(lo habitual: miércoles {habitual.inicio}–{habitual.fin} en {pistaHabitual.nombre}{pistaHabitual.enObras ? ", en obras" : ""})
              </span>
            ) : <span className="suave">No quedan entrenos en el calendario.</span>}
            {respEntreno && respEntreno.respondidas > 0 ? (
              <div data-testid="respuestas-entreno" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Numeros variante="cajas" columnas={4} prueba="entreno-numeros" etiqueta="Respuestas al entreno" grupos={respEntreno.grupos} />
                {respEntreno.dudas && <span className="pequeno suave" data-testid="linea-dudas">{respEntreno.dudas}</span>}
                <Link href={`/gestion/eventos/${respEntreno.id}/respuestas`} data-testid="enlace-respuestas" style={{ fontWeight: 600 }}>Ver respuestas y motivos →</Link>
              </div>
            ) : entreno ? (
              <p className="suave" style={{ margin: 0 }} data-testid="entreno-sin-respuestas">Aún nadie ha respondido a este entreno.</p>
            ) : null}
            {entreno && <PorDefectoEntreno eventoId={entreno.id} porDefecto={porDefecto} quitados={quitadosEntreno} />}
            {respEntreno && <AvisoSinFicha personas={respEntreno.sinFicha} pista={entreno?.solo_con_ficha_en} />}
          </section>

          <section className="gs-bloque" aria-labelledby="t-pendiente">
            <h2 id="t-pendiente">Pendiente esta semana</h2>
            {pendientes.length ? <ul className="gs-pendientes">{pendientes.map((p) => <li key={p.texto}><Link href={p.href}>{p.texto}</Link></li>)}</ul> : <p className="suave" style={{ margin: 0 }}>Nada pendiente.</p>}
          </section>

          <section className="gs-bloque" aria-labelledby="t-plantilla">
            <h2 id="t-plantilla">Plantilla</h2>
            <div className="gs-cifras">
              <div><b>{jugadores ?? 0}</b><span>personas activas</span></div>
              <div><b>{conCorreo ?? 0}</b><span>con correo dado de alta (pueden entrar)</span></div>
            </div>
            <Link href="/gestion/jugadores" style={{ fontWeight: 600 }}>Gestionar jugadores y correos →</Link>
          </section>

          <section className="gs-bloque" aria-labelledby="t-ropa">
            <h2 id="t-ropa">Pedido de ropa</h2>
            {campana ? (
              <p style={{ margin: 0 }}>{campana.nombre}: <span className={`etiqueta ${ropaAbierta ? "etiqueta-abierta" : "etiqueta-cerrada"}`}>{ropaAbierta ? "Abierta" : "Cerrada"}</span> · {pedidos ?? 0} pedidos.</p>
            ) : <p style={{ margin: 0 }}>No hay ninguna campaña.</p>}
            <Link href="/gestion/ropa" style={{ fontWeight: 600 }}>Ver pedido de ropa →</Link>
          </section>
        </div>
      </div>
    </>
  );
}
