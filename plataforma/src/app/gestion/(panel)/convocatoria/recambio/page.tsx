import Volver from "@/components/nav/Volver";
import { exigirGestor } from "@/lib/sesion";
import { cargarContexto } from "@/lib/convocatoria/datos";
import { EQUIPOS, sugerirRecambio, type Equipo } from "@/lib/convocatoria/motor";
import { entradaDe } from "@/lib/convocatoria/vista";
import { diaTexto } from "@/lib/convocatoria/mensajes";
import HojaRecambio from "./HojaRecambio";

export const metadata = { title: "Recambio · Gestión Maccabis" };

const TEXTO_RESP = { va: "dice «voy»", duda: "tiene «duda»", no: "dice «no voy»", sin_responder: "no ha respondido" } as const;

// Hoja de recambio (D173): sale un convocado de una convocatoria aprobada (dice «no voy», un gestor lo cambia o un cambio de
// calendario lo deja fuera). Trae preseleccionado el recambio del motor (sugerirRecambio: el reserva antes de doblar, las
// fichas, nada de doblar a la misma hora y solo se dobla para cubrir mínimos), pero lista TODOS los disponibles para elegir
// otro, o ninguno. «Aplicar y avisar» guarda, avisa a quien entra y a quien sale y da el WhatsApp del cambio. Solo gestores.
export default async function PaginaRecambio({ searchParams }: { searchParams: Promise<{ fecha?: string; sale?: string; equipo?: string }> }) {
  const { fecha, sale, equipo } = await searchParams;
  const { supabase } = await exigirGestor();
  const ctx = await cargarContexto(supabase, fecha);
  const volver = `/gestion/convocatoria${fecha ? `?fecha=${fecha}` : ""}`;
  const eq = EQUIPOS.find((e) => e === equipo) as Equipo | undefined;
  const c = ctx?.convocatoria;
  const sinNada = (texto: string) => (
    <>
      <div className="gs-titulo"><div><div className="gs-eyebrow"><Volver enLinea defecto={volver} etiqueta="Convocatoria" /></div><h1>Recambio</h1></div></div>
      <p className="suave" data-testid="rc-nada">{texto}</p>
    </>
  );
  if (!ctx || !fecha || ctx.fecha !== fecha || !c || c.estado !== "aprobada") return sinNada("La convocatoria de ese domingo no está aprobada: ajústala en la pantalla de la convocatoria.");
  if (!eq || !sale || !(c.equipos[eq] ?? []).some((x) => x.person_id === sale)) return sinNada("Ese jugador ya no está en ese equipo: el cambio ya está hecho.");
  const r = sugerirRecambio(entradaDe(ctx), c.equipos, sale, eq);
  const porId = new Map(ctx.jugadores.map((j) => [j.person_id, j]));
  const j = porId.get(sale);
  const resp = j?.respuesta[eq] ?? "sin_responder";
  return (
    <>
      <div className="gs-titulo">
        <div>
          <div className="gs-eyebrow"><Volver enLinea defecto={volver} etiqueta="Convocatoria" /> · Recambio</div>
          <h1>Sale {j?.nombre ?? sale}</h1>
          <span className="suave" data-testid="rc-sale">{eq} · {diaTexto(fecha)} · {TEXTO_RESP[resp]}</span>
        </div>
      </div>
      <HojaRecambio fecha={fecha} sale={sale} equipo={eq} sugerido={r.sugerido} porque={r.porque} bajoMinimo={r.bajoMinimo}
        candidatos={r.candidatos.map((x) => ({ ...x, nombre: porId.get(x.person_id)?.nombre ?? x.person_id }))} />
    </>
  );
}
