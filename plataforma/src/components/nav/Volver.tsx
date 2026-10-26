"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CLAVE_RASTRO, etiquetaDe, origenDe } from "@/lib/rastro";
import "./volver.css";

const leer = (): string[] => { try { const v = JSON.parse(sessionStorage.getItem(CLAVE_RASTRO) ?? "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; } };

/** «← volver» a la pantalla de origen (D139, norma 4). Sin rastro (se entro directamente a esta pantalla), a `defecto`. Al volver
 *  se conservan pestaña, filtro y jornada porque viven en la URL del origen; el boton atras del navegador hace lo mismo. */
export default function Volver(p: { defecto: string; etiqueta: string; enLinea?: boolean }) {
  return <Suspense fallback={<Enlace href={p.defecto} texto={p.etiqueta} enLinea={p.enLinea} />}><Origen {...p} /></Suspense>;
}

function Enlace({ href, texto, enLinea, ...resto }: { href: string; texto: string; enLinea?: boolean; onClick?: () => void; "data-origen"?: string }) {
  const a = <Link href={href} data-testid="volver" {...resto}>← {texto}</Link>;
  return enLinea ? a : <p className="volver">{a}</p>;
}

function Origen({ defecto, etiqueta, enLinea }: { defecto: string; etiqueta: string; enLinea?: boolean }) {
  const pathname = usePathname();
  const busqueda = useSearchParams().toString();
  const [destino, setDestino] = useState<{ href: string; texto: string; indice: number | null }>({ href: defecto, texto: etiqueta, indice: null });
  useEffect(() => {
    const actual = pathname + (busqueda ? `?${busqueda}` : "");
    const o = origenDe(leer(), actual);
    setDestino(o ? { href: o.url, texto: etiquetaDe(o.url, etiqueta), indice: o.indice } : { href: defecto, texto: etiqueta, indice: null });
  }, [pathname, busqueda, defecto, etiqueta]);
  // Al pulsarlo, lo que quedaba por delante del origen se olvida: el origen pasa a ser la pantalla actual del rastro.
  const alPulsar = () => { try { if (destino.indice != null) sessionStorage.setItem(CLAVE_RASTRO, JSON.stringify(leer().slice(0, destino.indice + 1))); } catch {} };
  return <Enlace href={destino.href} texto={destino.texto} enLinea={enLinea} onClick={alPulsar} data-origen={destino.indice != null ? "rastro" : "defecto"} />;
}
