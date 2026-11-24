// D199: la version de la web que hay ahora en el servidor. Estatica: se genera al compilar, la sirve la CDN sin ninguna
// funcion y el proxy no la toca (el matcher excluye los .txt). Una pestaña abierta antes de un despliegue lleva dentro su
// propia version (NEXT_PUBLIC_VERSION_WEB, de la misma compilacion) y la compara con esta antes de guardar una respuesta
// y al volver a la pestaña (src/lib/version/cliente.ts).
export const dynamic = "force-static";

export function GET() {
  return new Response(process.env.NEXT_PUBLIC_VERSION_WEB ?? "", { headers: { "content-type": "text/plain; charset=utf-8" } });
}
