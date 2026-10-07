import Link from "next/link";
import "../eventos/eventos.css";
import { exigirGestor } from "@/lib/sesion";
import { cargarEventos, cargarJugadores, TEMPORADA } from "@/lib/eventos/datos";
import { resumenTemporada, textoPct, type FilaResumen, type RespuestaMotivo } from "@/lib/eventos/asistencia";
import type { Motivo } from "@/lib/eventos/dominio";

export const metadata = { title: "Asistencia y motivos · Gestión Maccabis" };

// Resumen de la temporada por jugador: entrenos y partidos asistidos / total / % y motivos mas frecuentes. Solo gestores
// (D46, D82): lee asistencia_resumen (copia de asistencia_motivos) y las respuestas «no voy» con motivo.
export default async function Asistencia({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const { supabase } = await exigirGestor();
  const { data: filas, error } = await supabase.from("asistencia_resumen")
    .select("temporada, person_id, nombre, ambito, fueron, total, con_excusa, sin_excusa, no_convocado, lesion");
  if (error) throw new Error(error.message);
  const todas = (filas ?? []) as FilaResumen[];
  const temporadas = [...new Set([...todas.map((f) => f.temporada), TEMPORADA])].sort().reverse();
  const temporada = temporadas.includes(t ?? "") ? t! : TEMPORADA;

  let respuestas: RespuestaMotivo[] = [];
  const nombres: Record<string, string> = {};
  if (temporada === TEMPORADA) {
    const [eventos, jugadores, { data: r }] = await Promise.all([
      cargarEventos(supabase), cargarJugadores(supabase),
      supabase.from("respuestas").select("evento_id, person_id, respuesta, motivo").eq("respuesta", "no").not("motivo", "is", null),
    ]);
    const fecha = new Map(eventos.map((e) => [e.id, e.fecha]));
    for (const j of jugadores) nombres[j.person_id] = j.nombre_visible;
    respuestas = ((r ?? []) as { evento_id: string; person_id: string; respuesta: string; motivo: Motivo | null }[])
      .filter((x) => fecha.has(x.evento_id)).map((x) => ({ person_id: x.person_id, fecha: fecha.get(x.evento_id)!, respuesta: x.respuesta, motivo: x.motivo }));
  }
  const resumen = resumenTemporada(todas.filter((f) => f.temporada === temporada), respuestas, 3, nombres);

  return (
    <>
      <div className="gs-titulo">
        <div>
          <div className="gs-eyebrow">Solo gestores · temporada {temporada.replace("-", "/")}</div>
          <h1>Asistencia y motivos</h1>
        </div>
      </div>
      <nav className="ev-filtros" aria-label="Temporada" style={{ marginBottom: 16 }}>
        {temporadas.map((x) => <Link key={x} href={x === TEMPORADA ? "/gestion/asistencia" : `/gestion/asistencia?t=${x}`} aria-current={x === temporada ? "true" : undefined}>{x.replace("-", "/")}</Link>)}
      </nav>
      <p className="pequeno suave">
        Asistidos / total y porcentaje, por jugador. Los motivos son los más frecuentes: los históricos de SportEasy (con excusa, sin excusa, no convocado, lesión) y los «no voy» con motivo que Claude trae a la plataforma (lesión, trabajo, viaje, familia, otro). Ningún jugador ve esta pantalla ni los motivos de los demás (D46, D82).
      </p>
      {resumen.length === 0 ? <div className="hueco">No hay datos de asistencia de esta temporada.</div> : (
        <section className="gs-bloque" aria-labelledby="t-res">
          <h2 id="t-res" className="solo-lectores">Resumen por jugador</h2>
          <div className="tabla-desplazable">
            <table className="gs-tabla ev-tabla" data-testid="tabla-asistencia">
              <thead><tr><th>Jugador</th><th>Entrenos</th><th>Partidos</th><th>Motivos más frecuentes</th></tr></thead>
              <tbody>
                {resumen.map((j) => (
                  <tr key={j.person_id} data-person={j.person_id}>
                    <td data-label="Jugador"><b>{j.nombre}</b></td>
                    <td data-label="Entrenos"><span className="cifra">{j.entrenos.fueron} / {j.entrenos.total}</span> <b className={(j.entrenos.pct ?? 1) < 0.5 ? "ev-no" : "ev-ok"}>{textoPct(j.entrenos.pct)}</b></td>
                    <td data-label="Partidos"><span className="cifra">{j.partidos.fueron} / {j.partidos.total}</span> <b className={(j.partidos.pct ?? 1) < 0.5 ? "ev-no" : "ev-ok"}>{textoPct(j.partidos.pct)}</b></td>
                    <td data-label="Motivos">{j.motivos.length ? j.motivos.map((m) => `${m.texto} ×${m.veces}`).join(" · ") : <span className="suave">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
