import type { Metadata } from "next";
import Link from "next/link";
import { exigirSesion } from "@/lib/sesion";
import { cargarMiZona } from "./datos";
import { anularPedidoJugador } from "./acciones";
import { salir } from "@/app/entrar/acciones";
import { PRENDAS, type PrendaId, type Pedido } from "@/lib/ropa";
import BotonConfirmar from "@/components/BotonConfirmar";
import { fechaCorta } from "@/lib/fechas";
import { fichaEstadisticas } from "@/lib/mensajes";
import SinZona from "./SinZona";
import { Camiseta as ColorRival } from "@/components/ProximoPartido";
import AvisoTarjeta from "@/components/AvisoTarjeta";
import { Escudo } from "@/components/web/Marco";
import { Bolsa, Calendario, Camiseta, Casa, Flecha, Persona } from "@/components/Iconos";
import { descansaEl, eventosTemporada, proximosPartidos, temporadaDe, type Equipo, type Evento } from "@/lib/publico";
import { diaMes, diaSemanaCorto, hoyMadrid } from "@/lib/dias";
import { NOMBRE_EQUIPO } from "@/lib/web";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const zona = await cargarMiZona();
  return {
    title: zona ? `${zona.jugador.nombre_visible} · Maccabis` : "Maccabis",
    manifest: zona ? "/mi-zona/manifest.webmanifest" : undefined,
  };
}

function TablaPedido({ pedido }: { pedido: Pedido }) {
  const prendas = PRENDAS.filter((x) => pedido.tallas[x.id as PrendaId]);
  return (
    <div className="tabla-desplazable">
      <table>
        <thead>
          <tr><th>Prenda</th><th>Nombre</th><th>Número</th><th>Talla</th></tr>
        </thead>
        <tbody>
          {prendas.map((x) => (
            <tr key={x.id}>
              <td>{x.nombre}</td>
              <td className={x.llevaNombre ? "" : "suave"}>{x.llevaNombre ? pedido.nombre_ropa : "Sin nombre"}</td>
              <td className={x.llevaDorsal ? "" : "suave"}>{x.llevaDorsal ? pedido.dorsal : "Sin número"}</td>
              <td>{pedido.tallas[x.id]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Fecha({ f }: { f: string }) {
  return <div className="mz-fecha"><small>{diaSemanaCorto(f)}</small><b>{+f.slice(8)}</b></div>;
}

/** "MdA – Litros de Mahou" (el local primero, como en el calendario oficial). */
const cruce = (e: Evento) => { const n = NOMBRE_EQUIPO[e.equipo!]; return e.local ? `${n} – ${e.rival}` : `${e.rival} – ${n}`; };

// Mi zona (maqueta MiZona, D76). "Tu agenda" solo con datos que ya existen: calendario, entrenos, avisos de equipacion y
// partidos jugados. Disponibilidad y convocatoria salen como "pendiente" hasta el paso 2 (siguen en SportEasy).
export default async function MiZona({ searchParams }: { searchParams: Promise<{ guardado?: string; no_gestor?: string }> }) {
  const { guardado, no_gestor } = await searchParams;
  const { supabase, user } = await exigirSesion();
  const zona = await cargarMiZona();
  if (!zona) return <SinZona />;
  const { data: esGestor } = await supabase.rpc("is_gestor");

  const { jugador, campana, pedidos } = zona;
  const deEstaCampana = pedidos.filter((x) => x.campana_id === campana?.id);
  const anteriores = pedidos.filter((x) => x.campana_id !== campana?.id);
  // Equipos del jugador; sin datos de equipo (mi_zona antigua): los dos.
  const suyos = (["MDA", "MDL"] as const).filter((e) => (e === "MDA" ? jugador.ficha_mda : jugador.ficha_mdl));
  const equipos: Equipo[] = suyos.length ? [...suyos] : ["MDA", "MDL"];
  const dobla = suyos.length === 2;
  const hoy = hoyMadrid();

  // Proximo domingo con partido suyo: todos sus partidos de esa fecha.
  const proximos = proximosPartidos(hoy, equipos);
  const fechaDomingo = proximos.map((p) => p.evento.fecha).sort()[0];
  const delDomingo = proximos.filter((p) => p.evento.fecha === fechaDomingo).map((p) => p.evento);
  const descansan = fechaDomingo ? descansaEl(fechaDomingo).filter((e) => equipos.includes(e)) : [];
  const mismaHora = delDomingo.length === 2 && delDomingo[0].inicio && delDomingo[0].inicio === delDomingo[1].inicio;
  const conAviso = delDomingo.filter((e) => e.aviso?.hay);

  // Agenda: los 3 proximos eventos suyos (entrenos y partidos de sus equipos) y lo ultimo que jugo.
  const agenda = eventosTemporada().filter((e) => e.fecha >= hoy && (e.tipo === "entreno" || equipos.includes(e.equipo!))).slice(0, 3);
  const temporada = temporadaDe(jugador.person_id);
  const jugados = temporada?.partidos.filter((p) => p.fecha && p.fecha <= hoy) ?? [];
  const ultimaFecha = jugados.map((p) => p.fecha!).sort().at(-1);
  const ultimos = jugados.filter((p) => p.fecha === ultimaFecha);
  const dorsal = temporada?.dorsales[0];

  return (
    <div className="tema-oscuro">
      <div className="mz" id="inicio">
        <header className="mz-cab">
          <Link href="/" className="mz-escudo" aria-label="Ir a la web de Maccabis"><Escudo decorativo /></Link>
          <span className="mz-cab-titulo">Mi zona</span>
          {esGestor && <Link className="mz-enlace" href="/gestion">Gestión</Link>}
          <form action={salir}><button type="submit">Salir</button></form>
        </header>

        {guardado && <div className="aviso aviso-ok" role="status" style={{ margin: "12px 16px 0" }}>Pedido guardado. Puedes cambiarlo mientras el pedido siga abierto.</div>}
        {no_gestor && <div className="aviso aviso-info" role="status" style={{ margin: "12px 16px 0" }}>Tu cuenta no tiene permisos de gestión.</div>}

        <section className="mz-hola">
          <h1><small>Hola,</small>{" "}{jugador.nombre_visible}</h1>
          <div className="mz-chips">
            {suyos.map((e) => <span key={e} className={`chip-eq chip-${e}`}>{NOMBRE_EQUIPO[e]}</span>)}
            {(dorsal || dobla) && <span className="pastilla" style={{ background: "transparent", border: "1px solid var(--borde-fuerte)", fontWeight: 600 }}>{[dorsal ? `#${dorsal}` : null, dobla ? "doblas" : null].filter(Boolean).join(" · ")}</span>}
          </div>
        </section>

        <section className="mz-sec" aria-labelledby="t-agenda">
          <div className="mz-sec-cab">
            <h2 id="t-agenda">Tu agenda</h2>
            <Link href="/#calendario" className="pequeno" style={{ fontWeight: 600 }}>Calendario completo</Link>
          </div>
          <div className="mz-lista">
            {agenda.map((e) => (
              <div key={e.id} className="mz-fila" data-tipo={e.tipo}>
                <Fecha f={e.fecha} />
                <div className="mz-que">
                  <strong>{e.tipo === "entreno" ? "Entrenamiento" : `J${e.jornada} · ${cruce(e)}`}</strong>
                  <span>
                    {e.inicio ? (e.tipo === "entreno" ? `${e.inicio}–${e.fin}` : e.inicio) : "Hora por confirmar"} ·{" "}
                    {e.tipo === "entreno" ? (e.pistaPorConfirmar ? `pista por confirmar${e.nota ? ` (${e.nota})` : ""}` : `${e.lugar}${e.nota ? ` (${e.nota.replace(/\.$/, "").toLowerCase()})` : ""}`) : e.lugar}
                  </span>
                </div>
                <span className="pastilla pastilla-pendiente">{e.tipo === "entreno" ? "Respuesta: pendiente" : "Convocatoria: pendiente"}</span>
              </div>
            ))}
            {ultimos.length > 0 && (
              <div className="mz-fila pasado" data-tipo="jugado">
                <Fecha f={ultimaFecha!} />
                <div className="mz-que">
                  <strong>{ultimos[0].jornada ? `J${ultimos[0].jornada} · ` : ""}jugaste con {ultimos.map((p) => NOMBRE_EQUIPO[p.equipo]).join(" y ")}</strong>
                  <span>
                    {(() => { const v = ultimos.filter((p) => p.pf != null && p.pc != null && p.pf > p.pc).length; return v === ultimos.length ? `${v === 1 ? "victoria" : `${v} victorias`}` : `${v} de ${ultimos.length} ganados`; })()}
                    {" · "}{ultimos.reduce((s, p) => s + p.pts, 0)} puntos
                  </span>
                </div>
                <span className="pastilla pastilla-jugo">Jugó</span>
              </div>
            )}
            {!agenda.length && !ultimos.length && <div className="mz-fila"><span className="suave">No hay nada en el calendario.</span></div>}
          </div>
          <p className="mz-nota">Tu disponibilidad y la convocatoria llegarán aquí más adelante; mientras, se responde en SportEasy.</p>
        </section>

        <section className="mz-sec" aria-labelledby="t-partidos">
          <h2 id="t-partidos">{fechaDomingo ? `Próximo partido · ${diaSemanaCorto(fechaDomingo)} ${diaMes(fechaDomingo)}` : "Próximos partidos"}</h2>
          {delDomingo.length ? (
            <>
              <article className="mz-lista mz-domingo">
                <div className="mz-sec-cab">
                  <span className="cifra pequeno suave">J{delDomingo[0].jornada} · {[...new Set(delDomingo.map((e) => e.inicio ?? "hora por confirmar"))].join(" y ")}</span>
                  <span className="pastilla pastilla-pendiente">Convocatoria: pendiente</span>
                </div>
                {mismaHora && <p className="suave" style={{ margin: 0 }}>MdA y MdL juegan a la misma hora: esta jornada no se puede doblar.</p>}
                {descansan.length > 0 && <p className="suave" style={{ margin: 0 }}>{descansan.map((e) => NOMBRE_EQUIPO[e]).join(" y ")} descansa esta jornada.</p>}
                <div className="mz-partidos">
                  {delDomingo.map((e) => (
                    <div key={e.id} className="mz-partido eq-partido" data-equipo={e.equipo}>
                      <b>{cruce(e)}</b>
                      <span>{e.lugar} · {e.local ? "en casa" : "fuera"}</span>
                      {e.rival && <span><ColorRival rival={e.rival} /></span>}
                    </div>
                  ))}
                </div>
                <div className="mz-dato"><span>Tu disponibilidad</span><span className="pastilla pastilla-pendiente">Pendiente: en SportEasy</span></div>
              </article>
              <article className={`mz-equipacion ${conAviso.length ? "alerta" : "calma"}`} aria-label="Equipación del domingo">
                <Camiseta />
                <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                  <strong>Equipación del domingo</strong>
                  {conAviso.length === 0 && <span>Jugamos de negro{delDomingo.length > 1 ? " en los dos partidos" : ""}: sin choque de color.</span>}
                  {conAviso.map((e) => (
                    <div key={e.id}>
                      <AvisoTarjeta aviso={e.aviso} />
                    </div>
                  ))}
                  {conAviso.length > 0 && delDomingo.length > conAviso.length && (
                    <span className="pequeno">{delDomingo.filter((e) => !e.aviso?.hay).map(cruce).join(", ")}: negra, sin choque.</span>
                  )}
                </div>
              </article>
            </>
          ) : <p className="suave" style={{ margin: 0 }}>No quedan partidos de liga en el calendario.</p>}
        </section>

        <section className="mz-sec" id="ropa" aria-labelledby="t-ropa">
          <h2 id="t-ropa">Pedido de ropa</h2>
          {campana?.abierta_ahora && (
            <Link href="/mi-zona/ropa/nuevo" className="mz-ropa">
              <span className="mz-ropa-icono"><Bolsa size={24} /></span>
              <span style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", gap: 2 }}>
                <strong>Pedido de ropa abierto</strong>
                <span className="pequeno tenue">{campana.fecha_limite ? `Hasta el ${fechaCorta(campana.fecha_limite)}` : "Mientras siga abierto"} · {campana.nombre}</span>
              </span>
              <Flecha />
            </Link>
          )}
          <div className="tarjeta" style={{ margin: 0 }}>
            {!campana ? (
              <p className="suave" style={{ margin: 0 }}>Ahora mismo no hay ningún pedido de ropa.</p>
            ) : (
              <>
                <p style={{ marginBottom: 6 }}>
                  <strong>{campana.nombre}</strong> · {campana.proveedor}{" "}
                  {campana.abierta_ahora
                    ? <span className="etiqueta etiqueta-abierta">Abierto</span>
                    : <span className="etiqueta etiqueta-cerrada">Cerrado</span>}
                </p>
                {campana.abierta_ahora ? (
                  <>
                    <p className="suave">
                      {campana.fecha_limite ? `Puedes pedir o cambiar tus pedidos hasta el ${fechaCorta(campana.fecha_limite)}.` : "Puedes pedir o cambiar tus pedidos mientras siga abierto."}
                      {" "}Cada pedido es para una persona: tú o un familiar.
                    </p>
                    <p className="pequeno suave">
                      Precios orientativos, por confirmar: {PRENDAS.filter((x) => campana.precios[x.id] != null).map((x) => `${x.nombre.toLowerCase()} unos ${campana.precios[x.id]} €`).join(", ")}. No se paga por aquí.
                    </p>
                    <Link className="boton boton-amarillo boton-bloque" href="/mi-zona/ropa/nuevo">
                      {deEstaCampana.length ? "Hacer otro pedido" : "Hacer mi pedido"}
                    </Link>
                  </>
                ) : (
                  <p className="suave" style={{ margin: 0 }}>
                    {campana.estado === "abierta" && campana.fecha_limite
                      ? `El plazo terminó el ${fechaCorta(campana.fecha_limite)}.`
                      : "El pedido está cerrado."}{" "}
                    {deEstaCampana.length ? "Tus pedidos ya no se pueden cambiar." : "No hiciste ningún pedido."}
                  </p>
                )}
              </>
            )}
          </div>
          <div className="tarjeta" style={{ margin: 0 }} aria-labelledby="t-pedidos">
            <h3 id="t-pedidos" style={{ textTransform: "uppercase" }}>Mis pedidos</h3>
            {pedidos.length === 0 && <p className="suave" style={{ margin: 0 }}>Aún no has hecho ningún pedido.</p>}
            {[...deEstaCampana, ...anteriores].map((x) => (
              <article key={x.id} style={{ borderTop: "1px solid var(--borde)", paddingTop: 12, marginTop: 12 }}>
                <h3 style={{ marginBottom: 2 }}>{x.para === "yo" ? "Para mí" : `Para ${x.nombre_completo}`}</h3>
                <p className="pequeno suave" style={{ marginBottom: 6 }}>
                  {x.campana_nombre}{x.para === "yo" ? ` · ${x.nombre_completo}` : " · familiar"}
                </p>
                <TablaPedido pedido={x} />
                {x.campana_abierta && (
                  <div className="botones">
                    <Link className="boton boton-claro" href={`/mi-zona/ropa/${x.id}`}>Modificar</Link>
                    <form action={anularPedidoJugador.bind(null, x.id)}>
                      <BotonConfirmar className="boton boton-peligro" pregunta="¿Seguro que quieres anular este pedido?">Anular pedido</BotonConfirmar>
                    </form>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="mz-sec" aria-labelledby="t-stats">
          <div className="mz-sec-cab">
            <h2 id="t-stats">Tu temporada</h2>
            {temporada && <span className="mono tenue">26/27 · {temporada.pj} {temporada.pj === 1 ? "partido" : "partidos"}</span>}
          </div>
          {temporada && temporada.pj > 0 ? (
            <>
              <div className="mz-cifras">
                <div className="mz-cifra"><b>{temporada.tot.pts}</b><span>puntos · {(temporada.tot.pts / temporada.pj).toLocaleString("es-ES", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} por partido</span></div>
                <div className="mz-cifra"><b>{temporada.pj}</b><span>partidos{temporada.minutos ? ` · ${temporada.minutos} min` : ""}</span></div>
                <div className="mz-cifra"><b>{temporada.tot.p2a}</b><span>canastas de 2{temporada.tot.p3a ? ` · ${temporada.tot.p3a} triples` : ""}</span></div>
                <div className="mz-cifra"><b>{temporada.tot.tla}/{temporada.tot.tli}</b><span>tiros libres{temporada.tot.tli ? ` · ${Math.round((100 * temporada.tot.tla) / temporada.tot.tli)} %` : ""}</span></div>
              </div>
              <div className="mz-lista">
                {temporada.partidos.map((p, i) => (
                  <div key={i} className="mz-fila" style={{ justifyContent: "space-between" }}>
                    <span className="pequeno"><strong>{NOMBRE_EQUIPO[p.equipo]}</strong> {p.local ? "vs" : "en"} {p.rival}{p.pf != null && p.pc != null ? ` · ${p.pf > p.pc ? "G" : "P"} ${p.pf}-${p.pc}` : ""}</span>
                    <span className="cifra">{p.pts} pts</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="suave" style={{ margin: 0 }}>Aún no tienes partidos con estadísticas esta temporada.</p>}
          <a href={fichaEstadisticas(jugador.person_id)} style={{ fontWeight: 600, minHeight: 44, display: "inline-flex", alignItems: "center" }}>Ver tu ficha completa →</a>
        </section>

        <section className="mz-sec" id="cuenta" aria-labelledby="t-cuenta" style={{ paddingBottom: 24 }}>
          <h2 id="t-cuenta">Mi cuenta</h2>
          <div className="tarjeta" style={{ margin: 0 }}>
            <p style={{ margin: 0 }}>Entras con <strong>{user.email}</strong> (Google o código por correo).</p>
            <div className="botones">
              {esGestor && <Link className="boton boton-claro" href="/gestion">Ir a gestión</Link>}
              <form action={salir}><button className="boton boton-claro" type="submit">Salir</button></form>
            </div>
          </div>
          <p className="pie" style={{ marginTop: 8 }}>¿Algo no cuadra? Habla con Iván, Carlos o Edu. · <Link href="/privacidad">Privacidad</Link></p>
        </section>

        <nav aria-label="Mi zona" className="mz-barra">
          <a href="#inicio" aria-current="page"><Casa />Inicio</a>
          <Link href="/#calendario"><Calendario />Partidos</Link>
          <a href="#ropa"><Bolsa />Ropa</a>
          <a href="#cuenta"><Persona />Mi cuenta</a>
        </nav>
      </div>
    </div>
  );
}
