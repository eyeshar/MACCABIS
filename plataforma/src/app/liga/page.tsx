import type { Metadata } from "next";
import Link from "next/link";
import AvisoTarjeta from "@/components/AvisoTarjeta";
import { textoColores } from "@/lib/colores";
import LigaGrupoPanel from "@/components/liga/LigaGrupo";
import { SecH } from "@/components/liga/Comunes";
import { datosLiga, fichasPorNombre, grupoParaPantalla, hrefEquipo, hrefPartido, RIVALES, type Grupo } from "@/lib/estadisticas/liga";
import { diaLargo, hoyMadrid } from "@/lib/dias";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Liga 26/27 · Maccabis",
  description: "Clasificación, resultados por jornada y ficha de cada equipo de los grupos de MdA y MdL en la Liga Municipal de Moratalaz 2026/27.",
  alternates: { canonical: "/liga" },
};

// Liga 26/27 (antes, la pestaña «Liga 26/27» de GitHub Pages): próximos partidos con aviso de equipación, clasificación
// calculada, resultados por jornada y ficha por equipo. ?g=G1|G2 elige grupo y ?hoy=AAAA-MM-DD fija la fecha (revisiones).
export default async function Liga({ searchParams }: { searchParams: Promise<{ g?: string; hoy?: string }> }) {
  const { g, hoy: hoyPrueba } = await searchParams;
  const hoy = hoyPrueba && /^\d{4}-\d{2}-\d{2}$/.test(hoyPrueba) ? hoyPrueba : hoyMadrid();
  const { liga, colores, contra, proximos } = datosLiga(hoy);
  const grupo: Grupo = g === "G2" ? "G2" : "G1";
  const fichas = fichasPorNombre();
  // Enlaces de cada equipo y de cada partido (D129), calculados aqui para que el panel no lleve la logica.
  const enlaces = {
    G1: Object.fromEntries(Object.keys(liga.grupos.G1.equipos).map((id) => [id, hrefEquipo("G1", id)])),
    G2: Object.fromEntries(Object.keys(liga.grupos.G2.equipos).map((id) => [id, hrefEquipo("G2", id)])),
  };
  const partidos = Object.fromEntries((["G1", "G2"] as const).flatMap((k) => liga.grupos[k].resultados.map((r) => [r.id, hrefPartido(r.id)])));
  return (
    <>
      <SecH titulo="Próximos partidos" tag="MdA y MdL" />
      <div className="e-proximos" data-testid="liga-proximos">
        {(["MDA", "MDL"] as const).map((eq, i) => {
          const p = proximos[i], n = eq === "MDA" ? "MdA" : "MdL";
          if (!p) return <div key={eq} className="e-eqp"><div className="e-eqp-t">{n}</div><div className="e-eqp-s">No quedan partidos en el calendario.</div></div>;
          // D129: en esta liga todos juegan en Moratalaz. Sin «en casa / fuera»: el cartel tal cual sale en el calendario oficial.
          const fichaRival = fichas[`${eq === "MDA" ? "G1" : "G2"}|${p.rival}`];
          const rival = fichaRival ? <Link href={fichaRival} className="e-enlace-eq">{p.rival}</Link> : <>{p.rival}</>;
          const nuestro = <Link href={fichas[`${eq === "MDA" ? "G1" : "G2"}|${n}`]} className="e-enlace-eq">{n}</Link>;
          return (
            <div key={eq} className="e-eqp" data-eq={eq}>
              <div className="e-eqp-t">{n} · J{p.jornada}</div>
              <div className="e-eqp-v">{p.local === false ? <>{rival} – {nuestro}</> : <>{nuestro} – {rival}</>}</div>
              <div className="e-eqp-s">{p.fecha ? diaLargo(p.fecha) : "fecha por confirmar"} · {p.hora ?? "hora por confirmar"} · pista {p.campo ?? "por confirmar"}</div>
              {p.color && <div className="e-eqcol"><i className="e-eqdot" style={{ background: p.color.css }} />{textoColores(p.color)}</div>}
              <AvisoTarjeta aviso={p.aviso} />
            </div>
          );
        })}
      </div>
      <LigaGrupoPanel
        grupos={{ G1: grupoParaPantalla(liga.grupos.G1), G2: grupoParaPantalla(liga.grupos.G2) }} generado={liga.generado} colores={colores} contra={contra} grupoInicial={grupo}
        enlaces={enlaces} partidos={partidos}
        sinRastro={RIVALES.rivales.filter((r) => r.sin_rastro).map((r) => r.id)}
      />
    </>
  );
}
