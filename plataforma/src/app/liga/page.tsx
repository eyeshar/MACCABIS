import type { Metadata } from "next";
import AvisoTarjeta from "@/components/AvisoTarjeta";
import LigaGrupoPanel from "@/components/liga/LigaGrupo";
import { SecH } from "@/components/liga/Comunes";
import { datosLiga, RIVALES, type Grupo } from "@/lib/estadisticas/liga";
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
  return (
    <>
      <SecH titulo="Próximos partidos" tag="MdA y MdL" />
      <div className="e-proximos" data-testid="liga-proximos">
        {(["MDA", "MDL"] as const).map((eq, i) => {
          const p = proximos[i], n = eq === "MDA" ? "MdA" : "MdL";
          if (!p) return <div key={eq} className="e-eqp"><div className="e-eqp-t">{n}</div><div className="e-eqp-s">No quedan partidos en el calendario.</div></div>;
          return (
            <div key={eq} className="e-eqp" data-eq={eq}>
              <div className="e-eqp-t">{n} · J{p.jornada}</div>
              <div className="e-eqp-v">{n} {p.local ? "vs" : "en"} {p.rival}</div>
              <div className="e-eqp-s">{p.fecha ? diaLargo(p.fecha) : "fecha por confirmar"} · {p.hora ?? "hora por confirmar"} · pista {p.campo ?? "por confirmar"} · {p.local ? "en casa" : "fuera"}</div>
              {p.color && <div className="e-eqcol"><i className="e-eqdot" style={{ background: p.color.css }} />camiseta {p.color.camiseta}, pantalón {p.color.pantalon}</div>}
              <AvisoTarjeta aviso={p.aviso} />
            </div>
          );
        })}
      </div>
      <LigaGrupoPanel
        grupos={liga.grupos} generado={liga.generado} colores={colores} contra={contra} grupoInicial={grupo}
        sinRastro={RIVALES.rivales.filter((r) => r.sin_rastro).map((r) => r.id)}
      />
    </>
  );
}
