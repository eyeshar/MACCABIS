import Link from "next/link";
import type { Fantasy } from "@/lib/fantasy/datos";
import { conSigno, mesDe, nombreMes, premiosDelMes, pts, rankingDuelos, rankingJugadores, rankingManagers, resumenWhatsapp } from "@/lib/fantasy/vista";
import { Copiar } from "../Cliente";
import type { Consulta } from "../page";
import { enlaceJugador, enlaceManager } from "./Inicio";

const SUB = [{ id: "managers", texto: "Mánagers" }, { id: "jugadores", texto: "Jugadores" }, { id: "compromiso", texto: "Compromiso" }, { id: "duelos", texto: "Duelos" }] as const;

/** Ranking: podio; pestañas de managers, jugadores, compromiso y duelos; premios del mes; resumen para WhatsApp. */
export default function Ranking({ f, q }: { f: Fantasy; q: Consulta }) {
  const yo = f.estado.person_id;
  const sub = SUB.find((s) => s.id === q.r)?.id ?? "managers";
  const general = rankingManagers(f.managers, f.puntosM);
  const podio = general.filter((m) => m.jornadas > 0).slice(0, 3);
  const meses = [...new Set(f.jornadas.map((j) => mesDe(j.fecha)))];
  const mes = q.mes && meses.includes(q.mes) ? q.mes : meses.at(-1);
  const premios = mes ? premiosDelMes(mes, f.managers, f.jugadores, f.puntosM, f.puntosJ) : [];
  const ultima = f.jornadas.at(-1)?.fecha;
  const resumen = ultima ? resumenWhatsapp(ultima, f.managers, f.jugadores, f.puntosM, f.puntosJ, f.duelos) : "";
  const url = (r: string) => `/mdfantasy?tab=ranking${r === "managers" ? "" : `&r=${r}`}${q.mes ? `&mes=${q.mes}` : ""}`;

  return (
    <>
      {podio.length > 0 && (
        <ol className="fz-podio" aria-label="Podio" data-testid="fz-podio">
          {podio.map((m, i) => (
            <li key={m.person_id} className={`fz-podio-${i + 1}`}>
              <span className="fz-podio-puesto" aria-hidden="true">{i + 1}</span>
              <Link href={enlaceManager(m.person_id)}>{m.nombre}</Link>
              <b className="cifra">{pts(m.total)}</b>
            </li>
          ))}
        </ol>
      )}

      <nav className="fz-chips" aria-label="Clasificaciones" data-testid="fz-sub">
        {SUB.map((s) => <Link key={s.id} href={url(s.id)} aria-current={sub === s.id ? "page" : undefined}>{s.texto}</Link>)}
      </nav>

      <section className="gs-bloque" aria-label={SUB.find((s) => s.id === sub)!.texto} data-testid={`fz-ranking-${sub}`}>
        {sub === "managers" && (general.length ? (
          <ol className="fz-orden">
            {general.map((m) => <li key={m.person_id} className={m.person_id === yo ? "es-mio" : undefined}><span className="fz-puesto mono">{m.puesto}</span><Link href={enlaceManager(m.person_id)}>{m.nombre}</Link><span className="tenue pequeno">{m.jornadas} j.</span><b className="mono">{pts(m.total)}</b></li>)}
          </ol>
        ) : <p className="suave" style={{ margin: 0 }}>Aún no hay mánagers.</p>)}
        {(sub === "jugadores" || sub === "compromiso") && (
          <ol className="fz-orden">
            {rankingJugadores(f.jugadores, f.puntosJ, sub === "jugadores" ? "total" : "compromiso").map((j, i) => (
              <li key={j.person_id} className={j.person_id === yo ? "es-mio" : undefined}><span className="fz-puesto mono">{i + 1}</span><Link href={enlaceJugador(j.person_id)}>{j.nombre}</Link><span className="tenue pequeno">{sub === "jugadores" ? `${j.jugadas} jugadas` : `${j.jornadasCon} j.`}</span><b className="mono">{sub === "jugadores" ? pts(j.puntos) : conSigno(j.puntos)}</b></li>
            ))}
          </ol>
        )}
        {sub === "duelos" && (
          <ol className="fz-orden">
            {rankingDuelos(f.managers, f.duelos).map((m, i) => <li key={m.person_id} className={m.person_id === yo ? "es-mio" : undefined}><span className="fz-puesto mono">{i + 1}</span><Link href={enlaceManager(m.person_id)}>{m.nombre}</Link><span className="tenue pequeno">{m.g}-{m.e}-{m.p}</span><b className="mono">{m.puntos}</b></li>)}
          </ol>
        )}
        {sub === "duelos" && <p className="tenue pequeno" style={{ margin: 0 }}>Ganados-empatados-perdidos · 2 puntos por victoria, 1 por empate. No suma a la clasificación general.</p>}
      </section>

      {mes && (
        <section className="gs-bloque" aria-labelledby="t-fz-premios" data-testid="fz-premios">
          <h2 id="t-fz-premios" className="fz-h2">Premios de {nombreMes(mes)}</h2>
          {meses.length > 1 && <nav className="fz-chips" aria-label="Meses">{meses.map((m) => <Link key={m} href={`/mdfantasy?tab=ranking${sub === "managers" ? "" : `&r=${sub}`}&mes=${m}`} aria-current={m === mes ? "page" : undefined}>{nombreMes(m).split(" ")[0]}</Link>)}</nav>}
          {premios.length ? (
            <ul className="lista-limpia fz-premios">
              {premios.map((p) => <li key={p.premio}><span className="pastilla pastilla-jugo">{p.premio}</span><Link href={p.manager ? enlaceManager(p.person_id) : enlaceJugador(p.person_id)}>{p.nombre}</Link><b className="mono">{pts(p.puntos)}</b></li>)}
            </ul>
          ) : <p className="suave" style={{ margin: 0 }}>Sin datos ese mes.</p>}
        </section>
      )}

      {resumen && (
        <section className="gs-bloque" aria-labelledby="t-fz-wa" data-testid="fz-whatsapp">
          <h2 id="t-fz-wa" className="fz-h2">Resumen para WhatsApp</h2>
          <pre className="fz-resumen" data-testid="fz-resumen">{resumen}</pre>
          <Copiar texto={resumen} etiqueta="Copiar resumen" prueba="fz-copiar-resumen" />
        </section>
      )}
    </>
  );
}
