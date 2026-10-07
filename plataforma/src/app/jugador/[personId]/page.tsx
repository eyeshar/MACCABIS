import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import FichaJugador from "@/components/liga/Ficha";
import { SelectorJugador, SelectorTemporadaRuta } from "@/components/liga/Selectores";
import { metricasDe, nombrePropio } from "@/lib/estadisticas/calculo";
import { TEMPORADAS, TEMPORADA_POR_DEFECTO, cargarTemporada, equiposDe, esTemporada, temporadasDePersona } from "@/lib/estadisticas/datos";

type Props = { params: Promise<{ personId: string }>; searchParams: Promise<{ t?: string }> };

async function resolver({ params, searchParams }: Props) {
  const { personId } = await params;
  const { t } = await searchParams;
  const suyas = await temporadasDePersona(personId);
  if (!suyas.length) return null;
  // Temporada pedida; si el jugador no esta en ella (o no existe), la mas reciente suya.
  const pedida = t && esTemporada(t) ? t : TEMPORADA_POR_DEFECTO;
  return { personId, suyas, temporada: suyas.includes(pedida) ? pedida : suyas[suyas.length - 1], pedida };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const r = await resolver(props);
  if (!r) return {};
  const t = await cargarTemporada(r.temporada);
  const p = t?.players.find((x) => x.person_id === r.personId);
  if (!t || !p) return {};
  return { title: `${p.display || nombrePropio(p.nombre)} · ${t.label.replace(/ /g, "")} · Maccabis`, description: `Estadísticas de ${p.display || nombrePropio(p.nombre)} con Maccabis en la temporada ${t.label}.`, alternates: { canonical: `/jugador/${r.personId}?t=${r.temporada}` } };
}

// Ficha de un jugador en una temporada (antes, ?t=<temporada>&p=jugador&j=<person_id> en GitHub Pages).
export default async function Ficha(props: Props) {
  const r = await resolver(props);
  if (!r) notFound();
  if (r.temporada !== r.pedida && (await props.searchParams).t !== r.temporada) redirect(`/jugador/${r.personId}?t=${r.temporada}`);
  const t = (await cargarTemporada(r.temporada))!;
  const p = t.players.find((x) => x.person_id === r.personId)!;
  const M = metricasDe(t.metrics);
  const lista = t.players.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).map((x) => ({ id: x.person_id, nombre: x.display || x.nombre }));
  return (
    <>
      <div className="e-controles">
        <SelectorTemporadaRuta ruta={`/jugador/${r.personId}`} temporada={r.temporada} temporadas={TEMPORADAS.filter((s) => r.suyas.includes(s.id)).map((s) => ({ id: s.id, label: s.label }))} />
        <SelectorJugador temporada={r.temporada} personId={r.personId} jugadores={lista} />
      </div>
      <FichaJugador p={p} M={M} multiEquipo={equiposDe(t).length > 1} />
      <div className="e-fuente">{(t.fuente || "Fuente: actas y hojas de estadistica oficiales") + " · temporada " + (t.label || t.season)}</div>
    </>
  );
}
