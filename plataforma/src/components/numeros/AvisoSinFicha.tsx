import Link from "next/link";
import type { PersonaNum } from "./Numeros";
import { avisoSinFicha } from "@/lib/respuestas/dominio";

/** D148, solo gestores: quien dijo «voy» a un entreno en una pista «solo con ficha» sin tener ficha. Va aparte de los
 *  contadores (no cuenta), con su nombre enlazado a la ficha (D139). Nada si no hay nadie. */
export default function AvisoSinFicha({ personas, pista }: { personas: PersonaNum[]; pista: string | null | undefined }) {
  if (!pista || !personas.length) return null;
  return (
    <div className="aviso aviso-error pequeno" role="status" data-testid="aviso-sin-ficha" style={{ margin: "6px 0" }}>
      <strong>{avisoSinFicha(pista)}</strong>{" · dijo «voy»: "}
      {personas.map((p, i) => (
        <span key={`${p.nombre}-${i}`}>{i ? ", " : ""}{p.href ? <Link href={p.href}>{p.nombre}</Link> : p.nombre}</span>
      ))}
    </div>
  );
}
