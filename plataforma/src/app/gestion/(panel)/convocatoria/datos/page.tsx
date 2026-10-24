import Link from "next/link";
import { exigirGestor } from "@/lib/sesion";
import type { FilaPrivada } from "@/lib/convocatoria/vista";
import FichaPrivada from "./FichaPrivada";

export const metadata = { title: "Datos de convocatoria · Gestión Maccabis" };

type Jugador = { person_id: string; nombre_visible: string; ficha_mda: boolean; ficha_mdl: boolean; rol: string; activo: boolean };

// Datos privados por jugador para la convocatoria (D39, D107): posicion, base de reserva, nivel A-E, Dobla / No dobla,
// regla personal y sancion. Solo los 3 gestores (RLS); nunca salen de Gestion. «Solo entreno» y las fichas se cambian
// en Jugadores.
export default async function DatosConvocatoria() {
  const { supabase } = await exigirGestor();
  const [{ data: jug }, priv] = await Promise.all([
    supabase.from("jugadores").select("person_id, nombre_visible, ficha_mda, ficha_mdl, rol, activo").eq("activo", true).order("nombre_visible"),
    supabase.from("jugadores_privado").select("person_id, posicion, base_reserva, nivel, dobla, regla, regla_equipo, sancionado_hasta_jornada, nota, cambiado_en, cambiado_por_nombre, nota_ataque, nota_defensa, nota_total, minutos, pts_min"),
  ]);
  const sinMigracion = !!priv.error;
  const porId = new Map(((priv.data ?? []) as FilaPrivada[]).map((p) => [p.person_id, p]));
  const jugadores = ((jug ?? []) as Jugador[]).filter((j) => j.rol !== "entrenador");
  const faltan = jugadores.filter((j) => j.rol !== "solo_entreno" && (!porId.get(j.person_id)?.posicion || !porId.get(j.person_id)?.nivel)).length;
  return (
    <>
      <div className="gs-titulo">
        <div>
          <div className="gs-eyebrow"><Link href="/gestion/convocatoria">← Convocatoria</Link> · Confidencial: solo gestores</div>
          <h1>Datos de los jugadores</h1>
          <span className="suave">Posición, base de reserva, nivel (A–E), Dobla / No dobla (recomendación), regla personal y sanción. {faltan ? `${faltan} sin posición o nivel.` : "Todos completos."}</span>
        </div>
      </div>
      {sinMigracion && <div className="ev-aviso" role="alert"><span><b>Falta aplicar la migración de la convocatoria en esta base.</b> Hasta entonces no se pueden guardar estos datos.</span></div>}
      <p className="pequeno suave">El nivel que usa la propuesta es el tuyo. Ataque, defensa y total salen de tu hoja (<code>npm run db:privado</code>, privado/jugadores_2026-27.xlsx) y son solo de referencia. «Solo entreno» y las fichas (MdA / MdL) se cambian en <Link href="/gestion/jugadores">Jugadores</Link>. El entrenador-jugador se marca con «Fijo a un equipo».</p>
      <div className="cv-datos-lista">
        {jugadores.map((j) => (
          <FichaPrivada key={j.person_id} personId={j.person_id} nombre={j.nombre_visible} fichas={[j.ficha_mda && "MdA", j.ficha_mdl && "MdL"].filter(Boolean).join(" y ") || "sin ficha"}
            soloEntreno={j.rol === "solo_entreno"} inicial={porId.get(j.person_id) ?? null} desactivado={sinMigracion} />
        ))}
      </div>
    </>
  );
}
