"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { marcarAvisoVisto } from "@/app/planes/acciones";

/** Lo que un gestor le ha dejado al organizador de un plan (D117): se quita con «Entendido». */
export default function AvisoPersonal({ id, texto, url }: { id: string; texto: string; url: string }) {
  const [visto, setVisto] = useState(false);
  const [pendiente, empezar] = useTransition();
  if (visto) return null;
  return (
    <div className="aviso aviso-info in-aviso-personal" role="status" data-testid="aviso-personal">
      <span><Link href={url}>{texto}</Link></span>
      <button type="button" className="boton boton-claro" disabled={pendiente} onClick={() => empezar(async () => { await marcarAvisoVisto(id); setVisto(true); })}>Entendido</button>
    </div>
  );
}
