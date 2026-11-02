import Link from "next/link";
import Volver from "@/components/nav/Volver";
import { exigirGestor } from "@/lib/sesion";
import { cargarContexto } from "@/lib/convocatoria/datos";
import { diferencias, EQUIPOS } from "@/lib/convocatoria/motor";
import { destinatariosAviso, diaTexto, firmaConvocatoria, mensajeConvocatoria, textoAvisados } from "@/lib/convocatoria/mensajes";
import { avisosDelFichero } from "@/lib/inicio/avisos";
import CopiarTexto from "../../eventos/CopiarTexto";
import { BotonAviso, CopiarWhatsapp } from "./Botones";

export const metadata = { title: "Salida de la convocatoria · Gestión Maccabis" };

const fechaHora = (t: string | null) => (t ? new Date(t).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
const orden = (a: string, b: string) => a.localeCompare(b, "es");

// Salida de una convocatoria aprobada (D107, simplificada en D173): quién ha recibido el aviso en el móvil («Avisados N de
// M»; el aviso sale al pulsar «Aprobar y avisar») y el mensaje de WhatsApp del grupo con «Copiar mensaje». Sin estados
// «pendiente / al día». «Avisar del cambio» si la convocatoria cambió después del último aviso; «Reenviar», solo para los
// avisos que fallaron.
export default async function SalidaConvocatoria({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const { fecha } = await searchParams;
  const { supabase } = await exigirGestor();
  const ctx = await cargarContexto(supabase, fecha);
  const c = ctx?.convocatoria;
  if (!ctx || !c || c.estado !== "aprobada") {
    return (
      <>
        <div className="gs-titulo"><div><div className="gs-eyebrow"><Volver enLinea defecto={`/gestion/convocatoria${fecha ? `?fecha=${fecha}` : ""}`} etiqueta="Convocatoria" /></div><h1>Sin aprobar</h1></div></div>
        <p className="suave">La convocatoria de ese domingo aún no está aprobada.</p>
      </>
    );
  }
  const nombre = (id: string) => ctx.jugadores.find((j) => j.person_id === id)?.nombre ?? id;
  // El WhatsApp empieza por lo que ha cambiado desde la última vez que se copió.
  const cambiosWa = c.whatsapp_base ? diferencias(c.whatsapp_base, c.equipos, nombre) : [];
  const avisosDomingo = avisosDelFichero(ctx.fecha, ctx.partidos.map((p) => p.equipo));
  const wa = mensajeConvocatoria(ctx.fecha, ctx.jornada, ctx.partidos, c.equipos, nombre, cambiosWa, avisosDomingo);
  // Cambió después del último aviso: a quién avisaría «Avisar del cambio».
  const porAvisar = c.aviso_estado === "enviado" ? destinatariosAviso(c.equipos, c.aviso_base).personas : [];
  // Lo que salió en el último envío (registro de avisos con la firma de lo avisado).
  let envio: { avisados: string[]; sin: string[]; fallidos: string[]; pendientes: { nombre: string; cuando: string }[] } | null = null;
  if (c.aviso_estado === "enviado" && c.aviso_base) {
    const [{ data }, { data: subs }] = await Promise.all([
      supabase.from("avisos_registro").select("person_id, enviado_en, programado_para, resultado").like("clave", `convocatoria:${ctx.fecha}:${firmaConvocatoria(c.aviso_base)}:%`),
      supabase.from("suscripciones_avisos").select("person_id").eq("activa", true),
    ]);
    const conAvisos = new Set(((subs ?? []) as { person_id: string | null }[]).map((x) => x.person_id));
    const fs = (data ?? []) as { person_id: string; enviado_en: string | null; programado_para: string; resultado: string | null }[];
    // Lo que aún espera a las 08:00 (horas de silencio) cuenta como avisado si esa persona tiene avisos; si no, como «sin avisos».
    const espera = fs.filter((f) => !f.enviado_en);
    envio = {
      avisados: fs.filter((f) => f.resultado === "enviado").map((f) => nombre(f.person_id)).sort(orden),
      sin: [...fs.filter((f) => f.resultado === "sin_avisos"), ...espera.filter((f) => !conAvisos.has(f.person_id))].map((f) => nombre(f.person_id)).sort(orden),
      fallidos: fs.filter((f) => f.resultado === "fallido").map((f) => nombre(f.person_id)).sort(orden),
      pendientes: espera.filter((f) => conAvisos.has(f.person_id)).map((f) => ({ nombre: nombre(f.person_id), cuando: fechaHora(f.programado_para) })),
    };
  }
  const m = envio ? envio.avisados.length + envio.sin.length + envio.fallidos.length + envio.pendientes.length : 0;
  const web = "https://maccabis.vercel.app";
  const msgSinAvisos = envio?.sin.length ? `Hola, ${envio.sin.join(", ")}: no tenéis activados los avisos de Maccabis en el móvil y os perdéis la convocatoria y los cambios de hora o pista (de noche solo si el partido es en pocas horas). Es un minuto: ${web}/avisos` : "";
  const total = new Set(EQUIPOS.flatMap((e) => (c.equipos[e] ?? []).map((x) => x.person_id))).size;

  return (
    <>
      <div className="gs-titulo">
        <div>
          <div className="gs-eyebrow"><Volver enLinea defecto={`/gestion/convocatoria?fecha=${ctx.fecha}`} etiqueta="Convocatoria" /> · Salida</div>
          <h1>{ctx.jornada ? `J${ctx.jornada} aprobada` : "Aprobada"}</h1>
          <span className="suave">{diaTexto(ctx.fecha)} · {total} convocados · aprobada{c.aprobada_por_nombre ? ` por ${c.aprobada_por_nombre}` : ""} el {fechaHora(c.aprobada_en)}</span>
        </div>
      </div>

      <div className="cv-salidas">
        <section className="gs-bloque" aria-labelledby="t-aviso" data-testid="cv-salida-aviso">
          <h2 id="t-aviso">Aviso en el móvil</h2>
          {envio ? (
            <div data-testid="cv-aviso-resultado">
              <p style={{ margin: 0 }}><b>{textoAvisados(envio.avisados.length + envio.pendientes.length, m)}</b>{c.aviso_en ? <span className="suave"> · {fechaHora(c.aviso_en)}</span> : null}.</p>
              {envio.pendientes.length > 0 && <p className="pequeno" style={{ margin: 0 }}>De noche: sale el {envio.pendientes[0].cuando} (horas de silencio, 22:30–08:00).</p>}
              {envio.avisados.length > 0 && <p className="pequeno suave" style={{ margin: "6px 0 0" }} data-testid="cv-avisados">Avisados: {envio.avisados.join(", ")}.</p>}
              {envio.sin.length > 0 && (
                <>
                  <p className="pequeno" style={{ margin: "6px 0 0" }} data-testid="cv-sin-avisos">Sin avisos: {envio.sin.join(", ")}. Lo ven en su inicio; mándales el enlace a <Link href="/avisos">/avisos</Link>:</p>
                  <CopiarTexto texto={msgSinAvisos} etiqueta="Copiar mensaje para ellos" />
                </>
              )}
              {envio.fallidos.length > 0 && (
                <>
                  <p className="pequeno ev-no" style={{ margin: "6px 0 0" }} data-testid="cv-fallidos">No llegó (error al enviar): {envio.fallidos.join(", ")}.</p>
                  <BotonAviso fecha={ctx.fecha} que="reenviar" />
                </>
              )}
            </div>
          ) : <p className="pequeno" style={{ margin: 0 }}>Aún no ha salido ningún aviso de esta convocatoria.</p>}
          {(porAvisar.length > 0 || !envio) && (
            <div data-testid="cv-aviso-cambio">
              {porAvisar.length > 0 && <p className="pequeno" style={{ margin: "6px 0 0" }}>Ha cambiado después del aviso. Se avisaría a {porAvisar.map((x) => nombre(x.person_id)).sort(orden).join(", ")}.</p>}
              <BotonAviso fecha={ctx.fecha} que="cambio" etiqueta={envio ? "Avisar del cambio" : "Avisar ahora"} />
            </div>
          )}
          <p className="pequeno suave" style={{ margin: 0 }}>Cada jugador recibe un solo aviso según su caso: convocado, convocado con un equipo (y no con el otro) o «esta vez no entras». Nunca de 22:30 a 08:00 y nunca dos veces lo mismo. Nadie ve niveles.</p>
        </section>

        <section className="gs-bloque" aria-labelledby="t-wa" data-testid="cv-salida-whatsapp">
          <h2 id="t-wa">WhatsApp del grupo</h2>
          {cambiosWa.length > 0 && <p className="pequeno" style={{ margin: 0 }}><b>Cambió desde la última vez que lo copiaste:</b> {cambiosWa.join("; ")}.</p>}
          <CopiarWhatsapp fecha={ctx.fecha} texto={wa} />
        </section>
      </div>
    </>
  );
}
