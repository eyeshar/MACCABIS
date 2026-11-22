import Link from "next/link";
import type { Fantasy } from "@/lib/fantasy/datos";
import { precioClausula } from "@/lib/fantasy/manager";
import { millones } from "@/lib/fantasy/reglas";
import { CLASE_RESPUESTA, fechaCorta, importe, marcaConvocado, marcaRespuesta, mediaValor, textoMediaValor, textoMovimiento, type MarcaConvocado, type MarcaRespuesta } from "@/lib/fantasy/vista";
import { BotonClausulazo, BotonMercado } from "../Cliente";
import type { Consulta } from "../page";
import { bloqueoDe, enlaceJugador, enlaceManager } from "./Inicio";

export const Marca = ({ m }: { m: MarcaConvocado | null }) => (m ? <span className={`pastilla fz-conv ${m.clase === "si" ? "pastilla-ok" : "pastilla-pendiente"}`} data-conv={m.clase}>{m.texto}</span> : null);
/** Antes de la convocatoria: lo que ha contestado al domingo. */
export const Respuesta = ({ m }: { m: MarcaRespuesta | null }) => (m ? <span className={`pastilla fz-conv ${CLASE_RESPUESTA[m.clase]}`} data-resp={m.clase}>{m.texto}</span> : null);

/** Mercado: valor, copias libres, fichar, vender, clausulazo y movimientos. Con `?c=1`, solo los convocados. */
export default function Mercado({ f, q }: { f: Fantasy; q: Consulta }) {
  const e = f.estado;
  const yo = e.es_manager ? e.person_id : null;
  const bloqueo = yo ? bloqueoDe(f) : "Crea tu equipo para operar.";
  const mias = new Set(f.copias.filter((c) => c.manager === yo).map((c) => c.jugador));
  const llena = mias.size >= f.P.plantilla;
  const clausulazoHecho = !!yo && f.movimientos.some((m) => m.manager === yo && m.tipo === "clausulazo" && m.jornada === e.jornada);
  const jug = new Map(f.jugadores.map((j) => [j.person_id, j]));
  const conv = e.jornada ? e.convocatoria ?? null : null;
  const soloConv = !!conv && q.c === "1";
  const marca = (id: string) => marcaConvocado(conv, id);
  const resp = (id: string) => (conv ? null : marcaRespuesta(e.respuestas, id));
  const media = (id: string) => textoMediaValor(mediaValor(f.puntosJ, id, f.P.jornadasValor), f.P.jornadasValor);
  const mercado = f.jugadores.filter((j) => j.en_mercado && (!soloConv || marca(j.person_id)?.clase === "si")).sort((a, b) => b.valor - a.valor || a.nombre.localeCompare(b.nombre, "es"));
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
                <span className="fz-fila-quien"><Link href={enlaceJugador(j.person_id)}>{j.nombre}</Link><span className="tenue pequeno">{media(j.person_id)}</span><Marca m={marca(j.person_id)} /><Respuesta m={resp(j.person_id)} /></span>
                <b className="cifra fz-valor">{millones(j.valor)}</b>
                <BotonMercado accion="vender" jugador={j.person_id} nombre={j.nombre} precio={millones(j.valor)} desactivado={bloqueo ? "Cerrado" : null} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="gs-bloque" aria-labelledby="t-fz-mercado" data-testid="fz-mercado">
        <h2 id="t-fz-mercado" className="fz-h2">Jugadores <span className="suave fz-h2-nota">clausulazo = valor × {String(f.P.clausula).replace(".", ",")}</span></h2>
        {e.jornada && (conv ? (
          <nav className="fz-chips" aria-label="Filtro del mercado" data-testid="fz-filtro-conv">
            <Link href="/mdfantasy?tab=mercado" aria-current={!soloConv ? "page" : undefined}>Todos</Link>
            <Link href="/mdfantasy?tab=mercado&c=1" aria-current={soloConv ? "page" : undefined}>Convocados</Link>
          </nav>
        ) : <p className="aviso aviso-info" data-testid="fz-conv-sin-publicar">Convocatoria sin publicar.{e.respuestas ? " En cada jugador, lo que ha contestado al domingo." : ""}</p>)}
        {soloConv && !mercado.length && <p className="suave" style={{ margin: 0 }}>No hay ningún convocado en el mercado.</p>}
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
                  <span className="tenue pequeno">{media(j.person_id)} · {libres} {libres === 1 ? "libre" : "libres"} de {j.copias}</span>
                  <Marca m={marca(j.person_id)} />
                  <Respuesta m={resp(j.person_id)} />
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
