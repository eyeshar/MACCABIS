import { redirect } from "next/navigation";
import { TEMPORADA_POR_DEFECTO, cargarTemporada, esTemporada } from "@/lib/estadisticas/datos";

// /jugador (y /jugador?t=2023-24): como la pestaña «Ficha» de la web anterior, abre el primero de la plantilla por orden alfabético.
export default async function Jugador({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const id = t && esTemporada(t) ? t : TEMPORADA_POR_DEFECTO;
  const temporada = await cargarTemporada(id);
  const primero = temporada!.players.slice().sort((a, b) => a.nombre.localeCompare(b.nombre))[0];
  redirect(`/jugador/${primero.person_id}?t=${id}`);
}
