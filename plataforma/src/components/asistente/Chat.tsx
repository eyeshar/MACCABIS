"use client";
import { useEffect, useRef, useState } from "react";
import { guardarConversacion, leerConversacion, type Mensaje } from "./conversacion";
import "./asistente.css";

const WEB = "https://maccabis.vercel.app";

/** Texto del asistente con los enlaces pulsables. Los de la web van como ruta propia (valen tambien en la vista previa). */
function ConEnlaces({ texto }: { texto: string }) {
  const partes = texto.split(/(https?:\/\/[^\s)]+[^\s).,;:!?»"'])/g);
  return <>{partes.map((p, i) => {
    if (!/^https?:\/\//.test(p)) return <span key={i}>{p}</span>;
    if (p.startsWith(WEB)) return <a key={i} href={p.slice(WEB.length) || "/"}>{p.slice("https://".length)}</a>;
    return <a key={i} href={p} target="_blank" rel="noopener noreferrer">{p.includes("google.com/maps") ? "Abrir en Google Maps" : p}</a>;
  })}</>;
}

/** El chat (D142), en la pagina /asistente y en el panel del boton flotante. `activo`: el panel esta abierto (al abrirlo
 *  se relee la conversacion guardada y lo que queda de hoy). */
export default function Chat({ nombre, dueno, activo = true }: { nombre: string; dueno: string; activo?: boolean }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [quedan, setQuedan] = useState<number | null>(null);
  const [agotado, setAgotado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pensando, setPensando] = useState(false);
  const fin = useRef<HTMLDivElement>(null);
  const cargada = useRef(false);

  useEffect(() => {
    if (!activo) return;
    setMensajes(leerConversacion(dueno));
    cargada.current = true;
    fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accion: "cuota" }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && typeof d.quedan === "number") { setQuedan(d.quedan); if (d.quedan === 0) setAgotado(true); } })
      .catch(() => {});
  }, [activo, dueno]);
  useEffect(() => { if (cargada.current) guardarConversacion(dueno, mensajes); }, [dueno, mensajes]);
  useEffect(() => { fin.current?.scrollIntoView({ block: "nearest" }); }, [mensajes, pensando]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const pregunta = texto.trim();
    if (!pregunta || pensando || agotado) return;
    const nuevos: Mensaje[] = [...mensajes, { role: "user", content: pregunta }];
    setMensajes(nuevos);
    setTexto("");
    setError(null);
    setPensando(true);
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mensajes: nuevos.slice(-6) }) });
      const d = await r.json().catch(() => ({}));
      if (typeof d.quedan === "number") setQuedan(d.quedan);
      if (d.agotado) { setAgotado(true); setQuedan(0); }
      else if (r.ok && d.respuesta) setMensajes([...nuevos, { role: "assistant", content: d.respuesta }]);
      else setError(d.error ?? "No se pudo preguntar. Inténtalo otra vez.");
    } catch {
      setError("No se pudo preguntar. Mira tu conexión e inténtalo otra vez.");
    } finally {
      setPensando(false);
    }
  }

  return (
    <section className="as-chat" aria-label="Conversación con el asistente">
      <p className="as-cuota" data-testid="cuota" aria-live="polite">
        {agotado ? "El asistente descansa hasta mañana." : quedan == null ? " " : quedan === 1 ? "Te queda 1 pregunta hoy" : `Te quedan ${quedan} preguntas hoy`}
      </p>
      <div className="as-hilo" data-testid="hilo">
        {mensajes.length === 0 && (
          <div className="as-msg as-asistente">
            Hola, {nombre}. Pregúntame cómo se hace algo en la web o lo de tus próximos entrenos y partidos. Por ejemplo: «¿cómo activo los avisos en el iPhone?» o «¿a qué hora es mi próximo partido?».
          </div>
        )}
        {mensajes.map((m, i) => (
          <div key={i} className={`as-msg ${m.role === "user" ? "as-yo" : "as-asistente"}`} data-testid={m.role === "user" ? "msg-yo" : "msg-asistente"}>
            {m.role === "assistant" ? <ConEnlaces texto={m.content} /> : m.content}
          </div>
        ))}
        {pensando && <div className="as-msg as-asistente as-pensando" aria-live="polite">Pensando…</div>}
        {agotado && <div className="as-msg as-asistente as-descansa" data-testid="descansa">El asistente descansa hasta mañana. Mientras, lo tienes todo en la web y en la guía; si es urgente, escribe a Iván, Carlos o Edu.</div>}
        {error && <p className="aviso aviso-error" role="alert">{error}</p>}
        <div ref={fin} />
      </div>
      <form className="as-form" onSubmit={enviar}>
        <textarea
          aria-label="Tu pregunta" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={800} rows={2}
          placeholder={agotado ? "Vuelve mañana" : "Escribe tu pregunta"} disabled={agotado}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
        />
        <button type="submit" className="boton" disabled={agotado || pensando || !texto.trim()}>Preguntar</button>
      </form>
      <p className="as-nota">Solo responde sobre la web y tus datos; no cambia nada por ti. No guardamos la conversación.</p>
    </section>
  );
}
