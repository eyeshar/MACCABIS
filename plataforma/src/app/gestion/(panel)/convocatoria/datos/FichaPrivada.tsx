"use client";

import { useState, useTransition } from "react";
import { NIVELES, POSICIONES, TEXTO_POSICION, type Equipo } from "@/lib/convocatoria/motor";
import type { FilaPrivada } from "@/lib/convocatoria/vista";
import { guardarPrivado } from "../acciones";

/** Una tarjeta por jugador con sus datos privados de convocatoria (solo gestores). */
export default function FichaPrivada({ personId, nombre, fichas, soloEntreno, inicial, desactivado }: {
  personId: string; nombre: string; fichas: string; soloEntreno: boolean; inicial: FilaPrivada | null; desactivado: boolean;
}) {
  const [f, setF] = useState({
    posicion: inicial?.posicion ?? "", base_reserva: inicial?.base_reserva ?? false, nivel: inicial?.nivel ?? "", dobla: inicial?.dobla ?? true,
    regla: (inicial?.regla === "fijo" ? `fijo-${inicial.regla_equipo}` : inicial?.regla ?? "") as string,
    sancion: inicial?.sancionado_hasta_jornada ? String(inicial.sancionado_hasta_jornada) : "", nota: inicial?.nota ?? "",
  });
  const [estado, setEstado] = useState<{ ok: boolean; t: string } | null>(null);
  const [pend, iniciar] = useTransition();
  const cambia = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setF({ ...f, [k]: v }); setEstado(null); };
  const id = (k: string) => `p-${personId}-${k}`;
  function guardar() {
    const regla = f.regla.startsWith("fijo") ? "fijo" : f.regla === "comodin" ? "comodin" : null;
    iniciar(async () => {
      const r = await guardarPrivado(personId, {
        posicion: f.posicion || null, base_reserva: f.base_reserva, nivel: f.nivel || null, dobla: f.dobla, regla,
        regla_equipo: regla === "fijo" ? (f.regla.slice(5) as Equipo) : null, sancionado_hasta_jornada: f.sancion ? Number(f.sancion) : null, nota: f.nota || null,
      });
      setEstado(r.ok ? { ok: true, t: "Guardado" } : { ok: false, t: r.error });
    });
  }
  return (
    <form className="cv-ficha" data-person={personId} onSubmit={(e) => { e.preventDefault(); guardar(); }}>
      <div className="cv-ficha-cab"><b>{nombre}</b><small className="suave">{fichas}{soloEntreno ? " · solo entreno" : ""}</small></div>
      {inicial?.nota_ataque && (
        <small className="suave" data-testid="cv-notas">Ataque {inicial.nota_ataque} · defensa {inicial.nota_defensa ?? "–"} · total {inicial.nota_total ?? "–"}{inicial.minutos != null ? ` · ${inicial.minutos} min` : ""}{inicial.pts_min != null ? ` · ${Number(inicial.pts_min).toFixed(2).replace(".", ",")} pts/min` : ""}</small>
      )}
      <div className="cv-ficha-campos">
        <label htmlFor={id("pos")}>Posición
          <select id={id("pos")} value={f.posicion} onChange={(e) => cambia("posicion", e.target.value)} disabled={desactivado}>
            <option value="">—</option>
            {POSICIONES.map((p) => <option key={p} value={p}>{TEXTO_POSICION[p]}</option>)}
          </select>
        </label>
        <label htmlFor={id("niv")}>Nivel
          <select id={id("niv")} value={f.nivel} onChange={(e) => cambia("nivel", e.target.value)} disabled={desactivado}>
            <option value="">—</option>
            {NIVELES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="cv-ficha-casilla"><input type="checkbox" checked={f.base_reserva} onChange={(e) => cambia("base_reserva", e.target.checked)} disabled={desactivado} />Base de reserva</label>
        <label className="cv-ficha-casilla"><input type="checkbox" checked={f.dobla} onChange={(e) => cambia("dobla", e.target.checked)} disabled={desactivado} />Dobla</label>
        <label htmlFor={id("regla")}>Regla personal
          <select id={id("regla")} value={f.regla} onChange={(e) => cambia("regla", e.target.value)} disabled={desactivado}>
            <option value="">Ninguna</option>
            <option value="fijo-MdA">Fijo al MdA</option>
            <option value="fijo-MdL">Fijo al MdL</option>
            <option value="comodin">Al equipo al que le falte uno</option>
          </select>
        </label>
        <label htmlFor={id("san")}>Sancionado hasta la J
          <input id={id("san")} type="number" min={1} max={30} inputMode="numeric" value={f.sancion} onChange={(e) => cambia("sancion", e.target.value)} disabled={desactivado} />
        </label>
      </div>
      <label htmlFor={id("nota")} className="pequeno" style={{ margin: 0 }}>Nota (solo gestores)</label>
      <input id={id("nota")} type="text" value={f.nota} onChange={(e) => cambia("nota", e.target.value)} maxLength={200} disabled={desactivado} />
      <div className="botones" style={{ margin: 0, alignItems: "center" }}>
        <button type="submit" className="boton boton-claro" disabled={desactivado || pend}>Guardar</button>
        {estado && <span className={estado.ok ? "ev-ok" : "ev-no"} role="status">{estado.t}</span>}
        {inicial?.cambiado_por_nombre && !estado && <small className="suave">Último cambio: {inicial.cambiado_por_nombre}</small>}
      </div>
    </form>
  );
}
