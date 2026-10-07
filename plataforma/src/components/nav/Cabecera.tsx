import { usuarioActual } from "@/lib/usuario";
import { Escudo } from "@/components/web/Marco";
import Navegacion from "./Navegacion";

// Cabecera unica (D89), en el layout raiz: lee la sesion en el servidor y pinta la navegacion de toda la web.
export default async function Cabecera() {
  const usuario = await usuarioActual().catch(() => null);
  return <Navegacion usuario={usuario} escudo={<Escudo decorativo />} />;
}
