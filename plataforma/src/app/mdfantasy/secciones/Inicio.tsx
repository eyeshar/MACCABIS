import Link from "next/link";
import Numeros from "@/components/numeros/Numeros";
import type { Fantasy } from "@/lib/fantasy/datos";
import { millones } from "@/lib/fantasy/reglas";
import { alineacionVigente, fechaCorta, pts, rankingDuelos, rankingManagers, rivalDe } from "@/lib/fantasy/vista";
import { fechaHora } from "@/lib/fechas";
import { CrearEquipo, CuentaAtras, PorraBotones } from "../Cliente";

export const enlaceManager = (id: string) => `/mdfantasy?tab=plantilla&m=${encodeURIComponent(id)}`;
export const enlaceJugador = (id: string) => `/mdfantasy/jugador/${encodeURIComponent(id)}`;

/** Por que no puede operar ahora mismo (null = puede). */
export function bloqueoDe(f: Fantasy): string | null {
  const e = f.estado;
  if (!e.jornada) return "No queda ninguna jornada por jugar.";
  if (e.cerrado) return "Cerrado desde el primer partido hasta que se publiquen las estadísticas.";
  if (e.gestor_bloqueado) return "Eres gestor: no puedes operar desde que existe el borrador de la convocatoria hasta que se publica.";
  return null;
}

export default function Inicio({ f }: { f: Fantasy }) {
  const e = f.estado;
  const yo = e.person_id;
  const mgr = e.es_manager && yo ? f.managers.find((m) => m.person_id === yo) : null;
  const general = rankingManagers(f.managers, f.puntosM);
  const mio = general.find((m) => m.person_id === yo);
  const apuntados = [{ k: "managers", etiqueta: f.managers.length === 1 ? "mánager" : "mánagers", n: f.managers.length, personas: f.managers.map((m) => ({ nombre: m.nombre, href: enlaceManager(m.person_id) })), vacio: "Aún no se ha apuntado nadie." }];

  if (!mgr) {
    return (
      <>
        <section className="gs-bloque fz-bienvenida" aria-labelledby="t-fz-bien" data-testid="fz-bienvenida">
          <h2 id="t-fz-bien" className="fz-h2">Hazte mánager</h2>
          <ul className="fz-reglas">
            <li>Te toca una plantilla de {f.P.plantilla} jugadores del club al azar y {millones(f.P.cajaInicial)} de caja.</li>
            <li>Cada domingo alineas a {f.P.alineados}; suman sus puntos reales y su compromiso.</li>
            <li>Ficha, vende y haz clausulazos en el mercado.</li>
          </ul>
          {!yo ? <p className="aviso aviso-info">Tu cuenta no tiene ficha: puedes mirar, pero no jugar.</p>
            : e.cerrado && e.jornada ? <p className="aviso aviso-info">Ahora mismo está cerrado (hay jornada en juego). Podrás crear tu equipo cuando se publiquen las estadísticas.</p>
            : <CrearEquipo />}
        </section>
        <Numeros prueba="fz-apuntados" etiqueta="Mánagers apuntados" variante="linea" grupos={apuntados} />
        {e.es_gestor && <p><Link href="/mdfantasy/ajustes" className="boton boton-contorno">Ajustes</Link></p>}
      </>
    );
  }

  const alineacion = alineacionVigente(yo!, e.jornada, f.alineaciones, f.copias.filter((c) => c.manager === yo).map((c) => c.jugador));
  const completa = alineacion.titulares.length >= f.P.alineados && !!alineacion.capitan;
  const rival = yo ? rivalDe(yo, f.managers, f.jornadas) : null;
  const miDuelo = rankingDuelos(f.managers, f.duelos).find((d) => d.person_id === yo);
  const ultimo = [...f.duelos].reverse().find((d) => (d.manager_a === yo || d.manager_b === yo) && d.manager_b && d.puntos_a != null);
  const misPorras = new Map(f.porras.filter((p) => p.manager === yo && p.jornada === e.jornada).map((p) => [p.equipo, p.pronostico]));
  const logros = f.logros.filter((l) => l.manager === yo);
  const ultimaJ = f.puntosM.filter((p) => p.manager === yo).at(-1);

  return (
    <>
      {e.jornada && (
        <section className={`gs-bloque fz-aviso${completa || e.cerrado ? "" : " fz-aviso-falta"}`} aria-labelledby="t-fz-cierre" data-testid="fz-cierre">
          <h2 id="t-fz-cierre" className="fz-h2">Jornada del {fechaCorta(e.jornada)}</h2>
          {e.cerrado ? <p className="suave" style={{ margin: 0 }}>En juego. Los puntos salen cuando se publiquen las estadísticas.</p> : (
            <>
              <p style={{ margin: 0 }}>Cierra en {e.primer_partido && <CuentaAtras hasta={e.primer_partido} ahora={e.ahora} />} <span className="suave">· {e.primer_partido ? fechaHora(e.primer_partido) : ""}</span></p>
              <p style={{ margin: 0 }} data-testid="fz-estado-alineacion">
                {completa ? <>✓ Tienes {alineacion.titulares.length} alineados y capitán{alineacion.mantenida ? " (se mantiene la de la jornada pasada)" : ""}.</> : <><b>Te falta alinear</b> ({alineacion.titulares.length} de {f.P.alineados}{!alineacion.capitan ? ", sin capitán" : ""}).</>}
                {" "}<Link href="/mdfantasy?tab=plantilla">{completa ? "Cambiar" : "Alinear"} ›</Link>
              </p>
            </>
          )}
        </section>
      )}

      <div className="gs-cifras fz-cifras" data-testid="fz-cifras">
        <Link href="/mdfantasy?tab=ranking" className="num-caja fz-caja"><b className="cifra">{mio && mio.jornadas > 0 ? `${mio.puesto}.º` : "—"}</b><span>Puesto</span></Link>
        <Link href="/mdfantasy?tab=ranking" className="num-caja fz-caja"><b className="cifra">{pts(mio?.total ?? 0)}</b><span>Puntos</span></Link>
        <Link href={ultimaJ ? `/mdfantasy?tab=jornada&j=${ultimaJ.jornada}` : "/mdfantasy?tab=jornada"} className="num-caja fz-caja"><b className="cifra">{ultimaJ ? pts(ultimaJ.total) : "—"}</b><span>Última jornada</span></Link>
        <Link href="/mdfantasy?tab=mercado" className="num-caja fz-caja"><b className="cifra">{millones(e.caja)}</b><span>Caja</span></Link>
      </div>

      <section className="gs-bloque" aria-labelledby="t-fz-duelo" data-testid="fz-duelo">
        <h2 id="t-fz-duelo" className="fz-h2">Duelo</h2>
        {rival ? <p style={{ margin: 0 }}>Esta jornada, contra <Link href={enlaceManager(rival.person_id)}>{rival.nombre}</Link>.</p>
          : <p className="suave" style={{ margin: 0 }}>{f.managers.length < 2 ? "Hace falta otro mánager para tener rival." : "Esta jornada descansas."}</p>}
        {ultimo && <p className="suave" style={{ margin: 0 }}>Último ({fechaCorta(ultimo.jornada)}): {f.nombreM.get(ultimo.manager_a)} {pts(Number(ultimo.puntos_a))} - {pts(Number(ultimo.puntos_b))} {f.nombreM.get(ultimo.manager_b!)}</p>}
        {miDuelo && <p style={{ margin: 0 }}><Link href="/mdfantasy?tab=ranking&r=duelos">Duelos: {miDuelo.g} ganados · {miDuelo.e} empatados · {miDuelo.p} perdidos ›</Link></p>}
      </section>

      {e.jornada && e.equipos.length > 0 && (
        <section className="gs-bloque" aria-labelledby="t-fz-porra" data-testid="fz-porra">
          <h2 id="t-fz-porra" className="fz-h2">Porra <span className="suave fz-h2-nota">+{f.P.porraAcierto} por acierto</span></h2>
          {e.equipos.map((x) => <PorraBotones key={x.equipo} equipo={x.equipo} rival={x.rival ?? "rival"} actual={misPorras.get(x.equipo) ?? null} cerrado={e.cerrado} />)}
        </section>
      )}

      <section className="gs-bloque" aria-labelledby="t-fz-logros" data-testid="fz-logros">
        <h2 id="t-fz-logros" className="fz-h2">Logros</h2>
        {logros.length ? (
          <ul className="lista-limpia fz-logros">
            {logros.slice(0, 8).map((l) => <li key={`${l.logro}-${l.jornada}`}><span className="pastilla pastilla-jugo">{l.texto}</span> <Link href={`/mdfantasy?tab=jornada&j=${l.jornada}`} className="tenue pequeno">{fechaCorta(l.jornada)}</Link></li>)}
          </ul>
        ) : <p className="suave" style={{ margin: 0 }}>Aún no tienes logros.</p>}
      </section>

      <Numeros prueba="fz-apuntados" etiqueta="Mánagers apuntados" variante="linea" grupos={apuntados} />
      {e.es_gestor && <p><Link href="/mdfantasy/ajustes" className="boton boton-contorno" data-testid="fz-ir-ajustes">Ajustes</Link></p>}
    </>
  );
}
