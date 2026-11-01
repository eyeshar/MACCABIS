import Volver from "@/components/nav/Volver";
import "../eventos/eventos.css";
import { exigirGestor } from "@/lib/sesion";
import liga from "@/data/liga.json";
import type { GrupoCalculado } from "@/lib/contrasteClasificacion";
import ContrastarClasificacion from "./ContrastarClasificacion";

export const metadata = { title: "Contrastar clasificación · Gestión Maccabis" };

// D74 y rutina B (jueves): la clasificación oficial de Deportes/web, pegada, contra la calculada de las hojas (la
// publicada, data/liga_2026-27.json). Dice sola si difiere y da el texto para el informe a Iván. No guarda nada.
export default async function Clasificacion() {
  await exigirGestor();
  const grupos = (liga as unknown as { grupos: Record<string, { jornadas_cargadas: number[]; clasificacion: GrupoCalculado["clasificacion"] }> }).grupos;
  const calculada: Record<string, GrupoCalculado> = Object.fromEntries(Object.entries(grupos).map(([g, x]) => [g, {
    jornadas: x.jornadas_cargadas,
    clasificacion: x.clasificacion.map(({ equipo, pj, g, p, pf, pc, pts }) => ({ equipo, pj, g, p, pf, pc, pts })),
  }]));
  return (
    <>
      <div className="gs-titulo">
        <div>
          <div className="gs-eyebrow"><Volver enLinea defecto="/gestion" etiqueta="Panel" /> · Rutina B</div>
          <h1>Contrastar clasificación</h1>
        </div>
      </div>
      <p className="pequeno suave">
        Pega la clasificación oficial de Deportes/web («General por equipos de la jornada», G1 y G2), una línea por equipo:
        <code> grupo;equipo;puntos;J;G;P;TF;TC;Sanc</code>. Se compara con la calculada de las hojas (la publicada) y dice si
        difiere. No guarda nada.
      </p>
      <ContrastarClasificacion calculada={calculada} />
    </>
  );
}
