"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const CLAVE = "maccabis:banda-gestion-plegada";

/** «Gestión esta semana» (D116): arriba del todo del inicio de un gestor, con las tareas de «Pendiente esta semana» del
 *  Panel, cada una enlazada, y «Abrir gestión». Plegable: recuerda el estado en este navegador. */
export default function BandaGestion({ pendientes }: { pendientes: { texto: string; href: string }[] }) {
  const [plegada, setPlegada] = useState(false);
  useEffect(() => {
    try { setPlegada(localStorage.getItem(CLAVE) === "1"); } catch { /* sin almacenamiento: abierta */ }
  }, []);
  const cambiar = () => {
    const v = !plegada;
    setPlegada(v);
    try { localStorage.setItem(CLAVE, v ? "1" : "0"); } catch { /* no pasa nada */ }
  };
  return (
    <section className="in-gestion" aria-labelledby="t-gestion-semana" data-testid="banda-gestion">
      <div className="in-gestion-cab">
        <h2 id="t-gestion-semana"><span className="in-gestion-etq">Gestión</span> esta semana{pendientes.length ? <span className="in-gestion-n cifra"> · {pendientes.length}</span> : null}</h2>
        <button type="button" className="in-plegar" aria-expanded={!plegada} aria-controls="in-gestion-lista" onClick={cambiar}>{plegada ? "Mostrar" : "Ocultar"}</button>
      </div>
      <div id="in-gestion-lista" hidden={plegada}>
        {pendientes.length
          ? <ul className="in-gestion-lista">{pendientes.map((p) => <li key={p.texto}><Link href={p.href}>{p.texto}</Link></li>)}</ul>
          : <p className="suave" style={{ margin: "0 0 8px" }}>Nada pendiente esta semana.</p>}
        <Link href="/gestion" className="boton boton-contorno in-abrir-gestion">Abrir gestión</Link>
      </div>
    </section>
  );
}
