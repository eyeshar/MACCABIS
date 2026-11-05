"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { GRUPOS_AJENOS, etiquetaGrupo, hrefConsolidada, ordenarGrupos } from "@/lib/gruposLiga";

// Selector de grupos de Liga consolidada (D186, sustituye al de un grupo cada vez de D184): MdA (G1) y MdL (G2) arriba,
// marcados por defecto, y los grupos ajenos en «Otros grupos». Cualquier combinacion, como minimo un grupo. Cada casilla se
// aplica al marcarla (en el movil nadie pulsa un boton): la seleccion va a la URL (?grupos=G1,G2,G4) y se mantiene en la
// pestaña abierta. Quitar el ultimo grupo marcado no se deja. Sin JavaScript es un formulario GET con su boton «Ver».
// La pagina lo monta con key = seleccion: al cambiar la URL (tambien con atras), las casillas salen de ella.

const esAjeno = (g: string) => (GRUPOS_AJENOS as readonly string[]).includes(g);

export default function SelectorGrupos({ sel, vista }: { sel: string[]; vista: "jugadores" | "resultados" }) {
  const router = useRouter();
  const [marcados, setMarcados] = useState<string[]>(sel);
  const [ultimo, setUltimo] = useState(false);
  const [cargando, empezar] = useTransition();
  const cambia = (g: string, si: boolean) => {
    const nuevos = ordenarGrupos(si ? [...marcados, g] : marcados.filter((x) => x !== g));
    if (!nuevos.length) { setUltimo(true); return; }   // como minimo un grupo
    setUltimo(false);
    setMarcados(nuevos);
    empezar(() => router.push(hrefConsolidada(nuevos, vista === "resultados" ? { vista } : {}), { scroll: false }));
  };
  const casilla = (g: string, texto: string) => (
    <label key={g} className="lg-check">
      <input type="checkbox" value={g} checked={marcados.includes(g)} onChange={(e) => cambia(g, e.target.checked)} /> {texto}
    </label>
  );
  const ajenos = marcados.filter(esAjeno);
  return (
    <form method="get" action="/liga/consolidada" className="tarjeta lg-form" data-testid="selector-grupos" aria-busy={cargando}>
      <fieldset className="lg-grupos">
        <legend className="lg-etq">Grupos</legend>
        <div className="lg-form-fila">
          {casilla("G1", "MdA (G1)")}
          {casilla("G2", "MdL (G2)")}
        </div>
        <details className="lg-otros" open={sel.some(esAjeno)}>
          <summary>Otros grupos{ajenos.length ? ` (${ajenos.join(", ")})` : ""}</summary>
          <div className="lg-form-fila">{GRUPOS_AJENOS.map((g) => casilla(g, etiquetaGrupo(g)))}</div>
        </details>
      </fieldset>
      <input type="hidden" name="grupos" value={marcados.join(",")} />
      {vista === "resultados" && <input type="hidden" name="vista" value="resultados" />}
      <noscript><button className="boton" type="submit">Ver</button></noscript>
      {ultimo && <p className="lg-nota" role="status">Tiene que quedar al menos un grupo marcado.</p>}
      <p className="lg-nota">Cada casilla se aplica al marcarla. Todo sale solo de los grupos marcados; en el ranking, cada grupo va en su propia clasificación.</p>
    </form>
  );
}
