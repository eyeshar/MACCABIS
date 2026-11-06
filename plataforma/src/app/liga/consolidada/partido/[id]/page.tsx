import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CajaTabla } from "@/components/liga/Comunes";
import { exigirLiga } from "@/lib/sesion";
import { TEMPORADA, etiquetaGrupo, fechaCorta } from "@/lib/liga";
import { bonito, mmss } from "@/lib/jugadoresLiga";
import { gruposDeUrl, hrefConsolidada } from "@/lib/gruposLiga";

// La hoja de un partido de cualquier grupo de la fase (D186), desde la pestaña Resultados de Liga consolidada: marcador y
// datos POR JUGADOR de los dos equipos. Son de terceros (D73): solo con sesion de jugador con ficha o de gestor (D162), leidos
// de Supabase con su RLS. Sin sesion, a /entrar (exigirLiga): ni la pagina ni los datos en el HTML. Nunca se indexa.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Partido · Liga consolidada · Maccabis", robots: { index: false, follow: false } };

type Fila = { equipo: string; dorsal: string; nombre: string; segundos: number; pts: number; p2a: number; p3a: number; tla: number; tli: number; faltas: number };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PartidoConsolidada({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ grupos?: string; j?: string }>;
}) {
  const { supabase } = await exigirLiga();
  const [{ id }, q] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const { data: p, error } = await supabase.from("liga_partidos")
    .select("id, grupo, jornada, fecha, local, visitante, pts_local, pts_visitante").eq("id", id).eq("temporada", TEMPORADA).maybeSingle();
  if (error) throw new Error(error.message);
  if (!p) notFound();
  const { data, error: e2 } = await supabase.from("liga_estadisticas_jugador")
    .select("equipo, dorsal, nombre, segundos, pts, p2a, p3a, tla, tli, faltas").eq("partido_id", p.id)
    .order("pts", { ascending: false }).order("segundos", { ascending: false });
  if (e2) throw new Error(e2.message);
  const filas = (data ?? []) as Fila[];
  // Vuelve a Resultados con los mismos grupos y la misma jornada (si no vienen, los del partido).
  const volver = hrefConsolidada(q.grupos ? gruposDeUrl({ grupos: q.grupos }) : [p.grupo], { vista: "resultados", j: Number(q.j) || p.jornada || undefined });

  return (
    <article data-testid="partido-consolidada">
      {/* Bloque 6: un único «‹» a su sección (Resultados, con los mismos grupos y jornada) y el marcador primero. */}
      <Link href={volver} className="e-atras" prefetch={false} data-testid="volver">‹ Resultados</Link>
      <div className="e-pt-cab e-pt-cab-compacta">
        <div className="e-pt-cartel">
          <span className="e-pt-eq">{p.local}</span>
          <b className="e-pt-marcador" data-testid="marcador">{p.pts_local ?? "–"}–{p.pts_visitante ?? "–"}</b>
          <span className="e-pt-eq">{p.visitante}</span>
        </div>
        <div className="e-pt-meta">{etiquetaGrupo(p.grupo)}{p.jornada ? ` · jornada ${p.jornada}` : " · sin jornada"}{p.fecha ? ` · ${fechaCorta(p.fecha)}` : ""} · con sesión, no se publica</div>
      </div>
      {[p.local, p.visitante].map((eq) => {
        const suyas = filas.filter((f) => f.equipo === eq);
        return (
          <section key={eq}>
            <h3 className="e-pt-h3">{eq}</h3>
            {suyas.length === 0 ? <p className="lg-nota">Sin datos por jugador de este equipo.</p> : (
              <CajaTabla>
                <table className="e-tabla e-tabla-box" data-testid="hoja-por-jugador">
                  <thead><tr><th scope="col">#</th><th scope="col">Jugador</th><th scope="col" className="e-c">Min</th><th scope="col" className="e-c">Pts</th><th scope="col" className="e-c">2P</th><th scope="col" className="e-c">3P</th><th scope="col" className="e-c">TL</th><th scope="col" className="e-c">FC</th></tr></thead>
                  <tbody>
                    {suyas.map((j, i) => {
                      const dnp = j.segundos === 0;
                      return (
                        <tr key={i} className={dnp ? "e-dnp" : undefined}>
                          <td className="e-mono e-tenue">{j.dorsal}</td><td className="e-nombre">{bonito(j.nombre)}</td>
                          <td className="e-c e-mono">{dnp ? "DNP" : mmss(j.segundos)}</td><td className="e-c e-mono e-fuerte">{dnp ? "—" : j.pts}</td>
                          <td className="e-c e-mono">{dnp ? "" : j.p2a}</td><td className="e-c e-mono">{dnp ? "" : j.p3a}</td>
                          <td className="e-c e-mono">{dnp ? "" : `${j.tla}/${j.tli}`}</td><td className="e-c e-mono">{dnp ? "" : j.faltas}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CajaTabla>
            )}
          </section>
        );
      })}
      <div className="e-fuente">Fuente: hoja de estadística de la FBM (app Afición FBM). Datos por jugador, solo con sesión.</div>
    </article>
  );
}
