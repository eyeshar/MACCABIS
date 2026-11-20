import Link from "next/link";
import type { Fantasy } from "@/lib/fantasy/datos";
import { precioClausula } from "@/lib/fantasy/manager";
import { millones } from "@/lib/fantasy/reglas";
import { fechaCorta, importe, pts, textoMovimiento } from "@/lib/fantasy/vista";
import { BotonClausulazo, BotonMercado } from "../Cliente";
import { bloqueoDe, enlaceJugador, enlaceManager } from "./Inicio";

/** Mercado: valor, copias libres, fichar, vender, clausulazo y movimientos. */
export default function Mercado({ f }: { f: Fantasy }) {
  const e = f.estado;
  const yo = e.es_manager ? e.person_id : null;
  const bloqueo = yo ? bloqueoDe(f) : "Crea tu equipo para operar.";
  const mias = new Set(f.copias.filter((c) => c.manager === yo).map((c) => c.jugador));
  const llena = mias.size >= f.P.plantilla;
  const clausulazoHecho = !!yo && f.movimientos.some((m) => m.manager === yo && m.tipo === "clausulazo" && m.jornada === e.jornada);
  const jug = new Map(f.jugadores.map((j) => [j.person_id, j]));
  const mercado = f.jugadores.filter((j) => j.en_mercado).sort((a, b) => b.valor - a.valor || a.nombre.localeCompare(b.nombre, "es"));
  const duenosDe = (id: string) => f.copias.filter((c) => c.jugador === id);

  return (
    <>
      <div className="gs-cifras fz-cifras fz-cifras-3" data-testid="fz-cifras-mercado">
        <div className="num-caja"><b className="cifra" data-testid="fz-caja">{millones(e.caja)}</b><span>Tu caja</span></div>
        <div className="num-caja"><b className="cifra">{mias.size}/{f.P.plantilla}</b><span>Tu plantilla</span></div>
        <div className="num-caja"><b className="cifra">{clausulazoHecho ? "0" : "1"}</b><span>Clausulazo esta jornada</span></div>
      </div>
      {bloqueo && <p className="aviso aviso-info" data-testid="fz-mercado-bloqueo">{bloqueo}</p>}
      {!bloqueo && e.clausulas_cerradas && <p className="aviso aviso-info" data-testid="fz-clausulas-cerradas">Clausulazos cerrados desde el sábado a las 20:00.</p>}

      {yo && (
        <section className="gs-bloque" aria-labelledby="t-fz-mia" data-testid="fz-vender">
          <h2 id="t-fz-mia" className="fz-h2">Tu plantilla</h2>
          <ul className="lista-limpia fz-mercado">
            {[...mias].map((id) => jug.get(id)).filter((j): j is NonNullable<typeof j> => !!j).sort((a, b) => b.valor - a.valor).map((j) => (
              <li key={j.person_id} className="fz-fila">
                <span className="fz-fila-quien"><Link href={enlaceJugador(j.person_id)}>{j.nombre}</Link><span className="tenue pequeno">{pts(j.media)} pts de media</span></span>
                <b className="cifra fz-valor">{millones(j.valor)}</b>
                <BotonMercado accion="vender" jugador={j.person_id} nombre={j.nombre} precio={millones(j.valor)} desactivado={bloqueo ? "Cerrado" : null} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="gs-bloque" aria-labelledby="t-fz-mercado" data-testid="fz-mercado">
        <h2 id="t-fz-mercado" className="fz-h2">Jugadores <span className="suave fz-h2-nota">clausulazo = valor × {String(f.P.clausula).replace(".", ",")}</span></h2>
        <ul className="lista-limpia fz-mercado">
          {mercado.map((j) => {
            const duenos = duenosDe(j.person_id);
            const libres = Math.max(0, j.copias - duenos.length);
            const esMio = mias.has(j.person_id);
            const soyYo = j.person_id === e.person_id;
            const cara = precioClausula(j.valor, f.P);
            let accion: React.ReactNode;
            if (!yo) accion = null;
            else if (esMio) accion = <span className="pastilla pastilla-ok">Lo tienes</span>;
            else if (soyYo) accion = <span className="fz-no tenue pequeno">Eres tú</span>;
            else if (libres > 0) accion = <BotonMercado accion="fichar" jugador={j.person_id} nombre={j.nombre} precio={millones(j.valor)} desactivado={bloqueo ? "Cerrado" : llena ? "Plantilla llena" : e.caja < j.valor ? "No te llega" : null} />;
            else accion = <BotonClausulazo jugador={j.person_id} nombre={j.nombre} precio={millones(cara)} duenos={duenos.filter((d) => d.manager !== yo).map((d) => ({ id: d.manager, nombre: f.nombreM.get(d.manager) ?? "?", protegida: d.robada_en === e.jornada }))}
              desactivado={bloqueo ? "Cerrado" : e.clausulas_cerradas ? "Clausulazos cerrados" : clausulazoHecho ? "Ya has hecho tu clausulazo" : llena ? "Plantilla llena" : e.caja < cara ? `Clausulazo: ${millones(cara)}` : null} />;
            return (
              <li key={j.person_id} className="fz-fila" data-testid={`fz-jugador-${j.person_id}`}>
                <span className="fz-fila-quien">
                  <Link href={enlaceJugador(j.person_id)}>{j.nombre}</Link>
                  <span className="tenue pequeno">{pts(j.media)} pts · {libres} {libres === 1 ? "libre" : "libres"} de {j.copias}</span>
                </span>
                <b className="cifra fz-valor">{millones(j.valor)}</b>
                {accion}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="gs-bloque" aria-labelledby="t-fz-mov" data-testid="fz-movimientos">
        <h2 id="t-fz-mov" className="fz-h2">Movimientos</h2>
        {f.movimientos.length ? (
          <ul className="lista-limpia fz-movs">
            {f.movimientos.filter((m) => m.tipo !== "inicio" && (m.tipo !== "ingreso" || m.manager === yo)).slice(0, 40).map((m) => (
              <li key={m.id}>
                <span><Link href={enlaceManager(m.manager)}>{f.nombreM.get(m.manager) ?? "?"}</Link> · {m.jugador ? <Link href={enlaceJugador(m.jugador)}>{textoMovimiento(m, f.nombreJ, f.nombreM)}</Link> : textoMovimiento(m, f.nombreJ, f.nombreM)}</span>
                <span className={`mono ${m.importe >= 0 ? "ev-ok" : "ev-no"}`}>{importe(m.importe)}</span>
                <span className="tenue pequeno">{fechaCorta(m.creado_en.slice(0, 10))}</span>
              </li>
            ))}
          </ul>
        ) : <p className="suave" style={{ margin: 0 }}>Aún no hay movimientos.</p>}
      </section>
    </>
  );
}
