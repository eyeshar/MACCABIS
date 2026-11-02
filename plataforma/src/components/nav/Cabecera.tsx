import { Escudo } from "@/components/web/Marco";
import AsistenteFlotante from "@/components/asistente/AsistenteFlotante";
import Navegacion from "./Navegacion";

// Cabecera unica (D89), en el layout raiz: pinta la navegacion de toda la web. Desde D175 no lee la sesion en el servidor
// (eso hacia dinamica toda la web): Navegacion y AsistenteFlotante la toman de Sesion.tsx. El boton flotante del asistente
// (D142) es solo para quien lo tiene abierto (CHAT_IA_ABIERTO).
export default function Cabecera() {
  return (
    <>
      <Navegacion escudo={<Escudo decorativo />} />
      <AsistenteFlotante />
    </>
  );
}
