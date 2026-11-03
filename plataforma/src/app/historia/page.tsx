import HistoriaVista, { metadata } from "./HistoriaVista";

// «/historia» sin consulta (D175): ya hecha, desde la cache. Con ?persona=, next.config la manda a /historia/con-parametros.
export const revalidate = 300;
export { metadata };

export default function Historia() {
  return <HistoriaVista />;
}
