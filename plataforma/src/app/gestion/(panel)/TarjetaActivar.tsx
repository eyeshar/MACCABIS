"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import CopiarTexto from "./eventos/CopiarTexto";
import Numeros from "@/components/numeros/Numeros";
import type { ActivacionViva, EstadoActivacion } from "@/lib/gestion/activacion";
import ConfirmarEnPagina from "@/components/ConfirmarEnPagina";
import { cambiarInterruptor, marcarJornada, marcarSporteasy } from "./eventos/respuestas-acciones";

export type { EstadoActivacion };

const REFRESCO_MS = 60_000;

/** «Respuestas en la web: activar» (D99.13, D64): las cuatro condiciones, el boton y, al encender, los pasos en orden.
 *  Apagar vuelve a la fase puente sin perder nada. Cada cambio queda registrado en la base (quien y cuando). */
export default function TarjetaActivar({ inicial, jornadas, marcas, mensaje, cadaMs = REFRESCO_MS }: {
  inicial: ActivacionViva; jornadas: number[]; marcas: Record<number, "limpia" | "con_arreglo">; mensaje: string; cadaMs?: number;
}) {
  // En vivo (D156): contadores, listas y mensajes se vuelven a pedir cada minuto mientras la pestana esta visible y al volver
  // a ella. Es el mismo componente (no se recarga la pagina): lo que el gestor tenga desplegado en los contadores sigue abierto.
  const [viva, setViva] = useState(inicial);
  useEffect(() => setViva(inicial), [inicial]); // tras una accion de la tarjeta, router.refresh() trae datos nuevos de servidor
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
  const { estado, grupos, mensajeAvisos, mensajeEntrar, mensajePidieron, entrenadores } = viva;
  const actualizado = new Date(viva.calculadoEn).toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" });

  // Solo Iván maneja la tarjeta (D103); los demás gestores la ven en solo lectura. La base lo vuelve a comprobar.
  const solo = !estado.puede_manejar;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const hacer = (f: () => Promise<{ ok: boolean; error?: string }>) => empezar(async () => { setError(null); const r = await f(); if (!r.ok) setError(r.error ?? "No se pudo."); router.refresh(); });
  const c1 = estado.jornadas_seguidas >= 3, c2 = estado.entrados >= estado.minimo_entrados, c4 = estado.sporteasy_comprobado;
  const Marca = ({ ok }: { ok: boolean }) => <span className={ok ? "ev-cond-ok" : "ev-cond-no"} aria-label={ok ? "cumplida" : "sin cumplir"}>{ok ? "✓" : "○"}</span>;
  const siguiente = (e?: "limpia" | "con_arreglo") => (e === "limpia" ? "con_arreglo" : "limpia");

  // Encendido (D139): una franja compacta. Las condiciones, los pasos de activar y el mensaje de lanzamiento ya no hacen falta.
  if (estado.encendido) {
    const desde = estado.encendido_desde ?? estado.cambiado_en;
    const sinPedir = grupos.entrada.find((g) => g.k === "faltan");
    const pidieron = grupos.entrada.find((g) => g.k === "pidieron");
    const faltan = (sinPedir?.n ?? 0) + (pidieron?.n ?? 0);
    return (
      <section className="gs-bloque ev-activar ev-activar-compacta" aria-labelledby="t-activar" data-testid="tarjeta-activar">
        <div className="gs-bloque-cab">
          <h2 id="t-activar" style={{ fontSize: 20 }}>Respuestas en la web</h2>
          <span className="pastilla pastilla-ok" data-testid="estado-interruptor">Encendido</span>
        </div>
        <p style={{ margin: 0 }} data-testid="franja-encendido">
          Respuestas en la web: encendido{desde ? ` desde ${new Date(desde).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}{estado.cambiado_por ? ` (${estado.cambiado_por})` : ""}.
        </p>
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
        {error && <p className="aviso aviso-error" role="alert" style={{ margin: 0 }}>{error}</p>}
        <details className="ev-mas-opciones" data-testid="mas-opciones">
          <summary className="boton boton-claro" style={{ listStyle: "none", cursor: "pointer" }}>Más opciones</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {solo && <p className="aviso aviso-info" style={{ margin: 0 }} data-testid="solo-lectura">Solo lectura: el interruptor lo maneja Iván.</p>}
            <p className="pequeno suave" style={{ margin: 0 }}>SportEasy ya no tiene participantes en los eventos futuros: desactivar las respuestas en la web vuelve a la fase puente, pero <b>no los recupera</b>. Lo que se responda en SportEasy no contaría hasta que Claude los vuelva a invitar.</p>
            {solo ? <button type="button" className="boton boton-peligro" disabled>Desactivar</button> : (
              <ConfirmarEnPagina texto="Desactivar" testid="desactivar" pregunta="¿Desactivar las respuestas en la web? SportEasy ya no tiene participantes en los eventos y desactivar no los recupera." si="Sí, desactivar"
                accion={async () => { const r = await cambiarInterruptor(false); router.refresh(); return r; }} />
            )}
          </div>
        </details>
      </section>
    );
  }

  return (
    <section className="gs-bloque ev-activar" aria-labelledby="t-activar" data-testid="tarjeta-activar">
      <div className="gs-bloque-cab">
        <h2 id="t-activar" style={{ fontSize: 24 }}>Respuestas en la web: activar</h2>
        <span className={`pastilla ${estado.encendido ? "pastilla-ok" : "pastilla-pendiente"}`} data-testid="estado-interruptor">{estado.encendido ? "Encendido" : "Apagado · fase puente"}</span>
      </div>
      {estado.cambiado_en && <p className="pequeno suave" style={{ margin: 0 }}>Último cambio: {estado.cambiado_por ?? "—"}, {new Date(estado.cambiado_en).toLocaleString("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" })}.</p>}
      <ol className="ev-cond">
        <li><Marca ok={c1} /><div><b>{Math.min(estado.jornadas_seguidas, 3)}/3 jornadas seguidas sin arreglos a mano</b><div className="pequeno suave">Marca cada jornada al cerrarla: verde = limpia; rojo = con arreglo (la cuenta vuelve a 0).</div>
          <div className="ev-jornadas">{jornadas.map((j) => <button key={j} type="button" data-estado={marcas[j] ?? "sin"} disabled={pendiente || solo} aria-label={`J${j}: ${marcas[j] === "limpia" ? "limpia" : marcas[j] === "con_arreglo" ? "con arreglo" : "sin marcar"}`} onClick={() => hacer(() => marcarJornada(j, siguiente(marcas[j])))}>J{j}</button>)}</div></div></li>
        <li><Marca ok={c2} /><div><b>{estado.entrados}/{estado.plantilla} jugadores ya han entrado en la web</b> <span className="pequeno suave">(mínimo {estado.minimo_entrados})</span>
          <Numeros variante="linea" prueba="entrada-numeros" etiqueta="Jugadores que han entrado en la web" grupos={grupos.entrada} />
          {estado.faltan_por_entrar.length > 0 && (<div className="pequeno" data-testid="faltan-entrar" style={{ marginTop: 4 }}>
            {grupos.entrada.find((g) => g.k === "faltan")!.n > 0 && <CopiarTexto texto={mensajeEntrar} etiqueta="Copiar mensaje a quien no ha pedido acceso" />}
            {grupos.entrada.find((g) => g.k === "pidieron")!.n > 0 && <CopiarTexto texto={mensajePidieron} etiqueta="Copiar mensaje a quien no terminó" />}</div>)}</div></li>
        <li><span className="ev-cond-no" aria-hidden="true">i</span><div><b>{estado.con_avisos}/{estado.plantilla} con avisos activados</b> <span className="pequeno suave">(informativo, no bloquea)</span>
          <Numeros variante="linea" prueba="avisos-numeros" etiqueta="Jugadores con avisos activados" grupos={grupos.avisos} /></div></li>
        <li><Marca ok={c4} /><div><label style={{ display: "flex", gap: 10, alignItems: "center", minHeight: 44, cursor: "pointer" }}>
          <input type="checkbox" checked={c4} disabled={pendiente || solo} onChange={(e) => hacer(() => marcarSporteasy(e.target.checked))} style={{ width: 20, height: 20 }} />
          <b>SportEasy deja de pedir respuesta, comprobado por Claude</b></label></div></li>
      </ol>
      <div>
        <b>Al activar, en este orden:</b>
        <ol className="ev-pasos-activar">
          <li>Última Importar → Respuestas de los eventos futuros (Claude, desde SportEasy).</li>
          <li>Pulsar «Activar respuestas en la web».</li>
          <li>Mandar a la plantilla el mensaje de WhatsApp de abajo.</li>
          <li>Desde ese momento la web pide respuesta y salen los recordatorios (lunes 19:00, martes y miércoles 10:00).</li>
        </ol>
      </div>
      {solo && <p className="aviso aviso-info" style={{ margin: 0 }} data-testid="solo-lectura">Solo lectura: el interruptor, las jornadas y la casilla de SportEasy los maneja Iván.</p>}
      {error && <p className="aviso aviso-error" role="alert" style={{ margin: 0 }}>{error}</p>}
      {estado.encendido ? (
        <>
          <CopiarTexto texto={mensaje} etiqueta="Copiar mensaje para la plantilla" />
          <div className="botones" style={{ margin: 0 }}>
            <button type="button" className="boton boton-peligro" disabled={pendiente || solo} onClick={() => { if (window.confirm("¿Desactivar las respuestas en la web? Se vuelve a la fase puente (SportEasy) sin perder nada.")) hacer(() => cambiarInterruptor(false)); }}>Desactivar</button>
          </div>
        </>
      ) : (
        <div className="botones" style={{ margin: 0 }}>
          <button type="button" className="boton boton-amarillo" data-testid="boton-activar" disabled={pendiente || solo || !(c1 && c2 && c4)}
            onClick={() => { if (window.confirm("¿Hiciste ya la última Importar → Respuestas? Desde ahora la web pide respuesta y salen los recordatorios.")) hacer(() => cambiarInterruptor(true)); }}>
            Activar respuestas en la web
          </button>
          {!(c1 && c2 && c4) && <span className="pequeno suave" style={{ alignSelf: "center" }}>Se activa cuando se cumplan 1, 2 y 4.</span>}
        </div>
      )}
    </section>
  );
}
