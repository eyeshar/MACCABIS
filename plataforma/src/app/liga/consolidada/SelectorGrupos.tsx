"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { GRUPOS_AJENOS, etiquetaGrupo, hrefConsolidada, ordenarGrupos } from "@/lib/gruposLiga";

// Selector de grupos de Liga consolidada (D186, sustituye al de un grupo cada vez de D184): MdA (G1) y MdL (G2) arriba,
// marcados por defecto, y los grupos ajenos G3-G6 al lado, siempre a la vista y desmarcados por defecto (fix/visibilidad-movil:
// el desplegable «Otros grupos» cerrado parecia un titulo y hacia creer que no estaban cargados). Cualquier combinacion, como
// minimo un grupo. Cada casilla se aplica al marcarla (en el movil nadie pulsa un boton): la seleccion va a la URL
// (?grupos=G1,G2,G4) y se mantiene en la pestaña abierta. Quitar el ultimo grupo marcado no se deja. Sin JavaScript es un formulario GET con su boton «Ver».
// La pagina lo monta con key = seleccion: al cambiar la URL (tambien con atras), las casillas salen de ella.

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
    <label key={g} className="lg-check" data-grupo={g} title={etiquetaGrupo(g)}>
      <input type="checkbox" value={g} checked={marcados.includes(g)} onChange={(e) => cambia(g, e.target.checked)} /> {texto}
    </label>
  );
  return (
    <form method="get" action="/liga/consolidada" className="tarjeta lg-form" data-testid="selector-grupos" aria-busy={cargando}>
      <fieldset className="lg-grupos">
        <legend className="lg-etq">Grupos</legend>
        <div className="lg-form-fila lg-grupos-fila">
          {casilla("G1", "MdA (G1)")}
          {casilla("G2", "MdL (G2)")}
          {GRUPOS_AJENOS.map((g) => casilla(g, g))}
        </div>
      </fieldset>
      <input type="hidden" name="grupos" value={marcados.join(",")} />
      {vista === "resultados" && <input type="hidden" name="vista" value="resultados" />}
      <noscript><button className="boton" type="submit">Ver</button></noscript>
      {ultimo && <p className="lg-nota" role="status">Tiene que quedar al menos un grupo marcado.</p>}
    </form>
  );
}
