"use client";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { anotar, CLAVE_RASTRO } from "@/lib/rastro";

/** Anota cada pantalla visitada en esta pestaña (sessionStorage) para que «← volver» sepa cual es el origen (D139). No pinta nada. */
export default function RastroNavegacion() {
  const pathname = usePathname();
  const busqueda = useSearchParams().toString();
  useEffect(() => {
    try {
      const actual = pathname + (busqueda ? `?${busqueda}` : "");
      const v = JSON.parse(sessionStorage.getItem(CLAVE_RASTRO) ?? "[]");
      sessionStorage.setItem(CLAVE_RASTRO, JSON.stringify(anotar(Array.isArray(v) ? v : [], actual)));
    } catch {}
  }, [pathname, busqueda]);
  return null;
}
