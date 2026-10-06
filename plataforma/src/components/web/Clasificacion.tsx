"use client";

import { useState } from "react";

export type GrupoClas = {
  grupo: "G1" | "G2";
  equipo: "MDA" | "MDL";
  nombre: string;
  tras: number | null;
  filas: { pos: number; equipo: string; nuestro: boolean; g: number; p: number; dif: number; pts: number | null }[];
  nuestroAbajo: { pos: number; equipo: string; nuestro: boolean; g: number; p: number; dif: number; pts: number | null } | null;
};

const dif = (n: number) => (n > 0 ? `+${n}` : String(n));

// Clasificacion de los dos grupos: lado a lado en escritorio; en movil, un conmutador G1 / G2 (maqueta PortadaMovil).
export default function Clasificacion({ grupos }: { grupos: GrupoClas[] }) {
  const [visible, setVisible] = useState<"G1" | "G2">("G1");
  return (
    <>
      <div role="group" aria-label="Grupo" className="w-conmutador">
        {grupos.map((g) => (
          <button key={g.grupo} type="button" aria-pressed={visible === g.grupo} onClick={() => setVisible(g.grupo)}>
            {g.grupo} · {g.nombre}
          </button>
        ))}
      </div>
      <div className="w-clas">
        {grupos.map((g) => (
          <div key={g.grupo} className="w-panel w-clas-grupo" data-grupo={g.grupo} data-oculto={visible !== g.grupo}>
            <div className="w-clas-cab">
              <h3>Grupo {g.grupo.slice(1)} · {g.nombre}</h3>
              <span className="w-meta">{g.tras ? `Tras J${g.tras}` : "Sin jornadas"}</span>
            </div>
            <table className="w-tabla">
              <thead><tr><th scope="col">#</th><th scope="col">Equipo</th><th scope="col">G-P</th><th scope="col">Dif</th><th scope="col">Pts</th></tr></thead>
              <tbody>
                {[...g.filas, ...(g.nuestroAbajo ? [null, g.nuestroAbajo] : [])].map((f, i) =>
                  f ? (
                    <tr key={f.equipo} className={f.nuestro ? `w-nuestro-${g.equipo}` : undefined}>
                      <td>{f.pos}</td><td>{f.equipo}</td><td>{f.g}-{f.p}</td><td>{dif(f.dif)}</td><td>{f.pts ?? "—"}</td>
                    </tr>
                  ) : (
                    <tr key={`salto-${i}`} className="w-salto" aria-hidden="true"><td colSpan={5}>···</td></tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </>
  );
}
