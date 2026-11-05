"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GRUPOS_AJENOS, etiquetaGrupo, hrefConsolidada, ordenarGrupos } from "@/lib/gruposLiga";

// Selector de grupos de Liga consolidada (D186, sustituye al de un grupo cada vez de D184): MdA (G1) y MdL (G2) arriba,
// marcados por defecto, y los grupos ajenos en «Otros grupos». Cualquier combinacion, como minimo un grupo. La seleccion
// va en la URL (?grupos=G1,G2,G4) y se mantiene en la pestaña abierta. Es un formulario GET: sin JavaScript tambien vale.

export default function SelectorGrupos({ sel, vista }: { sel: string[]; vista: "jugadores" | "resultados" }) {
  const router = useRouter();
  const [marcados, setMarcados] = useState<string[]>(sel);
  const cambia = (g: string, si: boolean) => setMarcados((m) => ordenarGrupos(si ? [...m, g] : m.filter((x) => x !== g)));
  const ninguno = marcados.length === 0;
  const casilla = (g: string, texto: string) => (
    <label key={g} className="lg-check">
      <input type="checkbox" value={g} checked={marcados.includes(g)} onChange={(e) => cambia(g, e.target.checked)} /> {texto}
    </label>
  );
  return (
    <form
      method="get" action="/liga/consolidada" className="tarjeta lg-form" data-testid="selector-grupos"
      onSubmit={(e) => { e.preventDefault(); if (!ninguno) router.push(hrefConsolidada(marcados, vista === "resultados" ? { vista } : {})); }}
    >
      <fieldset className="lg-grupos">
        <legend className="lg-etq">Grupos</legend>
        <div className="lg-form-fila">
          {casilla("G1", "MdA (G1)")}
          {casilla("G2", "MdL (G2)")}
        </div>
        <details className="lg-otros" open={sel.some((g) => (GRUPOS_AJENOS as readonly string[]).includes(g))}>
          <summary>Otros grupos{marcados.some((g) => (GRUPOS_AJENOS as readonly string[]).includes(g)) ? ` (${marcados.filter((g) => (GRUPOS_AJENOS as readonly string[]).includes(g)).join(", ")})` : ""}</summary>
          <div className="lg-form-fila">{GRUPOS_AJENOS.map((g) => casilla(g, etiquetaGrupo(g)))}</div>
        </details>
      </fieldset>
      <input type="hidden" name="grupos" value={marcados.join(",")} />
      {vista === "resultados" && <input type="hidden" name="vista" value="resultados" />}
      <div className="lg-form-fila">
        <button className="boton" type="submit" disabled={ninguno}>Ver</button>
        {ninguno && <span className="lg-nota" role="status">Marca al menos un grupo.</span>}
      </div>
      <p className="lg-nota">Todo sale solo de los grupos marcados. En el ranking, cada grupo va en su propia clasificación.</p>
    </form>
  );
}
