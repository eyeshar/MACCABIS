import Link from "next/link";
import Volver from "@/components/nav/Volver";
import "../eventos/eventos.css";
import { exigirGestor } from "@/lib/sesion";
import { cargarEventos, cargarJugadores, TEMPORADA } from "@/lib/eventos/datos";
import { asistenciaPlataforma, resumenTemporada, textoPct, type AsistenciaEvento, type FilaResumen, type RespuestaEvento } from "@/lib/eventos/asistencia";
import { cargarDefecto } from "@/lib/convocatoria/defecto";
import { hoyMadrid } from "@/lib/dias";

export const metadata = { title: "Asistencia y motivos · Gestión Maccabis" };

// Temporadas cargadas del export histórico de SportEasy (2018/19–2024/25, D166) y sus personas sin ficha del club
// (`sporteasy-<id de perfil>`: sin cuenta ni acceso, solo existen aquí).
const HISTORICO_HASTA = "2025-26";
const PREFIJO_HISTORICO = "sporteasy-";

// Resumen de la temporada por jugador: entrenos y partidos asistidos / total / % y motivos mas frecuentes. Solo gestores
// (D46, D82): lee asistencia_motivos, lo mismo que carga `npm run db:asistencia` (D116: una sola fuente; la copia
// asistencia_resumen del paso 2 ya no se usa) con SportEasy hasta el 23/10/2026, y desde el 24/10 las respuestas de los
// eventos ya pasados de la plataforma (D161), sin duplicar.
export default async function Asistencia({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const { supabase } = await exigirGestor();
  const { data: filas, error } = await supabase.from("asistencia_motivos")
    .select("temporada, person_id, nombre, ambito, fueron, total, con_excusa:excusa, sin_excusa, no_convocado:no_conv, lesion");
  if (error) throw new Error(error.message);
  const todas = (filas ?? []) as FilaResumen[];
  const temporadas = [...new Set([...todas.map((f) => f.temporada), TEMPORADA])].sort().reverse();
  const temporada = temporadas.includes(t ?? "") ? t! : TEMPORADA;

  let plataforma: AsistenciaEvento[] = [];
  const nombres: Record<string, string> = {};
  if (temporada === TEMPORADA) {
    const [eventos, jugadores, defecto, { data: r, error: er }] = await Promise.all([
      cargarEventos(supabase), cargarJugadores(supabase), cargarDefecto(supabase),
      supabase.from("respuestas").select("evento_id, person_id, respuesta, motivo"),
    ]);
    if (er) throw new Error(er.message);
    for (const j of jugadores) nombres[j.person_id] = j.nombre_visible;
    plataforma = asistenciaPlataforma(eventos, (r ?? []) as RespuestaEvento[], defecto, hoyMadrid());
  }
  const resumen = resumenTemporada(todas.filter((f) => f.temporada === temporada), plataforma, 3, nombres);

  return (
    <>
      <Volver defecto="/gestion" etiqueta="Panel" />
      <div className="gs-titulo">
        <div>
          <div className="gs-eyebrow">Solo gestores · temporada {temporada.replace("-", "/")}</div>
          <h1>Asistencia y motivos</h1>
        </div>
      </div>
      <nav className="ev-filtros" aria-label="Temporada" style={{ marginBottom: 16 }}>
        {temporadas.map((x) => <Link key={x} href={x === TEMPORADA ? "/gestion/asistencia" : `/gestion/asistencia?t=${x}`} aria-current={x === temporada ? "true" : undefined}>{x.replace("-", "/")}</Link>)}
      </nav>
      {temporada < HISTORICO_HASTA ? (
        <p className="pequeno suave" data-testid="nota-historico">
          Histórico de SportEasy (D166): entrenos y partidos de campeonato (liga, 2.ª fase y play-off) de esa temporada, tal como quedaron en SportEasy. Menos completo que desde 2025/26: SportEasy no guardaba a quien no estaba convocado ni casi nunca las lesiones. Quien no casa con una persona del club sale con su nombre de SportEasy y la marca «histórico». Ningún jugador ve esta pantalla (D46, D82).
        </p>
      ) : (
        <p className="pequeno suave">
          Asistidos / total y porcentaje, por jugador, de entrenos y partidos de liga. Hasta el 23/10/2026 sale de SportEasy (con excusa, sin excusa, no convocado, lesión); desde el 24/10, de las respuestas de la plataforma en los eventos ya jugados (lesión, trabajo, viaje, familia, otro, sin responder…). Ningún jugador ve esta pantalla ni los motivos de los demás (D46, D82).
        </p>
      )}
      {resumen.length === 0 ? <div className="hueco">No hay datos de asistencia de esta temporada.</div> : (
        <section className="gs-bloque" aria-labelledby="t-res">
          <h2 id="t-res" className="solo-lectores">Resumen por jugador</h2>
          <div className="tabla-desplazable">
            <table className="gs-tabla ev-tabla" data-testid="tabla-asistencia">
              <thead><tr><th>Jugador</th><th>Entrenos</th><th>Partidos</th><th>Motivos más frecuentes</th></tr></thead>
              <tbody>
                {resumen.map((j) => (
                  <tr key={j.person_id} data-person={j.person_id}>
                    <td data-label="Jugador"><b>{j.nombre}</b>{j.person_id.startsWith(PREFIJO_HISTORICO) && <> <span className="pequeno suave" data-testid="marca-historico">histórico</span></>}</td>
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
