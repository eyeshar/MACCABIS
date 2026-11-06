import Link from "next/link";
import Volver from "@/components/nav/Volver";
import Numeros, { type GrupoNum } from "@/components/numeros/Numeros";
import { exigirGestor } from "@/lib/sesion";
import { cargarRegistro } from "@/lib/convocatoria/datos";
import { masTiempoFuera, TEXTO_ESTADO_DOMINGO } from "@/lib/convocatoria/noConvocados";
import { hrefJugador } from "@/lib/numeros/enlaces";
import "../eventos/eventos.css";
import "./no-convocados.css";

export const metadata = { title: "No convocados · Gestión Maccabis" };

const ddmm = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;

// Registro de no convocados (regla 4.3): racha seguida y total de la temporada de cada jugador, calculado en el momento con
// las convocatorias aprobadas, las respuestas y las fichas (sin tabla). SOLO GESTORES (layout del panel: exigirGestor).
export default async function NoConvocados() {
  const { supabase } = await exigirGestor();
  const { filas, domingos, desempate } = await cargarRegistro(supabase);
  const lista = masTiempoFuera(new Map(filas.map((f) => [f.person_id, f.reg])), filas);
  const sinNada = filas.filter((f) => f.reg.racha === 0 && f.reg.total === 0).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const persona = (f: (typeof filas)[number], nota?: string) => ({ nombre: f.nombre, href: hrefJugador(f.person_id), nota });
  const conRacha = lista.filter((x) => x.reg.racha > 0 && !x.reg.soloEntreno);
  const grupos: GrupoNum[] = [
    { k: "racha", etiqueta: "con racha", n: conRacha.length, tono: "no", personas: conRacha.map((x) => persona(x, `${x.reg.racha} seguidos`)) },
    { k: "total", etiqueta: "fuera alguna vez", n: lista.length, tono: "duda", personas: lista.map((x) => persona(x, `${x.reg.total} en la temporada`)) },
    { k: "nunca", etiqueta: "nunca fuera", n: sinNada.length, tono: "ok", personas: sinNada.map((x) => persona(x)) },
  ];

  return (
    <>
      <Volver defecto="/gestion" etiqueta="Panel" />
      <div className="gs-titulo">
        <div>
          <div className="gs-eyebrow">Plantilla y club</div>
          <h1>No convocados</h1>
          <span className="suave">{domingos.length} {domingos.length === 1 ? "domingo jugado" : "domingos jugados"} · desempate en la propuesta: <b data-testid="nc-interruptor">{desempate ? "encendido" : "apagado"}</b></span>
        </div>
      </div>

      <section className="gs-bloque" aria-label="Resumen">
        <Numeros variante="cajas" columnas={3} prueba="nc-numeros" etiqueta="Jugadores según sus domingos fuera" grupos={grupos} />
      </section>

      <section className="gs-bloque" aria-labelledby="t-mas-fuera" data-testid="nc-lista">
        <h2 id="t-mas-fuera">Quién lleva más tiempo fuera</h2>
        {lista.length ? (
          <ul className="nc-lista">
            {lista.map((x) => (
              <li key={x.person_id} data-person={x.person_id}>
                <details className="nc-fila">
                  <summary>
                    <span className="nc-nombre">{x.nombre}{x.reg.soloEntreno && <small className="suave"> · solo entreno</small>}</span>
                    <span className="nc-cifras"><b className="cifra" data-testid="nc-racha">{x.reg.racha}</b><small>seguidos</small></span>
                    <span className="nc-cifras"><b className="cifra" data-testid="nc-total">{x.reg.total}</b><small>temporada</small></span>
                  </summary>
                  <ul className="nc-domingos">
                    {x.reg.domingos.map((d) => (
                      <li key={d.fecha} className={`nc-dom nc-${d.estado}`}>
                        <b>{d.jornada ? `J${d.jornada}` : "—"} · {ddmm(d.fecha)}</b>
                        <span>{TEXTO_ESTADO_DOMINGO[d.estado]}</span>
                        {d.fuente && <small className="suave">según {d.fuente === "hojas" ? "las hojas de estadística" : d.fuente === "convocatoria" ? "la convocatoria aprobada" : "la convocatoria aprobada y las hojas"}</small>}
                      </li>
                    ))}
                  </ul>
                  {hrefJugador(x.person_id) && <Link className="nc-ficha" href={hrefJugador(x.person_id)!}>Ficha de {x.nombre} →</Link>}
                </details>
              </li>
            ))}
          </ul>
        ) : <p className="suave" style={{ margin: 0 }}>Nadie se ha quedado fuera estando disponible.</p>}
      </section>

      <details className="gs-bloque nc-como" data-testid="nc-como">
        <summary><b>Cómo se cuenta</b></summary>
        <ul className="pequeno">
          <li>Suma 1: dijo «voy» antes del cierre del martes a las 12:00, con ficha de ese equipo, y no entró en ningún equipo ese domingo.</li>
          <li>Vuelve a 0 el domingo en que se le convoca.</li>
          <li>No cuentan: solo entreno, «voy» después del cierre, sin ficha, sancionados y domingos sin convocatoria aprobada ni hojas.</li>
          <li>Quién entró sale de la convocatoria aprobada y de las hojas de estadística; las fichas, de la plantilla de hoy.</li>
        </ul>
      </details>
    </>
  );
}
