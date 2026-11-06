import Link from "next/link";
import { cargarFuente } from "@/lib/eventos/fuente";
import { cargarEventos, cargarJugadores, cargarPistas } from "@/lib/eventos/datos";
import { type Respuesta } from "@/lib/eventos/dominio";
import "./eventos/eventos.css";
import "./gestion.css";
import { exigirGestor, origenMensajes } from "@/lib/sesion";
import TarjetaAvisos from "./TarjetaAvisos";
import CopiarBoton from "./CopiarBoton";
import { cargarActivacionViva } from "@/lib/gestion/activacion";
import { AvisoCaja } from "@/components/ProximoPartido";
import { bonito, cargarLiga, dec, masPeligrosos, type DatosLiga } from "@/lib/liga";
import { ClavesTarjeta } from "@/components/liga/Claves";
import { clavesDeEquipo } from "@/lib/scouting/datos";
import { clave } from "@/data/avisosEquipacion";
import {
  chipEquipacion, entrenoHabitual, estadoClasificacion, proximosPartidos, ultimosResultados, type Evento,
} from "@/lib/publico";
import { diaMes, diaSemanaCorto, hoyMadrid, sumarDias, textoSemana } from "@/lib/dias";
import { estadoPedido } from "@/lib/pedidoRopa";
import { NOMBRE_EQUIPO } from "@/lib/web";
import { cargarPendientesSemana } from "@/lib/gestion/pendientes";
import { proximoEntreno } from "@/lib/gestion/entreno";
import { proximosEntrenos } from "@/lib/grupos/datos";
import { convocadosDe, diaYNumero, esPlanFila, hhmm, tituloEvento, type EventoFila } from "@/lib/eventos/dominio";
import CuentasRespuestas from "@/components/gestion/CuentasRespuestas";
import Numeros, { type GrupoNum } from "@/components/numeros/Numeros";
import { gruposEvento, lineaDudas, sinFichaQueVan, type RespuestaPersona } from "@/lib/numeros/respuestas";
import AvisoSinFicha from "@/components/numeros/AvisoSinFicha";
import { hrefJugador } from "@/lib/numeros/enlaces";
import { cargarDefecto } from "@/lib/convocatoria/defecto";
import { cargarContexto } from "@/lib/convocatoria/datos";
import { entradaDe } from "@/lib/convocatoria/vista";
import { proponer, revisar, type Convocatoria } from "@/lib/convocatoria/motor";
import { ausenciaQueCubre, claveQuitado, noVaPorDefecto } from "@/lib/disponibilidad/porDefecto";
import { mensajeGrupo } from "@/lib/whatsapp/sinResponder";
import { limiteDudas } from "@/lib/avisos/horario";
import { sitioAviso } from "@/lib/avisos/servidor";
import { urlDomingo, urlEvento } from "@/lib/avisos/planificador";
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
    claves: clavesDeEquipo(liga, fila.grupo as "G1" | "G2", fila.equipo),
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

/** «Avisar a los que faltan» (a la pantalla de respuestas, donde está «Enviar un recordatorio ahora») y «Copiar WhatsApp». */
function AccionesFaltan({ id, sin, mensaje }: { id: string; sin: number; mensaje: string | null }) {
  if (!sin) return null;
  return (
    <div className="gp-acciones" data-testid={`faltan-${id}`}>
      <Link className="boton boton-contorno" href={`/gestion/eventos/${id}/respuestas#t-rec`}>Avisar a los que faltan</Link>
      {mensaje && <CopiarBoton texto={mensaje} prueba={`whatsapp-${id}`} />}
    </div>
  );
}

// Gestión (/gestion), ordenada por lo que se hace cada semana (estructura nueva, bloque 4): 1 · quién va esta semana,
// 2 · la convocatoria del domingo y los grupos del miércoles, 3 · lo pendiente y 4 · plantilla y club (lleva a todas las
// pantallas de gestión: la barra de subsecciones ya no existe). Todo recuento, calculado en el momento.
export default async function InicioGestion() {
  const { supabase } = await exigirGestor();
  const [{ data: campanas }, liga] = await Promise.all([
    supabase.from("campanas_ropa").select("id, nombre, estado, fecha_limite").order("creado_en", { ascending: false }).limit(1),
    cargarLiga(supabase).catch(() => null),
  ]);
  const campana = campanas?.[0] as { id: string; nombre: string; estado: string; fecha_limite: string | null } | undefined;
  const { count: pedidos } = campana
    ? await supabase.from("pedidos_ropa").select("id", { count: "exact", head: true }).eq("campana_id", campana.id)
    : { count: 0 };

  const hoy = hoyMadrid();
  const ahora = new Date();
  const fuente = await cargarFuente();
  const proximos = proximosPartidos(hoy, undefined, fuente);
  const fecha = proximos.map((p) => p.evento.fecha).sort()[0];
  const delDomingo = proximos.filter((p) => p.evento.fecha === fecha).map((p) => p.evento);
  const jornada = delDomingo[0]?.jornada;
  const mismaHora = delDomingo.length === 2 && delDomingo[0].inicio && delDomingo[0].inicio === delDomingo[1].inicio;
  const conAviso = delDomingo.filter((e) => e.aviso?.hay);
  // D173: la propuesta automática del martes también se ve al entrar en Gestión (aunque no llegue el push), y qué gestor no
  // recibirá los avisos de la convocatoria (sin ninguna suscripción activa).
  const [{ data: gestoresF }, { data: subsG }, { data: propuestas }] = await Promise.all([
    supabase.from("gestores").select("nombre, user_id"),
    supabase.from("suscripciones_avisos").select("user_id").eq("activa", true),
    supabase.from("convocatorias").select("fecha").eq("estado", "borrador").not("automatica_en", "is", null).gte("fecha", hoy).order("fecha").limit(1),
  ]);
  const propuestaLista = ((propuestas ?? []) as { fecha: string }[])[0]?.fecha ?? null;
  const conAvisosG = new Set(((subsG ?? []) as { user_id: string | null }[]).map((x) => x.user_id));
  const gestoresSinAvisos = ((gestoresF ?? []) as { nombre: string; user_id: string | null }[]).filter((g) => !g.user_id || !conAvisosG.has(g.user_id)).map((g) => g.nombre.split(" ")[0]);
  const resultados = ultimosResultados(hoy);
  const sinActa = resultados.filter((r) => r.pendienteActa);
  const proximo = await proximoEntreno(supabase, hoy);
  const entreno = proximo?.evento ?? null;
  const habitual = entrenoHabitual(fuente);
  const pistaHabitual = proximo?.serie ? { nombre: proximo.serie.nombre, enObras: proximo.serie.estado === "en_obras" } : { nombre: habitual.pista, enObras: habitual.enObras };

  // Eventos de esta semana (hoy y los 7 días siguientes) de la tabla de eventos, con planes (para «Pendiente»).
  const [js, todos, pistas, ctx, entrenosG, { data: importaciones }] = await Promise.all([
    cargarJugadores(supabase), cargarEventos(supabase, { conPlanes: true }), cargarPistas(supabase),
    fecha ? cargarContexto(supabase, fecha).catch(() => null) : Promise.resolve(null),
    proximosEntrenos(supabase),
    supabase.from("importaciones").select("id, por_nombre, en, aceptadas").eq("tipo", "calendario").order("en", { ascending: false }).limit(1),
  ]);
  const hasta = sumarDias(hoy, 7);
  const oficiales = todos.filter((e) => !esPlanFila(e));
  const semana = oficiales.filter((e) => e.estado === "programado" && e.fecha >= hoy && e.fecha <= hasta);
  const evDomingo = oficiales.filter((e) => delDomingo.some((d) => d.id === e.clave));
  // Los demás de la semana (otros entrenos, amistosos, torneos…): el próximo entreno y los partidos del domingo van aparte.
  const otros = semana.filter((e) => e.id !== entreno?.id && !evDomingo.some((d) => d.id === e.id) && e.tipo !== "liga");
  const ids = [...new Set([...evDomingo.map((e) => e.id), ...(entreno ? [entreno.id] : []), ...otros.map((e) => e.id)])];
  const [{ data: rsTodas }, defecto] = await Promise.all([
    ids.length ? supabase.from("respuestas").select("evento_id, person_id, respuesta, motivo, detalle").in("evento_id", ids) : Promise.resolve({ data: [] }),
    cargarDefecto(supabase, [...(entreno ? [entreno.id] : []), ...otros.filter((e) => e.tipo === "entreno").map((e) => e.id)]),
  ]);
  const web = await origenMensajes();
  // Los cuatro contadores con sus nombres y motivos (D139, solo gestores) y el WhatsApp a quien falta (D178).
  const cuentas = (ev: EventoFila) => {
    const rs = ((rsTodas ?? []) as (RespuestaPersona & { evento_id: string })[]).filter((r) => r.evento_id === ev.id);
    const grupos = gruposEvento(ev as never, js, rs, true, defecto);
    const n = (k: string) => grupos.find((g) => g.k === k)!.n;
    const sinNombres = grupos.find((g) => g.k === "sin")?.personas.map((p) => p.nombre) ?? [];
    const mensaje = sinNombres.length ? mensajeGrupo(sinNombres, {
      tipo: ev.tipo, fecha: ev.fecha, horas: [hhmm(ev.inicio)].filter(Boolean) as string[], lugar: !ev.pista_id && ev.ubicacion_nombre ? ev.ubicacion_nombre : sitioAviso(ev, pistas),
      url: `${web}${ev.tipo === "liga" ? urlDomingo(ev.fecha) : urlEvento(ev)}`, limite: limiteDudas(ev),
    }, ahora) : null;
    return { grupos, va: n("va"), duda: n("duda"), no: n("no"), sin: n("sin"), id: ev.id, hay: rs.length > 0, respondidas: rs.filter((r) => r.respuesta !== "sin_responder").length, dudas: lineaDudas({ ...ev, oficial: ev.oficial ?? true } as never, grupos, rs), sinFicha: sinFichaQueVan(ev as never, js, rs), mensaje };
  };
  const cuentasDomingo = new Map(evDomingo.map((e) => [e.clave, cuentas(e)]));
  const respEntreno = entreno ? cuentas(entreno) : null;
  // D146: quien «no suele entrenar» y no ha respondido a este entreno (por defecto, «no va») y a quien se le quito.
  const sinMarca = (p: string) => ((rsTodas ?? []) as { evento_id: string; person_id: string; respuesta: Respuesta }[]).find((r) => r.evento_id === entreno?.id && r.person_id === p)?.respuesta ?? "sin_responder";
  const conMarca = entreno ? convocadosDe(entreno, js).filter((j) => noVaPorDefecto(entreno, defecto.marcas.get(j.person_id), sinMarca(j.person_id)) && !ausenciaQueCubre(j.person_id, entreno.fecha, defecto.ausencias)) : [];
  const quitado = (p: string) => !!entreno && defecto.quitados.has(claveQuitado(entreno.id, p));
  const porDefecto = conMarca.filter((j) => !quitado(j.person_id)).map((j) => ({ person_id: j.person_id, nombre: j.nombre_visible }));
  const quitadosEntreno = conMarca.filter((j) => quitado(j.person_id)).map((j) => ({ person_id: j.person_id, nombre: j.nombre_visible }));

  // 2 · Convocatoria del domingo: estado, convocados por equipo y cuántos se quedan fuera (el motor, como en su pantalla).
  const fila = ctx?.fecha === fecha ? ctx.convocatoria : null;
  const empezada = !!fila?.origen;
  const rev = ctx && ctx.fecha === fecha ? (empezada ? revisar(entradaDe(ctx), fila!.equipos) : proponer(entradaDe(ctx))) : null;
  const convActual: Convocatoria | null = empezada ? fila!.equipos : rev && "convocatoria" in rev ? (rev as { convocatoria: Convocatoria }).convocatoria : null;
  const estadoConv = !fila?.origen ? { texto: "Sin empezar", clase: "" }
    : fila.estado === "aprobada" ? (fila.aviso_estado === "enviado" ? { texto: "Enviada", clase: "pastilla-ok" } : { texto: "Aprobada", clase: "pastilla-ok" })
    : { texto: fila.automatica_en ? "Propuesta automática" : "Propuesta", clase: "pastilla-pendiente" };
  const nombreDe = (id: string) => js.find((y) => y.person_id === id)?.nombre_visible ?? id;
  const gruposConvocados = (e: Evento): GrupoNum[] | null => {
    if (!fila?.origen) return null;
    const lista = ((fila.equipos as Record<string, { person_id: string }[]>)[NOMBRE_EQUIPO[e.equipo!]] ?? []).map((x) => ({ nombre: nombreDe(x.person_id), href: hrefJugador(x.person_id) }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    return [{ k: "convocados", etiqueta: "convocados", n: lista.length, personas: lista }];
  };
  const convocados = (e: Evento) => {
    if (!fila?.origen) return "Pendiente";
    return `${((fila.equipos as Record<string, unknown[]>)[NOMBRE_EQUIPO[e.equipo!]] ?? []).length} · ${fila.estado === "aprobada" ? "aprobada" : "borrador"}`;
  };
  const fueraConv = rev?.sinConvocar ?? [];
  const gruposFuera: GrupoNum[] = [{ k: "fuera", etiqueta: empezada ? "se quedan fuera" : "se quedarían fuera", n: fueraConv.length, tono: "no", personas: fueraConv.map((s) => ({ nombre: nombreDe(s.person_id), href: hrefJugador(s.person_id), nota: s.motivo })) }];
  const gruposEquipo = (eq: "MdA" | "MdL"): GrupoNum => {
    const lista = (convActual?.[eq] ?? []).map((c) => ({ nombre: nombreDe(c.person_id), href: hrefJugador(c.person_id) })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    return { k: eq, etiqueta: eq, n: lista.length, personas: lista };
  };
  const grupoMiercoles = entrenosG[0] ?? null;

  // 3 · Pendiente
  const viva = await cargarActivacionViva(supabase, js, web);
  const pendientes = await cargarPendientesSemana(supabase);
  const ropa = campana ? estadoPedido(campana) : null;
  const planes = todos.filter((e) => esPlanFila(e) && e.fecha >= hoy && e.estado === "programado");
  const cambiosCal = oficiales.filter((e) => e.cambio_visible_en && e.fecha >= hoy).sort((a, b) => ((a.cambio_visible_en ?? "") < (b.cambio_visible_en ?? "") ? 1 : -1)).slice(0, 3);
  const ultimaImportacion = ((importaciones ?? []) as { id: string; por_nombre: string | null; en: string; aceptadas: number | null }[])[0] ?? null;
  const porContrastar = /pendiente de contrastar/i.test(estadoClasificacion());
  const ddmm = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit" });

  return (
    <div className="gp-panel">
      <div className="gs-titulo">
        <div>
          <div className="gs-eyebrow">Panel de gestión{fecha ? ` · ${textoSemana(fecha)}` : ""}</div>
          <h1>{jornada ? `Jornada ${jornada}` : "Temporada terminada"}</h1>
        </div>
      </div>

      {propuestaLista && (
        <div className="ev-aviso" role="note" data-testid="panel-propuesta" style={{ marginBottom: 16 }}>
          <span><b>Convocatoria del domingo {diaMes(propuestaLista)} lista para revisar.</b> No sale nada hasta que la apruebes.</span>
          <Link className="boton boton-amarillo" href={`/gestion/convocatoria?fecha=${propuestaLista}`}>Revisar y aprobar</Link>
        </div>
      )}
      {gestoresSinAvisos.length > 0 && (
        <p className="aviso aviso-error" role="note" data-testid="panel-gestores-sin-avisos" style={{ marginBottom: 16 }}>
          {gestoresSinAvisos.join(" y ")} no recibirá{gestoresSinAvisos.length > 1 ? "n" : ""} los avisos de la convocatoria: no tiene{gestoresSinAvisos.length > 1 ? "n" : ""} los avisos activados en ningún móvil (<Link href="/avisos">/avisos</Link>).
        </p>
      )}

      <div className="gs-dos">
        <div className="gs-izq">
          {/* ------------------------------------------------ 1 · Quién va esta semana */}
          <section className="gs-bloque" aria-labelledby="t-semana" data-testid="gp-semana">
            <h2 id="t-semana">1 · Quién va esta semana</h2>

            <div className="gp-evento" aria-labelledby="t-entreno">
              <div className="gs-bloque-cab">
                <h3 id="t-entreno">Entreno del miércoles</h3>
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
                  <Link href={`/gestion/eventos/${respEntreno.id}/respuestas`} data-testid="enlace-respuestas" className="gp-enlace">Ver respuestas y motivos →</Link>
                </div>
              ) : entreno ? (
                <p className="suave" style={{ margin: 0 }} data-testid="entreno-sin-respuestas">Aún nadie ha respondido a este entreno.</p>
              ) : null}
              {respEntreno && <AccionesFaltan id={respEntreno.id} sin={respEntreno.sin} mensaje={respEntreno.mensaje} />}
              {entreno && <PorDefectoEntreno eventoId={entreno.id} porDefecto={porDefecto} quitados={quitadosEntreno} />}
              {respEntreno && <AvisoSinFicha personas={respEntreno.sinFicha} pista={entreno?.solo_con_ficha_en} />}
            </div>

            <div className="gp-evento" aria-labelledby="t-prox">
              <div className="gs-bloque-cab">
                <h3 id="t-prox">Partidos del domingo</h3>
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
                        const g = gruposConvocados(e);
                        return (
                          <tr key={e.id} className="eq-partido" data-equipo={e.equipo}>
                            <td><span className={`chip-eq chip-${e.equipo}`}>{NOMBRE_EQUIPO[e.equipo!]}</span></td>
                            <td style={{ fontWeight: 600 }}>{enlaceRival(liga, e)}</td>
                            <td className="cifra" style={{ whiteSpace: "nowrap" }}>{e.inicio ?? "¿?"} · P{e.partido?.campo ?? "?"}</td>
                            <td data-label="Equipación">{chip ? <span className={`pastilla pastilla-${chip.tipo}`}>{chip.texto}</span> : <span className="pastilla">Negra</span>}</td>
                            <td data-label="Respuestas" className={r?.hay ? "ev-celda-resp" : undefined}>
                              {r?.hay ? <CuentasRespuestas id={r.id} grupos={r.grupos} nombre={cruce(e)} dudas={r.dudas} /> : r ? <Link href={`/gestion/eventos/${r.id}/respuestas`} className="tenue">Sin respuestas</Link> : <span className="suave">—</span>}
                              {r && <AccionesFaltan id={r.id} sin={r.sin} mensaje={r.mensaje} />}
                            </td>
                            <td data-label="Convocados">
                              {g && <Numeros variante="linea" prueba={`convocados-${e.id}`} etiqueta={`Convocados del ${NOMBRE_EQUIPO[e.equipo!]}`} grupos={g} />}
                              <Link href={`/gestion/convocatoria?fecha=${e.fecha}`} className={fila ? undefined : "tenue"} style={{ display: "block" }}>{convocados(e)}</Link>
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
                        {s && <ClavesTarjeta res={s.claves} />}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {otros.length > 0 && (
              <div className="gp-evento" aria-labelledby="t-otros" data-testid="gp-otros">
                <h3 id="t-otros">Más esta semana</h3>
                <ul className="gp-lista">
                  {otros.map((e) => {
                    const r = cuentas(e);
                    return (
                      <li key={e.id} data-evento={e.id}>
                        <b>{diaYNumero(e.fecha)} · {hhmm(e.inicio) ?? "hora por confirmar"} · {tituloEvento(e)}</b>
                        {r.hay ? <CuentasRespuestas id={r.id} grupos={r.grupos} nombre={tituloEvento(e)} dudas={r.dudas} /> : <Link href={`/gestion/eventos/${e.id}/respuestas`} className="tenue">Sin respuestas</Link>}
                        <AccionesFaltan id={r.id} sin={r.sin} mensaje={r.mensaje} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          {/* ------------------------------------------------ 2 · Convocatoria del domingo */}
          <section className="gs-bloque" aria-labelledby="t-conv" data-testid="gp-convocatoria">
            <div className="gs-bloque-cab">
              <h2 id="t-conv">2 · Convocatoria del domingo</h2>
              {fecha && <span className={`pastilla ${estadoConv.clase}`} data-testid="gp-estado-conv">{estadoConv.texto}</span>}
            </div>
            {fecha && rev ? (
              <>
                <p className="pequeno suave" style={{ margin: 0 }}>
                  {jornada ? `J${jornada} · ` : ""}{diaSemanaCorto(fecha)} {diaMes(fecha)} · {mismaHora ? "los dos a la misma hora" : delDomingo.length === 2 ? `MdA ${delDomingo.find((e) => e.equipo === "MDA")?.inicio ?? "?"} · MdL ${delDomingo.find((e) => e.equipo === "MDL")?.inicio ?? "?"}` : delDomingo.length === 1 ? `solo juega el ${NOMBRE_EQUIPO[delDomingo[0].equipo!]}` : ""}
                  {!empezada ? " · propuesta del motor (sin guardar)" : ""}
                </p>
                <Numeros variante="cajas" columnas={Math.max(1, (ctx?.partidos.length ?? 0) + 1)} prueba="gp-conv-numeros" etiqueta="Convocados por equipo y quién se queda fuera"
                  grupos={[...(ctx?.partidos ?? []).map((p) => gruposEquipo(p.equipo)), ...gruposFuera]} />
                <Link className="boton boton-amarillo boton-bloque" href={`/gestion/convocatoria?fecha=${fecha}`}>{fila?.estado === "aprobada" ? "Ver la convocatoria" : "Preparar la convocatoria"}</Link>
              </>
            ) : <p className="suave" style={{ margin: 0 }}>No quedan partidos de liga en el calendario.</p>}

            <div className="gp-sub" data-testid="gp-grupos">
              <div className="gs-bloque-cab">
                <h3>Grupos del miércoles</h3>
                {grupoMiercoles && <span className={`pastilla ${grupoMiercoles.publicado ? "pastilla-ok" : grupoMiercoles.repartos ? "pastilla-pendiente" : ""}`}>{grupoMiercoles.publicado ? "Publicados" : grupoMiercoles.repartos ? "Sin publicar" : "Sin hacer"}</span>}
              </div>
              {grupoMiercoles ? (
                <p className="pequeno" style={{ margin: 0 }}>
                  {diaSemanaCorto(grupoMiercoles.fecha)} {diaMes(grupoMiercoles.fecha)} · {hhmm(grupoMiercoles.inicio)} · {grupoMiercoles.repartos} {grupoMiercoles.repartos === 1 ? "reparto" : "repartos"}
                  {" · "}<Link href={`/gestion/grupos/${grupoMiercoles.id}`}>Grupos ›</Link>
                </p>
              ) : <p className="suave" style={{ margin: 0 }}>No quedan entrenos en el calendario.</p>}
            </div>
          </section>
        </div>

        <div className="gs-der">
          {/* ------------------------------------------------ 3 · Pendiente */}
          <section className="gs-bloque" aria-labelledby="t-pendiente" data-testid="gp-pendiente">
            <h2 id="t-pendiente">3 · Pendiente</h2>
            {pendientes.length ? <ul className="gs-pendientes">{pendientes.map((p) => <li key={p.texto}><Link href={p.href}>{p.texto}</Link></li>)}</ul> : <p className="suave" style={{ margin: 0 }}>Nada pendiente esta semana.</p>}

            <ul className="gp-filas">
              <li data-testid="gp-clasificacion">
                <span>Clasificación oficial</span>
                {porContrastar ? <Link href="/gestion/clasificacion">Contrastar ›</Link> : <span className="pastilla pastilla-ok">Contrastada</span>}
              </li>
              <li data-testid="gp-calendario">
                <span>Cambios del calendario</span>
                <Link href="/gestion/eventos/importar">{ultimaImportacion ? `Última importación ${ddmm(ultimaImportacion.en)}` : "Importar"} ›</Link>
              </li>
              {cambiosCal.map((e) => (
                <li key={e.id} className="gp-fila-sub"><span className="pequeno">{diaYNumero(e.fecha)} · {tituloEvento(e)}</span><Link href={`/gestion/eventos/${e.id}`} className="pequeno">cambiado {ddmm(e.cambio_visible_en!)} ›</Link></li>
              ))}
              <li data-testid="gp-planes">
                <span>Planes de jugadores</span>
                <Link href="/gestion/eventos?f=planes">{planes.length} {planes.length === 1 ? "plan" : "planes"} ›</Link>
              </li>
              {planes.slice(0, 3).map((e) => (
                <li key={e.id} className="gp-fila-sub"><span className="pequeno">{diaYNumero(e.fecha)} · {tituloEvento(e)}</span><Link href={`/planes/${e.id}`} className="pequeno">ver ›</Link></li>
              ))}
            </ul>

            {viva && <TarjetaAvisos inicial={viva} />}

            <div className="gp-rutinas" data-testid="gp-rutinas">
              <h3>Rutinas</h3>
              <ul className="gp-filas">
                <li><span>A · Actas y estadísticas</span>{sinActa.length ? <span className="pastilla etiqueta-aviso">Esperando FBM</span> : <span className="pastilla pastilla-ok">{resultados.length ? `J${resultados[0].jornada ?? "?"} publicada` : "Al día"}</span>}</li>
                <li><span>B · Calendario y clasificación</span><span className="pastilla">jueves 20:15</span></li>
                <li><span>C · Convocatoria</span><span className={`pastilla ${propuestaLista ? "pastilla-pendiente" : ""}`}>{propuestaLista ? "propuesta lista" : "martes 12:00"}</span></li>
              </ul>
            </div>
          </section>

          {/* ------------------------------------------------ Plantilla y club */}
          <section className="gs-bloque" aria-labelledby="t-plantilla" data-testid="gp-plantilla">
            <h2 id="t-plantilla">Plantilla y club</h2>
            <nav aria-label="Pantallas de gestión">
              <ul className="gp-menu">
                <li><Link href="/gestion/jugadores"><b>Jugadores</b><small>{js.filter((j) => j.activo && j.rol !== "entrenador").length} en la plantilla · niveles, fichas, accesos y teléfonos</small></Link></li>
                <li><Link href="/gestion/no-convocados"><b>No convocados</b><small>quién lleva más tiempo fuera</small></Link></li>
                <li><Link href="/gestion/asistencia"><b>Asistencia y motivos</b><small>quién viene y por qué falta</small></Link></li>
                <li><Link href="/gestion/ropa"><b>Pedido de ropa</b><small>{ropa && campana ? `${ropa.texto.toLowerCase()} · ${pedidos ?? 0} ${pedidos === 1 ? "pedido" : "pedidos"}` : "sin campaña"}</small></Link></li>
                <li><Link href="/gestion/eventos"><b>Todos los eventos</b><small>próximos, pasados, entrenos, liga, amistosos y planes</small></Link></li>
                <li><Link href="/gestion/convocatoria"><b>Convocatoria</b><small>reparto MdA / MdL y mensaje</small></Link></li>
                <li><Link href="/gestion/convocatoria/datos"><b>Datos de los jugadores</b><small>posición, nivel, reservas y reglas</small></Link></li>
                <li><Link href="/gestion/tablero"><b>Tablero</b><small>quién va de un vistazo y ajustes a mano</small></Link></li>
                <li><Link href="/gestion/grupos"><b>Grupos de entreno</b><small>repartos del miércoles</small></Link></li>
                <li><Link href="/gestion/eventos/pistas"><b>Pistas</b><small>habituales, en obras y de partido</small></Link></li>
                <li><Link href="/gestion/eventos/importar"><b>Importar calendario</b><small>cambios del Ayuntamiento</small></Link></li>
                <li><Link href="/gestion/telefonos"><b>Importar teléfonos</b><small>contacto de WhatsApp de cada jugador</small></Link></li>
                <li><Link href="/gestion/clasificacion"><b>Contrastar clasificación</b><small>la oficial frente a la calculada</small></Link></li>
                <li><Link href="/liga/scouting"><b>Scouting rivales</b><small>próximo rival y sus anotadores</small></Link></li>
                <li><Link href="/liga/consolidada"><b>Liga consolidada</b><small>todos los jugadores de la liga</small></Link></li>
                <li><span className="gp-desactivada" aria-disabled="true"><b>Tesorería</b><small>por construir</small></span></li>
              </ul>
            </nav>
            <div className="gp-acciones">
              <Link className="boton boton-amarillo" href="/gestion/eventos/nuevo">+ Nuevo evento</Link>
              {entreno?.serie && <Link className="boton boton-contorno" href={`/gestion/eventos/${entreno.id}?alcance=siguientes`}>Entreno semanal</Link>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
