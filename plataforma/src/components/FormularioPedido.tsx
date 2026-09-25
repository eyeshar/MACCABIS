"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { PRENDAS, TALLAS, ERRORES_PEDIDO, lleva, type PrendaId, type Pedido } from "@/lib/ropa";

export type DatosPedido = {
  id: string | null;
  campana_id: string;
  jugador_id?: string;
  para: "yo" | "familiar";
  nombre_completo: string;
  nombre_ropa: string;
  dorsal: string;
  tallas: Partial<Record<PrendaId, string>>;
};

export type Resultado = { ok: true; id?: string } | { ok: false; error: string; prenda?: string };

type Props = {
  modo: "jugador" | "gestor";
  campanaId: string;
  precios: Partial<Record<PrendaId, number>>;
  inicial: Pedido | null;
  nombrePropio: string; // "Nombre Apellidos" del jugador, para rellenar "Para mi"
  jugadores?: { id: string; nombre: string; oficial: string }[]; // solo gestor
  jugadorInicial?: string; // solo gestor
  guardar: (datos: DatosPedido) => Promise<Resultado>;
  comprobarDorsal: (dorsal: number, pedidoId: string | null) => Promise<boolean>;
  volverA: string;
};

export default function FormularioPedido(p: Props) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [jugadorId, setJugadorId] = useState(p.jugadorInicial ?? "");
  const [para, setPara] = useState<"yo" | "familiar">(p.inicial?.para ?? "yo");
  const [nombreCompleto, setNombreCompleto] = useState(p.inicial?.nombre_completo ?? (p.modo === "jugador" ? p.nombrePropio : ""));
  const [nombreRopa, setNombreRopa] = useState(p.inicial?.nombre_ropa ?? "");
  const [dorsal, setDorsal] = useState(p.inicial?.dorsal != null ? String(p.inicial.dorsal) : "");
  const [elegidas, setElegidas] = useState<Partial<Record<PrendaId, boolean>>>(
    Object.fromEntries(Object.keys(p.inicial?.tallas ?? {}).map((k) => [k, true])),
  );
  const [tallas, setTallas] = useState<Partial<Record<PrendaId, string>>>(p.inicial?.tallas ?? {});
  const [dorsalCogido, setDorsalCogido] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intentado, setIntentado] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const marcadas = PRENDAS.filter((x) => elegidas[x.id]);
  const hacenFaltaNombre = marcadas.some((x) => x.llevaNombre);
  const hacenFaltaDorsal = marcadas.some((x) => x.llevaDorsal);
  const dorsalNum = /^\d{1,2}$/.test(dorsal) ? Number(dorsal) : null;
  // El dorsal solo es unico entre pedidos de jugadores; el de un familiar es libre (D59).
  const compruebaDorsal = hacenFaltaDorsal && para === "yo";

  // Comprobacion del dorsal en vivo (solo dice si esta cogido, nunca de quien).
  useEffect(() => {
    // Al cambiar el dorsal se quita el aviso anterior; la base de datos lo vuelve a comprobar al guardar.
    setDorsalCogido(false);
    if (dorsalNum === null || !compruebaDorsal) return;
    let vivo = true;
    const t = setTimeout(async () => {
      const cogido = await p.comprobarDorsal(dorsalNum, p.inicial?.id ?? null);
      if (vivo) setDorsalCogido(cogido);
    }, 350);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dorsalNum, compruebaDorsal]);

  const problemas = useMemo(() => {
    const lista: string[] = [];
    if (p.modo === "gestor" && !jugadorId) lista.push("Elige de qué jugador es el pedido.");
    if (nombreCompleto.trim().length < 3) lista.push("Falta el nombre completo.");
    if (!marcadas.length) lista.push("Elige al menos una prenda.");
    for (const x of marcadas) if (!tallas[x.id]) lista.push(`Falta la talla de: ${x.nombre.toLowerCase()}.`);
    if (hacenFaltaNombre && !nombreRopa.trim()) lista.push("Falta el nombre que va en la ropa.");
    if (hacenFaltaDorsal && dorsalNum === null) lista.push("Falta el dorsal (del 0 al 99).");
    if (compruebaDorsal && dorsalCogido && p.modo === "jugador") lista.push(ERRORES_PEDIDO.dorsal_cogido);
    return lista;
  }, [p.modo, jugadorId, nombreCompleto, marcadas, tallas, hacenFaltaNombre, nombreRopa, hacenFaltaDorsal, compruebaDorsal, dorsalNum, dorsalCogido]);

  function cambiarPara(v: "yo" | "familiar") {
    setPara(v);
    if (p.modo === "jugador") {
      if (v === "familiar" && nombreCompleto === p.nombrePropio) setNombreCompleto("");
      if (v === "yo" && !nombreCompleto) setNombreCompleto(p.nombrePropio);
    }
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setIntentado(true);
    setError(null);
    if (problemas.length) {
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    const datos: DatosPedido = {
      id: p.inicial?.id ?? null,
      campana_id: p.campanaId,
      jugador_id: p.modo === "gestor" ? jugadorId : undefined,
      para,
      nombre_completo: nombreCompleto.trim(),
      nombre_ropa: hacenFaltaNombre ? nombreRopa.trim().toUpperCase() : "",
      dorsal: hacenFaltaDorsal ? dorsal : "",
      tallas: Object.fromEntries(marcadas.map((x) => [x.id, tallas[x.id] ?? ""])),
    };
    empezar(async () => {
      const r = await p.guardar(datos);
      if (r.ok) {
        router.push(`${p.volverA}${p.volverA.includes("?") ? "&" : "?"}guardado=1`);
        router.refresh();
      } else {
        setError(ERRORES_PEDIDO[r.error] ?? r.error);
        if (r.error === "dorsal_cogido") setDorsalCogido(true);
        requestAnimationFrame(() => errorRef.current?.focus());
      }
    });
  }

  const mostrarProblemas = intentado && problemas.length > 0;
  const faltaTalla = marcadas.some((x) => !tallas[x.id]);

  return (
    <form onSubmit={enviar} noValidate>
      {p.modo === "gestor" && (
        <div className="campo">
          <label htmlFor="jugador">Jugador que hace el pedido</label>
          <select id="jugador" value={jugadorId} onChange={(e) => setJugadorId(e.target.value)} aria-invalid={intentado && !jugadorId}>
            <option value="">Elige…</option>
            {p.jugadores?.map((j) => (
              <option key={j.id} value={j.id}>{j.nombre} ({j.oficial})</option>
            ))}
          </select>
        </div>
      )}

      <fieldset className="campo" style={{ border: 0, padding: 0, margin: "14px 0" }}>
        <legend style={{ fontWeight: 600, marginBottom: 6 }}>¿Para quién es?</legend>
        <div className="opciones">
          <label className="opcion">
            <input type="radio" name="para" value="yo" checked={para === "yo"} onChange={() => cambiarPara("yo")} />
            {p.modo === "jugador" ? "Para mí" : "Para el jugador"}
          </label>
          <label className="opcion">
            <input type="radio" name="para" value="familiar" checked={para === "familiar"} onChange={() => cambiarPara("familiar")} />
            Para un familiar
          </label>
        </div>
      </fieldset>

      <div className="campo">
        <label htmlFor="nombre_completo">Nombre completo {para === "familiar" ? "del familiar" : ""}</label>
        <input id="nombre_completo" type="text" autoComplete="name" value={nombreCompleto} maxLength={80}
          onChange={(e) => setNombreCompleto(e.target.value)} aria-invalid={intentado && nombreCompleto.trim().length < 3} />
        <p className="ayuda">Para saber de quién es cada prenda. No se imprime.</p>
      </div>

      <div className="rejilla-2">
        <div className="campo">
          <label htmlFor="nombre_ropa">Nombre en la ropa</label>
          <input id="nombre_ropa" type="text" value={nombreRopa} maxLength={15} autoCapitalize="characters"
            onChange={(e) => setNombreRopa(e.target.value.toUpperCase())}
            aria-invalid={intentado && hacenFaltaNombre && !nombreRopa.trim()} aria-describedby="ayuda-nombre-ropa" />
          <p className="ayuda" id="ayuda-nombre-ropa">En mayúsculas, máximo 15 letras. Va en la camiseta, el cubre y la sudadera.</p>
        </div>
        <div className="campo">
          <label htmlFor="dorsal">Dorsal</label>
          <input id="dorsal" type="number" inputMode="numeric" min={0} max={99} value={dorsal}
            onChange={(e) => setDorsal(e.target.value.replace(/\D/g, "").slice(0, 2))}
            aria-invalid={(intentado && hacenFaltaDorsal && dorsalNum === null) || (compruebaDorsal && dorsalCogido)} aria-describedby="ayuda-dorsal" />
          <p className="ayuda" id="ayuda-dorsal">Del 0 al 99. Va en la camiseta, el pantalón y el cubre.</p>
          {dorsalCogido && compruebaDorsal && (
            <p className="aviso aviso-error" role="status" style={{ margin: "6px 0 0" }}>
              {p.modo === "jugador" ? "Ese dorsal ya está cogido." : "Ese dorsal ya está en otro pedido de esta campaña. Puedes guardar igualmente."}
            </p>
          )}
        </div>
      </div>

      <h2 style={{ marginTop: 20 }}>Prendas</h2>
      <p className="suave pequeno">
        Marca las que quieras y elige la talla. <a href="/guia-tallas" target="_blank" rel="noopener">Ver la guía de tallas</a>
      </p>
      <div className="prendas">
        {PRENDAS.map((x) => {
          const marcada = Boolean(elegidas[x.id]);
          const precio = p.precios[x.id];
          return (
            <div key={x.id} className={`prenda${marcada ? " elegida" : ""}`}>
              <div className="foto">
                <Image src={x.imagen} alt={x.imagenAlt} width={300} height={533} sizes="140px" />
              </div>
              <div>
                <h3>{x.nombre}</h3>
                <p className="suave pequeno" style={{ margin: 0 }}>{x.detalle}. Lleva {lleva(x.id)}.</p>
                {precio != null && <p className="pequeno" style={{ margin: "2px 0 8px" }}>Unos {precio} € <span className="suave">(por confirmar)</span></p>}
                <label className="opcion" style={{ marginTop: 6 }}>
                  <input type="checkbox" checked={marcada}
                    onChange={(e) => setElegidas({ ...elegidas, [x.id]: e.target.checked })} />
                  La quiero
                </label>
                {marcada && (
                  <div className="campo" style={{ marginBottom: 0 }}>
                    <label htmlFor={`talla-${x.id}`}>Talla</label>
                    <select id={`talla-${x.id}`} value={tallas[x.id] ?? ""} aria-invalid={intentado && !tallas[x.id]}
                      onChange={(e) => setTallas({ ...tallas, [x.id]: e.target.value })}>
                      <option value="">Elige talla…</option>
                      {TALLAS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                )}
                {x.nota && <p className="nota">{x.nota}</p>}
              </div>
            </div>
          );
        })}
      </div>

      <section className="tarjeta" aria-labelledby="titulo-resumen">
        <h2 id="titulo-resumen">Resumen del pedido</h2>
        {marcadas.length === 0 ? (
          <p className="suave">Todavía no has elegido ninguna prenda.</p>
        ) : (
          <div className="tabla-desplazable">
            <table>
              <thead>
                <tr><th>Prenda</th><th>Nombre</th><th>Número</th><th>Talla</th></tr>
              </thead>
              <tbody>
                {marcadas.map((x) => (
                  <tr key={x.id}>
                    <td>{x.nombre}</td>
                    {x.llevaNombre
                      ? <td className={nombreRopa.trim() ? "" : "falta"}>{nombreRopa.trim() || "Falta"}</td>
                      : <td className="suave">Sin nombre</td>}
                    {x.llevaDorsal
                      ? <td className={dorsalNum === null ? "falta" : ""}>{dorsalNum ?? "Falta"}</td>
                      : <td className="suave">Sin número</td>}
                    <td className={tallas[x.id] ? "" : "falta"}>{tallas[x.id] || "Falta talla"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="pequeno suave" style={{ marginTop: 10 }}>
          Para: {para === "yo" ? (p.modo === "jugador" ? "ti" : "el jugador") : "un familiar"}{nombreCompleto.trim() ? ` (${nombreCompleto.trim()})` : ""}.
          {" "}No se paga por aquí: el precio final lo confirmamos cuando VIVE pase el presupuesto.
        </p>
      </section>

      <div ref={errorRef} tabIndex={-1} aria-live="assertive">
        {error && <div className="aviso aviso-error">{error}</div>}
        {mostrarProblemas && (
          <div className="aviso aviso-error">
            <strong>Antes de enviar:</strong>
            <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>{problemas.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        )}
      </div>

      <div className="botones">
        <button type="submit" className="boton boton-amarillo boton-bloque" disabled={pendiente || faltaTalla || (intentado && problemas.length > 0)}>
          {pendiente ? "Guardando…" : p.inicial ? "Guardar cambios" : "Enviar pedido"}
        </button>
        <a className="boton boton-claro boton-bloque" href={p.volverA}>Volver sin guardar</a>
      </div>
      {faltaTalla && <p className="ayuda" role="status">Para enviar, elige la talla de todas las prendas marcadas.</p>}
    </form>
  );
}
