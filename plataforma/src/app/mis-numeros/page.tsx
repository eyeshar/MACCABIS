import { redirect } from "next/navigation";
import { exigirSesion } from "@/lib/sesion";
import { cargarMiZona } from "@/app/mi-zona/datos";
import { fichaEstadisticas } from "@/lib/mensajes";

export const dynamic = "force-dynamic";

// «Mis números» (D116): las estadisticas del propio jugador, su ficha de la temporada en curso.
export default async function MisNumeros() {
  await exigirSesion();
  const zona = await cargarMiZona().catch(() => null);
  redirect(zona ? fichaEstadisticas(zona.jugador.person_id) : "/plantilla");
}
