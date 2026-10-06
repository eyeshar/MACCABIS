import { cargarMiZona } from "../datos";

// Manifiesto de la zona personal: misma app que la web (id y alcance "/", D76), pero al "Añadir a pantalla de inicio"
// desde aqui el icono abre /mi-zona (la sesion decide quien es).
export async function GET() {
  const zona = await cargarMiZona();
  if (!zona) return new Response("No encontrado", { status: 404 });
  const cuerpo = {
    id: "/",
    name: "Maccabis",
    short_name: "Maccabis",
    lang: "es",
    start_url: "/mi-zona",
    scope: "/",
    display: "standalone",
    background_color: "#0E0D12",
    theme_color: "#0E0D12",
    icons: [
      { src: "/iconos/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/iconos/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/iconos/icono-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(cuerpo), {
    headers: { "content-type": "application/manifest+json", "cache-control": "private, no-store" },
  });
}
