"use client";

import { useMemo, useState } from "react";
import { nombreCorto, ordenarAsistencia, pctAsistencia, type Asis, type ClaveAsis } from "@/lib/estadisticas/calculo";
import { CajaTabla, Control, Nota, SecH, Segmento } from "./Comunes";

type JugadorAsis = { person_id: string; nombre: string; display?: string; asist_part?: Asis | null; asist_entr?: Asis | null };

// Pestaña Asistencia: por jugador, solo asistidos, total y % (los motivos de ausencia no son públicos, D82; los ven los
// gestores en la plataforma).
export default function AsistenciaPestana({ jugadores }: { jugadores: JugadorAsis[] }) {
  const [vista, setVista] = useState<"part" | "entr">("part");
  const [orden, setOrden] = useState<{ k: ClaveAsis | null; d: 1 | -1 }>({ k: null, d: -1 });
  const esPart = vista === "part";
  const pool = useMemo(() => {
    const src = (p: JugadorAsis) => (esPart ? p.asist_part : p.asist_entr) as Asis;
    return ordenarAsistencia(jugadores.filter((p) => (esPart ? p.asist_part : p.asist_entr)), src, orden.k, orden.d);
  }, [jugadores, esPart, orden]);
  const ordenaPor = (k: ClaveAsis) => setOrden((o) => (o.k === k ? { k, d: (o.d * -1) as 1 | -1 } : { k, d: -1 }));
  const cols: [ClaveAsis, string][] = [["fueron", esPart ? "Partidos" : "Entrenos"], ["total", "De"], ["pct", "% Asist."]];
  return (
    <>
      <div className="e-controles">
        <Control etiqueta="Vista">
          <Segmento etiqueta="Vista" valor={vista} opciones={[{ v: "part", t: "Partidos" }, { v: "entr", t: "Entrenamientos" }]} onCambia={(v) => { setVista(v); setOrden({ k: null, d: -1 }); }} />
        </Control>
      </div>
      <SecH titulo={esPart ? "Asistencia a partidos" : "Asistencia a entrenamientos"} tag={`${pool.length} jugadores`} />
      <CajaTabla>
        <table className="e-tabla" data-testid="asistencia-tabla">
          <thead>
            <tr>
              <th scope="col" className="e-c">#</th>
              <th scope="col">Jugador</th>
              {cols.map(([k, t]) => (
                <th key={k} scope="col" className={`e-c ${(orden.k ?? "pct") === k ? "e-ordenada" : ""}`}>
                  <button type="button" className="e-th-boton" onClick={() => ordenaPor(k)}>{t}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pool.length === 0 && <tr><td colSpan={5} className="e-vacio">Sin datos.</td></tr>}
            {pool.map((p, i) => {
              const d = (esPart ? p.asist_part : p.asist_entr) as Asis;
              return (
                <tr key={p.person_id + i}>
                  <td className="e-c e-mono e-tenue">{i + 1}</td>
                  <td className="e-nombre">{p.display || nombreCorto(p.nombre)}</td>
                  <td className="e-c e-mono">{d.fueron == null ? "—" : d.fueron}</td>
                  <td className="e-c e-mono">{d.total == null ? "—" : d.total}</td>
                  <td className="e-c e-mono">{pctAsistencia(d.pct)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CajaTabla>
      <Nota>
        {esPart
          ? "Partidos = partidos de liga a los que asistió a tiempo, de los de su equipo en la temporada. % Asist. = asistió / total. Datos de la app de asistencia del equipo."
          : "Entrenos = entrenamientos a los que asistió a tiempo, de los registrados. % Asist. = asistió / total. Algunos jugadores no tienen registro de entrenamientos."}
      </Nota>
    </>
  );
}
