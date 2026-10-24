"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import BuscadorLugar from "@/components/lugar/BuscadorLugar";
import type { Lugar } from "@/lib/ubicacion";
import { crearPlan, editarPlan } from "./acciones";

type Tipo = "quedada" | "pachanga" | "amistoso" | "otro";
const TIPOS: { id: Tipo; texto: string; detalle: string }[] = [
  { id: "quedada", texto: "Quedada", detalle: "tomar algo, comida, cena" },
  { id: "pachanga", texto: "Pachanga", detalle: "partido entre nosotros" },
  { id: "amistoso", texto: "Amistoso", detalle: "contra otro equipo" },
  { id: "otro", texto: "Otro plan", detalle: "lo que sea" },
];

export type PlanInicial = {
  id: string; tipo: Tipo; titulo: string; fecha: string; inicio: string | null; quedada: string | null; equipo: "ambos" | "MdA" | "MdL";
  plazas: number | null; notas: string | null; recordar: boolean; rival_texto: string | null; lugar: Lugar | null;
};

/** «Proponer un plan» (D118, lienzo «Inicio personal»): tipo en cuatro botones, título, día, quedada, empieza, dónde
 *  (buscador, D119), contra quién (solo amistoso), para quién, plazas, algo más y «Recordar un día antes». Se publica al
 *  momento como plan no oficial. El mismo formulario edita un plan. */
export default function FormularioPlan({ plan, hoy, volver }: { plan?: PlanInicial; hoy: string; volver: string }) {
  const [estado, accion, enviando] = useActionState(plan ? editarPlan.bind(null, plan.id) : crearPlan, null);
  const [tipo, setTipo] = useState<Tipo | null>(plan?.tipo ?? null);
  const [equipo, setEquipo] = useState(plan?.equipo ?? "ambos");
  return (
    <form action={accion} className="pl-form" data-testid="formulario-plan">
      {estado?.error && <div className="aviso aviso-error" role="alert">{estado.error}</div>}
      <fieldset className="pl-tipos">
        <legend>¿Qué plan es?</legend>
        <div className="pl-tipos-fila">
          {TIPOS.map((t) => (
            <label key={t.id} className={`pl-tipo${tipo === t.id ? " elegido" : ""}`}>
              <input type="radio" name="tipo" value={t.id} checked={tipo === t.id} onChange={() => setTipo(t.id)} required />
              <b>{t.texto}</b><span>{t.detalle}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="campo"><label htmlFor="pl-titulo">Título</label>
        <input id="pl-titulo" name="titulo" type="text" required minLength={3} maxLength={80} defaultValue={plan?.titulo ?? ""} placeholder={tipo === "pachanga" ? "Pachanga del sábado" : tipo === "amistoso" ? "Amistoso con los del barrio" : "Cañas después del entreno"} />
      </div>
      <div className="pl-tres">
        <div className="campo"><label htmlFor="pl-fecha">Día</label><input id="pl-fecha" name="fecha" type="date" required min={hoy} defaultValue={plan?.fecha ?? ""} /></div>
        <div className="campo"><label htmlFor="pl-quedada">Quedada</label><input id="pl-quedada" name="quedada" type="time" defaultValue={plan?.quedada ?? ""} /><div className="ayuda">Vacía: 20 min antes.</div></div>
        <div className="campo"><label htmlFor="pl-inicio">Empieza</label><input id="pl-inicio" name="inicio" type="time" required defaultValue={plan?.inicio ?? ""} /></div>
      </div>

      <div className="campo"><BuscadorLugar inicial={plan?.lugar ?? null} ayuda="Escribe el sitio (bar, pista, calle…) o pega un enlace de Google Maps." /></div>

      {tipo === "amistoso" && (
        <div className="campo"><label htmlFor="pl-rival">Contra quién</label>
          <input id="pl-rival" name="rival_texto" type="text" maxLength={80} defaultValue={plan?.rival_texto ?? ""} placeholder="Los del barrio" />
          <div className="ayuda">Un amistoso entre amigos no es un partido del club: no cuenta para la convocatoria ni para las estadísticas. Si debe ser oficial, un gestor puede hacerlo oficial.</div>
        </div>
      )}

      <fieldset className="pl-para">
        <legend>Para quién</legend>
        <div className="ev-radios" role="radiogroup" aria-label="Para quién">
          <label><input type="radio" name="equipo" value="ambos" checked={equipo === "ambos"} onChange={() => setEquipo("ambos")} />Toda la plantilla</label>
          <label><input type="radio" name="equipo" value="MdA" checked={equipo === "MdA"} onChange={() => setEquipo("MdA")} />Solo MdA</label>
          <label><input type="radio" name="equipo" value="MdL" checked={equipo === "MdL"} onChange={() => setEquipo("MdL")} />Solo MdL</label>
        </div>
      </fieldset>

      <div className="pl-tres">
        <div className="campo"><label htmlFor="pl-plazas">Plazas <span className="suave">(opcional)</span></label><input id="pl-plazas" name="plazas" type="number" min={2} max={60} inputMode="numeric" defaultValue={plan?.plazas ?? ""} /><div className="ayuda">Al llenarse, «Voy» pasa a «Completo».</div></div>
      </div>
      <div className="campo"><label htmlFor="pl-notas">Algo más</label><textarea id="pl-notas" name="notas" rows={3} maxLength={300} defaultValue={plan?.notas ?? ""} placeholder="Trae la camiseta blanca, reservamos mesa a nombre de Jon…" /></div>
      <label className="pl-recordar"><input type="checkbox" name="recordar" defaultChecked={plan?.recordar ?? false} /> Recordar a los invitados un día antes <span className="suave">(un aviso a quien no haya respondido; nunca de noche)</span></label>

      <p className="pl-nota" role="note">Se publica al momento como <b>plan no oficial</b>: lo ven solo los de la plantilla a los que invitas, no sale en la web pública y no cuenta para la asistencia, la convocatoria ni las estadísticas. Se responde aquí, en la web.</p>
      <div className="botones" style={{ justifyContent: "flex-end" }}>
        <Link className="boton boton-claro" href={volver}>Volver</Link>
        <button className="boton boton-amarillo" type="submit" disabled={enviando}>{enviando ? "Guardando…" : plan ? "Guardar cambios" : "Publicar plan"}</button>
      </div>
    </form>
  );
}
