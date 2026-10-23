import Link from "next/link";
import { exigirGestor } from "@/lib/sesion";
import { cargarContexto } from "@/lib/convocatoria/datos";
import { diferencias, EQUIPOS } from "@/lib/convocatoria/motor";
import { diaTexto, mensajeConvocatoria, textoEstasConvocado, textoSportEasy } from "@/lib/convocatoria/mensajes";
import CopiarTexto from "../../eventos/CopiarTexto";
import { BotonAvisar, BotonMarcar } from "./Botones";

export const metadata = { title: "Salida de la convocatoria · Gestión Maccabis" };

const fechaHora = (t: string | null) => (t ? new Date(t).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");

// Salida de una convocatoria aprobada (D107): (1) mensaje de WhatsApp listo para copiar (formato de D98), (2) aviso
// «Estás convocado» en la web (solo con el interruptor encendido; si no, en espera) y (3) copia a SportEasy, que hace
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
  const ejemplo = textoEstasConvocado(ctx.fecha, ctx.partidos, ctx.partidos.map((p) => p.equipo).slice(0, 1));
  const pendientesAviso = diferencias(c.aviso_base, c.equipos, nombre).filter((t) => t.startsWith("entra") || t.includes("dobla") || t.includes("pasa"));
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
            <Estado al={c.aviso_estado === "enviado" && !pendientesAviso.length} texto={c.aviso_estado === "enviado" && !pendientesAviso.length ? "Enviado" : "En espera"} /></div>
          <p className="pequeno" style={{ margin: 0 }}>Cada convocado recibe en el móvil: <b>«{ejemplo.titulo}»</b> — {ejemplo.cuerpo}</p>
          {ctx.encendido ? (
            c.aviso_estado === "enviado" && !pendientesAviso.length
              ? <p className="pequeno suave" style={{ margin: 0 }}>Enviado el {fechaHora(c.aviso_en)}.</p>
              : <BotonAvisar fecha={ctx.fecha} />
          ) : (
            <p className="pequeno suave" style={{ margin: 0 }}>En espera: el interruptor de «respuestas en la web» está apagado (fase puente). Saldrá cuando Iván lo encienda y pulse «Enviar ahora».</p>
          )}
          <p className="pequeno suave" style={{ margin: 0 }}>En Mi zona, cada convocado ve «Convocado» con su equipo, la hora y el encuentro. Nadie ve niveles ni la convocatoria de otros.</p>
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
