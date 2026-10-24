"use client";

import { useEffect, useId, useRef, useState } from "react";
import { enlaceGoogle, esEnlaceGoogle, leerEnlaceGoogle, type Lugar } from "@/lib/ubicacion";

// Campo «Dónde» (D118): escribes y salen sugerencias de OpenStreetMap (las pide el servidor, /api/lugares); tambien se
// puede pegar un enlace de Google Maps (si trae coordenadas se leen; un enlace corto se guarda tal cual) o usar lo
// escrito como nombre. Elegido el sitio: nombre, direccion, «Ver en Google Maps» y «Cambiar sitio». Los valores viajan
// en campos ocultos del formulario (ubicacion_nombre, ubicacion_direccion, ubicacion_lat, ubicacion_lng, ubicacion_enlace).
export default function BuscadorLugar({ inicial, etiqueta = "Dónde", ayuda, onCambio }: {
  inicial?: Lugar | null; etiqueta?: string; ayuda?: string; onCambio?: (l: Lugar | null) => void;
}) {
  const id = useId();
  const [lugar, setLugar] = useState<Lugar | null>(inicial ?? null);
  const [texto, setTexto] = useState("");
  const [opciones, setOpciones] = useState<Lugar[]>([]);
  const [activa, setActiva] = useState(-1);
  const [estado, setEstado] = useState<"" | "buscando" | "nada" | "error">("");
  const [abierta, setAbierta] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const pedido = useRef(0);

  const elegir = (l: Lugar | null) => {
    setLugar(l); onCambio?.(l); setOpciones([]); setAbierta(false); setActiva(-1); setTexto("");
    if (!l) setTimeout(() => campo.current?.focus(), 0);
  };

  useEffect(() => {
    const t = texto.trim();
    if (lugar || t.length < 3 || esEnlaceGoogle(t)) { setOpciones([]); setEstado(""); return; }
    const n = ++pedido.current;
    setEstado("buscando");
    const h = setTimeout(async () => {
      try {
        const r = await fetch(`/api/lugares?q=${encodeURIComponent(t)}`);
        const j = (await r.json()) as { lugares?: Lugar[]; error?: string };
        if (n !== pedido.current) return;
        setOpciones(j.lugares ?? []); setActiva(-1); setAbierta(true);
        setEstado(j.error ? "error" : (j.lugares ?? []).length ? "" : "nada");
      } catch { if (n === pedido.current) { setOpciones([]); setEstado("error"); setAbierta(true); } }
    }, 450);
    return () => clearTimeout(h);
  }, [texto, lugar]);

  const alEscribir = (v: string) => {
    setTexto(v);
    const g = leerEnlaceGoogle(v);
    if (g) elegir(g);
  };
  const libre: Lugar | null = texto.trim().length >= 2 && !esEnlaceGoogle(texto) ? { nombre: texto.trim().slice(0, 120), direccion: null, lat: null, lng: null, enlace: null } : null;
  const todas = [...opciones, ...(libre ? [libre] : [])];
  const teclas = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && todas.length) { e.preventDefault(); setAbierta(true); setActiva((a) => (a + 1) % todas.length); }
    else if (e.key === "ArrowUp" && todas.length) { e.preventDefault(); setActiva((a) => (a <= 0 ? todas.length - 1 : a - 1)); }
    else if (e.key === "Enter" && abierta && activa >= 0) { e.preventDefault(); elegir(todas[activa]); }
    else if (e.key === "Escape") { setAbierta(false); setActiva(-1); }
  };
  const mapa = enlaceGoogle(lugar);

  return (
    <div className="lg" data-testid="buscador-lugar">
      <input type="hidden" name="ubicacion_nombre" value={lugar?.nombre ?? ""} />
      <input type="hidden" name="ubicacion_direccion" value={lugar?.direccion ?? ""} />
      <input type="hidden" name="ubicacion_lat" value={lugar?.lat ?? ""} />
      <input type="hidden" name="ubicacion_lng" value={lugar?.lng ?? ""} />
      <input type="hidden" name="ubicacion_enlace" value={lugar?.enlace ?? ""} />
      {lugar ? (
        <div className="lg-elegido" data-testid="lugar-elegido">
          <span className="lg-etq">{etiqueta}</span>
          <strong>{lugar.nombre}</strong>
          {lugar.direccion && <span className="suave">{lugar.direccion}</span>}
          {!lugar.direccion && lugar.enlace && <span className="suave pequeno">Enlace de Google Maps guardado tal cual</span>}
          <div className="lg-botones">
            {mapa && <a className="boton boton-claro" href={mapa} target="_blank" rel="noopener noreferrer">Ver en Google Maps</a>}
            <button type="button" className="boton boton-claro" onClick={() => elegir(null)}>Cambiar sitio</button>
          </div>
        </div>
      ) : (
        <div className="lg-buscar">
          <label htmlFor={`${id}-q`}>{etiqueta}</label>
          <input
            ref={campo} id={`${id}-q`} type="text" role="combobox" aria-expanded={abierta && todas.length > 0} aria-controls={`${id}-lista`}
            aria-autocomplete="list" aria-activedescendant={activa >= 0 ? `${id}-o${activa}` : undefined} autoComplete="off"
            placeholder="Busca un sitio o pega un enlace de Google Maps" value={texto} onChange={(e) => alEscribir(e.target.value)}
            onKeyDown={teclas} onFocus={() => setAbierta(true)} onBlur={() => setTimeout(() => setAbierta(false), 150)} maxLength={500}
          />
          {ayuda && <div className="ayuda">{ayuda}</div>}
          {estado === "buscando" && <div className="ayuda" aria-live="polite">Buscando…</div>}
          {abierta && todas.length > 0 && (
            <ul id={`${id}-lista`} role="listbox" className="lg-lista" aria-label="Sugerencias">
              {opciones.map((o, i) => (
                <li key={`${o.lat},${o.lng},${i}`} id={`${id}-o${i}`} role="option" aria-selected={activa === i} className="lg-opcion"
                  onMouseDown={(e) => { e.preventDefault(); elegir(o); }}>
                  <strong>{o.nombre}</strong>{o.direccion && <>{" "}<span>{o.direccion}</span></>}
                </li>
              ))}
              {libre && (
                <li id={`${id}-o${opciones.length}`} role="option" aria-selected={activa === opciones.length} className="lg-opcion lg-libre"
                  onMouseDown={(e) => { e.preventDefault(); elegir(libre); }}>
                  <strong>Usar «{libre.nombre}»</strong>{" "}<span>tal cual, sin mapa</span>
                </li>
              )}
            </ul>
          )}
          {abierta && estado === "nada" && <div className="ayuda">Sin sugerencias en el mapa: puedes usar lo que has escrito o pegar un enlace de Google Maps.</div>}
          {abierta && estado === "error" && <div className="ayuda">El buscador no responde ahora: usa lo que has escrito o pega un enlace de Google Maps.</div>}
        </div>
      )}
    </div>
  );
}
