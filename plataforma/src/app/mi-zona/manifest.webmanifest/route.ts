import { cargarMiZona } from "../datos";

// Manifiesto de la zona personal: al "Añadir a pantalla de inicio" el icono
// abre /mi-zona (la sesion decide quien es, ya no hace falta un token por URL).
export async function GET() {
  const zona = await cargarMiZona();
  if (!zona) return new Response("No encontrado", { status: 404 });
  const cuerpo = {
    name: "Maccabis",
    short_name: "Maccabis",
    start_url: "/mi-zona",
    scope: "/mi-zona",
    display: "standalone",
    background_color: "#F4F1EA",
    theme_color: "#16150F",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
  return new Response(JSON.stringify(cuerpo), {
    headers: { "content-type": "application/manifest+json", "cache-control": "private, no-store" },
  });
}
