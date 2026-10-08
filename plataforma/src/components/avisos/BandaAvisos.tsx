"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Campana } from "@/components/Iconos";
import { casoActual } from "./dispositivo";

// Banda amarilla de Mi zona (D99, 3.2): «Activa los avisos en este móvil» hasta que este movil los tenga.
export default function BandaAvisos() {
  const [ver, setVer] = useState(false);
  useEffect(() => { casoActual().then((c) => setVer(c !== "activados" && c !== "no-soportado")).catch(() => setVer(false)); }, []);
  if (!ver) return null;
  return (
    <Link href="/avisos" className="rw-banda" data-banda="avisos">
      <span aria-hidden="true" className="rw-banda-icono"><Campana size={24} /></span>
      <span><strong>Activa los avisos en este móvil</strong><small>Solo si te falta responder, si cambia algo o si se cancela. Nunca de noche.</small></span>
      <span aria-hidden="true">›</span>
    </Link>
  );
}
