"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { GrupoAjuste, Parametros } from "@/lib/fantasy/reglas";
import { guardarAjustes, puntuarAhora, type R } from "../acciones";

type Campo = { clave: keyof Parametros; texto: string; grupo: GrupoAjuste; min: number; max: number; paso: number; valor: number; salida: number };
const GRUPOS: GrupoAjuste[] = ["Rendimiento", "Compromiso", "Mánager", "Mercado"];
const MODOS = [
  { id: "apagado", texto: "Apagado", nota: "Nadie lo ve." },
  { id: "gestores", texto: "Solo gestores", nota: "Para probarlo antes de abrirlo." },
  { id: "todos", texto: "Abierto a todos", nota: "Todo jugador con sesión ve «Fantasy» en el menú." },
];

export default function AjustesFormulario({ modo, campos, alias, sinCasar, jugadores, puntuadas, cambiado }: {
  modo: string; campos: Campo[]; alias: Record<string, string>; sinCasar: string[]; jugadores: { id: string; nombre: string }[]; puntuadas: number; cambiado: string | null;
}) {
  const [m, setM] = useState(modo);
  const [v, setV] = useState<Record<string, string>>(Object.fromEntries(campos.map((c) => [c.clave, String(c.valor)])));
  const [al, setAl] = useState<Record<string, string>>(alias);
  const [r, setR] = useState<R | null>(null);
  const [pendiente, empezar] = useTransition();
  const router = useRouter();
  const malos = campos.filter((c) => { const x = Number(v[c.clave].replace(",", ".")); return !Number.isFinite(x) || x < c.min || x > c.max; });
  const guardar = (recalcular: boolean) => empezar(async () => {
    // solo se guarda lo que difiere del valor de salida: asi un cambio futuro del valor de salida llega a quien no lo toco
    const cambiados = Object.fromEntries(campos.map((c) => [c.clave, Number(v[c.clave].replace(",", "."))] as const).filter(([k, x]) => x !== campos.find((c) => c.clave === k)!.salida));
    const limpio = Object.fromEntries(Object.entries(al).filter(([, id]) => id));
    const res = await guardarAjustes(m, cambiados, limpio, recalcular);
    setR(res);
    if (res.ok) router.refresh();
  });
  const puntuar = () => empezar(async () => { const res = await puntuarAhora(); setR(res); if (res.ok) router.refresh(); });
  const nombres = [...new Set([...sinCasar, ...Object.keys(al)])];

  return (
    <form className="fz-ajustes" onSubmit={(e) => { e.preventDefault(); guardar(false); }}>
      <fieldset className="gs-bloque">
        <legend className="fz-h2">Interruptor</legend>
        {MODOS.map((x) => (
          <label key={x.id} className="fz-radio">
            <input type="radio" name="modo" value={x.id} checked={m === x.id} onChange={() => setM(x.id)} data-testid={`fz-modo-${x.id}`} />
            <span><b>{x.texto}</b> <span className="suave">{x.nota}</span></span>
          </label>
        ))}
        {cambiado && <p className="tenue pequeno" style={{ margin: 0 }}>Último cambio: {cambiado}.</p>}
      </fieldset>

      {GRUPOS.map((g) => (
        <fieldset key={g} className="gs-bloque">
          <legend className="fz-h2">{g}</legend>
          {campos.filter((c) => c.grupo === g).map((c) => (
            <label key={c.clave} className="fz-campo">
              <span>{c.texto}{Number(v[c.clave].replace(",", ".")) !== c.salida && <em className="tenue pequeno"> (de salida: {String(c.salida).replace(".", ",")})</em>}</span>
              <input type="number" inputMode="decimal" min={c.min} max={c.max} step={c.paso} value={v[c.clave]} onChange={(e) => setV({ ...v, [c.clave]: e.target.value })} aria-invalid={malos.includes(c)} data-testid={`fz-p-${c.clave}`} />
            </label>
          ))}
        </fieldset>
      ))}

      <fieldset className="gs-bloque" data-testid="fz-alias">
        <legend className="fz-h2">Nombres de la hoja sin casar</legend>
        {nombres.length ? nombres.map((n) => (
          <label key={n} className="fz-campo">
            <span className="mono">{n}</span>
            <select value={al[n] ?? ""} onChange={(e) => setAl({ ...al, [n]: e.target.value })} data-testid="fz-alias-select">
              <option value="">— no es de la plantilla —</option>
              {jugadores.map((j) => <option key={j.id} value={j.id}>{j.nombre}</option>)}
            </select>
          </label>
        )) : <p className="suave" style={{ margin: 0 }}>Todos los nombres de las hojas casan con una ficha.</p>}
      </fieldset>

      <div className="gs-bloque">
        <p className="suave" style={{ margin: 0 }}>Jornadas puntuadas: <b>{puntuadas}</b>. Cambiar un peso no cambia lo ya puntuado salvo que pulses «Guardar y volver a puntuar todo».</p>
        {malos.length > 0 && <p className="aviso aviso-error" role="alert">Fuera de límites: {malos.map((c) => c.texto).join("; ")}.</p>}
        <div className="botones">
          <button type="submit" className="boton boton-amarillo" disabled={pendiente || malos.length > 0} data-testid="fz-guardar-ajustes">{pendiente ? "Guardando…" : "Guardar"}</button>
          <button type="button" className="boton boton-contorno" disabled={pendiente || malos.length > 0} onClick={() => guardar(true)} data-testid="fz-recalcular">Guardar y volver a puntuar todo</button>
          <button type="button" className="boton boton-contorno" disabled={pendiente} onClick={puntuar} data-testid="fz-puntuar">Puntuar ahora</button>
        </div>
        {r && (r.ok ? <p className="aviso aviso-ok" role="status" data-testid="fz-ok">{r.aviso ?? "Hecho."}</p> : <p className="aviso aviso-error" role="alert" data-testid="fz-error">{r.error}</p>)}
      </div>
    </form>
  );
}
