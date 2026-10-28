import { estadoSalud } from "@/lib/avisos/alarma";
import { clienteServicio, configuradoEnvio } from "@/lib/avisos/servidor";

// Salud de la tarea de avisos: la consulta cada hora un workflow de GitHub Actions (.github/workflows/salud-avisos.yml),
// que FALLA si no esta "ok" y GitHub avisa por correo. Publico y sin datos personales: solo "ok" / "fallando" y la hora
// de la ultima pasada correcta (respuesta 200 de la tarea, vista en pg_net).
export const dynamic = "force-dynamic";

export async function GET() {
  let ultima: string | null = null;
  let motivo: string | undefined;
  if (!configuradoEnvio()) motivo = "faltan las claves en el servidor";
  else {
    const { data, error } = await clienteServicio().rpc("ultima_pasada_avisos");
    if (error) motivo = "no se pudo leer la ultima pasada";
    else ultima = (data as string | null) ?? null;
  }
  const estado = motivo ? ("fallando" as const) : estadoSalud(ultima);
  return Response.json({ estado, ultima_pasada_ok: ultima, ...(motivo ? { motivo } : {}) }, { status: estado === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
