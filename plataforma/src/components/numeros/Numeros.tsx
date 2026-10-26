"use client";
import { useId, useState } from "react";
import Link from "next/link";
import "./numeros.css";

/** Contadores de personas desplegables (D139). Cada numero («5 van», «3 sin responder»...) es un boton con aria-expanded que
 *  despliega, EN LINEA y debajo, los nombres de ese estado; otro toque lo cierra. Un solo componente para todas las pantallas.
 *  Privacidad: `nota` (motivo y detalle) solo la manda el servidor a los gestores; al jugador nunca le llega (D46). */
export type PersonaNum = { nombre: string; href?: string | null; nota?: string | null };
export type GrupoNum = { k: string; etiqueta: string; n: number; tono?: "ok" | "duda" | "no" | "sin"; personas: PersonaNum[]; vacio?: string; valor?: string; clase?: string; soloNumero?: boolean };

const CLASE_TONO = { ok: "ev-ok", duda: "ev-duda", no: "ev-no", sin: "suave" } as const;

export default function Numeros({ grupos, variante = "cajas", etiqueta, columnas, prueba = "numeros", contenedor }: {
  grupos: GrupoNum[]; variante?: "cajas" | "linea"; etiqueta: string; columnas?: number; prueba?: string; contenedor?: string;
}) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const id = useId();
  const actual = grupos.find((g) => g.k === abierto) ?? null;
  const boton = (g: GrupoNum) => {
    const on = abierto === g.k;
    // Una cifra sin lista (p. ej. «sin responder» para un jugador, D46): se ve, pero no se despliega.
    if (g.soloNumero) return variante === "cajas"
      ? <div key={g.k} className={`num-solo ${g.clase ?? "num-caja"}`} data-testid={`${prueba}-${g.k}`}><b className={g.tono ? CLASE_TONO[g.tono] : undefined}>{g.valor ?? g.n}</b><span>{g.etiqueta}</span></div>
      : <span key={g.k} className={`num-solo ${g.tono ? CLASE_TONO[g.tono] : ""}`} data-testid={`${prueba}-${g.k}`}>{g.n} {g.etiqueta}</span>;
    const contenido = variante === "cajas"
      ? <><b className={g.tono ? CLASE_TONO[g.tono] : undefined}>{g.valor ?? g.n}</b><span>{g.etiqueta}</span></>
      : <span className={g.tono ? CLASE_TONO[g.tono] : undefined}>{g.n} {g.etiqueta}</span>;
    return (
      <button key={g.k} type="button" className={`num-boton num-${variante}${g.clase ? ` ${g.clase}` : variante === "cajas" ? " num-caja" : ""}`} aria-expanded={on} aria-controls={`${id}-${g.k}`}
        data-testid={`${prueba}-${g.k}`} onClick={() => setAbierto(on ? null : g.k)}>
        {contenido}<i className="num-flecha" aria-hidden="true" />
      </button>
    );
  };
  return (
    <div className={`num num-${variante}`} data-testid={prueba}>
      {variante === "cajas"
        ? <div className={contenedor ?? "gs-cifras num-cajas"} role="group" aria-label={etiqueta} style={columnas ? { gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` } : undefined}>{grupos.map(boton)}</div>
        : <div className={contenedor ?? "num-fila ev-cuentas"} role="group" aria-label={etiqueta}>{grupos.map(boton)}</div>}
      {actual && (
        <div className="num-panel" id={`${id}-${actual.k}`} role="region" aria-label={`${actual.etiqueta}: ${actual.n}`} data-testid={`${prueba}-lista`}>
          {actual.personas.length ? (
            <ul>
              {actual.personas.map((p, i) => (
                <li key={`${p.nombre}-${i}`}>
                  {p.href ? <Link href={p.href} className="num-nombre">{p.nombre}</Link> : <span className="num-nombre">{p.nombre}</span>}
                  {p.nota && <span className="num-nota">{p.nota}</span>}
                </li>
              ))}
            </ul>
          ) : <p className="suave">{actual.vacio ?? "Nadie."}</p>}
        </div>
      )}
    </div>
  );
}
