import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Volver from "@/components/nav/Volver";
import Numeros from "@/components/numeros/Numeros";
import { exigirSesion } from "@/lib/sesion";
import { cargarFantasy, esFantasy } from "@/lib/fantasy/datos";
import { millones } from "@/lib/fantasy/reglas";
import { conSigno, fechaCorta, insignias, pts } from "@/lib/fantasy/vista";
import { fichaEstadisticas } from "@/lib/mensajes";
import { Compartir } from "../../Cliente";
import "../../fantasy.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Carta de jugador · MdFantasy", robots: { index: false, follow: false } };

// Carta de jugador (D196): media, de donde salen sus puntos, ultimas 5 jornadas, insignias y compartir.
export default async function Carta({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await exigirSesion();
  const { id } = await params;
  const f = await cargarFantasy(supabase);
  if (!esFantasy(f)) redirect("/mdfantasy");
  const personId = decodeURIComponent(id);
  const j = f.jugadores.find((x) => x.person_id === personId);
  if (!j) notFound();
  const suyos = f.puntosJ.filter((p) => p.person_id === personId);
  const rend = suyos.reduce((s, p) => s + p.rendimiento, 0), comp = suyos.reduce((s, p) => s + p.compromiso, 0);
  const total = suyos.reduce((s, p) => s + p.total, 0);
  const ultimas = suyos.slice(-5).reverse();
  const duenos = f.copias.filter((c) => c.jugador === personId);
  const libres = Math.max(0, j.copias - duenos.length);
  const ins = insignias(personId, f.puntosJ);
  const maximo = Math.max(1, ...ultimas.map((p) => p.total));
  const parte = (x: number) => (rend + Math.max(0, comp) > 0 ? Math.round((Math.max(0, x) / (rend + Math.max(0, comp))) * 100) : 0);

  return (
    <main className="pagina fz" data-testid="fz-carta">
      <Volver defecto="/mdfantasy?tab=mercado" etiqueta="MdFantasy" />
      <article className="fz-carta">
        <header>
          <span className="fz-carta-marca">MdFantasy</span>
          <h1>{j.nombre}</h1>
          <p className="fz-carta-valor"><b className="cifra">{millones(j.valor)}</b><span>valor</span></p>
        </header>
        <div className="fz-carta-cifras">
          <div><b className="cifra" data-testid="fz-carta-media">{pts(j.media)}</b><span>media</span></div>
          <div><b className="cifra">{pts(total)}</b><span>puntos</span></div>
          <div><b className="cifra">{suyos.filter((p) => p.minutos > 0).length}</b><span>jornadas jugadas</span></div>
        </div>
        <section aria-labelledby="t-fz-origen">
          <h2 id="t-fz-origen" className="fz-h3">De dónde salen sus puntos</h2>
          <div className="fz-barra" role="img" aria-label={`Rendimiento ${parte(rend)} %, compromiso ${parte(comp)} %`}>
            <i className="fz-barra-rend" style={{ width: `${parte(rend)}%` }} /><i className="fz-barra-comp" style={{ width: `${parte(comp)}%` }} />
          </div>
          <p className="fz-leyenda"><span><i className="fz-punto fz-barra-rend" /> Rendimiento {pts(rend)}</span><span><i className="fz-punto fz-barra-comp" /> Compromiso {conSigno(comp)}</span></p>
        </section>
        <section aria-labelledby="t-fz-ultimas" data-testid="fz-carta-ultimas">
          <h2 id="t-fz-ultimas" className="fz-h3">Últimas {ultimas.length || 5} jornadas</h2>
          {ultimas.length ? (
            <ul className="lista-limpia fz-ultimas">
              {ultimas.map((p) => (
                <li key={p.jornada}>
                  <Link href={`/mdfantasy?tab=jornada&j=${p.jornada}`}>{fechaCorta(p.jornada)}</Link>
                  <span className="fz-ultimas-barra"><i style={{ width: `${Math.round((p.total / maximo) * 100)}%` }} /></span>
                  <span className="mono tenue pequeno">{pts(p.rendimiento)} {conSigno(p.compromiso)}</span>
                  <b className="mono">{pts(p.total)}</b>
                </li>
              ))}
            </ul>
          ) : <p className="suave" style={{ margin: 0 }}>Aún no tiene jornadas.</p>}
        </section>
        {ultimas.map((u0) => (
          <details className="fz-detalle" key={u0.jornada}>
            <summary>Detalle de la jornada del {fechaCorta(u0.jornada)}</summary>
            <ul className="lista-limpia">
              {(u0.detalle.partidos ?? []).map((x, i) => <li key={`p${i}`}>{x.equipo}: {x.pts} pts, +/- relativo {conSigno(x.relativo)} → {conSigno(x.extra)} · <b>{pts(x.total)}</b> ({x.minutos} min)</li>)}
              {u0.doblete && <li>Dos partidos el mismo domingo: media de los dos + {f.P.bonusDoblete}</li>}
              {(u0.detalle.unidades ?? []).map((u, i) => <li key={`u${i}`}>{u.texto}: {u.como || "—"} · <b>{conSigno(u.respuesta + u.asistencia)}</b></li>)}
            </ul>
          </details>
        ))}
        <section aria-labelledby="t-fz-insignias" data-testid="fz-carta-insignias">
          <h2 id="t-fz-insignias" className="fz-h3">Insignias</h2>
          {ins.length ? <p className="fz-insignias">{ins.map((x) => <span key={x.clave} className="pastilla pastilla-jugo">{x.texto}{x.veces > 1 ? ` ×${x.veces}` : ""}</span>)}</p> : <p className="suave" style={{ margin: 0 }}>Todavía ninguna.</p>}
        </section>
      </article>
      <Numeros prueba="fz-duenos" etiqueta="Copias" variante="linea" grupos={[
        { k: "duenos", etiqueta: duenos.length === 1 ? "mánager lo tiene" : "mánagers lo tienen", n: duenos.length, personas: duenos.map((d) => ({ nombre: f.nombreM.get(d.manager) ?? "?", href: `/mdfantasy?tab=plantilla&m=${encodeURIComponent(d.manager)}` })), vacio: "Nadie lo tiene." },
        { k: "libres", etiqueta: libres === 1 ? "copia libre" : "copias libres", n: libres, personas: [], soloNumero: true },
      ]} />
      <div className="botones">
        <Compartir titulo={`${j.nombre} · MdFantasy`} texto={`${j.nombre} en MdFantasy: ${pts(j.media)} puntos de media, valor ${millones(j.valor)}.`} />
        <Link href="/mdfantasy?tab=mercado" className="boton boton-contorno">Mercado</Link>
        <Link href={fichaEstadisticas(personId)} className="boton boton-contorno">Sus estadísticas</Link>
      </div>
    </main>
  );
}
