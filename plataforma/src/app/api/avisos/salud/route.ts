import { erroresUltimaHora, estadoSalud, type Pasada } from "@/lib/avisos/alarma";
import { clienteServicio, configuradoEnvio } from "@/lib/avisos/servidor";

// Salud de la tarea de avisos: la consulta cada hora un workflow de GitHub Actions (.github/workflows/salud-avisos.yml),
// que FALLA si no esta "ok" y GitHub avisa por correo. Publico y sin datos personales: solo "ok" / "fallando" y la hora
// de la ultima pasada correcta (respuesta 200 de la tarea, vista en pg_net) y cuantas pasadas dieron error en la ultima hora
// (2 o mas: "fallando").
export const dynamic = "force-dynamic";

export async function GET() {
  let ultima: string | null = null;
  let pasadas: Pasada[] = [];
  let motivo: string | undefined;
  if (!configuradoEnvio()) motivo = "faltan las claves en el servidor";
  else {
    const sb = clienteServicio();
    const [u, h] = await Promise.all([sb.rpc("ultima_pasada_avisos"), sb.rpc("pasadas_avisos_hora")]);
    if (u.error) motivo = "no se pudo leer la ultima pasada";
    else ultima = (u.data as string | null) ?? null;
    // Sin la migracion 20261104130000 (PGRST202) se sigue solo con la regla de los 40 minutos; otro error, a la vista.
    if (h.error && h.error.code !== "PGRST202") motivo ??= "no se pudieron leer las pasadas de la ultima hora";
    else pasadas = (h.data as Pasada[] | null) ?? [];
  }
  const estado = motivo ? ("fallando" as const) : estadoSalud(ultima, new Date(), pasadas);
  const errores = erroresUltimaHora(pasadas);
  return Response.json({ estado, ultima_pasada_ok: ultima, errores_ultima_hora: errores, ...(motivo ? { motivo } : {}) }, { status: estado === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
