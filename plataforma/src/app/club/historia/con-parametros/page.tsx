import HistoriaVista, { metadata } from "../HistoriaVista";

// /club/historia?persona=<person_id> (D175; antes /historia?persona=): la misma pagina, dinamica porque lee la consulta (ver next.config).
export const dynamic = "force-dynamic";
export { metadata };

export default async function HistoriaConParametros({ searchParams }: { searchParams: Promise<{ persona?: string }> }) {
  return <HistoriaVista {...(await searchParams)} />;
}
