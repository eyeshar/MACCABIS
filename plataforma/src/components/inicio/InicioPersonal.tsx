import Link from "next/link";
import { cargarMiZona } from "@/app/mi-zona/datos";
import BandaAvisos from "@/components/avisos/BandaAvisos";
import { AvisoCaja } from "@/components/ProximoPartido";
import { Flecha } from "@/components/Iconos";
import { madrid } from "@/lib/avisos/horario";
import { textoColores } from "@/lib/colores";
import { TEXTO_POSICION, type Posicion } from "@/lib/convocatoria/motor";
import { avisoDeEvento } from "@/lib/eventos/datos";
import { coloresDe } from "@/lib/equipacion";
import { cargarPendientesSemana } from "@/lib/gestion/pendientes";
import { avisosDeLaJornada } from "@/lib/inicio/avisos";
import { fichaEstadisticas } from "@/lib/mensajes";
import { clasificaciones, temporadaDe } from "@/lib/publico";
import {
  cargarAvisosPersonales, cargarMiConvocatoria, cargarMisAusencias, cargarMisEventos, cargarMisGrupos, cargarMisRespuestas,
  cargarQuienVa, respuestasWebEncendido,
} from "@/lib/respuestas/jugador";
import {
  enlaceLugar, esPlan, estadoDe, fechaTitular, hhmm, lugarTexto, restar20, unidades, type MiEvento, type Unidad,
} from "@/lib/respuestas/dominio";
import { sumarDias, hoyMadrid } from "@/lib/dias";
import { clienteSesion } from "@/lib/supabase";
import type { Usuario } from "@/lib/usuario";
import AvisoPersonal from "./AvisoPersonal";
import RopaInicio from "./RopaInicio";
import BandaGestion from "./BandaGestion";
import Carrusel from "./Carrusel";
import { FilaAgenda, TarjetaPendiente } from "./piezas";

const NOMBRE_GRUPO = { MDA: "grupo 1", MDL: "grupo 2" } as const;
const dec1 = (x: number) => x.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const conSigno = (x: number) => (x > 0 ? `+${x}` : String(x));

/** Inicio personal (D117, lienzo «Maccabis · Inicio personal»): con sesion, «/» enseña lo de cada persona y lo que
 *  tiene que hacer. Orden: (gestores) «Gestión esta semana» · saludo · «Te faltan N respuestas» · y, debajo (en
 *  escritorio, tres columnas que se apilan solas): próximo partido con avisos | agenda | temporada con el club. */
export default async function InicioPersonal({ usuario, aviso }: { usuario: Usuario; aviso?: "guardado" | "no_gestor" | null }) {
  const hoy = hoyMadrid();
  const ahora = new Date();
  const zona = await cargarMiZona().catch(() => null);
  const pendientesGestion = usuario.esGestor ? await cargarPendientesSemana(await clienteSesion()).catch(() => []) : [];
  const grupos = clasificaciones();

  const club = (
    <section className="in-sec in-club" id="club" aria-labelledby="t-club">
      <h2 id="t-club">El club</h2>
      <div className="in-club-fila">
        {grupos.map((g) => {
          const n = g.filas.find((f) => f.nuestro);
          return (
            <div key={g.grupo} className="in-club-equipo" data-equipo={g.equipo}>
              <span className={`chip-eq chip-${g.equipo}`}>{g.equipo === "MDA" ? "MdA" : "MdL"} · {NOMBRE_GRUPO[g.equipo]}</span>
              <b className="cifra">{n ? `${n.pos}.º` : "—"}</b>
              <span className="suave">{n ? `${n.g} ganados · ${n.p} perdidos` : "Sin partidos"}{g.tras ? ` · tras la J${g.tras}` : ""}</span>
            </div>
          );
        })}
      </div>
      <Link href="/liga" className="in-mas">Resultados y clasificación <Flecha size={16} /></Link>
    </section>
  );

  if (!zona) {
    // Gestor sin ficha de jugador: la banda de gestion y el club.
    return (
      <main className="in" id="inicio">
        {usuario.esGestor && <BandaGestion pendientes={pendientesGestion} />}
        <section className="in-hola"><h1><small>Hola,</small> {usuario.corto}</h1><p className="suave">Tu cuenta no tiene ficha de jugador: aquí tienes la gestión y el club.</p></section>
        <div className="in-cols">{club}</div>
      </main>
    );
  }

  const { jugador, campana, pedidos } = zona;
  const equipos = (["MdA", "MdL"] as const).filter((e) => (e === "MdA" ? jugador.ficha_mda : jugador.ficha_mdl));
  const sb = await clienteSesion();
  const [encendido, eventos, respuestas, ausencias, convocatorias, misGrupos, avisosPersonales, { data: posicion }] = await Promise.all([
    respuestasWebEncendido(), cargarMisEventos(hoy).catch(() => [] as MiEvento[]), cargarMisRespuestas().catch(() => []), cargarMisAusencias().catch(() => []),
    cargarMiConvocatoria().catch(() => []), cargarMisGrupos(), cargarAvisosPersonales(), sb.rpc("mi_posicion"),
  ]);
  const abierta = (u: Unidad) => u.eventos.some((e) => e.estado === "programado" && madrid(e.fecha, hhmm(e.inicio) ?? "00:00") > ahora);
  const todas = unidades(eventos);
  const limite = sumarDias(hoy, 14);

  // «Te faltan N respuestas»: encendido, lo que la web pide (14 dias, D102); apagado (fase puente), lo que SportEasy da
  // como «sin responder» en la ultima importacion. Los planes no oficiales, siempre (D118).
  const pendientes = todas.filter((u) => {
    if (!abierta(u)) return false;
    const est = estadoDe(u, respuestas, ausencias);
    if (!est.pendiente) return false;
    if (esPlan(u.eventos[0])) return true;
    if (u.fecha > limite) return false;
    if (encendido) return true;
    return u.eventos.some((e) => respuestas.find((r) => r.evento_id === e.id)?.respuesta === "sin_responder");
  });
  const conPlazas = pendientes.filter((u) => esPlan(u.eventos[0]) && u.eventos[0].plazas).map((u) => u.eventos[0].id);
  const ocupacion = conPlazas.length ? await cargarQuienVa(conPlazas) : new Map();
  const lleno = (e: MiEvento) => Boolean(e.plazas && (ocupacion.get(e.id)?.va.length ?? 0) >= e.plazas);

  // Tu proximo partido: el proximo domingo con partido suyo.
  const domingo = todas.find((u) => u.tipo === "domingo" && abierta(u));
  const conv = domingo ? convocatorias.find((c) => c.fecha === domingo.fecha) ?? null : null;
  const resp = (e: MiEvento) => respuestas.find((r) => r.evento_id === e.id)?.respuesta ?? "sin_responder";
  const noVa = domingo ? domingo.eventos.every((e) => resp(e) === "no") : false;
  const estadoPartido = !domingo ? null
    : conv?.equipos.length ? { clase: "convocado", texto: `Convocado · ${conv.equipos.join(" y ")}` }
    : noVa ? { clase: "novas", texto: "No vas" }
    : conv ? { clase: "pendiente", texto: "No convocado esta vez" }
    : { clase: "pendiente", texto: "Convocatoria pendiente" };
  const partidosVer = domingo ? (conv?.equipos.length ? domingo.eventos.filter((e) => conv.equipos.includes(e.equipo as "MdA" | "MdL")) : domingo.eventos) : [];
  const temporada = temporadaDe(jugador.person_id);
  const dorsales = temporada?.dorsales ?? [];
  const dorsalDe = (eq: string) => {
    const eqs = (temporada ? (["MDA", "MDL"] as const).filter((x) => (x === "MDA" ? jugador.ficha_mda : jugador.ficha_mdl)) : []).map((x) => (x === "MDA" ? "MdA" : "MdL"));
    if (dorsales.length > 1 && dorsales.length === eqs.length) return dorsales[eqs.indexOf(eq as "MdA" | "MdL")] ?? dorsales[0];
    return dorsales[0];
  };
  const proximoEntreno = eventos.find((e) => e.tipo === "entreno" && e.estado === "programado" && e.oficial !== false && madrid(e.fecha, hhmm(e.inicio) ?? "00:00") > ahora);
  const avisos = avisosDeLaJornada(hoy, equipos, proximoEntreno ? { fecha: proximoEntreno.fecha, porConfirmar: proximoEntreno.pista_por_confirmar && !proximoEntreno.lugar_nombre, motivo: proximoEntreno.pista_motivo } : null);

  const agenda = todas.filter((u) => abierta(u) || u.eventos.every((e) => e.estado === "cancelado")).slice(0, 4);
  const grupoDe = (u: Unidad) => (u.eventos[0].tipo === "entreno" ? misGrupos.find((g) => g.evento_id === u.eventos[0].id) ?? null : null);
  const ropa = campana?.abierta_ahora || pedidos.some((p) => p.campana_abierta);
  const linea = [posicion ? TEXTO_POSICION[posicion as Posicion] : null, equipos.length ? equipos.join(" y ") : null, dorsales.length ? `#${dorsales.join(" · #")}` : null].filter(Boolean).join(" · ");

  return (
    <main className="in" id="inicio">
      {usuario.esGestor && <BandaGestion pendientes={pendientesGestion} />}
      {aviso === "guardado" && <div className="aviso aviso-ok" role="status">Pedido guardado. Puedes cambiarlo mientras el pedido siga abierto.</div>}
      {aviso === "no_gestor" && <div className="aviso aviso-info" role="status">Tu cuenta no tiene permisos de gestión.</div>}

      <section className="in-hola" aria-label="Saludo">
        <h1><small>Hola,</small> {jugador.nombre_visible}</h1>
        {linea && <p className="in-hola-linea" data-testid="linea-saludo">{linea}</p>}
      </section>
      {avisosPersonales.map((a) => <AvisoPersonal key={a.id} id={a.id} texto={a.texto} url={a.url} />)}
      <BandaAvisos />

      <section className="in-sec in-faltan" id="pendientes" aria-labelledby="t-faltan" data-testid="pendientes">
        <div className="in-sec-cab">
          <h2 id="t-faltan">{pendientes.length === 0 ? "Lo tienes todo respondido" : pendientes.length === 1 ? "Te falta 1 respuesta" : `Te faltan ${pendientes.length} respuestas`}</h2>
          {!encendido && pendientes.some((u) => !esPlan(u.eventos[0])) && <span className="pastilla pastilla-pendiente">Se responde en SportEasy</span>}
        </div>
        {pendientes.length > 0 && (
          <Carrusel etiqueta="Respuestas que te faltan">
            {pendientes.map((u) => <TarjetaPendiente key={u.clave} u={u} encendido={encendido} respuestas={respuestas} plazasLlenas={lleno(u.eventos[0])} />)}
          </Carrusel>
        )}
        <p className="in-nota" data-testid="regla-recordatorios">
          {encendido
            ? "Si no respondes, te lo recordamos: el lunes a las 19:00 (todo lo de la semana en un aviso), los entrenos también el mismo día a las 10:00 y los partidos el martes a las 10:00. Nunca de 22:30 a 8:30."
            : "Por ahora, los partidos y entrenos se responden en SportEasy y los recordatorios llegan de allí. Los planes no oficiales se responden aquí."}
          {" "}Los planes, solo si quien lo organiza lo pide: un aviso un día antes.
        </p>
      </section>

      <div className="in-cols">
        <div className="in-col">
          <section className="in-sec in-partido" id="proximo-partido" aria-labelledby="t-partido" data-testid="proximo-partido">
            <div className="in-sec-cab">
              <h2 id="t-partido">Tu próximo partido</h2>
              {estadoPartido && <span className={`in-pastilla in-p-${estadoPartido.clase}`} data-testid="estado-partido">{estadoPartido.texto}</span>}
            </div>
            {domingo ? (
              <>
                <p className="in-titular">{fechaTitular(domingo.fecha, hoy)}</p>
                {partidosVer.map((e) => {
                  const a = avisoDeEvento(e);
                  const rival = e.rival ? coloresDe(e.rival) : null;
                  const inicio = hhmm(e.inicio);
                  const mapa = enlaceLugar(e);
                  const dorsal = dorsalDe(e.equipo);
                  return (
                    <article key={e.id} className="in-partido-uno" data-equipo={e.equipo === "MdA" ? "MDA" : "MDL"}>
                      <strong className="in-partido-cruce">{e.equipo} {e.es_local === false ? "en" : "vs"} {a?.rival ?? e.rival}</strong>
                      <div className="in-casillas">
                        <div className="in-casilla in-casilla-quedada"><small>Quedada</small><b className="cifra">{inicio ? restar20(inicio) : "—"}</b></div>
                        <div className="in-casilla"><small>Partido</small><b className="cifra">{inicio ?? "—"}</b></div>
                      </div>
                      <span className="suave">{lugarTexto(e)}{e.es_local != null ? ` · ${e.es_local ? "en casa" : "fuera"}` : ""}</span>
                      {mapa && <a className="boton boton-claro in-llegar" href={mapa} target="_blank" rel="noopener noreferrer">Cómo llegar</a>}
                      <div className="in-tepones" data-testid="te-pones">
                        <span className="mono tenue">Te pones</span>
                        <b>{a?.tipo === "nos_toca" ? "Equipación amarilla" : "Equipación negra"}{dorsal ? ` con tu dorsal ${dorsal}` : ""}</b>
                        {a?.hay && a.tipo !== "nos_toca" && <span className="pequeno">Lleva también la amarilla, por si acaso.</span>}
                        {/* El aviso de choque de equipacion de siempre (D79), el mismo que en la portada y en Gestion. */}
                        {a?.hay && <AvisoCaja a={a} />}
                      </div>
                      {rival && <p className="in-rival pequeno" data-testid="color-rival-inicio"><i className="eq-punto" style={{ background: rival.css }} aria-hidden="true" /> El rival: {textoColores(rival)}</p>}
                    </article>
                  );
                })}
                {domingo.eventos.length === 2 && hhmm(domingo.eventos[0].inicio) === hhmm(domingo.eventos[1].inicio) && <p className="suave pequeno">MdA y MdL juegan a la misma hora: esta jornada no se puede doblar.</p>}
                <Link href={domingo.url} className="in-mas">Ver el partido y quién va <Flecha size={16} /></Link>
              </>
            ) : <p className="suave" style={{ margin: 0 }}>No tienes partidos de liga en el calendario.</p>}
            {avisos.length > 0 && (
              <div className="in-avisos" data-testid="avisos-jornada" aria-label="Avisos de la jornada">
                {avisos.map((x) => <p key={x.id} className={`in-aviso in-aviso-${x.tipo}`}>{x.texto}</p>)}
              </div>
            )}
          </section>
        </div>

        <div className="in-col">
          <section className="in-sec in-agenda" id="agenda" aria-labelledby="t-agenda">
            <div className="in-sec-cab"><h2 id="t-agenda">Tu agenda</h2></div>
            <div className="in-lista">
              {agenda.map((u) => <FilaAgenda key={u.clave} u={u} respuestas={respuestas} ausencias={ausencias} convocatorias={convocatorias} grupo={grupoDe(u)} encendido={encendido} />)}
              {!agenda.length && <p className="suave" style={{ margin: 0 }}>No tienes nada en la agenda.</p>}
            </div>
            <div className="botones">
              <Link href="/planes/nuevo" className="boton boton-contorno">Proponer un plan</Link>
              <Link href="/agenda" className="boton boton-claro">Ver todo</Link>
            </div>
          </section>
        </div>

        <div className="in-col">
          <section className="in-sec in-temporada" id="temporada" aria-labelledby="t-temporada" data-testid="tu-temporada">
            <div className="in-sec-cab"><h2 id="t-temporada">Tu temporada</h2>{temporada && temporada.pj > 0 && <span className="mono tenue">tras {temporada.pj} {temporada.pj === 1 ? "partido" : "partidos"}</span>}</div>
            {temporada && temporada.pj > 0 ? (
              <>
                <div className="in-cifras">
                  <div className="in-cifra"><b className="cifra">{temporada.masMenos != null ? conSigno(temporada.masMenos) : "—"}</b><span>más/menos con él en pista</span></div>
                  <div className="in-cifra"><b className="cifra">{temporada.minutos ?? "—"}</b><span>minutos{temporada.minutos ? ` · ${dec1(temporada.minutos / temporada.pj)} de media` : ""}</span></div>
                  <div className="in-cifra"><b className="cifra">{temporada.tot.pts}</b><span>puntos · {dec1(temporada.tot.pts / temporada.pj)} por partido</span></div>
                  <div className="in-cifra"><b className="cifra">{temporada.entrenos ? `${temporada.entrenos.fueron}/${temporada.entrenos.total}` : "—"}</b><span>entrenos</span></div>
                </div>
                <div className="in-partidos-temporada">
                  {temporada.partidos.map((p, i) => (
                    <div key={i} className="in-fila-partido pequeno">
                      <span><b>{p.equipo === "MDA" ? "MdA" : "MdL"}</b> {p.local ? "vs" : "en"} {p.rival}</span>
                      <span className="cifra">{p.minutos != null ? `${p.minutos}′` : "—"} · {p.masMenos != null ? conSigno(p.masMenos) : "—"}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="suave" style={{ margin: 0 }}>Aún no has jugado esta temporada.</p>}
            <Link href={fichaEstadisticas(jugador.person_id)} className="in-mas">Tus estadísticas completas <Flecha size={16} /></Link>
          </section>
          {club}
        </div>
      </div>

      {ropa && <RopaInicio campana={campana} pedidos={pedidos} />}
    </main>
  );
}
