import Link from "next/link";
import { exigirGestor } from "@/lib/sesion";
import { cargarContexto } from "@/lib/convocatoria/datos";
import { diferencias, EQUIPOS } from "@/lib/convocatoria/motor";
import { destinatariosAviso, diaTexto, firmaConvocatoria, mensajeConvocatoria, textoCambioConvocatoria, textoEstasConvocado, textoSportEasy } from "@/lib/convocatoria/mensajes";
import CopiarTexto from "../../eventos/CopiarTexto";
import { BotonAvisar, BotonMarcar } from "./Botones";

export const metadata = { title: "Salida de la convocatoria · Gestión Maccabis" };

const fechaHora = (t: string | null) => (t ? new Date(t).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");

// Salida de una convocatoria aprobada (D107): (1) mensaje de WhatsApp listo para copiar (formato de D98), (2) aviso
// «Estás convocado» en la web, con «Enviar ahora» y SIN depender del interruptor (D127) y (3) copia a SportEasy, que hace
// Claude con el navegador y sin notificar (D104). Si la convocatoria cambia tras aprobarla, 1 y 3 vuelven a pendiente
// y el mensaje dice qué ha cambiado.
export default async function SalidaConvocatoria({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const { fecha } = await searchParams;
  const { supabase } = await exigirGestor();
  const ctx = await cargarContexto(supabase, fecha);
  const c = ctx?.convocatoria;
  if (!ctx || !c || c.estado !== "aprobada") {
    return (
      <>
        <div className="gs-titulo"><div><div className="gs-eyebrow"><Link href={`/gestion/convocatoria${fecha ? `?fecha=${fecha}` : ""}`}>← Convocatoria</Link></div><h1>Sin aprobar</h1></div></div>
        <p className="suave">La convocatoria de ese domingo aún no está aprobada.</p>
      </>
    );
  }
  const nombre = (id: string) => ctx.jugadores.find((j) => j.person_id === id)?.nombre ?? id;
  const cambiosWa = c.whatsapp_estado === "pendiente" ? diferencias(c.whatsapp_base, c.equipos, nombre) : [];
  const cambiosSe = c.sporteasy_estado === "pendiente" ? diferencias(c.sporteasy_base, c.equipos, nombre) : [];
  const wa = mensajeConvocatoria(ctx.fecha, ctx.jornada, ctx.partidos, c.equipos, nombre, cambiosWa);
  const se = textoSportEasy(ctx.fecha, ctx.jornada, ctx.partidos, c.equipos, nombre, cambiosSe);
  // Aviso de la web (D127): a quien toca ahora y como fue el ultimo envio (registro de avisos con la firma de lo avisado).
  const porAvisar = destinatariosAviso(c.equipos, c.aviso_estado === "enviado" ? c.aviso_base : null);
  const avisoAlDia = c.aviso_estado === "enviado" && porAvisar.personas.length === 0;
  const primero = porAvisar.personas[0];
  const ejemplo = porAvisar.cambio
    ? textoCambioConvocatoria(ctx.fecha, ctx.partidos, primero?.equipos ?? ctx.partidos.map((p) => p.equipo).slice(0, 1))
    : textoEstasConvocado(ctx.fecha, ctx.partidos, primero?.equipos ?? ctx.partidos.map((p) => p.equipo).slice(0, 1));
  let ultimoEnvio: { n: number; m: number; sinAvisos: string[]; programado: string | null } | null = null;
  if (c.aviso_estado === "enviado" && c.aviso_base) {
    const [{ data: filas }, { data: subs }] = await Promise.all([
      supabase.from("avisos_registro").select("person_id, enviado_en, programado_para, resultado").like("clave", `convocatoria:${ctx.fecha}:${firmaConvocatoria(c.aviso_base)}:%`),
      supabase.from("suscripciones_avisos").select("person_id").eq("activa", true),
    ]);
    const con = new Set(((subs ?? []) as { person_id: string | null }[]).map((x) => x.person_id));
    const fs = (filas ?? []) as { person_id: string; enviado_en: string | null; programado_para: string; resultado: string | null }[];
    const sin = fs.filter((f) => !con.has(f.person_id)).map((f) => nombre(f.person_id)).sort((a, b) => a.localeCompare(b, "es"));
    const pend = fs.find((f) => !f.enviado_en);
    if (fs.length) ultimoEnvio = { n: fs.length - sin.length, m: fs.length, sinAvisos: sin, programado: pend ? pend.programado_para : null };
  }
  const web = "https://maccabis.vercel.app";
  const msgSinAvisos = ultimoEnvio?.sinAvisos.length ? `Hola, ${ultimoEnvio.sinAvisos.join(", ")}: estáis convocados y no tenéis activados los avisos de Maccabis en el móvil. Así os llega la convocatoria y si cambia la hora o la pista (nunca de noche). Es un minuto: ${web}/avisos` : "";
  const total = new Set(EQUIPOS.flatMap((e) => (c.equipos[e] ?? []).map((x) => x.person_id))).size;
  const Estado = ({ al, texto }: { al: boolean; texto?: string }) => <span className={`pastilla ${al ? "pastilla-ok" : "pastilla-pendiente"}`}>{texto ?? (al ? "Al día" : "Pendiente")}</span>;

  return (
    <>
      <div className="gs-titulo">
        <div>
          <div className="gs-eyebrow"><Link href={`/gestion/convocatoria?fecha=${ctx.fecha}`}>← Convocatoria</Link> · Salida</div>
          <h1>{ctx.jornada ? `J${ctx.jornada} aprobada` : "Aprobada"}</h1>
          <span className="suave">{diaTexto(ctx.fecha)} · {total} convocados · aprobada{c.aprobada_por_nombre ? ` por ${c.aprobada_por_nombre}` : ""} el {fechaHora(c.aprobada_en)}</span>
        </div>
      </div>

      <div className="cv-salidas">
        <section className="gs-bloque" aria-labelledby="t-wa" data-testid="cv-salida-whatsapp">
          <div className="cv-salida-cab"><h2 id="t-wa">1 · WhatsApp</h2><Estado al={c.whatsapp_estado === "al_dia"} /></div>
          {cambiosWa.length > 0 && <p className="pequeno" style={{ margin: 0 }}><b>Cambió tras aprobarla:</b> {cambiosWa.join("; ")}.</p>}
          <CopiarTexto texto={wa} etiqueta="Copiar mensaje" id="cv-mensaje" />
          {c.whatsapp_estado === "pendiente"
            ? <BotonMarcar fecha={ctx.fecha} que="whatsapp" texto="Ya lo he pegado en el grupo" />
            : <p className="pequeno suave" style={{ margin: 0 }}>Copiado el {fechaHora(c.whatsapp_en)}.</p>}
        </section>

        <section className="gs-bloque" aria-labelledby="t-aviso" data-testid="cv-salida-aviso">
          <div className="cv-salida-cab"><h2 id="t-aviso">2 · Aviso en la web</h2>
            <Estado al={avisoAlDia} texto={avisoAlDia ? "Enviado" : "Pendiente"} /></div>
          <p className="pequeno" style={{ margin: 0 }}>{porAvisar.cambio ? "A quien entra, cambia de equipo o sale" : "Cada convocado"} recibe en el móvil: <b>«{ejemplo.titulo}»</b> — {ejemplo.cuerpo}</p>
          {!avisoAlDia && <p className="pequeno" style={{ margin: 0 }} data-testid="cv-aviso-a">Al pulsar, a {porAvisar.personas.length} {porAvisar.personas.length === 1 ? "persona" : "personas"}: {porAvisar.personas.map((x) => nombre(x.person_id)).sort((a, b) => a.localeCompare(b, "es")).join(", ") || "nadie"}.</p>}
          {!avisoAlDia && <BotonAvisar fecha={ctx.fecha} />}
          {ultimoEnvio && (
            <div data-testid="cv-aviso-resultado">
              <p className="pequeno" style={{ margin: 0 }}><b>{avisoAlDia ? "Enviado" : "Último envío"}{c.aviso_en ? ` el ${fechaHora(c.aviso_en)}` : ""}: a {ultimoEnvio.n} de {ultimoEnvio.m}</b>{ultimoEnvio.m - ultimoEnvio.n ? ` (los otros ${ultimoEnvio.m - ultimoEnvio.n} no tienen avisos activados)` : ""}.{ultimoEnvio.programado ? ` Sale a las ${fechaHora(ultimoEnvio.programado)} (horas de silencio).` : ""}</p>
              {ultimoEnvio.sinAvisos.length > 0 && (
                <>
                  <p className="pequeno" style={{ margin: "6px 0 0" }} data-testid="cv-sin-avisos">Sin avisos: {ultimoEnvio.sinAvisos.join(", ")}. Lo ven en su inicio; mándales por WhatsApp el enlace a <Link href="/avisos">/avisos</Link> para que los activen:</p>
                  <CopiarTexto texto={msgSinAvisos} etiqueta="Copiar mensaje para ellos" />
                </>
              )}
            </div>
          )}
          <p className="pequeno suave" style={{ margin: 0 }}>No depende de «respuestas en la web»: avisar de la convocatoria no pide respuestas (D127). Respeta las horas de silencio (22:30–8:30) y nunca manda dos veces lo mismo. En su inicio y en la página del domingo, cada convocado ve con quién juega; nadie ve niveles.</p>
        </section>

        <section className="gs-bloque" aria-labelledby="t-se" data-testid="cv-salida-sporteasy">
          <div className="cv-salida-cab"><h2 id="t-se">3 · SportEasy</h2><Estado al={c.sporteasy_estado === "al_dia"} /></div>
          <p className="pequeno suave" style={{ margin: 0 }}>La copia la hace Claude en tu Chrome, con «Selección manual» y sin notificar (D104).</p>
          <CopiarTexto texto={se} etiqueta="Copiar para SportEasy" />
          {c.sporteasy_estado === "pendiente"
            ? <BotonMarcar fecha={ctx.fecha} que="sporteasy" texto="Marcar como copiado" />
            : <p className="pequeno suave" style={{ margin: 0 }}>Copiado el {fechaHora(c.sporteasy_en)}.</p>}
        </section>
      </div>
    </>
  );
}
