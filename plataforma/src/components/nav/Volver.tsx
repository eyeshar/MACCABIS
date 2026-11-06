"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { CLAVE_RASTRO, vueltaDe } from "@/lib/rastro";
import "./volver.css";

const leer = (): string[] => { try { const v = JSON.parse(sessionStorage.getItem(CLAVE_RASTRO) ?? "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; } };

/** Un unico «‹» a su seccion (D189; sustituye al «← volver» dinamico de D139). Siempre lleva a `defecto` con la misma
 *  etiqueta; si esa pantalla ya se vio en esta pestaña, con la pestaña, el filtro y la jornada que tenia en la URL. El boton
 *  atras del navegador sigue haciendo lo de siempre. */
export default function Volver(p: { defecto: string; etiqueta: string; enLinea?: boolean }) {
  return <Suspense fallback={<Enlace href={p.defecto} texto={p.etiqueta} enLinea={p.enLinea} />}><Vuelta {...p} /></Suspense>;
}

function Enlace({ href, texto, enLinea, ...resto }: { href: string; texto: string; enLinea?: boolean; onClick?: () => void; "data-origen"?: string }) {
  const a = <Link href={href} data-testid="volver" aria-label={`Volver a ${texto}`} {...resto}><span aria-hidden="true">‹</span> {texto}</Link>;
  return enLinea ? a : <p className="volver">{a}</p>;
}

function Vuelta({ defecto, etiqueta, enLinea }: { defecto: string; etiqueta: string; enLinea?: boolean }) {
  const [destino, setDestino] = useState<{ href: string; indice: number | null }>({ href: defecto, indice: null });
  useEffect(() => {
    const v = vueltaDe(leer(), defecto);
    setDestino(v ? { href: v.url, indice: v.indice } : { href: defecto, indice: null });
  }, [defecto]);
  // Al pulsarlo, lo que quedaba por delante se olvida: la pantalla de vuelta pasa a ser la ultima del rastro.
  const alPulsar = () => { try { if (destino.indice != null) sessionStorage.setItem(CLAVE_RASTRO, JSON.stringify(leer().slice(0, destino.indice + 1))); } catch {} };
  return <Enlace href={destino.href} texto={etiqueta} enLinea={enLinea} onClick={alPulsar} data-origen={destino.indice != null ? "rastro" : "defecto"} />;
}
