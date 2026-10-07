import type { Metadata } from "next";
import RivalesPanel from "@/components/liga/Rivales";
import { RIVALES, coloresRivales } from "@/lib/estadisticas/liga";

export const metadata: Metadata = {
  title: "Rivales 26/27 · Maccabis",
  description: "Los rivales de MdA y MdL en 2026/27: su puesto en 2025/26, el cara a cara con Maccabis y su trayectoria en la liga municipal.",
  alternates: { canonical: "/liga/rivales" },
};

// Rivales 26/27 (antes, la pestaña de GitHub Pages ?p=rivales&g=MdA&r=<id>). Fuente: Ayuntamiento de Madrid, datos abiertos, CC BY 4.0.
export default async function Rivales({ searchParams }: { searchParams: Promise<{ g?: string; r?: string }> }) {
  const { g, r } = await searchParams;
  return <RivalesPanel datos={RIVALES} colores={coloresRivales()} grupoInicial={g === "MdL" ? "MdL" : "MdA"} rivalInicial={r ?? null} />;
}
