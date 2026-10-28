import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import Volver from "@/components/nav/Volver";
import { puedeUsarChat } from "@/lib/chat/acceso";
import { exigirSesion } from "@/lib/sesion";
import { usuarioActual } from "@/lib/usuario";
import Chat from "./Chat";
import "./asistente.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Asistente · Maccabis", robots: { index: false, follow: false } };

// «Pregunta al asistente» (D142): IA gratuita (Workers AI, plan Free) que responde sobre el uso de la web y lo tuyo.
// Solo lectura. Con CHAT_IA_ABIERTO = "gestores" (por defecto), solo los gestores; los demas, 403.
export default async function Asistente() {
  await exigirSesion();
  const usuario = await usuarioActual();
  if (!puedeUsarChat(usuario)) forbidden();
  return (
    <main className="pagina as-pagina">
      <Volver defecto="/" etiqueta="Inicio" />
      <h1>Pregunta al asistente</h1>
      <p className="as-aviso" data-testid="aviso-fijo">Respuestas automáticas, pueden equivocarse. Lo oficial es lo que pone la web.</p>
      <Chat nombre={usuario!.corto} />
    </main>
  );
}
