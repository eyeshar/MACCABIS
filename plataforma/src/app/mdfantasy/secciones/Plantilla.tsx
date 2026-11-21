import Link from "next/link";
import type { Fantasy } from "@/lib/fantasy/datos";
import { millones } from "@/lib/fantasy/reglas";
import { alineacionVigente, fechaCorta, marcaConvocado, marcaRespuesta, mediaValor, pts, textoMediaValor } from "@/lib/fantasy/vista";
import { Alineador } from "../Cliente";
import type { Consulta } from "../page";
import { bloqueoDe, enlaceJugador } from "./Inicio";

/** Plantilla: la pista con los alineados, capitan y vicecapitan, caja, valor de plantilla y banquillo. Con `?m=` se ve la
 *  de otro manager: su plantilla siempre; su alineacion, solo desde el cierre (la base no la manda antes). */
export default function Plantilla({ f, q }: { f: Fantasy; q: Consulta }) {
  const e = f.estado;
  const de = q.m && f.managers.some((m) => m.person_id === q.m) ? q.m : e.es_manager ? e.person_id : null;
  if (!de) {
    return (
      <section className="gs-bloque" data-testid="fz-sin-equipo">
        <p style={{ margin: 0 }}>Aún no tienes equipo. <Link href="/mdfantasy">Créalo en Inicio ›</Link></p>
        <ListaManagers f={f} />
      </section>
    );
  }
  const mio = de === e.person_id;
  const jug = new Map(f.jugadores.map((j) => [j.person_id, j]));
  const plantilla = f.copias.filter((c) => c.manager === de).map((c) => jug.get(c.jugador)).filter((j): j is NonNullable<typeof j> => !!j).sort((a, b) => b.valor - a.valor || a.nombre.localeCompare(b.nombre, "es"));
  const valor = plantilla.reduce((s, j) => s + j.valor, 0);
  const alin = e.jornada ? f.alineaciones.find((a) => a.manager === de && a.jornada === e.jornada) : undefined;
  const vigente = alineacionVigente(de, e.jornada, f.alineaciones, plantilla.map((j) => j.person_id));
  const conv = e.jornada ? e.convocatoria ?? null : null;
  const N = f.P.jornadasValor;
  const mv = (id: string) => mediaValor(f.puntosJ, id, N);
  const caja = mio ? e.caja : f.movimientos.filter((m) => m.manager === de).reduce((s, m) => s + m.importe, 0);

  return (
    <>
      {!mio && <p className="fz-de" data-testid="fz-de-otro">Plantilla de <b>{f.nombreM.get(de)}</b> · <Link href="/mdfantasy?tab=plantilla">ver la mía</Link></p>}
      <div className="gs-cifras fz-cifras fz-cifras-3" data-testid="fz-cifras-plantilla">
        <div className="num-caja"><b className="cifra">{millones(caja)}</b><span>Caja</span></div>
        <div className="num-caja"><b className="cifra">{millones(valor)}</b><span>Valor de plantilla</span></div>
        <div className="num-caja"><b className="cifra">{plantilla.length}/{f.P.plantilla}</b><span>Jugadores</span></div>
      </div>
      <section className="gs-bloque" aria-labelledby="t-fz-pista">
        <h2 id="t-fz-pista" className="fz-h2">{e.jornada ? `Alineación · jornada del ${fechaCorta(e.jornada)}` : "Alineación"}</h2>
        {mio ? (
          <Alineador
            key={`${e.jornada}-${plantilla.map((p) => p.person_id).join()}`}
            plantilla={plantilla.map((j) => ({ id: j.person_id, nombre: j.nombre, valor: millones(j.valor), media: mv(j.person_id) == null ? "—" : pts(mv(j.person_id)!), conv: marcaConvocado(conv, j.person_id), resp: conv ? null : marcaRespuesta(e.respuestas, j.person_id) }))}
            sinPublicar={!!e.jornada && !conv} jornadasValor={N}
            inicial={{ titulares: vigente.titulares, capitan: vigente.capitan, vice: vigente.vice }}
            max={f.P.alineados} vetado={vigente.vetado} bloqueo={bloqueoDe(f)}
          />
        ) : alin ? (
          <div className="fz-pista" role="list" data-testid="fz-pista-otro">
            {alin.titulares.map((id) => (
              <div key={id} role="listitem" className={`fz-ficha${alin.capitan === id ? " es-cap" : alin.vice === id ? " es-vice" : ""}`}>
                {(alin.capitan === id || alin.vice === id) && <b className="fz-galon" aria-label={alin.capitan === id ? "Capitán" : "Vicecapitán"}>{alin.capitan === id ? "C" : "V"}</b>}
                <Link href={enlaceJugador(id)} className="fz-ficha-nombre">{f.nombreJ.get(id) ?? "?"}</Link>
              </div>
            ))}
          </div>
        ) : (
          <>
            <p className="suave" style={{ margin: 0 }} data-testid="fz-oculta">Su alineación, capitán y porra no se ven hasta el cierre de la jornada.</p>
            <ul className="lista-limpia fz-banquillo" data-testid="fz-plantilla-otro">
              {plantilla.map((j) => <li key={j.person_id}><Link href={enlaceJugador(j.person_id)}>{j.nombre}</Link><span className="tenue pequeno">{millones(j.valor)} · {textoMediaValor(mv(j.person_id), N)}</span></li>)}
            </ul>
          </>
        )}
      </section>
      {!mio && alin && (
        <section className="gs-bloque" aria-labelledby="t-fz-resto">
          <h2 id="t-fz-resto" className="fz-h2">Banquillo</h2>
          <ul className="lista-limpia fz-banquillo">
            {plantilla.filter((j) => !alin.titulares.includes(j.person_id)).map((j) => <li key={j.person_id}><Link href={enlaceJugador(j.person_id)}>{j.nombre}</Link><span className="tenue pequeno">{millones(j.valor)}</span></li>)}
          </ul>
        </section>
      )}
      {mio && <p className="suave pequeno">El capitán dobla su rendimiento y no puede repetir dos jornadas seguidas; si no juega, dobla el vicecapitán. Si no cambias nada, la alineación se mantiene (capitán y vicecapitán se intercambian). Para fichar o vender: <Link href="/mdfantasy?tab=mercado">Mercado ›</Link></p>}
      <ListaManagers f={f} actual={de} />
    </>
  );
}

function ListaManagers({ f, actual }: { f: Fantasy; actual?: string }) {
  const otros = f.managers.filter((m) => m.person_id !== actual);
  if (!otros.length) return null;
  return (
    <nav className="fz-otros" aria-label="Plantillas de los demás" data-testid="fz-otros">
      <span className="tenue pequeno">Otras plantillas:</span>
      {otros.map((m) => <Link key={m.person_id} href={`/mdfantasy?tab=plantilla&m=${encodeURIComponent(m.person_id)}`}>{m.nombre}</Link>)}
    </nav>
  );
}
