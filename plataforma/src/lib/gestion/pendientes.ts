import "server-only";
import { cargarFuente } from "@/lib/eventos/fuente";
import { estadoClasificacion, proximosPartidos, ultimosResultados } from "@/lib/publico";
import { proximoEntreno } from "@/lib/gestion/entreno";
import { diaMes, diaSemanaCorto, hoyMadrid } from "@/lib/dias";
import { campanaAbiertaAhora, fechaCorta } from "@/lib/fechas";
import type { Cliente } from "@/lib/eventos/datos";

// «Pendiente esta semana» del Panel de Gestion (D76), en un solo sitio: lo usan el Panel y la banda «Gestión esta
// semana» del inicio personal de los gestores (D117). Cada tarea lleva su enlace.
export type Pendiente = { texto: string; href: string };

export async function cargarPendientesSemana(supabase: Cliente): Promise<Pendiente[]> {
  const hoy = hoyMadrid();
  const fuente = await cargarFuente();
  const proximos = proximosPartidos(hoy, undefined, fuente);
  const fecha = proximos.map((p) => p.evento.fecha).sort()[0];
  const jornada = proximos.find((p) => p.evento.fecha === fecha)?.evento.jornada;
  const sinActa = ultimosResultados(hoy).filter((r) => r.pendienteActa);
  // El proximo entreno, de la tabla de eventos con su pista efectiva (no del fichero ni de la vista publica).
  const [{ count: jugadores }, { count: conCorreo }, { data: campanas }, entreno] = await Promise.all([
    supabase.from("jugadores").select("id", { count: "exact", head: true }).eq("activo", true),
    supabase.from("jugadores").select("id", { count: "exact", head: true }).eq("activo", true).not("email", "is", null),
    supabase.from("campanas_ropa").select("id, nombre, estado, fecha_limite").order("creado_en", { ascending: false }).limit(1),
    proximoEntreno(supabase, hoy),
  ]);
  const campana = campanas?.[0] as { id: string; nombre: string; estado: string; fecha_limite: string | null } | undefined;
  const ropaAbierta = campana ? campanaAbiertaAhora(campana as never) : false;
  const { count: pedidos } = campana && ropaAbierta
    ? await supabase.from("pedidos_ropa").select("id", { count: "exact", head: true }).eq("campana_id", campana.id)
    : { count: 0 };
  const sinCorreo = (jugadores ?? 0) - (conCorreo ?? 0);
  const out: Pendiente[] = [];
  if (entreno?.pista.porConfirmar) out.push({ texto: `Fijar la pista del entreno del ${diaSemanaCorto(entreno.evento.fecha)} ${diaMes(entreno.evento.fecha)} (${entreno.pista.motivo ?? "pista por confirmar"}).`, href: `/gestion/eventos/${entreno.evento.id}` });
  if (jornada) out.push({ texto: `Convocatoria de la J${jornada}: reparto MdA / MdL y aviso de equipación (rutina C, lunes y martes).`, href: `/gestion/convocatoria?fecha=${fecha}` });
  if (sinActa.length) out.push({ texto: `J${sinActa[0].jornada ?? "?"} publicada sin acta: completarla cuando la FBM suba las actas (rutina A).`, href: "/gestion/liga" });
  if (/pendiente de contrastar/i.test(estadoClasificacion())) out.push({ texto: "Contrastar la clasificación calculada con la oficial (rutina B, jueves).", href: "/liga" });
  if (sinCorreo > 0) out.push({ texto: `${sinCorreo} ${sinCorreo === 1 ? "jugador sin correo: no puede" : "jugadores sin correo: no pueden"} entrar.`, href: "/gestion/jugadores" });
  if (campana && ropaAbierta) out.push({ texto: `Pedido de ropa abierto${campana.fecha_limite ? ` hasta el ${fechaCorta(campana.fecha_limite)}` : ""}: ${pedidos ?? 0} pedidos.`, href: "/gestion/ropa" });
  return out;
}
