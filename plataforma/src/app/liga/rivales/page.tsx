import type { Metadata } from "next";
import RivalesPanel from "@/components/liga/Rivales";
import { LIGA, RIVALES, coloresRivales, temporadaRivales } from "@/lib/estadisticas/liga";

export const metadata: Metadata = {
  title: "Rivales 26/27 · Maccabis",
  description: "Los rivales de MdA y MdL en 2026/27: su puesto en 2025/26, el cara a cara con Maccabis y su trayectoria en la liga municipal.",
  alternates: { canonical: "/liga/rivales" },
};

// Rivales 26/27 (antes, la pestaña de GitHub Pages ?p=rivales&g=MdA&r=<id>). Fuente: Ayuntamiento de Madrid, datos abiertos, CC BY 4.0.
export default async function Rivales({ searchParams }: { searchParams: Promise<{ g?: string; r?: string }> }) {
  const { g, r } = await searchParams;
  // El nombre de cada rival en la liga (el de las hojas de la FBM), para enlazar su Scouting (solo con sesión, D162).
  const nombresLiga = Object.fromEntries((["G1", "G2"] as const).flatMap((k) => Object.entries(LIGA.grupos[k].equipos).filter(([, e]) => !e.nuestro).map(([id, e]) => [id, e.nombre])));
  return <RivalesPanel datos={RIVALES} colores={coloresRivales()} grupoInicial={g === "MdL" ? "MdL" : "MdA"} rivalInicial={r ?? null} temporada={temporadaRivales()} nombresLiga={nombresLiga} />;
}
