"use client";

import { useState } from "react";
import { bonito, dec, type FilaTabla } from "@/lib/jugadoresLiga";
import { cumpleMinimoPP, porFaltas, porPartido, porPuntos, porTirosLibres, porTriples, valorPP, type ClavePP } from "@/lib/ordenLideres";

// Lideres individuales de la liga, en Totales o Por partido (interruptor independiente del de la tabla). Solo gestores (D73).

type Lista = { titulo: string; nota?: string; filas: { f: FilaTabla; valor: string; extra?: string }[] };

const POR_PARTIDO: { k: ClavePP; titulo: string; fmt: (v: number) => string; nota?: string }[] = [
  { k: "pts", titulo: "Puntos por partido", fmt: (v) => dec(v) },
  { k: "p2a", titulo: "2P por partido", fmt: (v) => dec(v) },
  { k: "p3a", titulo: "3P por partido", fmt: (v) => dec(v) },
  { k: "tla", titulo: "TL anotados por partido", fmt: (v) => dec(v) },
  { k: "pctTL", titulo: "TL%", fmt: (v) => `${Math.round(100 * v)}%`, nota: "Con al menos 3 tiros libres intentados." },
  { k: "faltas", titulo: "Faltas por partido", fmt: (v) => dec(v), nota: "Faltas cometidas (5 = eliminado)." },
  { k: "segundos", titulo: "Minutos por partido", fmt: (v) => dec(v / 60) },
];

function Tarjeta({ l }: { l: Lista }) {
  return (
    <section className="tarjeta lg-lider">
      <h3>{l.titulo}</h3>
      <ol className="lista-limpia">
        {l.filas.map(({ f, valor, extra }, i) => (
          <li key={`${f.grupo}${f.equipo}${f.nombre}`}>
            <span>{i + 1}</span>
            <span>
              <b>{bonito(f.nombre)}</b>{f.dobla && <> <span className="etiqueta etiqueta-abierta">dobla</span></>}
              <small>{f.equipo}{f.grupo === "G1+G2" ? "" : ` · ${f.grupo}`}{extra ? ` · ${extra}` : ""}</small>
            </span>
            <b>{valor}</b>
          </li>
        ))}
        {l.filas.length === 0 && <li><span /><span>Nadie cumple el mínimo todavía.</span><span /></li>}
      </ol>
      {l.nota && <p className="lg-nota">{l.nota}</p>}
    </section>
  );
}

export default function Lideres({ filas, resumen }: { filas: FilaTabla[]; resumen: string }) {
  const [porPartidoVista, setPorPartidoVista] = useState(false);
  const top = <T,>(l: T[]) => l.slice(0, 8);

  const totales: Lista[] = [
    { titulo: "Puntos", filas: top([...filas].sort(porPuntos)).map((f) => ({ f, valor: String(f.pts) })) },
    { titulo: "Triples", filas: top([...filas].sort(porTriples)).map((f) => ({ f, valor: String(f.p3a) })) },
    { titulo: "Tiros libres", nota: "Con al menos 3 tiros libres intentados.", filas: top(filas.filter((f) => f.tli >= 3).sort(porTirosLibres)).map((f) => ({ f, valor: `${f.tla}/${f.tli}` })) },
    { titulo: "Faltas", nota: "Faltas cometidas (5 = eliminado). A igualdad de faltas va primero quien las hizo en menos partidos (más faltas por partido); después, por nombre.", filas: top([...filas].sort(porFaltas)).map((f) => ({ f, valor: String(f.faltas) })) },
  ];

  const porPartidoListas: Lista[] = POR_PARTIDO.map(({ k, titulo, fmt, nota }) => ({
    titulo, nota,
    filas: top(filas.filter((f) => cumpleMinimoPP(f, k)).sort(porPartido(k)))
      .map((f) => ({ f, valor: fmt(valorPP(f, k) ?? 0), extra: `${f.pj} PJ` })),
  }));

  const listas = porPartidoVista ? porPartidoListas : totales;
  return (
    <section id="lideres" className="lg-seccion">
      <h2>Líderes individuales de la liga</h2>
      <p className="lg-sub">{resumen}</p>
      <div className="lg-conmutador" role="group" aria-label="Líderes: totales o por partido">
        <button type="button" className={!porPartidoVista ? "on" : ""} aria-pressed={!porPartidoVista} onClick={() => setPorPartidoVista(false)}>Totales</button>
        <button type="button" className={porPartidoVista ? "on" : ""} aria-pressed={porPartidoVista} onClick={() => setPorPartidoVista(true)}>Por partido</button>
      </div>
      <div className="lg-lideres" style={{ marginTop: 12 }}>
        {listas.map((l) => <Tarjeta key={l.titulo} l={l} />)}
      </div>
      {porPartidoVista && (
        <p className="lg-nota">
          Mínimo de partidos «Automático»: la mitad de los partidos jugados por su equipo (al menos 1); en TL%, además, 3 tiros libres
          intentados. Quien dobla cuenta con los partidos sumados de sus dos fichas. Una decimal; el orden usa el valor exacto y, si empatan,
          el total, menos partidos jugados, el nombre y el equipo.
        </p>
      )}
    </section>
  );
}
