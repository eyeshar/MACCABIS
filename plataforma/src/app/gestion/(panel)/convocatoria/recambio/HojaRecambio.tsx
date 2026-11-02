"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Candidato, Equipo } from "@/lib/convocatoria/motor";
import CopiarTexto from "../../eventos/CopiarTexto";
import { aplicarRecambio } from "../acciones";

const TIPO = { libre: "Sin convocar", reserva: "Reserva", dobla: "Doblaría" } as const;

/** Elegir el recambio (preseleccionado el del motor) o ninguno, y «Aplicar y avisar» (D173). Móvil primero (375 px). */
export default function HojaRecambio({ fecha, sale, equipo, sugerido, porque, bajoMinimo, candidatos, yaHecho = false }: {
  fecha: string; sale: string; equipo: Equipo; sugerido: string | null; porque: string; bajoMinimo: boolean; yaHecho?: boolean;
  candidatos: (Candidato & { nombre: string })[];
}) {
  const [elegido, setElegido] = useState<string>(sugerido ?? "");
  const [pend, iniciar] = useTransition();
  const [res, setRes] = useState<{ ok: boolean; texto: string; whatsapp?: string } | null>(null);
  if (res?.ok) {
    return (
      <section className="gs-bloque" data-testid="rc-hecho" aria-label="Recambio aplicado">
        <p className="aviso aviso-ok" role="status" style={{ margin: 0 }}>{res.texto}</p>
        {res.whatsapp && <><h2 style={{ fontSize: 20 }}>WhatsApp del cambio</h2><CopiarTexto texto={res.whatsapp} etiqueta="Copiar mensaje" id="rc-whatsapp" /></>}
        <Link className="boton boton-contorno" href={`/gestion/convocatoria?fecha=${fecha}`}>Volver a la convocatoria</Link>
      </section>
    );
  }
  if (yaHecho) return <p className="suave" data-testid="rc-nada">Ese jugador ya no está en ese equipo: el cambio ya está hecho.</p>;
  return (
    <section className="gs-bloque" aria-labelledby="t-rc" data-testid="rc-hoja">
      <h2 id="t-rc" style={{ fontSize: 20 }}>¿Quién entra en el {equipo}?</h2>
      <p className="pequeno" style={{ margin: 0 }} data-testid="rc-porque"><b>Propuesta del motor:</b> {sugerido ? candidatos.find((c) => c.person_id === sugerido)?.nombre : "ninguno"}. {porque}{bajoMinimo ? " Sin él, el equipo queda por debajo de un mínimo." : ""}</p>
      <fieldset className="cv-opciones">
        <legend>Elige</legend>
        <div className="ev-radios cv-radios-columna" role="radiogroup">
          {candidatos.map((c) => (
            <label key={c.person_id} data-person={c.person_id} aria-disabled={!c.valido} style={!c.valido ? { opacity: 0.55 } : undefined}>
              <input type="radio" name="entra" value={c.person_id} checked={elegido === c.person_id} disabled={!c.valido} onChange={() => setElegido(c.person_id)} />
              <span><b>{c.nombre}</b>{c.person_id === sugerido && <span className="cv-etq cv-etq-dobla" style={{ marginLeft: 6 }}>propuesta</span>}<br /><small>{TIPO[c.tipo]} · {c.nota}</small></span>
            </label>
          ))}
          <label data-person="">
            <input type="radio" name="entra" value="" checked={elegido === ""} onChange={() => setElegido("")} />
            <span><b>Ninguno</b><br /><small>Solo sale; el equipo se queda con uno menos.</small></span>
          </label>
        </div>
      </fieldset>
      {!candidatos.length && <p className="pequeno suave" style={{ margin: 0 }}>Nadie más ha dicho «voy» a este partido.</p>}
      {res && !res.ok && <p className="aviso aviso-error" role="alert">{res.texto}</p>}
      <button type="button" className="boton boton-amarillo boton-bloque" disabled={pend} data-testid="rc-aplicar"
        onClick={() => iniciar(async () => { const r = await aplicarRecambio(fecha, sale, equipo, elegido || null); setRes(r.ok ? { ok: true, texto: r.texto ?? "Hecho.", whatsapp: r.whatsapp } : { ok: false, texto: r.error }); })}>
        {pend ? "Aplicando…" : "Aplicar y avisar"}
      </button>
      <p className="pequeno suave" style={{ margin: 0 }}>Se avisa a quien entra y a quien sale (nunca de 22:30 a 08:00). El mensaje no lleva niveles.</p>
    </section>
  );
}
