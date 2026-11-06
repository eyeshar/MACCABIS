"use client";

import { useState } from "react";
import { Info } from "@/components/liga/Comunes";
import { bonito, dec, mmss, type FilaTabla } from "@/lib/jugadoresLiga";
import { cumpleMinimoPP, porFaltas, porPartido, porPuntos, porTirosLibres, porTriples, valorPP, type ClavePP } from "@/lib/ordenLideres";

// Líderes de la liga (bloque 6): UNA lista con chips de estadística (Puntos, 2P, 3P, TL, TL%, Faltas, Minutos), Totales o
// Por partido (interruptor independiente del de la tabla; por defecto Por partido, D169), buscador y los de Maccabis
// resaltados. Con sesión de jugador o gestor (D73, D162). Los órdenes y los mínimos son los de siempre (lib/ordenLideres).

const TOP = 10;
type Chip = { k: ClavePP; t: string; titulo: string; tituloPP: string };
const CHIPS: Chip[] = [
  { k: "pts", t: "Puntos", titulo: "Puntos", tituloPP: "Puntos por partido" },
  { k: "p2a", t: "2P", titulo: "2P anotados", tituloPP: "2P por partido" },
  { k: "p3a", t: "3P", titulo: "Triples", tituloPP: "3P por partido" },
  { k: "tla", t: "TL", titulo: "Tiros libres", tituloPP: "TL anotados por partido" },
  { k: "pctTL", t: "TL%", titulo: "TL%", tituloPP: "TL%" },
  { k: "faltas", t: "Faltas", titulo: "Faltas", tituloPP: "Faltas por partido" },
  { k: "segundos", t: "Minutos", titulo: "Minutos", tituloPP: "Minutos por partido" },
];

const NOTAS: Partial<Record<ClavePP, string>> = {
  tla: "Con al menos 3 tiros libres intentados.",
  pctTL: "Con al menos 3 tiros libres intentados.",
  faltas: "Faltas cometidas (5 = eliminado).",
};

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Lista ordenada (completa) y cómo se escribe el valor de cada fila, para un chip y un modo. */
function ranking(filas: FilaTabla[], k: ClavePP, pp: boolean): { f: FilaTabla; valor: string; extra?: string }[] {
  if (pp || k === "pctTL") {
    const fmt = k === "pctTL" ? (v: number) => `${Math.round(100 * v)}%` : k === "segundos" ? (v: number) => dec(v / 60) : (v: number) => dec(v);
    return filas.filter((f) => cumpleMinimoPP(f, k)).sort(porPartido(k)).map((f) => ({ f, valor: fmt(valorPP(f, k) ?? 0), extra: `${f.pj} PJ` }));
  }
  switch (k) {
    case "pts": return [...filas].sort(porPuntos).map((f) => ({ f, valor: String(f.pts) }));
    case "p2a": return [...filas].sort((a, b) => b.p2a - a.p2a || porPuntos(a, b)).map((f) => ({ f, valor: String(f.p2a) }));
    case "p3a": return [...filas].sort(porTriples).map((f) => ({ f, valor: String(f.p3a) }));
    case "tla": return filas.filter((f) => f.tli >= 3).sort(porTirosLibres).map((f) => ({ f, valor: `${f.tla}/${f.tli}` }));
    case "faltas": return [...filas].sort(porFaltas).map((f) => ({ f, valor: String(f.faltas) }));
    case "segundos": return [...filas].sort((a, b) => b.segundos - a.segundos || porPuntos(a, b)).map((f) => ({ f, valor: mmss(f.segundos) }));
  }
  return [];
}

export default function Lideres({ filas, recuento, notaDobla, sumaDobla = true }: { filas: FilaTabla[]; recuento: string; notaDobla?: string; sumaDobla?: boolean }) {
  // D169: lo que importa es lo que hace por partido; los totales, a un toque.
  const [pp, setPp] = useState(true);
  const [chip, setChip] = useState<ClavePP>("pts");
  const [buscar, setBuscar] = useState("");
  const c = CHIPS.find((x) => x.k === chip)!;
  const todos = ranking(filas, chip, pp);
  const q = sinTildes(buscar.trim());
  // Sin buscar, los 10 primeros; buscando, todos los que coinciden, cada uno con su puesto en la lista completa.
  const lista = (q ? todos.map((x, i) => ({ ...x, pos: i + 1 })).filter((x) => sinTildes(x.f.nombre).includes(q)) : todos.slice(0, TOP).map((x, i) => ({ ...x, pos: i + 1 })));
  const nota = NOTAS[chip];

  return (
    <section id="lideres" className="lg-seccion">
      <h2>Líderes de la liga</h2>
      <p className="lg-recuento" data-testid="recuento">{recuento}</p>
      <div className="lg-chips" role="group" aria-label="Estadística" data-testid="chips-lideres">
        {CHIPS.map((x) => (
          <button key={x.k} type="button" className={x.k === chip ? "on" : ""} aria-pressed={x.k === chip} onClick={() => setChip(x.k)}>{x.t}</button>
        ))}
      </div>
      <div className="lg-barra">
        <div className="lg-conmutador" role="group" aria-label="Líderes: totales o por partido">
          <button type="button" className={!pp ? "on" : ""} aria-pressed={!pp} onClick={() => setPp(false)}>Totales</button>
          <button type="button" className={pp ? "on" : ""} aria-pressed={pp} onClick={() => setPp(true)}>Por partido</button>
        </div>
        <label className="lg-buscar">
          <input type="search" value={buscar} placeholder="Buscar jugador…" onChange={(e) => setBuscar(e.target.value)} aria-label="Buscar en los líderes" />
        </label>
      </div>
      <div className="lg-lideres">
        <section className="tarjeta lg-lider" data-testid="lista-lideres">
          <h3>{pp ? c.tituloPP : c.titulo}</h3>
          <ol className="lista-limpia">
            {lista.map(({ f, valor, extra, pos }) => (
              <li key={`${f.grupo}${f.equipo}${f.nombre}`} className={f.nuestro ? "lg-nuestro" : undefined}>
                <span>{pos}</span>
                <span>
                  <b>{bonito(f.nombre)}</b>{f.dobla && <> <span className="etiqueta etiqueta-abierta">dobla</span></>}
                  <small>{f.equipo}{f.grupo === "G1+G2" ? "" : ` · ${f.grupo}`}{extra ? ` · ${extra}` : ""}</small>
                </span>
                <b>{valor}</b>
              </li>
            ))}
            {lista.length === 0 && <li><span /><span>{q ? "Nadie con ese nombre en esta lista." : "Nadie cumple el mínimo todavía."}</span><span /></li>}
          </ol>
          {nota && <p className="lg-nota">{nota}</p>}
        </section>
      </div>
      <Info testid="aclaraciones-lideres">
        {notaDobla && <p>{notaDobla}</p>}
        <p>Por partido, mínimo de partidos «Automático»: la mitad de los partidos jugados por su equipo, redondeando hacia arriba, o 2, lo que sea menor; en TL%, además, 3 tiros libres
          intentados. {sumaDobla ? "Quien dobla cuenta con los partidos sumados de sus dos fichas." : "Quien dobla cuenta solo con los partidos de este grupo."}</p>
      </Info>
    </section>
  );
}
