import { NextResponse } from "next/server";
import { modoChat, puedeUsarChat } from "@/lib/chat/acceso";
import { cargarContexto, llamarWorker, usuarioHash } from "@/lib/chat/servidor";
import { sesionActual } from "@/lib/sesion";
import { usuarioActual } from "@/lib/usuario";

// Asistente de la web (D142). El navegador solo habla con esta ruta; ella monta el contexto con la sesion de quien
// pregunta y llama al Worker de Cloudflare con el secreto (nunca llega al navegador). Solo lectura: no cambia nada.
//   POST { accion: "cuota" }                      -> { quedan }
//   POST { mensajes: [{ role, content }, ...] }    -> { respuesta, quedan } | { agotado: true, quedan: 0 }
export const dynamic = "force-dynamic";

const no = (status: number, error: string) => NextResponse.json({ error }, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: Request) {
  const { user } = await sesionActual();
  if (!user) return no(401, "Entra en la web para usar el asistente.");
  const usuario = await usuarioActual();
  if (!puedeUsarChat(usuario)) return no(403, modoChat() === "off" ? "El asistente está apagado." : "El asistente aún no está abierto para tu cuenta.");

  let cuerpo: { accion?: unknown; mensajes?: unknown };
  try { cuerpo = await request.json(); } catch { return no(400, "Petición no válida."); }
  const hash = usuarioHash(user.id);

  try {
    if (cuerpo.accion === "cuota") {
      const r = await llamarWorker({ accion: "cuota", usuario_hash: hash });
      return NextResponse.json({ quedan: r.quedan }, { headers: { "cache-control": "no-store" } });
    }
    const mensajes = Array.isArray(cuerpo.mensajes)
      ? cuerpo.mensajes
          .filter((m): m is { role: "user" | "assistant"; content: string } => Boolean(m) && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .map((m) => ({ role: m.role, content: m.content.slice(0, 800) }))
          .slice(-6)
      : [];
    if (!mensajes.length || mensajes.at(-1)!.role !== "user") return no(400, "Escribe una pregunta.");
    const contexto = await cargarContexto(usuario!);
    const r = await llamarWorker({ usuario_hash: hash, mensajes, contexto });
    if ("agotado" in r) return NextResponse.json({ agotado: true, motivo: r.motivo, quedan: r.quedan }, { headers: { "cache-control": "no-store" } });
    return NextResponse.json({ respuesta: r.respuesta, quedan: r.quedan, uso: "uso" in r ? r.uso : undefined }, { headers: { "cache-control": "no-store" } });
  } catch {
    // Worker caido o lento: sin detalles.
    return no(502, "El asistente no responde ahora. Inténtalo en un rato.");
  }
}

export function GET() {
  return no(405, "Usa POST.");
}
