import Link from "next/link";
import { cargarMiZona } from "@/app/mi-zona/datos";
import BandaAvisos from "@/components/avisos/BandaAvisos";
import Numeros from "@/components/numeros/Numeros";
import Responder from "@/components/respuestas/Responder";
import { Flecha } from "@/components/Iconos";
import { dudaAbierta, madrid } from "@/lib/avisos/horario";
import { avisoDeEvento } from "@/lib/eventos/datos";
import { hhmm as hhmmF, pistaEfectiva, tituloEvento, type EventoFila } from "@/lib/eventos/dominio";
import { cargarPendientesSemana } from "@/lib/gestion/pendientes";
import { avisosDelFichero } from "@/lib/inicio/avisos";
import { cuentasDeLaSemana, type CuentaGestion } from "@/lib/inicio/semanaGestor";
import { temporadaDe } from "@/lib/publico";
import {
  cargarAvisosPersonales, cargarMiConvocatoria, cargarMisAusencias, cargarMisEventos, cargarMisGrupos, cargarMisRespuestas,
  cargarQuienVa, misEntrenosPorDefecto,
} from "@/lib/respuestas/jugador";
import { esPlan, estadoDe, hhmm, lugarTexto, nombreCorto, restar20, unidades, type MiEvento, type MotivoJugador, type Unidad } from "@/lib/respuestas/dominio";
import { sumarDias, hoyMadrid } from "@/lib/dias";
import { clienteSesion } from "@/lib/supabase";
import type { Usuario } from "@/lib/usuario";
import AvisoPersonal from "./AvisoPersonal";
import RopaInicio from "./RopaInicio";
import BandaGestion from "./BandaGestion";
import Carrusel from "./Carrusel";
import { cifrasTemporada } from "./TuTemporada";
import { horasDe, pastillaDe, TarjetaPendiente, TarjetaPorDefecto, tituloUnidad } from "./piezas";

/** Sin rival o sin jornada en la tabla de eventos no hay aviso; la línea de equipación no falta nunca (D160). */
const LINEA_SIN_AVISO = "Jugamos de negro. Lleva la amarilla por si acaso.";
/** La línea de D160 es del grupo («Llevad…»); en la tarjeta personal va en singular (Iván, 02/11/2026). */
const enSingular = (l: string) => l.replace(/Llevad/g, "Lleva");
/** Los próximos días de la Semana: hoy y los 9 siguientes. */
const DIAS = 10;
const DIA_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const corta = (f: string) => { const d = new Date(`${f}T12:00:00Z`); return `${DIA_SEMANA[d.getUTCDay()]} ${d.getUTCDate()} ${MES[d.getUTCMonth()]}`; };

type DatosTarjeta = {
  clave: string; fecha: string; url: string; tipo: string; titulo: string; etiquetas: { texto: string; equipo?: "MdA" | "MdL" }[];
  inicio: string | null; quedada: string | null; pista: string; equipacion: string | null; avisos: { id: string; texto: string }[];
  nota?: string | null;
};

/** Una tarjeta de los próximos días (D189): fecha y hora con la quedada, MdA/MdL y jornada, rival o tipo y pista; la
 *  equipación en una línea (D160); los avisos del día plegados; y, según quién mira, Voy · Duda · No voy y la franja
 *  GESTIÓN con sus contadores. */
function TarjetaSemana({ t, estado, responder, gestion }: { t: DatosTarjeta; estado?: { clase: string; texto: string } | null; responder?: React.ReactNode; gestion?: React.ReactNode }) {
  return (
    <article className="sm-tarjeta" data-tipo={t.tipo} data-testid="tarjeta-semana">
      <div className="sm-t-cab">
        <Link href={t.url} className="sm-t-cuando"><b>{corta(t.fecha)}</b><b className="cifra">{t.inicio ?? "—"}</b>{t.quedada && <span className="cifra">quedada {t.quedada}</span>}</Link>
        {estado && <span className={`in-pastilla in-p-${estado.clase}`} data-testid="estado-tarjeta">{estado.texto}</span>}
      </div>
      <Link href={t.url} className="sm-t-que">
        {t.etiquetas.length > 0 && <span className="sm-t-etqs">{t.etiquetas.map((e) => <span key={e.texto} className={e.equipo ? `chip-eq chip-${e.equipo === "MdA" ? "MDA" : "MDL"}` : "sm-t-etq"}>{e.texto}</span>)}</span>}
        <strong>{t.titulo}</strong>
        <span className="suave">{t.pista}</span>
      </Link>
      {t.equipacion && <p className="sm-t-linea" data-testid="linea-equipacion">{t.equipacion}</p>}
      {t.nota && <p className="sm-t-linea">{t.nota}</p>}
      {t.avisos.length > 0 && (
        <details className="sm-t-avisos" data-testid="avisos-dia">
          <summary>⚠ {t.avisos[0].texto.split(/[.:]/)[0]}{t.avisos.length > 1 ? ` y ${t.avisos.length - 1} más` : ""} · ver</summary>
          {t.avisos.map((a) => <p key={a.id} className="pequeno">{a.texto}</p>)}
        </details>
      )}
      {responder}
      {gestion}
    </article>
  );
}

/** Franja «GESTIÓN» de una tarjeta (solo gestores): N van · N dudan · N no van · N convocados, pulsables, y «Preparar ›»
 *  (partido: la convocatoria) o «Grupos ›» (entreno). */
function FranjaGestion({ partes, enlace }: { partes: { id: string; etiqueta?: string; c: CuentaGestion }[]; enlace: { href: string; texto: string } | null }) {
  return (
    <div className="sm-gestion" data-testid="franja-gestion">
      <span className="sm-gestion-etq">GESTIÓN</span>
      {partes.map((p) => (
        <div key={p.id} className="sm-gestion-fila">
          {p.etiqueta && <b className="pequeno">{p.etiqueta}</b>}
          <Numeros variante="linea" prueba={`cuentas-${p.id}`} etiqueta={`Respuestas${p.etiqueta ? ` ${p.etiqueta}` : ""}`}
            grupos={[...p.c.grupos, ...(p.c.convocados != null ? [{ k: "conv", etiqueta: "convocados", n: p.c.convocados, personas: [], soloNumero: true }] : [])]} />
        </div>
      ))}
      {enlace && <Link href={enlace.href} className="sm-gestion-ir">{enlace.texto} ›</Link>}
    </div>
  );
}

const enlaceGestion = (e: { id: string; tipo: string; fecha: string }) =>
  e.tipo === "liga" ? { href: `/gestion/convocatoria?fecha=${e.fecha}`, texto: "Preparar" } : e.tipo === "entreno" ? { href: `/gestion/grupos/${e.id}`, texto: "Grupos" } : { href: `/evento/${e.id}`, texto: "Respuestas" };

/** Semana (D189; sustituye al inicio personal de D117): con sesion, «/» (reescrita a /inicio, D175). «Esta semana» y el
 *  rango; las respuestas que faltan de una en una; a los gestores, «Gestión · N pendientes»; las tarjetas de los próximos
 *  días; y abajo «Calendario completo», «+ Proponer un plan» y «Tu temporada». */
export default async function InicioPersonal({ usuario, aviso }: { usuario: Usuario; aviso?: "guardado" | "no_gestor" | null }) {
  const hoy = hoyMadrid();
  const ahora = new Date();
  const hasta = sumarDias(hoy, DIAS - 1);
  const sb = await clienteSesion();
  // En paralelo (D175): la zona y, si es gestor, lo pendiente y las cuentas de la semana.
  const [zona, pendientesGestion, gestion] = await Promise.all([
    cargarMiZona().catch(() => null),
    usuario.esGestor ? cargarPendientesSemana(sb).catch(() => []) : Promise.resolve([]),
    usuario.esGestor ? cuentasDeLaSemana(sb, hoy, hasta).catch(() => null) : Promise.resolve(null),
  ]);
  const cabecera = (
    <section className="sm-cab" aria-label="Esta semana">
      <h1>Esta semana</h1>
      <p className="suave cifra" data-testid="rango-semana">{corta(hoy)} – {corta(hasta)}</p>
    </section>
  );
  const banda = usuario.esGestor ? <BandaGestion pendientes={pendientesGestion} /> : null;
  const abajo = (temporada: ReturnType<typeof temporadaDe> | null) => (
    <section className="sm-abajo" aria-label="Más">
      <div className="botones">
        <Link href="/calendario" className="boton boton-claro">Calendario completo</Link>
        {zona && <Link href="/planes/nuevo" className="boton boton-contorno">+ Proponer un plan</Link>}
      </div>
      {temporada && temporada.pj > 0 && (
        <Link href="/yo" className="sm-temporada" data-testid="tu-temporada">
          Tu temporada: {cifrasTemporada(temporada).map((c) => `${c.valor} ${c.corto}`).join(" · ")} <Flecha size={14} />
        </Link>
      )}
    </section>
  );

  // Las tarjetas de un gestor salen de la tabla de eventos; las de un jugador, de su agenda (v_mi_agenda).
  const tarjetaEvento = (e: EventoFila): DatosTarjeta => {
    const a = avisoDeEvento(e);
    const ini = hhmmF(e.inicio);
    const pe = gestion ? pistaEfectiva(e, gestion.pistas) : null;
    return {
      clave: e.id, fecha: e.fecha, url: `/evento/${e.id}`, tipo: e.tipo, titulo: tituloEvento(e),
      etiquetas: [...(e.equipo !== "ambos" ? [{ texto: e.equipo, equipo: e.equipo }] : []), ...(e.tipo === "liga" && e.jornada ? [{ texto: `J${e.jornada}` }] : [])],
      inicio: ini, quedada: hhmmF(e.quedada) ?? (ini ? restar20(ini) : null), pista: pe ? (pe.porConfirmar ? "Pista por confirmar" : pe.texto) : "",
      equipacion: e.tipo === "liga" ? (a?.convocatoria ?? "Jugamos de negro. Llevad la amarilla por si acaso.") : null,
      avisos: avisosDelFichero(e.fecha, e.equipo === "ambos" ? ["MdA", "MdL"] : [e.equipo]).map((x) => ({ id: x.id, texto: x.texto })),
    };
  };

  if (!zona) {
    // Gestor sin ficha de jugador: las mismas tarjetas, sin botones de respuesta, con la barra de respuestas y el estado de
    // la convocatoria o de los grupos en primer plano.
    const lista = (gestion?.eventos ?? []).filter((e) => e.estado === "programado" && madrid(e.fecha, hhmmF(e.inicio) ?? "23:59") > ahora);
    return (
      <main className="in sm" id="inicio">
        {cabecera}
        {banda}
        {aviso === "no_gestor" && <div className="aviso aviso-info" role="status">Tu cuenta no tiene permisos de gestión.</div>}
        <section className="sm-lista" aria-label="Próximos días" data-testid="proximos-dias">
          {lista.map((e) => {
            const c = gestion?.cuentas.get(e.id);
            const estado = e.tipo === "liga" ? (c?.convocatoria === "aprobada" ? { clase: "vas", texto: "Convocatoria aprobada" } : c?.convocatoria === "borrador" ? { clase: "duda", texto: "Propuesta sin aprobar" } : { clase: "responde", texto: "Sin convocatoria" }) : null;
            return <TarjetaSemana key={e.id} t={tarjetaEvento(e)} estado={estado} gestion={c ? <FranjaGestion partes={[{ id: e.id, c }]} enlace={enlaceGestion(e)} /> : null} />;
          })}
          {!lista.length && <p className="suave">Nada en los próximos {DIAS} días.</p>}
        </section>
        {abajo(null)}
      </main>
    );
  }

  const { jugador, campana, pedidos } = zona;
  const [eventos, respuestas, ausencias, convocatorias, misGrupos, avisosPersonales] = await Promise.all([
    cargarMisEventos(hoy).catch(() => [] as MiEvento[]), cargarMisRespuestas().catch(() => []), cargarMisAusencias().catch(() => []),
    cargarMiConvocatoria().catch(() => []), cargarMisGrupos(), cargarAvisosPersonales(),
  ]);
  const abierta = (u: Unidad) => u.eventos.some((e) => e.estado === "programado" && madrid(e.fecha, hhmm(e.inicio) ?? "00:00") > ahora);
  const todas = unidades(eventos);
  const limite = sumarDias(hoy, 14);
  // D152: entrenos que le salen como «No vas (puesto por defecto)» (solo lo suyo; nunca se nombra la marca).
  const porDefecto = await misEntrenosPorDefecto(eventos, respuestas, ausencias).catch(() => new Set<string>());

  // Respuestas que faltan: lo que la web pide (14 dias, D102); los planes no oficiales, siempre (D118).
  const pendientes = todas.filter((u) => {
    if (!abierta(u)) return false;
    const est = estadoDe(u, respuestas, ausencias, porDefecto);
    if (!est.pendiente) return false;
    if (esPlan(u.eventos[0])) return true;
    return u.fecha <= limite;
  });
  const puestosPorDefecto = todas.filter((u) => abierta(u) && u.fecha <= limite && estadoDe(u, respuestas, ausencias, porDefecto).clase === "defecto");
  const conPlazas = pendientes.filter((u) => esPlan(u.eventos[0]) && u.eventos[0].plazas).map((u) => u.eventos[0].id);
  const ocupacion = conPlazas.length ? await cargarQuienVa(conPlazas) : new Map();
  const lleno = (e: MiEvento) => Boolean(e.plazas && (ocupacion.get(e.id)?.va.length ?? 0) >= e.plazas);

  const temporada = temporadaDe(jugador.person_id);
  const equiposJugador = (["MdA", "MdL"] as const).filter((e) => (e === "MdA" ? jugador.ficha_mda : jugador.ficha_mdl));
  // Su dorsal en cada equipo: si tiene uno por ficha, el de ese equipo; si no, el único que tiene.
  const dorsales = temporada?.dorsales ?? [];
  const dorsalDe = (eq: string) => (dorsales.length > 1 && dorsales.length === equiposJugador.length ? dorsales[equiposJugador.indexOf(eq as "MdA" | "MdL")] ?? null : dorsales[0] ?? null);
  const proximos = todas.filter((u) => u.fecha <= hasta && (abierta(u) || u.eventos.every((e) => e.estado === "cancelado")));
  const grupoDe = (u: Unidad) => (u.eventos[0].tipo === "entreno" ? misGrupos.find((g) => g.evento_id === u.eventos[0].id) ?? null : null);
  const ropa = campana?.abierta_ahora || pedidos.some((p) => p.campana_abierta);

  const tarjetaUnidad = (u: Unidad): DatosTarjeta => {
    const e = u.eventos[0];
    const h = horasDe(u);
    const liga = u.eventos.filter((x) => x.tipo === "liga");
    // Una sola «Lleva la amarilla por si acaso» aunque jueguen los dos equipos; cada equipo con su línea (D160).
    const POR_SI_ACASO = /\s*Lleva la amarilla por si acaso\.?/g;
    const lineas = liga.map((x) => { const a = avisoDeEvento(x); const l = (a?.convocatoria ? enSingular(a.convocatoria) : LINEA_SIN_AVISO).replace(POR_SI_ACASO, "").trim(); const d = dorsalDe(x.equipo); return liga.length > 1 ? `${x.equipo}${d ? ` (dorsal ${d})` : ""}: ${l}` : l; });
    const equipo = [...new Set(u.eventos.map((x) => x.equipo).filter((x): x is "MdA" | "MdL" => x !== "ambos"))];
    const aviso = liga[0] ? avisoDeEvento(liga[0]) : null;
    const g = grupoDe(u);
    return {
      clave: u.clave, fecha: u.fecha, url: u.url, tipo: e.tipo, titulo: tituloUnidad(u),
      etiquetas: [...equipo.map((x) => ({ texto: x, equipo: x })), ...(e.tipo === "liga" && e.jornada ? [{ texto: `J${e.jornada}` }] : []), ...(esPlan(e) ? [{ texto: "Plan no oficial" }] : [])],
      inicio: h.inicio, quedada: h.quedada, pista: `${lugarTexto(e)}${g ? ` · tu grupo: ${g.grupo}` : ""}`,
      equipacion: liga.length ? `${aviso?.tipo === "nos_toca" ? "Amarilla" : "Negra"}${liga.length === 1 && dorsalDe(liga[0].equipo) ? ` con tu dorsal ${dorsalDe(liga[0].equipo)}` : ""}. ${lineas.join(" · ")} Lleva la amarilla por si acaso.` : null,
      avisos: avisosDelFichero(u.fecha, equipo.length ? equipo : [...equiposJugador]).map((x) => ({ id: x.id, texto: x.texto })),
      nota: u.modo === "misma" ? "MdA y MdL a la misma hora: esta jornada no se puede doblar." : null,
    };
  };
  // La pastilla de la Agenda (D171); si su «duda» pasó a «no va» por no confirmar, lo dice (no lo dijo él).
  const estadoTarjeta = (u: Unidad) => {
    const p = pastillaDe(u, respuestas, ausencias, convocatorias, porDefecto);
    const est = estadoDe(u, respuestas, ausencias, porDefecto);
    return p.clase === "novas" && /no confirmaste a tiempo/.test(est.texto) ? { clase: p.clase, texto: est.texto } : p;
  };
  const responderDe = (u: Unidad) => {
    if (!abierta(u) || esPlan(u.eventos[0])) return null;
    const est = estadoDe(u, respuestas, ausencias, porDefecto);
    const r = respuestas.find((x) => x.evento_id === u.eventos[0].id);
    const actual = est.clase === "vas" && u.eventos.length === 1 ? "va" : est.clase === "duda" ? "duda" : est.clase === "novas" || est.clase === "defecto" ? "no" : null;
    return (
      <div className="sm-t-responder">
        <Responder eventoId={u.eventos[0].id} fecha={u.fecha} domingo={u.tipo === "domingo"} actual={r?.motivo === "no_confirmo" ? null : actual}
          nombre={u.tipo === "domingo" ? `partido del domingo ${+u.fecha.slice(8)}` : nombreCorto(u.eventos[0])}
          sinDuda={!u.eventos.every((x) => dudaAbierta(x, ahora))} urlDomingo={u.modo === "distintas" ? u.url : undefined}
          motivo={r?.motivo === "no_confirmo" ? null : ((r?.motivo as MotivoJugador) ?? null)} detalle={r?.detalle ?? null} />
      </div>
    );
  };
  const franjaDe = (u: Unidad) => {
    if (!gestion) return null;
    const partes = u.eventos.flatMap((x) => { const c = gestion.cuentas.get(x.id); return c ? [{ id: x.id, etiqueta: u.eventos.length > 1 ? String(x.equipo) : undefined, c }] : []; });
    return partes.length ? <FranjaGestion partes={partes} enlace={enlaceGestion(u.eventos[0])} /> : null;
  };

  return (
    <main className="in sm" id="inicio">
      {cabecera}
      {aviso === "guardado" && <div className="aviso aviso-ok" role="status">Pedido guardado. Puedes cambiarlo mientras el pedido siga abierto.</div>}
      {aviso === "no_gestor" && <div className="aviso aviso-info" role="status">Tu cuenta no tiene permisos de gestión.</div>}
      {avisosPersonales.map((a) => <AvisoPersonal key={a.id} id={a.id} texto={a.texto} url={a.url} />)}
      <BandaAvisos />

      <section className="in-sec in-faltan sm-faltan" id="pendientes" aria-labelledby="t-faltan" data-testid="pendientes">
        {pendientes.length === 0
          ? <p className="sm-todo" id="t-faltan">✓ Lo tienes todo respondido</p>
          : <h2 id="t-faltan">{pendientes.length === 1 ? "Te falta 1 respuesta" : `Te faltan ${pendientes.length} respuestas`}</h2>}
        {pendientes.length > 0 && (
          <Carrusel etiqueta="Respuestas que te faltan">
            {pendientes.map((u) => <TarjetaPendiente key={u.clave} u={u} respuestas={respuestas} plazasLlenas={lleno(u.eventos[0])} />)}
          </Carrusel>
        )}
        {puestosPorDefecto.length > 0 && (
          <div className="in-pordefecto-lista" data-testid="por-defecto">
            {puestosPorDefecto.map((u) => <TarjetaPorDefecto key={u.clave} u={u} />)}
          </div>
        )}
        {pendientes.length > 0 && <p className="in-nota" data-testid="regla-recordatorios">Plazo: martes 12:00 para el partido del domingo y miércoles 12:00 para el entreno.</p>}
      </section>

      {banda}

      <section className="sm-lista" aria-label="Próximos días" data-testid="proximos-dias">
        {proximos.map((u) => (
          <TarjetaSemana key={u.clave} t={tarjetaUnidad(u)} estado={estadoTarjeta(u)} responder={responderDe(u)} gestion={franjaDe(u)} />
        ))}
        {!proximos.length && <p className="suave" data-testid="sin-partidos">Nada en los próximos {DIAS} días.</p>}
      </section>

      {ropa && <RopaInicio campana={campana} pedidos={pedidos} />}
      {abajo(temporada)}
    </main>
  );
}
