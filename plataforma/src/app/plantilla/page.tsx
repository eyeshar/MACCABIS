import PlantillaVista, { metadata } from "./PlantillaVista";

// «/plantilla» sin consulta (D175): la temporada por defecto, ya hecha, desde la cache. Con ?t=, next.config la manda a
// /plantilla/con-parametros.
export const revalidate = 300;
export { metadata };

export default function Plantilla() {
  return <PlantillaVista />;
}
