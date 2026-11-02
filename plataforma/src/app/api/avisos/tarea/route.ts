import { timingSafeEqual } from "node:crypto";
import { configuradoEnvio, ejecutarTarea } from "@/lib/avisos/servidor";

// Tarea de avisos (D99.5): la llama cada 15 minutos pg_cron + pg_net desde Supabase, con el secreto AVISOS_SECRETO en la
// cabecera Authorization. Sin el secreto correcto, 401 y no hace nada. Repetirla no duplica avisos (registro con clave).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function autorizado(req: Request) {
  const secreto = process.env.AVISOS_SECRETO;
  const dado = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secreto || secreto.length < 32 || !dado) return false;
  const a = Buffer.from(secreto), b = Buffer.from(dado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** La hora de la pasada: la real. Solo en las pruebas (variable AVISOS_PRUEBAS_AHORA=1, que nunca está en Vercel) se puede
 *  simular con ?ahora=<ISO> para probar el martes a las 12:00 cualquier día (D173). */
function horaDeLaPasada(req: Request) {
  const pedida = process.env.AVISOS_PRUEBAS_AHORA === "1" ? new URL(req.url).searchParams.get("ahora") : null;
  const t = pedida ? new Date(pedida) : null;
  return t && !Number.isNaN(t.getTime()) ? t : new Date();
}

export async function POST(req: Request) {
  if (!autorizado(req)) return Response.json({ error: "no autorizado" }, { status: 401 });
  if (!configuradoEnvio()) return Response.json({ error: "faltan las claves de avisos en el servidor" }, { status: 503 });
  try {
    return Response.json(await ejecutarTarea(horaDeLaPasada(req)));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ error: "usa POST" }, { status: 405 });
}
