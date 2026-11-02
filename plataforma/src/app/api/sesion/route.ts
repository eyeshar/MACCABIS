import { NextResponse } from "next/server";
import { sesionDelNavegador } from "@/lib/usuario";
import { puedeUsarChat } from "@/lib/chat/acceso";
import { duenoConversacion } from "@/lib/chat/dueno";
import type { DatosSesion } from "@/components/nav/Sesion";

// Quien es (D175): lo que la cabecera, el pie, la navegacion de la liga y el boton del asistente necesitan saber de la sesion.
// Sin cache de ningun tipo: es de cada persona. El HTML de las paginas publicas ya no lleva nada de la sesion.
export const dynamic = "force-dynamic";

export async function GET() {
  const { usuario, verLiga } = await sesionDelNavegador().catch(() => ({ usuario: null, verLiga: false }));
  const estado: DatosSesion = {
    usuario,
    chat: usuario && puedeUsarChat(usuario) ? { nombre: usuario.corto, dueno: duenoConversacion(usuario.email) } : null,
    verLiga,
  };
  return NextResponse.json(estado, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
