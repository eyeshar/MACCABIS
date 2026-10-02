"use client";

import { useActionState } from "react";
import { PRENDAS, type PrendaId } from "@/lib/ropa";
import { guardarCampana } from "../acciones";

type Campana = {
  id: string;
  nombre: string;
  estado: "abierta" | "cerrada";
  fecha_limite: string | null;
  precios: Partial<Record<PrendaId, number>>;
};

const ymd = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso)) : "";

export default function FormularioCampana({ campana }: { campana: Campana }) {
  const [aviso, accion, pendiente] = useActionState(guardarCampana.bind(null, campana.id), null);
  return (
    <form action={accion}>
      <div className="rejilla-2">
        <div className="campo">
          <label htmlFor="nombre-campana">Nombre</label>
          <input id="nombre-campana" name="nombre" type="text" defaultValue={campana.nombre} />
        </div>
        <div className="campo">
          <label htmlFor="estado-campana">Estado</label>
          <select id="estado-campana" name="estado" defaultValue={campana.estado}>
            <option value="abierta">Abierta</option>
            <option value="cerrada">Cerrada</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="fecha-campana">Fecha límite (incluida)</label>
          <input id="fecha-campana" name="fecha_limite" type="date" defaultValue={ymd(campana.fecha_limite)} />
          <p className="ayuda">Vacía = sin fecha: abierta hasta que la cierres.</p>
        </div>
      </div>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 600 }}>Precio orientativo por prenda (euros, se muestra como &quot;por confirmar&quot;)</legend>
        <div className="rejilla-2">
          {PRENDAS.map((p) => (
            <div className="campo" key={p.id} style={{ margin: "6px 0" }}>
              <label htmlFor={`precio-${p.id}`}>{p.nombre}</label>
              <input id={`precio-${p.id}`} name={`precio_${p.id}`} type="text" inputMode="decimal" defaultValue={campana.precios?.[p.id] ?? ""} />
            </div>
          ))}
        </div>
      </fieldset>
      <button className="boton" disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar campaña"}</button>
      {aviso && <p className="ayuda" role="status">{aviso}</p>}
    </form>
  );
}
