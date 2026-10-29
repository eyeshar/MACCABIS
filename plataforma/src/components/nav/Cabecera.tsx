import { usuarioActual } from "@/lib/usuario";
import { puedeUsarChat } from "@/lib/chat/acceso";
import { duenoConversacion } from "@/lib/chat/dueno";
import { Escudo } from "@/components/web/Marco";
import AsistenteFlotante from "@/components/asistente/AsistenteFlotante";
import Navegacion from "./Navegacion";

// Cabecera unica (D89), en el layout raiz: lee la sesion en el servidor y pinta la navegacion de toda la web.
// Tambien el boton flotante del asistente (D142), solo para quien lo tiene abierto (CHAT_IA_ABIERTO).
export default async function Cabecera() {
  const usuario = await usuarioActual().catch(() => null);
  const chat = usuario && puedeUsarChat(usuario) ? { nombre: usuario.corto, dueno: duenoConversacion(usuario.email) } : null;
  return (
    <>
      <Navegacion usuario={usuario} escudo={<Escudo decorativo />} />
      <AsistenteFlotante chat={chat} />
    </>
  );
}
