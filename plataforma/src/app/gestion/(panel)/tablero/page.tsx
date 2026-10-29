import { exigirGestor } from "@/lib/sesion";
import Volver from "@/components/nav/Volver";
import { cargarTableroDomingo, cargarTableroEvento, opcionesSelector } from "@/lib/tablero/datos";
import Tablero from "./Tablero";
import AvisoSinFicha from "@/components/numeros/AvisoSinFicha";
import "./tablero.css";

export const metadata = { title: "Tablero · Gestión Maccabis" };
export const dynamic = "force-dynamic";

// Tablero de asistencias y convocatoria (D121): solo gestores. Un DOMINGO de partidos (una linea por jugador, con su
// estado en cada partido) o un EVENTO SUELTO (Van · Duda o sin responder · No van). Complementa al motor de
// convocatorias, que sigue proponiendo: aqui se ve de un vistazo y se ajusta a mano.
export default async function PaginaTablero({ searchParams }: { searchParams: Promise<{ domingo?: string; evento?: string }> }) {
  const { domingo, evento } = await searchParams;
  const { supabase } = await exigirGestor();
  const opciones = await opcionesSelector(supabase);
  const datos = evento && /^[0-9a-f-]{36}$/i.test(evento) ? await cargarTableroEvento(supabase, evento) : await cargarTableroDomingo(supabase, domingo);
  if (!datos) {
    return <div className="gs-titulo"><div><div className="gs-eyebrow">Tablero</div><h1>Nada que ver</h1><span className="suave">Ese evento no existe o no quedan partidos de liga en el calendario.</span></div></div>;
  }
  const actual = datos.vista === "domingo" ? `domingo:${datos.fecha}` : `evento:${datos.evento.id}`;
  const sinFicha = datos.vista === "evento" ? datos.sinFicha : null;
  return <><Volver defecto="/gestion/convocatoria" etiqueta="Convocatoria" /><AvisoSinFicha personas={sinFicha?.personas ?? []} pista={sinFicha?.pista} /><Tablero key={actual} datos={datos} opciones={opciones} actual={actual} /></>;
}
