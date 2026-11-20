"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { alinear, apostar, clausulazo, crearEquipo, fichar, vender, type R } from "./acciones";

// MdFantasy (D196): las piezas con estado del navegador. La base decide; aqui solo se pulsa y se enseña el resultado.

function useAccion() {
  const [pendiente, empezar] = useTransition();
  const [r, setR] = useState<R | null>(null);
  const router = useRouter();
  const lanzar = (f: () => Promise<R>, despues?: (r: R) => void) => empezar(async () => {
    const res = await f();
    setR(res);
    despues?.(res);
    if (res.ok) router.refresh();
  });
  const mensaje = r && (r.ok ? (r.aviso ? <p className="aviso aviso-ok fz-msj" role="status" data-testid="fz-ok">{r.aviso}</p> : null) : <p className="aviso aviso-error fz-msj" role="alert" data-testid="fz-error">{r.error}</p>);
  return { pendiente, lanzar, mensaje, limpiar: () => setR(null) };
}

export function CrearEquipo() {
  const a = useAccion();
  return (
    <div className="fz-accion">
      <button type="button" className="boton boton-amarillo boton-bloque" disabled={a.pendiente} onClick={() => a.lanzar(crearEquipo)} data-testid="fz-crear">{a.pendiente ? "Creando…" : "Crear mi equipo"}</button>
      {a.mensaje}
    </div>
  );
}

/** Fichar o vender: un toque abre la confirmacion en linea (sin ventanas del navegador), otro lo hace. */
export function BotonMercado({ accion, jugador, nombre, precio, desactivado }: { accion: "fichar" | "vender"; jugador: string; nombre: string; precio: string; desactivado?: string | null }) {
  const a = useAccion();
  const [confirmando, setConfirmando] = useState(false);
  const verbo = accion === "fichar" ? "Fichar" : "Vender";
  if (desactivado) return <span className="fz-no tenue pequeno" data-testid={`fz-${accion}-no-${jugador}`}>{desactivado}</span>;
  return (
    <div className="fz-accion">
      {!confirmando
        ? <button type="button" className={`boton ${accion === "fichar" ? "boton-amarillo" : "boton-contorno"}`} onClick={() => { a.limpiar(); setConfirmando(true); }} data-testid={`fz-${accion}-${jugador}`}>{verbo}</button>
        : (
          <span className="fz-confirmar" role="group" aria-label={`${verbo} a ${nombre}`}>
            <button type="button" className="boton boton-amarillo" disabled={a.pendiente} onClick={() => a.lanzar(() => (accion === "fichar" ? fichar(jugador) : vender(jugador)), () => setConfirmando(false))} data-testid={`fz-${accion}-si-${jugador}`}>{a.pendiente ? "…" : `${verbo} por ${precio}`}</button>
            <button type="button" className="boton boton-contorno" disabled={a.pendiente} onClick={() => setConfirmando(false)}>No</button>
          </span>
        )}
      {a.mensaje}
    </div>
  );
}

export function BotonClausulazo({ jugador, nombre, precio, duenos, desactivado }: { jugador: string; nombre: string; precio: string; duenos: { id: string; nombre: string; protegida: boolean }[]; desactivado?: string | null }) {
  const a = useAccion();
  const [abierto, setAbierto] = useState(false);
  const libres = duenos.filter((d) => !d.protegida);
  const [dueno, setDueno] = useState(libres[0]?.id ?? "");
  if (desactivado) return <span className="fz-no tenue pequeno" data-testid={`fz-clausulazo-no-${jugador}`}>{desactivado}</span>;
  if (!libres.length) return <span className="fz-no tenue pequeno">Sin copias que se puedan robar esta jornada</span>;
  return (
    <div className="fz-accion">
      {!abierto
        ? <button type="button" className="boton boton-peligro" onClick={() => { a.limpiar(); setAbierto(true); }} data-testid={`fz-clausulazo-${jugador}`}>Clausulazo · {precio}</button>
        : (
          <span className="fz-confirmar fz-clausula" role="group" aria-label={`Clausulazo por ${nombre}`}>
            <label className="campo"><span>¿A quién se lo quitas?</span>
              <select value={dueno} onChange={(e) => setDueno(e.target.value)} data-testid={`fz-dueno-${jugador}`}>{libres.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}</select>
            </label>
            <button type="button" className="boton boton-peligro" disabled={a.pendiente || !dueno} onClick={() => a.lanzar(() => clausulazo(jugador, dueno), () => setAbierto(false))} data-testid={`fz-clausulazo-si-${jugador}`}>{a.pendiente ? "…" : `Pagar ${precio}`}</button>
            <button type="button" className="boton boton-contorno" disabled={a.pendiente} onClick={() => setAbierto(false)}>No</button>
          </span>
        )}
      {a.mensaje}
    </div>
  );
}

export type DePlantilla = { id: string; nombre: string; valor: string; media: string; conv?: { texto: string; clase: "si" | "no" } | null };

/** La pista con los alineados, capitan (C) y vicecapitan (V), y el banquillo. Se guarda con un boton. */
export function Alineador({ plantilla, inicial, max, vetado, bloqueo, sinPublicar = false, jornadasValor = 4 }: {
  plantilla: DePlantilla[]; inicial: { titulares: string[]; capitan: string | null; vice: string | null }; max: number; vetado: string | null; bloqueo: string | null; sinPublicar?: boolean; jornadasValor?: number;
}) {
  const a = useAccion();
  const [tit, setTit] = useState<string[]>(inicial.titulares.filter((id) => plantilla.some((p) => p.id === id)));
  const [cap, setCap] = useState<string | null>(inicial.capitan);
  const [vice, setVice] = useState<string | null>(inicial.vice);
  const [sucio, setSucio] = useState(false);
  const tocar = () => { setSucio(true); a.limpiar(); };
  const de = (id: string) => plantilla.find((p) => p.id === id);
  const alternar = (id: string) => {
    tocar();
    if (tit.includes(id)) { setTit(tit.filter((x) => x !== id)); if (cap === id) setCap(null); if (vice === id) setVice(null); }
    else if (tit.length < max) setTit([...tit, id]);
  };
  const hacerCap = (id: string) => { tocar(); if (vice === id) setVice(cap); setCap(id); };
  const hacerVice = (id: string) => { tocar(); if (cap === id) setCap(vice); setVice(id); };
  useEffect(() => {
    if (!sucio) return;
    const aviso = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [sucio]);
  const banquillo = plantilla.filter((p) => !tit.includes(p.id));
  const huecos = Array.from({ length: Math.max(0, max - tit.length) });
  const noConvocados = tit.map(de).filter((p): p is DePlantilla => !!p && p.conv?.clase === "no");
  const marca = (p: DePlantilla) => (p.conv ? <span className={`pastilla fz-conv ${p.conv.clase === "si" ? "pastilla-ok" : "pastilla-pendiente"}`} data-conv={p.conv.clase} data-testid={`fz-conv-${p.id}`}>{p.conv.texto}</span> : null);
  return (
    <div className="fz-alineador" data-testid="fz-alineador">
      {sinPublicar && <p className="aviso aviso-info fz-msj" data-testid="fz-conv-sin-publicar">Convocatoria sin publicar.</p>}
      {noConvocados.length > 0 && <p className="aviso aviso-error fz-msj" role="status" data-testid="fz-alineado-no-convocado">{noConvocados.length === 1 ? `${noConvocados[0].nombre} está alineado y no está convocado.` : `${noConvocados.map((p) => p.nombre).join(", ")} están alineados y no están convocados.`}</p>}
      <div className="fz-pista" role="list" aria-label={`Alineados: ${tit.length} de ${max}`}>
        {tit.map((id) => {
          const p = de(id);
          if (!p) return null;
          return (
            <div key={id} role="listitem" className={`fz-ficha${cap === id ? " es-cap" : vice === id ? " es-vice" : ""}`} data-testid={`fz-titular-${id}`}>
              {(cap === id || vice === id) && <b className="fz-galon" aria-label={cap === id ? "Capitán" : "Vicecapitán"}>{cap === id ? "C" : "V"}</b>}
              <Link href={`/mdfantasy/jugador/${id}`} className="fz-ficha-nombre">{p.nombre}</Link>
              <span className="tenue pequeno">{p.valor} · {p.media} pts</span>
              {marca(p)}
              {!bloqueo && (
                <span className="fz-ficha-botones">
                  <button type="button" aria-pressed={cap === id} disabled={vetado === id} title={vetado === id ? "Fue tu capitán la jornada pasada" : "Capitán: dobla su rendimiento"} onClick={() => hacerCap(id)} data-testid={`fz-cap-${id}`}>C</button>
                  <button type="button" aria-pressed={vice === id} title="Vicecapitán: dobla si el capitán no juega" onClick={() => hacerVice(id)} data-testid={`fz-vice-${id}`}>V</button>
                  <button type="button" aria-label={`Mandar a ${p.nombre} al banquillo`} onClick={() => alternar(id)} data-testid={`fz-quitar-${id}`}>↓</button>
                </span>
              )}
            </div>
          );
        })}
        {huecos.map((_, i) => <div key={`h${i}`} role="listitem" className="fz-ficha fz-hueco"><span className="tenue">Hueco libre</span></div>)}
      </div>
      <p className="tenue pequeno fz-nota-media" data-testid="fz-nota-media">Los puntos de cada jugador son su media de las últimas {jornadasValor} jornadas, la que fija su valor.</p>
      <h3 className="fz-h3">Banquillo</h3>
      {banquillo.length ? (
        <ul className="lista-limpia fz-banquillo" data-testid="fz-banquillo">
          {banquillo.map((p) => (
            <li key={p.id}>
              <Link href={`/mdfantasy/jugador/${p.id}`}>{p.nombre}</Link>
              <span className="fz-banq-datos"><span className="tenue pequeno">{p.valor} · {p.media} pts</span>{marca(p)}</span>
              {!bloqueo && <button type="button" className="boton boton-contorno" disabled={tit.length >= max} onClick={() => alternar(p.id)} data-testid={`fz-alinear-${p.id}`}>Alinear</button>}
            </li>
          ))}
        </ul>
      ) : <p className="suave" style={{ margin: 0 }}>Nadie en el banquillo.</p>}
      {bloqueo ? <p className="aviso aviso-info" data-testid="fz-bloqueo">{bloqueo}</p> : (
        <div className="fz-guardar">
          {sucio && <p className="aviso aviso-info fz-msj" data-testid="fz-sin-guardar">Cambios sin guardar.</p>}
          {vetado && de(vetado) && <p className="tenue pequeno" style={{ margin: 0 }}>{de(vetado)!.nombre} fue tu capitán la jornada pasada: no puede repetir.</p>}
          <button type="button" className="boton boton-amarillo boton-bloque" disabled={a.pendiente || !sucio} onClick={() => a.lanzar(() => alinear(tit, cap, vice), (r) => { if (r.ok) setSucio(false); })} data-testid="fz-guardar-alineacion">{a.pendiente ? "Guardando…" : "Guardar alineación"}</button>
          {a.mensaje}
        </div>
      )}
    </div>
  );
}

export function PorraBotones({ equipo, rival, actual, cerrado }: { equipo: string; rival: string; actual: string | null; cerrado: boolean }) {
  const a = useAccion();
  const [mio, setMio] = useState(actual);
  const poner = (p: string) => { setMio(p); a.lanzar(() => apostar(equipo, p), (r) => { if (!r.ok) setMio(actual); }); };
  return (
    <div className="fz-porra-fila" data-testid={`fz-porra-${equipo}`}>
      <span><b>{equipo}</b> <span className="suave">vs {rival}</span></span>
      <span className="fz-porra-botones" role="group" aria-label={`Porra de ${equipo}`}>
        {(["gana", "pierde"] as const).map((p) => (
          <button key={p} type="button" className="boton boton-contorno" aria-pressed={mio === p} disabled={cerrado || a.pendiente} onClick={() => poner(p)} data-testid={`fz-porra-${equipo}-${p}`}>{p === "gana" ? "Gana" : "Pierde"}</button>
        ))}
      </span>
      {a.mensaje}
    </div>
  );
}

function resta(ms: number) {
  if (ms <= 0) return "ya";
  const min = Math.floor(ms / 60000), d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
  return d > 0 ? `${d} d ${h} h` : h > 0 ? `${h} h ${m} min` : `${m} min`;
}

/** Cuenta atras hasta el cierre. El primer texto es el del servidor (sin saltos al hidratar); despues se actualiza sola. */
export function CuentaAtras({ hasta, ahora }: { hasta: string; ahora: string }) {
  const [t, setT] = useState(() => resta(new Date(hasta).getTime() - new Date(ahora).getTime()));
  useEffect(() => {
    const paso = () => setT(resta(new Date(hasta).getTime() - Date.now()));
    paso();
    const i = setInterval(paso, 30000);
    return () => clearInterval(i);
  }, [hasta]);
  return <b className="cifra fz-cuenta" data-testid="fz-cuenta-atras" suppressHydrationWarning>{t}</b>;
}

export function Copiar({ texto, etiqueta = "Copiar", prueba = "fz-copiar" }: { texto: string; etiqueta?: string; prueba?: string }) {
  const [hecho, setHecho] = useState(false);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); setHecho(true); setTimeout(() => setHecho(false), 2500); } catch { setHecho(false); }
  };
  return <button type="button" className="boton boton-contorno" onClick={copiar} data-testid={prueba}>{hecho ? "Copiado ✓" : etiqueta}</button>;
}

/** Compartir la carta: la hoja de compartir del movil si existe; si no, copia el texto. */
export function Compartir({ titulo, texto }: { titulo: string; texto: string }) {
  const [hecho, setHecho] = useState(false);
  const compartir = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) await navigator.share({ title: titulo, text: texto, url });
      else { await navigator.clipboard.writeText(`${texto}\n${url}`); setHecho(true); setTimeout(() => setHecho(false), 2500); }
    } catch { /* cancelado */ }
  };
  return <button type="button" className="boton boton-contorno" onClick={compartir} data-testid="fz-compartir">{hecho ? "Copiado ✓" : "Compartir"}</button>;
}
