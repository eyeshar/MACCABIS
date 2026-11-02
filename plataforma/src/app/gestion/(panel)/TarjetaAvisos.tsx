"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CopiarTexto from "./eventos/CopiarTexto";
import Numeros from "@/components/numeros/Numeros";
import type { ActivacionViva, EstadoActivacion } from "@/lib/gestion/activacion";

export type { EstadoActivacion };

const REFRESCO_MS = 60_000;

/** «Avisos y accesos» del Panel (D156, D157): quién tiene los avisos activados y quién falta por entrar en la web, con los
 *  mensajes para copiar. Las respuestas en la web están siempre encendidas (D172): ya no hay interruptor ni condiciones. */
export default function TarjetaAvisos({ inicial, cadaMs = REFRESCO_MS }: { inicial: ActivacionViva; cadaMs?: number }) {
  // En vivo (D156): contadores, listas y mensajes se vuelven a pedir cada minuto mientras la pestana esta visible y al volver
  // a ella. Es el mismo componente (no se recarga la pagina): lo que el gestor tenga desplegado en los contadores sigue abierto.
  const [viva, setViva] = useState(inicial);
  useEffect(() => setViva(inicial), [inicial]);
  const enVuelo = useRef(false);
  const refrescar = useCallback(async () => {
    if (enVuelo.current) return;
    enVuelo.current = true;
    try {
      const r = await fetch("/api/gestion/activacion", { cache: "no-store" });
      if (r.ok) setViva((await r.json()) as ActivacionViva);
    } catch { /* sin red: se queda lo que habia y se reintenta en el siguiente turno */ } finally { enVuelo.current = false; }
  }, []);
  useEffect(() => {
    let reloj: ReturnType<typeof setInterval> | undefined;
    const parar = () => { if (reloj) clearInterval(reloj); reloj = undefined; };
    const volver = () => {
      parar();
      if (document.visibilityState !== "visible") return; // oculta: en pausa
      void refrescar();
      reloj = setInterval(() => void refrescar(), cadaMs);
    };
    if (document.visibilityState === "visible") reloj = setInterval(() => void refrescar(), cadaMs);
    document.addEventListener("visibilitychange", volver);
    window.addEventListener("focus", volver);
    return () => { parar(); document.removeEventListener("visibilitychange", volver); window.removeEventListener("focus", volver); };
  }, [refrescar, cadaMs]);
  const { grupos, mensajeAvisos, mensajeEntrar, mensajePidieron, entrenadores } = viva;
  const actualizado = new Date(viva.calculadoEn).toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" });
  const sinPedir = grupos.entrada.find((g) => g.k === "faltan");
  const pidieron = grupos.entrada.find((g) => g.k === "pidieron");
  const faltan = (sinPedir?.n ?? 0) + (pidieron?.n ?? 0);

  return (
    <section className="gs-bloque ev-activar" aria-labelledby="t-avisos-accesos" data-testid="tarjeta-avisos">
      <div className="gs-bloque-cab">
        <h2 id="t-avisos-accesos" style={{ fontSize: 20 }}>Avisos y accesos</h2>
      </div>
      <div data-testid="franja-avisos">
        <b data-testid="con-avisos-cabecera">Con avisos: {grupos.avisos.reduce((t, g) => t + (g.k === "con" ? g.n : 0), 0)}/{grupos.avisos.reduce((t, g) => t + g.n, 0)} jugadores</b>
        {entrenadores.total > 0 && <span className="pequeno suave" data-testid="nota-entrenador"> · {entrenadores.conAvisos === entrenadores.total ? (entrenadores.total === 1 ? "el entrenador también los tiene" : "los entrenadores también los tienen") : `sin contar ${entrenadores.total === 1 ? "al entrenador" : "a los entrenadores"}`}</span>}
        <Numeros variante="linea" prueba="avisos-numeros" etiqueta="Jugadores con avisos activados" grupos={grupos.avisos} />
        {grupos.avisos.find((g) => g.k === "sin")!.n > 0 && <div style={{ marginTop: 6 }}><CopiarTexto texto={mensajeAvisos} etiqueta="Copiar mensaje" /></div>}
      </div>
      {faltan > 0 && (
        <div data-testid="faltan-entrar">
          <b>Faltan por entrar: {faltan}</b>
          <Numeros variante="linea" prueba="entrada-numeros" etiqueta="Jugadores que faltan por entrar en la web" grupos={[sinPedir!, pidieron!]} />
          {sinPedir!.n > 0 && <div style={{ marginTop: 6 }}><CopiarTexto texto={mensajeEntrar} etiqueta="Copiar mensaje a quien no ha pedido acceso" /></div>}
          {pidieron!.n > 0 && <div style={{ marginTop: 6 }}><CopiarTexto texto={mensajePidieron} etiqueta="Copiar mensaje a quien no terminó" /></div>}
        </div>
      )}
      <span className="pequeno suave" data-testid="actualizado" aria-live="off">Actualizado {actualizado}</span>
    </section>
  );
}
