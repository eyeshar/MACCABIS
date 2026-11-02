import Link from "next/link";
import { ETIQUETA, lineaClave, primerasClaves, type Clave, type ResultadoClaves } from "@/lib/scouting/claves";

// «Claves del partido» (D174): lo que hay que saber del rival, en frases cortas calculadas con reglas fijas. Solo con sesion.

function Lista({ claves, id }: { claves: Clave[]; id?: string }) {
  return (
    <ul className="cl-lista" data-testid={id}>
      {claves.map((c) => (
        <li key={`${c.regla}-${c.texto}`} className={`cl-clave cl-${c.tipo}`} data-regla={c.regla} data-tipo={c.tipo}>
          <b className="cl-etq">{ETIQUETA[c.tipo]}</b> <span>{c.texto}</span>
        </li>
      ))}
    </ul>
  );
}

/** Caja de la pagina del rival en Scouting: «Del equipo» (hasta 3) y «Jugadores a vigilar» (hasta 3), o «Pocos datos: N partidos jugados». */
export function CajaClaves({ res, equipo }: { res: ResultadoClaves; equipo: string }) {
  return (
    <section className="tarjeta cl-caja" data-testid="claves-partido" aria-label={`Claves del partido contra ${equipo}`}>
      <h3 className="lg-etq" style={{ marginTop: 0 }}>Claves del partido</h3>
      {res.pocosDatos ? <p className="lg-sub" data-testid="claves-pocos-datos">{res.pocosDatos}</p> : (
        <>
          <h4 className="cl-sub">Del equipo</h4>
          {res.equipo.length ? <Lista claves={res.equipo} id="claves-lista" />
            : <p className="lg-sub" data-testid="claves-ninguna">Ningún dato de {equipo} se aparta lo bastante de la media de los equipos de su grupo.</p>}
          <h4 className="cl-sub">Jugadores a vigilar</h4>
          {res.jugadores.length ? <Lista claves={res.jugadores} id="claves-jugadores" />
            : <p className="lg-sub" data-testid="claves-ninguna-jugadores">Ningún jugador de {equipo} destaca todavía entre los del grupo.</p>}
        </>
      )}
      <p className="lg-nota">
        Calculadas con reglas fijas a partir de las hojas de la FBM de esta temporada. «Del equipo»: frente a la media de los equipos de su grupo (sin contarlo a él),
        solo lo que se aparta un 20 % o más. «Jugadores a vigilar»: cada jugador frente a los jugadores del grupo, con su mínimo de partidos. No hay rebotes,
        asistencias ni pérdidas en esas hojas.
      </p>
    </section>
  );
}

/** Las 2 primeras claves, en las tarjetas del Panel y de «Tu proximo partido», con enlace al scouting del rival. */
export function ClavesTarjeta({ res, href }: { res: ResultadoClaves; href?: string }) {
  const ver = primerasClaves(res);   // la primera de cada via
  if (!ver.length && !res.pocosDatos) return null;
  return (
    <div className="cl-tarjeta" data-testid="claves-tarjeta">
      {res.pocosDatos ? <p className="cl-linea cl-pocos" data-testid="claves-pocos-datos">{res.pocosDatos}</p>
        : ver.map((c) => <p key={`${c.bloque}-${c.regla}`} className={`cl-linea cl-${c.tipo}`} data-regla={c.regla} data-tipo={c.tipo}>{lineaClave(c)}</p>)}
      {href && <Link href={href} className="cl-mas">Ver el scouting</Link>}
    </div>
  );
}
