import HistoriaVista, { metadata } from "./HistoriaVista";

// «/club/historia» sin consulta (D175): ya hecha, desde la cache. Con ?persona=, next.config la manda a /club/historia/con-parametros.
export const revalidate = 300;
export { metadata };

export default function Historia() {
  return <HistoriaVista />;
}
