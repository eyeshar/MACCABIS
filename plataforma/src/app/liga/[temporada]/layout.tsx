import { notFound, redirect } from "next/navigation";
import { NavTemporada } from "@/components/liga/NavLiga";
import { TEMPORADAS, TEMPORADA_POR_DEFECTO, TEXTO_PESTANA, cargarTemporada, pestanasDe } from "@/lib/estadisticas/datos";

// Estadísticas de una temporada: selector 2013/14 → 2026/27 y las pestañas que existen esa temporada (según lo que
// recogía la liga: Por cuartos, Asistencia y MdA no están en todas).
export default async function TemporadaLayout({ children, params }: { children: React.ReactNode; params: Promise<{ temporada: string }> }) {
  const { temporada } = await params;
  const t = await cargarTemporada(temporada);
  // Una temporada con forma valida pero sin datos (2016/17, 2022/23: no existen en la fuente) lleva a la de por defecto, como la web anterior.
  if (!t && /^[0-9]{4}-[0-9]{2}$/.test(temporada)) redirect(`/liga/${TEMPORADA_POR_DEFECTO}/equipo`);
  if (!t) notFound();
  return (
    <>
      <NavTemporada
        temporada={temporada}
        temporadas={TEMPORADAS.map((s) => ({ id: s.id, label: s.label }))}
        pestanas={pestanasDe(t).map((p) => ({ id: p, t: TEXTO_PESTANA[p] }))}
      />
      {children}
    </>
  );
}
