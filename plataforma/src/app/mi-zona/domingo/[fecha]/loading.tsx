import Esqueleto from "@/components/carga/Esqueleto";

// D198: al tocar «Responder al domingo» se ve esto al momento, mientras llega el domingo.
export default function Cargando() {
  return <Esqueleto prueba="cargando-domingo" titulo="tu domingo" bloques={3} />;
}
