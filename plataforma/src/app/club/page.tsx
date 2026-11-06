import PlantillaVista, { metadata } from "./PlantillaVista";

// «/club» (Club › Plantilla) sin consulta (D175): la temporada por defecto, ya hecha, desde la cache. Con ?t=, next.config la manda a
// /club/con-parametros.
export const revalidate = 300;
export { metadata };

export default function Plantilla() {
  return <PlantillaVista />;
}
