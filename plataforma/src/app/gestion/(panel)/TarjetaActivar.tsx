"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import CopiarTexto from "./eventos/CopiarTexto";
import { cambiarInterruptor, marcarJornada, marcarSporteasy } from "./eventos/respuestas-acciones";

export type EstadoActivacion = {
  encendido: boolean; encendido_desde: string | null; sporteasy_comprobado: boolean; cambiado_en: string | null; cambiado_por: string | null;
  jornadas_seguidas: number; plantilla: number; entrados: number; con_avisos: number; se_puede_encender: boolean;
  minimo_entrados: number; faltan_por_entrar: string[]; puede_manejar: boolean;
};

/** «Respuestas en la web: activar» (D99.13, D64): las cuatro condiciones, el boton y, al encender, los pasos en orden.
 *  Apagar vuelve a la fase puente sin perder nada. Cada cambio queda registrado en la base (quien y cuando). */
export default function TarjetaActivar({ estado, jornadas, marcas, mensaje, mensajeEntrar }: {
  estado: EstadoActivacion; jornadas: number[]; marcas: Record<number, "limpia" | "con_arreglo">; mensaje: string; mensajeEntrar: string;
}) {
  // Solo Iván maneja la tarjeta (D103); los demás gestores la ven en solo lectura. La base lo vuelve a comprobar.
  const solo = !estado.puede_manejar;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const hacer = (f: () => Promise<{ ok: boolean; error?: string }>) => empezar(async () => { setError(null); const r = await f(); if (!r.ok) setError(r.error ?? "No se pudo."); router.refresh(); });
  const c1 = estado.jornadas_seguidas >= 3, c2 = estado.entrados >= estado.minimo_entrados, c4 = estado.sporteasy_comprobado;
  const Marca = ({ ok }: { ok: boolean }) => <span className={ok ? "ev-cond-ok" : "ev-cond-no"} aria-label={ok ? "cumplida" : "sin cumplir"}>{ok ? "✓" : "○"}</span>;
  const siguiente = (e?: "limpia" | "con_arreglo") => (e === "limpia" ? "con_arreglo" : "limpia");

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
          {estado.faltan_por_entrar.length > 0 && (<div className="pequeno" data-testid="faltan-entrar" style={{ marginTop: 4 }}>Faltan: {estado.faltan_por_entrar.join(", ")}.<div style={{ marginTop: 6 }}><CopiarTexto texto={mensajeEntrar} etiqueta="Copiar mensaje para quien falta" /></div></div>)}</div></li>
        <li><span className="ev-cond-no" aria-hidden="true">i</span><div><b>{estado.con_avisos}/{estado.plantilla} con avisos activados</b> <span className="pequeno suave">(informativo, no bloquea)</span></div></li>
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
