import type { temporadaDe } from "@/lib/publico";

type Temporada = NonNullable<ReturnType<typeof temporadaDe>>;
const dec1 = (x: number) => x.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const conSigno = (x: number) => (x > 0 ? `+${x}` : String(x));

/** «Tu temporada» en 4 cifras (D117, D189): más/menos, minutos, puntos y entrenos. La usan Yo y la línea de la Semana. */
export function cifrasTemporada(t: Temporada) {
  return [
    { k: "masmenos", valor: t.masMenos != null ? conSigno(t.masMenos) : "—", corto: "+/-", texto: "más/menos con él en pista" },
    { k: "minutos", valor: t.minutos != null ? String(t.minutos) : "—", corto: "min", texto: `minutos${t.minutos ? ` · ${dec1(t.minutos / t.pj)} de media` : ""}` },
    { k: "puntos", valor: String(t.tot.pts), corto: "pts", texto: `puntos · ${dec1(t.tot.pts / t.pj)} por partido` },
    { k: "entrenos", valor: t.entrenos ? `${t.entrenos.fueron}/${t.entrenos.total}` : "—", corto: "entrenos", texto: "entrenos" },
  ];
}
