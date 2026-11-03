import LigaVista, { metadata } from "../LigaVista";

// /liga?g=G2 y /liga?hoy=AAAA-MM-DD (D175): la misma pagina, pero dinamica porque lee la consulta. next.config reescribe a
// esta ruta cuando «/liga» lleva g o hoy; la direccion que se ve sigue siendo /liga.
export const dynamic = "force-dynamic";
export { metadata };

export default async function LigaConParametros({ searchParams }: { searchParams: Promise<{ g?: string; hoy?: string }> }) {
  return <LigaVista {...(await searchParams)} />;
}
