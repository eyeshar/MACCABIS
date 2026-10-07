"use client";

import { useActionState } from "react";
import { TEXTO_ESTADO_PISTA, type EstadoPista, type Pista } from "@/lib/eventos/dominio";
import { cambiarPista, crearPista } from "../acciones";

const ESTADOS = Object.keys(TEXTO_ESTADO_PISTA) as EstadoPista[];

export function FilaPista({ pista }: { pista: Pista }) {
  const [res, accion, guardando] = useActionState(cambiarPista.bind(null, pista.id), null);
  const enObras = pista.estado === "en_obras";
  return (
    <li className="gs-bloque" data-pista={pista.slug}>
      <div className="gs-bloque-cab">
        <h3 style={{ margin: 0 }}>{pista.nombre}</h3>
        <span className={`pastilla ${enObras ? "etiqueta-aviso" : pista.estado === "habitual" ? "pastilla-ok" : ""}`}>{TEXTO_ESTADO_PISTA[pista.estado]}</span>
      </div>
      <p className="pequeno suave" style={{ margin: 0 }}>
        {pista.uso === "partido" ? "Partidos de liga" : pista.es_de_serie ? "Pista habitual de la serie de entrenos" : "Entrenos"}
        {pista.nota ? ` · ${pista.nota}` : ""}
      </p>
      {res?.error && <div className="aviso aviso-error" role="alert">{res.error}</div>}
      <form action={accion} className="ev-dos">
        <div className="campo" style={{ margin: 0 }}>
          <label htmlFor={`estado-${pista.id}`}>Estado</label>
          <select id={`estado-${pista.id}`} name="estado" defaultValue={pista.estado}>{ESTADOS.map((e) => <option key={e} value={e}>{TEXTO_ESTADO_PISTA[e]}</option>)}</select>
        </div>
        <div className="campo" style={{ margin: 0 }}>
          <label htmlFor={`nump-${pista.id}`}>Número de pistas</label>
          <input id={`nump-${pista.id}`} name="num_pistas" type="number" min={1} defaultValue={pista.num_pistas ?? ""} />
        </div>
        <div className="campo" style={{ margin: 0 }}>
          <label htmlFor={`dir-${pista.id}`}>Dirección</label>
          <input id={`dir-${pista.id}`} name="direccion" type="text" defaultValue={pista.direccion ?? ""} placeholder="Sin dirección: la pones tú" />
        </div>
        <div className="campo" style={{ margin: 0 }}>
          <label htmlFor={`nota-${pista.id}`}>Nota</label>
          <input id={`nota-${pista.id}`} name="nota" type="text" defaultValue={pista.nota ?? ""} />
        </div>
        <div className="botones" style={{ margin: 0 }}>
          <button className="boton boton-amarillo" type="submit" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
          {pista.es_de_serie && enObras && <button className="boton boton-claro" type="submit" name="reabrir" value="1" disabled={guardando}>Marcar como reabierta</button>}
          {pista.es_de_serie && pista.estado === "habitual" && <button className="boton boton-claro" type="submit" name="cerrar_obras" value="1" disabled={guardando}>Marcar en obras</button>}
        </div>
      </form>
      {pista.es_de_serie && (
        <p className="pequeno suave" style={{ margin: 0 }}>
          Al cambiar su estado, los entrenos futuros <b>sin pista propia</b> pasan {enObras ? "a esta pista (reabierta)" : "a «Pista por confirmar»"} y quedan pendientes de copiar a SportEasy. Los que tienen pista propia no cambian.
        </p>
      )}
    </li>
  );
}

export function PistaNueva({ volver }: { volver: string }) {
  const [res, accion, guardando] = useActionState(crearPista, null);
  return (
    <form action={accion} className="gs-bloque" aria-labelledby="t-nueva">
      <h2 id="t-nueva" style={{ fontSize: 24 }}>Nueva pista</h2>
      {res?.error && <div className="aviso aviso-error" role="alert">{res.error}</div>}
      <input type="hidden" name="volver" value={volver} />
      <div className="ev-dos">
        <div className="campo" style={{ margin: 0 }}><label htmlFor="np-nombre">Nombre</label><input id="np-nombre" name="nombre" type="text" required maxLength={80} /></div>
        <div className="campo" style={{ margin: 0 }}><label htmlFor="np-corto">Nombre corto (opcional)</label><input id="np-corto" name="nombre_corto" type="text" maxLength={30} /></div>
        <div className="campo" style={{ margin: 0 }}><label htmlFor="np-dir">Dirección</label><input id="np-dir" name="direccion" type="text" placeholder="Puede quedar vacía" /></div>
        <div className="campo" style={{ margin: 0 }}><label htmlFor="np-uso">Uso</label><select id="np-uso" name="uso" defaultValue="entreno"><option value="entreno">Entreno</option><option value="partido">Partido</option></select></div>
        <div className="campo" style={{ margin: 0 }}><label htmlFor="np-estado">Estado</label><select id="np-estado" name="estado" defaultValue="provisional">{ESTADOS.map((e) => <option key={e} value={e}>{TEXTO_ESTADO_PISTA[e]}</option>)}</select></div>
        <div className="campo" style={{ margin: 0 }}><label htmlFor="np-num">Número de pistas</label><input id="np-num" name="num_pistas" type="number" min={1} /></div>
      </div>
      <div className="botones" style={{ margin: 0 }}><button className="boton boton-amarillo" type="submit" disabled={guardando}>{guardando ? "Creando…" : "Añadir pista"}</button></div>
    </form>
  );
}
