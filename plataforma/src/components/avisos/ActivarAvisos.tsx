"use client";

import { useEffect, useState, useTransition } from "react";
import { altaSuscripcion, bajaSuscripcion, mandarAvisoPrueba } from "@/app/mi-zona/respuestas-acciones";
import { casoActual, datosDispositivo, suscribir, suscripcionActual, type Caso } from "./dispositivo";

const CLAVE = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function Paso({ n, children, icono }: { n: number; children: React.ReactNode; icono: React.ReactNode }) {
  return (
    <li className="av-paso">
      <span className="av-num" aria-hidden="true">{n}</span>
      <span className="av-icono" aria-hidden="true">{icono}</span>
      <span>{children}</span>
    </li>
  );
}
const IcoCompartir = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>;
const IcoMas = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 8v8M8 12h8" /></svg>;
const IcoEscudo = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z" /></svg>;

// /avisos (D99, 3.1): detecta el caso y muestra uno de tres estados. Funciona con el interruptor apagado (D99.12).
export default function ActivarAvisos() {
  const [caso, setCaso] = useState<Caso | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, empezar] = useTransition();

  useEffect(() => {
    (async () => {
      const c = await casoActual();
      setCaso(c);
      // Si este movil ya estaba suscrito, se vuelve a apuntar a esta cuenta (por si otra persona entro en el).
      if (c === "activados") {
        const s = await suscripcionActual();
        const j = s?.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } } | undefined;
        if (j?.endpoint && j.keys) await altaSuscripcion({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, navegador: datosDispositivo().navegador });
      }
    })();
  }, []);

  const activar = () => empezar(async () => {
    setMsg(null);
    if (!CLAVE) { setMsg({ ok: false, texto: "Los avisos aún no están configurados en el servidor." }); return; }
    try {
      const r = await suscribir(CLAVE);
      if (!r.ok) { setCaso(r.permiso === "denied" ? "denegados" : "puede"); setMsg({ ok: false, texto: "No has dado permiso para los avisos." }); return; }
      const g = await altaSuscripcion({ endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth, navegador: datosDispositivo().navegador });
      if (!g.ok) { setMsg({ ok: false, texto: g.error }); return; }
      setCaso("activados");
      setMsg({ ok: true, texto: "Listo: los avisos están activados en este móvil." });
    } catch {
      setMsg({ ok: false, texto: "Este navegador no ha dejado activar los avisos. Prueba otra vez o mira «Si dijiste No permitir»." });
    }
  });
  const prueba = () => empezar(async () => {
    setMsg(null);
    const r = await mandarAvisoPrueba();
    setMsg(r.ok ? { ok: true, texto: r.aviso ?? "Enviado." } : { ok: false, texto: r.error });
  });
  const desactivar = () => empezar(async () => {
    const s = await suscripcionActual();
    if (s) { await bajaSuscripcion(s.endpoint); await s.unsubscribe().catch(() => {}); }
    setCaso("puede"); setMsg({ ok: true, texto: "Avisos desactivados en este móvil." });
  });

  return (
    <div className="av" data-caso={caso ?? "cargando"}>
      {caso === null && <p className="suave">Comprobando este móvil…</p>}
      {caso === "iphone-safari" && (
        <section className="tarjeta av-caso" aria-labelledby="av-t1">
          <h2 id="av-t1">En iPhone, primero instálala</h2>
          <p className="suave">Apple solo deja recibir avisos desde la web añadida a la pantalla de inicio.</p>
          <ol className="av-pasos">
            <Paso n={1} icono={<IcoCompartir />}>Toca <strong>Compartir</strong> (el cuadrado con la flecha, abajo).</Paso>
            <Paso n={2} icono={<IcoMas />}>Elige <strong>«Añadir a pantalla de inicio»</strong> y luego «Añadir».</Paso>
            <Paso n={3} icono={<IcoEscudo />}>Abre <strong>Maccabis desde el icono</strong> y entra con tu correo (te llega un código). Vuelve aquí y activa los avisos.</Paso>
          </ol>
        </section>
      )}
      {caso === "iphone-otro" && (
        <section className="tarjeta av-caso" aria-labelledby="av-t2">
          <h2 id="av-t2">Abre esta página en Safari</h2>
          <p>En iPhone los avisos solo funcionan con Safari: copia esta dirección y ábrela en Safari, y sigue los pasos que verás.</p>
          <p className="mono av-url">maccabis.vercel.app/avisos</p>
        </section>
      )}
      {(caso === "puede" || caso === "denegados") && (
        <section className="tarjeta av-caso" aria-labelledby="av-t3">
          <h2 id="av-t3">Activa los avisos en este móvil</h2>
          <p className="suave">El móvil te preguntará si permites los avisos de Maccabis: di <strong>Permitir</strong>.</p>
          <button type="button" className="boton boton-amarillo boton-bloque av-activar" onClick={activar} disabled={pendiente || caso === "denegados"}>
            {pendiente ? "Activando…" : "Activar avisos en este móvil"}
          </button>
          {caso === "denegados" && <p className="aviso aviso-error" style={{ marginTop: 12, marginBottom: 0 }}>Este móvil tiene los avisos de Maccabis bloqueados. Mira abajo «Si dijiste No permitir».</p>}
        </section>
      )}
      {caso === "activados" && (
        <section className="tarjeta av-caso av-ok" aria-labelledby="av-t4">
          <h2 id="av-t4"><span aria-hidden="true">✓</span> Avisos activados en este móvil</h2>
          <p className="suave">Te llegarán aquí. Si cambias de móvil, vuelve a activarlos en el nuevo.</p>
          <div className="botones">
            <button type="button" className="boton boton-amarillo" onClick={prueba} disabled={pendiente}>{pendiente ? "Enviando…" : "Mandarme un aviso de prueba"}</button>
            <button type="button" className="boton boton-claro" onClick={desactivar} disabled={pendiente}>Desactivar en este móvil</button>
          </div>
        </section>
      )}
      {caso === "no-soportado" && (
        <section className="tarjeta av-caso" aria-labelledby="av-t5">
          <h2 id="av-t5">Este navegador no recibe avisos</h2>
          <p>Abre Maccabis en el móvil: en Android con Chrome; en iPhone con Safari, añadida a la pantalla de inicio.</p>
        </section>
      )}
      {msg && <p className={`aviso ${msg.ok ? "aviso-ok" : "aviso-error"}`} role="status">{msg.texto}</p>}
    </div>
  );
}
