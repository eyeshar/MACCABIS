import Esqueleto from "@/components/carga/Esqueleto";

// D198: al tocar un evento se ve esto al momento, mientras llega la página.
export default function Cargando() {
  return <Esqueleto prueba="cargando-evento" titulo="el evento" bloques={2} />;
}
