import { ClavesTarjeta } from "@/components/liga/Claves";
import { avisoDeEvento } from "@/lib/eventos/datos";
import { coloresDe } from "@/lib/equipacion";
import { textoColores } from "@/lib/colores";
import { cargarLiga } from "@/lib/liga";
import { puedeVerLigaActual } from "@/lib/sesion";
import { clavesPorNombre } from "@/lib/scouting/datos";
import { clienteSesion } from "@/lib/supabase";
import type { MiEvento } from "@/lib/respuestas/dominio";

/** «El rival» de un partido de liga (D189): sus colores y las 2 primeras claves del scouting (D174) con «Ver el scouting».
 *  Mismo acceso que Scouting (D162): las claves solo con sesion de jugador con ficha o de gestor; si la liga no responde,
 *  sale sin ellas. En el evento y, por partido, en el domingo con dos partidos. */
export default async function ElRival({ e, conColores = true, titulo = "El rival" }: { e: MiEvento; conColores?: boolean; titulo?: string }) {
  if (e.tipo !== "liga" || !e.rival) return null;
  const rival = conColores ? coloresDe(e.rival) : null;
  const grupo = e.equipo === "MdL" ? "G2" : "G1";
  const verLiga = await puedeVerLigaActual().catch(() => false);
  const liga = verLiga ? await cargarLiga(await clienteSesion(), [grupo]).catch(() => null) : null;
  const aviso = avisoDeEvento(e);
  const claves = liga ? clavesPorNombre(liga, grupo, aviso?.rival ?? e.rival) : null;
  if (!rival && !claves) return null;
  const href = claves ? `/liga/scouting?e=${encodeURIComponent(claves.nombreEquipo)}${e.equipo === "MdL" ? "&v=mdl" : ""}` : undefined;
  return (
    <section className="tarjeta ev2-rival" aria-label={titulo} data-testid="el-rival">
      <h2 className="ev2-h2">{titulo}</h2>
      {rival && <p className="pequeno" data-testid="color-rival"><i className="eq-punto" style={{ background: rival.css }} aria-hidden="true" /> {textoColores(rival)}</p>}
      {claves && <ClavesTarjeta res={claves} href={href} />}
    </section>
  );
}
