import type { Metadata } from "next";
import Volver from "@/components/nav/Volver";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Boxscore } from "@/components/liga/Equipo";
import { CajaTabla, Nota, SecH } from "@/components/liga/Comunes";
import { metricasDe } from "@/lib/estadisticas/calculo";
import { cargarTemporada } from "@/lib/estadisticas/datos";
import { LIGA, NUESTRO_DE, TEMPORADA_LIGA, hrefEquipo, partidoPorId, type EstEquipo, type Grupo, type ResultadoLiga } from "@/lib/estadisticas/liga";
import { bonito, mmss } from "@/lib/jugadoresLiga";
import { partidosCalendario } from "@/lib/publico";
import { cargarFuente } from "@/lib/eventos/fuente";
import { esGestorActual, sesionActual } from "@/lib/sesion";
import { diaLargo } from "@/lib/dias";

// Pagina de un partido de la liga (D129): equipos (enlazados a su ficha), fecha, pista, marcador, parciales por cuarto
// (actas, solo en los partidos de MdA y MdL) y estadisticas POR EQUIPO de la hoja. En los partidos de MdA o MdL, ademas,
// el boxscore de los nuestros (el mismo de la pestaña Equipo). Los datos POR JUGADOR de los rivales son de terceros (D73):
// solo los ve un gestor con sesion, leidos de Supabase con su RLS (como Scouting); a nadie mas le llega nada.
export const dynamic = "force-dynamic";

const nombreGrupo = (g: Grupo) => `Grupo ${g.slice(1)} (${NUESTRO_DE[g]})`;

export async function generateMetadata({ params }: { params: Promise<{ temporada: string; id: string }> }): Promise<Metadata> {
  const { temporada, id } = await params;
  const x = temporada === TEMPORADA_LIGA ? partidoPorId(decodeURIComponent(id)) : null;
  if (!x) return {};
  const { r } = x;
  const marcador = r.incomparecencia ? "incomparecencia" : `${r.pl}-${r.pv}`;
  return {
    title: `${r.local} – ${r.visitante} (J${r.jornada}) · Liga 26/27 · Maccabis`,
    description: `Liga Municipal de Moratalaz 2026/27, ${nombreGrupo(x.grupo)}, jornada ${r.jornada}: ${r.local} – ${r.visitante}, ${marcador}.`,
    alternates: { canonical: `/liga/${temporada}/partido/${r.id}` },
  };
}

type FilaRival = { equipo: string; dorsal: string; nombre: string; segundos: number; pts: number; p2a: number; p3a: number; tla: number; tli: number; faltas: number };

/** Por jugador de los equipos que no son nuestros, SOLO para gestores (RLS de liga_partidos y liga_estadisticas_jugador). */
async function rivalesPorJugador(grupo: Grupo, r: ResultadoLiga): Promise<FilaRival[] | null> {
  if (!(await esGestorActual())) return null;
  const { supabase } = await sesionActual();
  if (!supabase) return null;
  const { data: p } = await supabase.from("liga_partidos").select("id")
    .eq("temporada", TEMPORADA_LIGA).eq("grupo", grupo).eq("jornada", r.jornada).eq("local", r.local).eq("visitante", r.visitante).maybeSingle();
  if (!p) return [];
  const { data, error } = await supabase.from("liga_estadisticas_jugador")
    .select("equipo, dorsal, nombre, segundos, pts, p2a, p3a, tla, tli, faltas").eq("partido_id", p.id)
    .order("pts", { ascending: false }).order("segundos", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as FilaRival[];
}

const pct = (a: number, i: number) => (i ? `${Math.round((100 * a) / i)} %` : "—");

function EstadisticasEquipo({ r, est }: { r: ResultadoLiga; est: { local: EstEquipo; visitante: EstEquipo } }) {
  const filas: [string, (e: EstEquipo) => string][] = [
    ["Puntos", (e) => String(e.pts)],
    ["Tiros de 2 anotados", (e) => String(e.t2)],
    ["Tiros de 3 anotados", (e) => String(e.t3)],
    ["Tiros libres", (e) => `${e.tl}/${e.tl_int} · ${pct(e.tl, e.tl_int)}`],
    ["Faltas cometidas", (e) => String(e.faltas)],
  ];
  return (
    <CajaTabla>
      <table className="e-tabla e-tabla-pt" data-testid="partido-equipos">
        <thead><tr><th scope="col">Por equipo</th><th scope="col" className="e-c">{r.local}</th><th scope="col" className="e-c">{r.visitante}</th></tr></thead>
        <tbody>
          {filas.map(([t, f]) => <tr key={t}><td>{t}</td><td className="e-c e-mono">{f(est.local)}</td><td className="e-c e-mono">{f(est.visitante)}</td></tr>)}
        </tbody>
      </table>
    </CajaTabla>
  );
}

function TablaRival({ equipo, filas }: { equipo: string; filas: FilaRival[] }) {
  return (
    <>
      <h3 className="e-pt-h3">{equipo}</h3>
      <CajaTabla>
        <table className="e-tabla e-tabla-box" data-testid="rival-por-jugador">
          <thead><tr><th scope="col">#</th><th scope="col">Jugador</th><th scope="col" className="e-c">Min</th><th scope="col" className="e-c">Pts</th><th scope="col" className="e-c">2P</th><th scope="col" className="e-c">3P</th><th scope="col" className="e-c">TL</th><th scope="col" className="e-c">FC</th></tr></thead>
          <tbody>
            {filas.map((j, i) => {
              const dnp = j.segundos === 0;
              return (
                <tr key={i} className={dnp ? "e-dnp" : undefined}>
                  <td className="e-mono e-tenue">{j.dorsal}</td><td className="e-nombre">{bonito(j.nombre)}</td>
                  <td className="e-c e-mono">{dnp ? "DNP" : mmss(j.segundos)}</td><td className="e-c e-mono e-fuerte">{dnp ? "—" : j.pts}</td>
                  <td className="e-c e-mono">{dnp ? "" : j.p2a}</td><td className="e-c e-mono">{dnp ? "" : j.p3a}</td>
                  <td className="e-c e-mono">{dnp ? "" : `${j.tla}/${j.tli}`}</td><td className="e-c e-mono">{dnp ? "" : j.faltas}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CajaTabla>
    </>
  );
}

export default async function PaginaPartido({ params }: { params: Promise<{ temporada: string; id: string }> }) {
  const { temporada, id } = await params;
  if (temporada !== TEMPORADA_LIGA) notFound();
  const x = partidoPorId(decodeURIComponent(id));
  if (!x) notFound();
  const { grupo, r } = x;
  const G = LIGA.grupos[grupo];
  const nuestroId = Object.entries(G.equipos).find(([, e]) => e.nuestro)?.[0];
  const esNuestro = r.local_id === nuestroId || r.visitante_id === nuestroId;
  const nosLocal = r.local_id === nuestroId;
  const conHoja = !r.incomparecencia && !!r.est;

  // Hora y pista: del calendario (tabla de eventos, D151), que solo trae los partidos de MdA y MdL.
  const cal = esNuestro ? partidosCalendario(await cargarFuente()).find((p) => p.equipo === G.nuestro && p.jornada === r.jornada && !p.descansa) : undefined;
  // Parciales (actas) y boxscore de los nuestros: de la temporada publica (data/season_<t>.json), el mismo de la pestaña Equipo.
  const t = esNuestro ? await cargarTemporada(TEMPORADA_LIGA) : null;
  const sp = t?.partidos.find((p) => p.equipo === G.nuestro && p.fecha === r.fecha) as
    (NonNullable<typeof t>["partidos"][number] & { q_us?: number[]; q_them?: number[]; hora?: string; pista?: string }) | undefined;
  const box = t && sp ? t.box[`${sp.pn}_${G.nuestro}`] : undefined;
  const cuartos = conHoja && sp?.q_us?.length && sp.q_them?.length === sp.q_us.length
    ? { local: nosLocal ? sp.q_us : sp.q_them, visitante: nosLocal ? sp.q_them : sp.q_us }
    : null;
  const rivales = conHoja ? await rivalesPorJugador(grupo, r) : null;
  const pista = cal?.campo ? `Moratalaz · pista ${cal.campo}` : sp?.pista ? sp.pista : null;

  const gana = (a: number | null, b: number | null) => a != null && b != null && a > b;
  const Equipo = ({ nombre, idEq, lado }: { nombre: string; idEq: string; lado: "l" | "v" }) => (
    <Link href={hrefEquipo(grupo, idEq)} className={`e-pt-eq e-enlace-eq${(lado === "l" ? gana(r.pl, r.pv) : gana(r.pv, r.pl)) ? " e-gan" : ""}`} data-testid={`partido-${lado === "l" ? "local" : "visitante"}`}>{nombre}</Link>
  );

  return (
    <article className="e-pt" data-testid="pagina-partido" data-partido={r.id}>
      <div className="e-pt-volver"><Volver defecto={`/liga?g=${grupo}`} etiqueta={`Liga 26/27 · ${nombreGrupo(grupo)}`} /></div>
      <div className="e-pt-cab">
        <div className="e-pt-meta">Jornada {r.jornada} · {r.fecha ? diaLargo(r.fecha) : "fecha por confirmar"}{cal?.hora ? ` · ${cal.hora}` : ""}</div>
        {/* El cartel tal cual sale en el calendario oficial: primero el que figura en primer lugar (D129, sin «casa/fuera»). */}
        <div className="e-pt-cartel">
          <Equipo nombre={r.local} idEq={r.local_id} lado="l" />
          <span className="e-pt-marcador" data-testid="partido-marcador">{r.incomparecencia ? "incomp." : `${r.pl} – ${r.pv}`}</span>
          <Equipo nombre={r.visitante} idEq={r.visitante_id} lado="v" />
        </div>
        <div className="e-pt-meta">{pista ?? "Pista: no consta en nuestros datos (el calendario oficial solo trae la de los partidos de MdA y MdL)"}</div>
      </div>

      {!conHoja && (
        <div className="e-aviso" data-testid="partido-sin-hoja">
          {r.incomparecencia
            ? <>Incomparecencia: no se presentó <b>{r.no_presentado}</b>. No hay hoja de estadística de este partido; solo cuenta el resultado.</>
            : <>Falta la hoja de estadística de este partido (no se ha descargado): solo se enseña el marcador.</>}
        </div>
      )}

      {conHoja && (
        <>
          {cuartos && (
            <>
              <SecH titulo="Parciales" tag="por cuarto · acta oficial" />
              <CajaTabla>
                <table className="e-tabla e-tabla-pt" data-testid="partido-cuartos">
                  <thead><tr><th scope="col">Equipo</th>{cuartos.local.map((_, i) => <th key={i} scope="col" className="e-c">{i < 4 ? `${i + 1}º` : `Pr. ${i - 3}`}</th>)}<th scope="col" className="e-c">Total</th></tr></thead>
                  <tbody>
                    <tr><td>{r.local}</td>{cuartos.local.map((v, i) => <td key={i} className="e-c e-mono">{v}</td>)}<td className="e-c e-mono e-fuerte">{r.pl}</td></tr>
                    <tr><td>{r.visitante}</td>{cuartos.visitante.map((v, i) => <td key={i} className="e-c e-mono">{v}</td>)}<td className="e-c e-mono e-fuerte">{r.pv}</td></tr>
                  </tbody>
                </table>
              </CajaTabla>
            </>
          )}
          <SecH titulo="Estadísticas por equipo" tag="hoja de la FBM" />
          <EstadisticasEquipo r={r} est={r.est!} />
          <Nota>La hoja de la liga solo registra los tiros de 2 y de 3 anotados (no los intentados); los tiros libres llevan anotados e intentados.</Nota>

          {box && t && (
            <>
              <SecH titulo={`${NUESTRO_DE[grupo]} por jugador`} tag="boxscore" />
              <Boxscore filas={box} M={metricasDe(t.metrics)} />
            </>
          )}

          {rivales && (
            <section className="e-pt-gestores" data-testid="rival-por-jugador-seccion" aria-label="Rival por jugador, solo gestores">
              <SecH titulo="Rival por jugador · solo gestores" tag="D73" />
              <div className="e-aviso"><b>Solo gestores.</b> Datos por jugador de otros equipos: son de terceros y no se publican ni se enseñan a los jugadores.</div>
              {rivales.length === 0 && <Nota>No hay datos por jugador cargados de este partido (<code>npm run db:liga</code>).</Nota>}
              {[r.local, r.visitante].filter((n) => n !== NUESTRO_DE[grupo]).map((n) => {
                const filas = rivales.filter((j) => j.equipo === n);
                return filas.length ? <TablaRival key={n} equipo={n} filas={filas} /> : null;
              })}
            </section>
          )}
        </>
      )}
      <div className="e-fuente">Fuente: hojas de estadística de la FBM (app Afición FBM){cuartos ? " y acta oficial del partido" : ""}. Solo datos por equipo{box ? " y de los jugadores de Maccabis" : ""}.</div>
    </article>
  );
}
