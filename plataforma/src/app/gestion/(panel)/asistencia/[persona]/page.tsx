import { notFound } from "next/navigation";
import Link from "next/link";
import Volver from "@/components/nav/Volver";
import "../../eventos/eventos.css";
import "../asistencia.css";
import { exigirGestor } from "@/lib/sesion";
import { hoyMadrid } from "@/lib/dias";
import { cargarFilasGuardadas, cargarFilasPlataforma, cargarTotales } from "@/lib/eventos/asistenciaDatos";
import { eventosDe, fichaJugador, PRIMERA_PRECISA, textoEstado, textoPct, type Cuenta } from "@/lib/eventos/asistenciaPantalla";

export const metadata = { title: "Ficha de asistencia · Gestión Maccabis" };

const dma = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`;

// Ficha de asistencia de un jugador (D170, solo gestores): % por temporada, motivos más frecuentes y sus últimos 10 eventos.
export default async function FichaAsistencia({ params }: { params: Promise<{ persona: string }> }) {
  const { persona } = await params;
  const id = decodeURIComponent(persona);
  const { supabase } = await exigirGestor();
  const [guardadas, totales, plat] = await Promise.all([cargarFilasGuardadas(supabase, { persona: id }), cargarTotales(supabase), cargarFilasPlataforma(supabase)]);
  const ficha = fichaJugador({ filas: [...guardadas, ...plat.filas.filter((f) => f.person_id === id)], totales, hoy: hoyMadrid() }, id);
  if (!ficha) notFound();
  const celda = (c: Cuenta) => {
    const n = eventosDe(c);
    return <><b>{textoPct(n ? c.fue / n : null)}</b> <span className="as-det">{c.fue} / {n}</span></>;
  };
  return (
    <>
      <Volver defecto="/gestion/asistencia" etiqueta="Asistencia" />
      <div className="gs-titulo">
        <div>
          <div className="gs-eyebrow">Solo gestores · ficha de asistencia</div>
          <h1 data-testid="ficha-nombre">{ficha.nombre}</h1>
        </div>
      </div>
      <div className="as-ficha">
        <section className="gs-bloque" aria-labelledby="f-temp">
          <h2 id="f-temp">Por temporada</h2>
          <div className="tabla-desplazable">
            <table data-testid="ficha-temporadas">
              <thead><tr><th>Temporada</th><th>Entrenos</th><th>Partidos</th><th>Total</th><th>Sin excusa</th></tr></thead>
              <tbody>
                {ficha.temporadas.map((t) => (
                  <tr key={t.temporada} data-temporada={t.temporada}>
                    <td>{t.temporada.replace("-", "/")}{t.temporada < PRIMERA_PRECISA && <span className="as-aprox">aprox.</span>}</td>
                    <td>{celda(t.entrenos)}</td><td>{celda(t.partidos)}</td><td>{celda(t.total)}</td><td className="cifra">{t.total.sin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="as-nota">No cuentan «no convocado» ni lesión. 2025/26: totales corregidos a mano (D72).</p>
        </section>
        <section className="gs-bloque" aria-labelledby="f-mot">
          <h2 id="f-mot">Motivos más frecuentes</h2>
          {ficha.motivos.length ? <p data-testid="ficha-motivos">{ficha.motivos.map((m) => `${m.texto} ×${m.veces}`).join(" · ")}</p> : <p className="suave">—</p>}
        </section>
        <section className="gs-bloque" aria-labelledby="f-ult">
          <h2 id="f-ult">Últimos {ficha.ultimos.length} eventos</h2>
          <ul className="lista-limpia" data-testid="ficha-ultimos">
            {ficha.ultimos.map((e) => (
              <li key={e.evento_ref} data-estado={e.estado} style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", padding: "8px 0", borderTop: "1px solid var(--linea-suave)" }}>
                <span className="cifra">{dma(e.fecha)}</span>
                <span>{e.ambito === "entrenos" ? "Entreno" : `Partido${e.equipo ? ` ${e.equipo}` : ""}`}{e.titulo && e.ambito === "partidos" ? ` · ${e.titulo}` : ""}</span>
                <span className={`as-estado ${e.estado}`}>{textoEstado(e.estado)}</span>
                {e.segunSportEasy && <span className="as-det" data-testid="segun-sporteasy">según SportEasy</span>}
                {e.motivo && e.estado !== "fue" && <span className="as-det">{e.motivo}</span>}
              </li>
            ))}
          </ul>
        </section>
        <p><Link href="/gestion/asistencia">← Volver a la tabla</Link></p>
      </div>
    </>
  );
}
