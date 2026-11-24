"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Campana } from "@/components/Iconos";
import { casoActual, type Caso } from "./dispositivo";

// Banda amarilla de Mi zona (D99, 3.2): «Activa los avisos en este móvil» hasta que este movil los tenga.
// D198: en un iPhone sin la web instalada (Safari en pestaña) los avisos no pueden llegar: Apple solo los deja desde la web
// añadida a la pantalla de inicio. Ahí la banda dice eso y cómo hacerlo; /avisos tiene los pasos con dibujos.
const TEXTO: Partial<Record<Caso, { titulo: string; detalle: string }>> = {
  "iphone-safari": { titulo: "Añade Maccabis a la pantalla de inicio", detalle: "En iPhone los avisos solo llegan así: toca Compartir (el cuadrado con la flecha) y «Añadir a pantalla de inicio». Luego ábrela desde el icono y activa los avisos." },
  "iphone-otro": { titulo: "En iPhone, los avisos van con Safari", detalle: "Abre maccabis.vercel.app en Safari, añádela a la pantalla de inicio (Compartir › «Añadir a pantalla de inicio») y activa los avisos desde el icono." },
};
const NORMAL = { titulo: "Activa los avisos en este móvil", detalle: "Solo si te falta responder, si cambia algo o si se cancela. De noche, solo si el partido es en pocas horas." };

export default function BandaAvisos() {
  const [caso, setCaso] = useState<Caso | null>(null);
  useEffect(() => { casoActual().then(setCaso).catch(() => setCaso(null)); }, []);
  if (!caso || caso === "activados" || caso === "no-soportado") return null;
  const t = TEXTO[caso] ?? NORMAL;
  return (
    <Link href="/avisos" className="rw-banda" data-banda="avisos" data-caso={caso}>
      <span aria-hidden="true" className="rw-banda-icono"><Campana size={24} /></span>
      <span><strong>{t.titulo}</strong><small>{t.detalle}</small></span>
      <span aria-hidden="true">›</span>
    </Link>
  );
}
