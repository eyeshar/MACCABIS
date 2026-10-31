import Link from "next/link";
import Volver from "@/components/nav/Volver";
import CuentasRespuestas from "@/components/gestion/CuentasRespuestas";
import { gruposEvento, lineaDudas, sinFichaQueVan, type RespuestaPersona } from "@/lib/numeros/respuestas";
import AvisoSinFicha from "@/components/numeros/AvisoSinFicha";
import { exigirGestor } from "@/lib/sesion";
import { chipEquipacion } from "@/lib/publico";
import { diaYNumero, hoyMadrid } from "@/lib/dias";
import { fechaHora } from "@/lib/fechas";
import { avisoDeEvento, cargarEventos, cargarJugadores, cargarPistas } from "@/lib/eventos/datos";
import { cargarDefecto } from "@/lib/convocatoria/defecto";
import type { Defecto } from "@/lib/disponibilidad/porDefecto";
import {
  esPlanFila, hhmm, pistaEfectiva, rangoHoras, TEXTO_ESTADO_PISTA, textoTipo, tituloEvento,
  type EventoFila, type JugadorBasico, type Pista,
} from "@/lib/eventos/dominio";

export const metadata = { title: "Eventos · Gestión Maccabis" };

const FILTROS = [
  { id: "proximos", texto: "Próximos" },
  { id: "entrenos", texto: "Entrenos" },
  { id: "liga", texto: "Liga" },
  { id: "amistosos", texto: "Amistosos y torneos" },
  { id: "pasados", texto: "Pasados" },
  // D118: los planes no oficiales de los jugadores (no cuentan para nada del club; aqui se ven, se editan o se hacen oficiales).
  { id: "planes", texto: "Planes de jugadores" },
] as const;
type Filtro = (typeof FILTROS)[number]["id"];

const MAX_PROXIMOS = 30;

export default async function Eventos({ searchParams }: { searchParams: Promise<{ f?: string; borrado?: string }> }) {
  const { f, borrado } = await searchParams;
  const filtro: Filtro = FILTROS.some((x) => x.id === f) ? (f as Filtro) : "proximos";
  const { supabase } = await exigirGestor();
  const hoy = hoyMadrid();
  const [todos, pistas, jugadores, { data: filasResp }, { data: importaciones }, defecto] = await Promise.all([
    cargarEventos(supabase, { conPlanes: true }), cargarPistas(supabase), cargarJugadores(supabase),
    supabase.from("respuestas").select("evento_id, person_id, respuesta, motivo, detalle"),
    // Solo las del calendario del Ayuntamiento (las respuestas ya no se importan).
    supabase.from("importaciones").select("id, por_nombre, en, lineas, aceptadas, bloqueadas").eq("tipo", "calendario").order("en", { ascending: false }).limit(4),
    cargarDefecto(supabase),
  ]);
  // Los planes no oficiales (D118) solo salen en su filtro: el resto de la pantalla es lo del club.
  const eventos = todos.filter((e) => !esPlanFila(e));
  const resp = new Map<string, RespuestaPersona[]>();
  for (const r of (filasResp ?? []) as (RespuestaPersona & { evento_id: string })[]) resp.set(r.evento_id, [...(resp.get(r.evento_id) ?? []), r]);

  const planes = todos.filter((e) => esPlanFila(e) && e.fecha >= hoy);
  const futuros = eventos.filter((e) => e.fecha >= hoy);
  const sinPista = futuros.filter((e) => e.tipo === "entreno" && e.estado === "programado" && pistaEfectiva(e, pistas).porConfirmar);

  const lista = ((): EventoFila[] => {
    switch (filtro) {
      case "entrenos": return futuros.filter((e) => e.tipo === "entreno");
      case "liga": return eventos.filter((e) => e.tipo === "liga");
      case "amistosos": return eventos.filter((e) => ["amistoso", "torneo", "interno"].includes(e.tipo));
      case "pasados": return eventos.filter((e) => e.fecha < hoy).reverse();
      case "planes": return planes;
      default: return futuros.slice(0, MAX_PROXIMOS);
    }
  })();
  const cuenta: Record<Filtro, number> = {
    proximos: futuros.length, entrenos: futuros.filter((e) => e.tipo === "entreno").length, liga: eventos.filter((e) => e.tipo === "liga").length,
    amistosos: eventos.filter((e) => ["amistoso", "torneo", "interno"].includes(e.tipo)).length, pasados: eventos.filter((e) => e.fecha < hoy).length,
    planes: planes.length,
  };
  const proximoEntreno = futuros.find((e) => e.tipo === "entreno" && e.estado === "programado" && e.serie);
  const habitual = pistas.find((p) => p.es_de_serie && p.uso === "entreno");
  const primeraSinPista = sinPista[0];

  return (
    <>
      <Volver defecto="/gestion" etiqueta="Panel" />
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

      {borrado && <div className="aviso aviso-ok" role="status">Plan borrado. A quien lo organizaba le ha llegado un aviso.</div>}
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
                {x.texto} {(x.id === "pasados" || x.id === "planes") && cuenta[x.id] > 0 && <small>{cuenta[x.id]}</small>}
              </Link>
            ))}
          </nav>
          {lista.length === 0 ? <p className="suave" style={{ margin: 0 }}>No hay eventos en esta vista.</p> : (
            <div className="tabla-desplazable">
              <table className="gs-tabla ev-tabla" data-testid="tabla-eventos">
                <thead><tr><th>Fecha</th><th>Evento</th><th>Pista</th><th>Respuestas</th></tr></thead>
                <tbody>
                  {lista.map((e) => <Fila key={e.id} e={e} pistas={pistas} respuestas={resp.get(e.id) ?? []} jugadores={jugadores} defecto={defecto} />)}
                </tbody>
              </table>
            </div>
          )}
          {filtro === "proximos" && futuros.length > MAX_PROXIMOS && <p className="pequeno suave" style={{ margin: 0 }}>Se ven los próximos {MAX_PROXIMOS} de {futuros.length}. Para el resto, usa los filtros (Entrenos, Liga…).</p>}
        </section>

        <aside className="gs-der ev-lateral" aria-label="Pistas e importaciones" style={{ flex: "1 1 300px" }}>
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

          <section className="gs-bloque" aria-labelledby="t-importaciones" data-testid="ultimas-importaciones">
            <div className="gs-bloque-cab"><h2 id="t-importaciones" style={{ fontSize: 22 }}>Calendario importado</h2><Link href="/gestion/eventos/importar" style={{ fontWeight: 600, fontSize: 14 }}>Importar</Link></div>
            {(importaciones ?? []).length === 0 ? <p className="pequeno suave" style={{ margin: 0 }}>Todavía no se ha importado el calendario del Ayuntamiento.</p> : (
              <ul className="gs-pendientes">
                {(importaciones ?? []).map((i) => (
                  <li key={i.id}><span>{fechaHora(i.en)} · {i.por_nombre}<br /><span className="suave">{i.lineas} líneas, {i.aceptadas} {i.aceptadas === 1 ? "cambio aplicado" : "cambios aplicados"}{i.bloqueadas ? `, ${i.bloqueadas} con error` : ""}</span></span></li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

function Fila({ e, pistas, respuestas, jugadores, defecto }: { e: EventoFila; pistas: Pista[]; respuestas: RespuestaPersona[]; jugadores: JugadorBasico[]; defecto: Defecto }) {
  const pe = pistaEfectiva(e, pistas);
  const aviso = chipEquipacion(avisoDeEvento(e));
  const cancelado = e.estado === "cancelado";
  const sinPista = !cancelado && e.tipo === "entreno" && pe.porConfirmar;
  const quedada = hhmm(e.quedada);
  const equipoClase = e.tipo === "liga" ? `ev-tipo-${e.equipo}` : "";
  return (
    <tr className={`${cancelado ? "ev-cancelado" : ""} ${sinPista ? "ev-sin-pista" : ""}`} data-evento={e.clave}>
      <td data-label="Fecha">
        <strong>{diaYNumero(e.fecha)}</strong>
        <div className="ev-hora">{rangoHoras(e)}{e.tipo === "liga" && quedada ? ` · encuentro ${quedada}` : ""}</div>
      </td>
      <td data-label="Evento">
        <span className={`ev-tipo ${equipoClase}`}>{e.tipo === "liga" ? `${e.equipo}${e.jornada ? ` · J${e.jornada}` : ""}` : textoTipo(e.tipo).toUpperCase()}</span>
        {esPlanFila(e) && <span className="pl-etq-plan" style={{ marginLeft: 6 }}>Plan no oficial</span>}
        {cancelado && <span className="ev-tipo" style={{ marginLeft: 6, background: "var(--error-fondo)", color: "var(--error)" }}>CANCELADO</span>}
        <span className="ev-titulo"><Link href={esPlanFila(e) ? `/planes/${e.id}` : `/gestion/eventos/${e.id}`}>{tituloEvento(e)}</Link></span>
        {e.notas && <span className="ev-sub">{e.notas}</span>}
        {aviso && <span className="ev-sub ev-sub-info">{aviso.texto}</span>}
      </td>
      <td data-label="Pista">
        {pe.porConfirmar ? <><b style={{ color: "var(--amarillo-tinta)" }}>Pista por confirmar</b>{pe.motivo && <span className="ev-sub" style={{ color: "var(--tinta-tenue)" }}>{pe.motivo}</span>}</> : pe.texto}
        {e.solo_con_ficha_en && <span className="ev-sub" data-testid="pista-solo-ficha">Solo jugadores con ficha</span>}
      </td>
      <td data-label="Respuestas" className={respuestas.length > 0 ? "ev-celda-resp" : undefined}>
        {respuestas.length > 0 ? (
          <CuentasRespuestas id={e.id} grupos={gruposEvento(e, jugadores, respuestas, true, defecto)} nombre={`${tituloEvento(e)} ${diaYNumero(e.fecha)}`}
            dudas={e.estado === "programado" ? lineaDudas(e, gruposEvento(e, jugadores, respuestas, true, defecto), respuestas) : null} />
        ) : e.tipo === "liga" ? <span className="suave">Convocatoria el martes</span> : <span className="suave">—</span>}
        <AvisoSinFicha personas={sinFichaQueVan(e, jugadores, respuestas)} pista={e.solo_con_ficha_en} />
      </td>
    </tr>
  );
}
