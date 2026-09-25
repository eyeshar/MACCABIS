import { cargarZona } from "../datos";

// Manifiesto propio de cada jugador: al "Añadir a pantalla de inicio", el icono
// abre SU zona (start_url con su enlace) y no la portada.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const zona = await cargarZona(token);
  if (!zona) return new Response("No encontrado", { status: 404 });
  const cuerpo = {
    name: "Maccabis",
    short_name: "Maccabis",
    start_url: `/j/${token}`,
    scope: `/j/${token}`,
    display: "standalone",
    background_color: "#F4F1EA",
    theme_color: "#16150F",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
  return new Response(JSON.stringify(cuerpo), {
    headers: { "content-type": "application/manifest+json", "cache-control": "private, no-store" },
  });
}
