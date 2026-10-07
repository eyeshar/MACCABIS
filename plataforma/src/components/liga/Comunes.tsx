"use client";

import type { ReactNode } from "react";
import { esNum, type FiltroEq } from "@/lib/estadisticas/calculo";

// Piezas comunes de las pestañas de estadisticas (migradas de index.html). Las clases e-* viven en
// src/app/liga/estadisticas.css, con los tokens del tema oscuro de la web (globals.css).

export const Dash = () => <span className="e-tenue">—</span>;

/** Valor o "—" cuando no hay dato (null donde no hay dato: nunca un cero inventado). */
export function Nz({ v, f }: { v: unknown; f: (x: number) => ReactNode }) {
  return esNum(v) ? <>{f(v)}</> : <Dash />;
}
export const N1 = ({ v }: { v: number | null | undefined }) => <Nz v={v} f={(x) => x.toFixed(1)} />;
export const N2 = ({ v }: { v: number | null | undefined }) => <Nz v={v} f={(x) => x.toFixed(2)} />;
export const NInt = ({ v }: { v: number | null | undefined }) => <Nz v={v} f={(x) => x} />;
export const NPct = ({ v }: { v: number | null | undefined }) => <Nz v={v} f={(x) => x + "%"} />;
export const NSigned = ({ v }: { v: number | null | undefined }) => (
  <Nz v={v} f={(x) => <span className={x >= 0 ? "e-pos" : "e-neg"}>{(x >= 0 ? "+" : "") + x}</span>} />
);
export const NSigned1 = ({ v }: { v: number | null | undefined }) => (
  <Nz v={v} f={(x) => <span className={x >= 0 ? "e-pos" : "e-neg"}>{(x >= 0 ? "+" : "") + x.toFixed(1)}</span>} />
);
/** "a/i" cuando la fuente recoge los intentos; solo los anotados cuando no. */
export const Tiros = ({ a, i, conIntentos }: { a: number | null | undefined; i: number | null | undefined; conIntentos: boolean }) =>
  a == null ? <Dash /> : <>{conIntentos && i != null ? `${a}/${i}` : String(a)}</>;

export function Kpi({ lab, val, foot, tono }: { lab: string; val: ReactNode; foot?: ReactNode; tono?: "win" | "accent" | "gold" | "grape" | "" }) {
  return (
    <div className={`e-kpi ${tono ?? ""}`}>
      <div className="e-kpi-tira" />
      <div className="e-kpi-lab">{lab}</div>
      <div className="e-kpi-val">{val}</div>
      <div className="e-kpi-pie">{foot}</div>
    </div>
  );
}

export function SecH({ titulo, tag, id }: { titulo: string; tag?: ReactNode; id?: string }) {
  return (
    <div className="e-sec">
      <h2 id={id}>{titulo}</h2>
      {tag != null && <span className="e-tag">{tag}</span>}
      <span className="e-regla" />
    </div>
  );
}

export function Control({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return <div className="e-ctl"><span className="e-ctl-et">{etiqueta}</span>{children}</div>;
}

/** Selector segmentado (Combinado / MdA / MdL...). */
export function Segmento<T extends string | number>({ valor, opciones, onCambia, etiqueta }: {
  valor: T; opciones: { v: T; t: string }[]; onCambia: (v: T) => void; etiqueta: string;
}) {
  return (
    <div className="e-segmento" role="group" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={String(o.v)} type="button" aria-pressed={valor === o.v} onClick={() => onCambia(o.v)}>{o.t}</button>
      ))}
    </div>
  );
}

export const OPCIONES_EQUIPO: { v: FiltroEq; t: string }[] = [
  { v: "ALL", t: "Combinado" }, { v: "MDA", t: "MdA" }, { v: "MDL", t: "MdL" },
];

export function ChipEquipo({ equipo, corto = false }: { equipo: "MDA" | "MDL"; corto?: boolean }) {
  return <span className={`e-chip e-chip-${equipo}`}>{corto ? (equipo === "MDA" ? "A" : "L") : equipo === "MDA" ? "MdA" : "MdL"}</span>;
}

/** Caja con scroll horizontal propio: las tablas anchas nunca desbordan la pagina (375 px). */
export function CajaTabla({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`e-caja ${className}`} tabIndex={0}>{children}</div>;
}

export const Nota = ({ children }: { children: ReactNode }) => <p className="e-nota">{children}</p>;
export const Vacio = ({ children }: { children: ReactNode }) => <p className="e-vacio">{children}</p>;
