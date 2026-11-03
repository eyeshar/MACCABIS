import LigaVista, { metadata } from "./LigaVista";

// «/liga» sin consulta (D175): ya hecha, desde la cache (se rehace como mucho cada minuto y cuando un gestor toca el
// calendario). Con ?g= o ?hoy=, next.config la manda a /liga/con-parametros, que si lee la consulta.
export const revalidate = 60;
export { metadata };

export default function Liga() {
  return <LigaVista />;
}
