import { Escudo } from "@/components/web/Marco";
import Navegacion from "./Navegacion";

// Cabecera unica (D89), en el layout raiz: pinta la navegacion de toda la web. Desde D175 no lee la sesion en el servidor
// (eso hacia dinamica toda la web): Navegacion la toma de Sesion.tsx. Desde D189 el asistente (D142, solo para quien lo tiene
// abierto, CHAT_IA_ABIERTO) es un icono de la cabecera, no un boton flotante.
export default function Cabecera() {
  return <Navegacion escudo={<Escudo decorativo />} />;
}
