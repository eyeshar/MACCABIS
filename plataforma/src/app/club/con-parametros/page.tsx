import PlantillaVista, { metadata } from "../PlantillaVista";

// /club?t=<temporada> (D175; antes /plantilla?t=): la misma pagina, dinamica porque lee la consulta (ver next.config).
export const dynamic = "force-dynamic";
export { metadata };

export default async function PlantillaConParametros({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  return <PlantillaVista {...(await searchParams)} />;
}
