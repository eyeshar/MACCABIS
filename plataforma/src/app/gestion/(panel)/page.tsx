import Link from "next/link";
import { exigirGestor } from "@/lib/sesion";
import ProximoPartido from "@/components/ProximoPartido";
import { proximoConAviso } from "@/lib/equipacion";

export const metadata = { title: "Gestión · Maccabis" };

export default async function InicioGestion() {
  const { supabase } = await exigirGestor();
  const [{ count: jugadores }, { count: conCorreo }, { data: campanas }] = await Promise.all([
    supabase.from("jugadores").select("id", { count: "exact", head: true }).eq("activo", true),
    supabase.from("jugadores").select("id", { count: "exact", head: true }).eq("activo", true).not("email", "is", null),
    supabase.from("campanas_ropa").select("id, nombre, estado").order("creado_en", { ascending: false }).limit(1),
  ]);
  const campana = campanas?.[0];
  const { count: pedidos } = campana
    ? await supabase.from("pedidos_ropa").select("id", { count: "exact", head: true }).eq("campana_id", campana.id)
    : { count: 0 };

  const proximos = (["MDA", "MDL"] as const).map((e) => proximoConAviso(e)?.partido).filter((x) => !!x);

  return (
    <>
      <h1>Panel de gestión</h1>
      <section className="tarjeta" aria-labelledby="t-prox">
        <h2 id="t-prox">Próximos partidos</h2>
        {proximos.length ? proximos.map((x) => <ProximoPartido key={x!.equipo} partido={x!} />) : <p className="suave" style={{ margin: 0 }}>No quedan partidos de liga en el calendario.</p>}
      </section>
      <div className="rejilla-2">
        <section className="tarjeta">
          <h2>Jugadores</h2>
          <p>{jugadores ?? 0} personas activas. {conCorreo ?? 0} con correo dado de alta (pueden entrar).</p>
          <Link className="boton" href="/gestion/jugadores">Ver jugadores</Link>
        </section>
        <section className="tarjeta">
          <h2>Pedido de ropa</h2>
          {campana ? (
            <p>{campana.nombre}: <span className={`etiqueta ${campana.estado === "abierta" ? "etiqueta-abierta" : "etiqueta-cerrada"}`}>{campana.estado === "abierta" ? "Abierta" : "Cerrada"}</span> · {pedidos ?? 0} pedidos.</p>
          ) : <p>No hay ninguna campaña.</p>}
          <Link className="boton" href="/gestion/ropa">Ver pedido de ropa</Link>
        </section>
      </div>
      <div className="rejilla-2">
        <section className="tarjeta">
          <h2>Scouting rivales</h2>
          <p>Jugadores de cada rival (puntos, triples, tiros libres, faltas) y su próximo partido contra nosotros.</p>
          <Link className="boton" href="/gestion/scouting">Ver scouting</Link>
        </section>
        <section className="tarjeta">
          <h2>Liga consolidada</h2>
          <p>Líderes individuales de los dos grupos y ranking conjunto de equipos.</p>
          <Link className="boton" href="/gestion/liga">Ver liga</Link>
        </section>
      </div>
      <section className="tarjeta tarjeta-apagada">
        <h2>Próximamente</h2>
        <p style={{ margin: 0 }}>Calendario único, disponibilidad de la semana, pase de lista y convocatorias (bloque de la jornada 2).</p>
      </section>
    </>
  );
}
