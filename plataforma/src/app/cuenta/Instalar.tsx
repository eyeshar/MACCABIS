"use client";

import { useEffect, useState } from "react";

type AvisoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// "Instalar en el movil" (D78, D90): si el navegador ofrece instalar la web (Chrome en Android y escritorio), un boton;
// si ya esta instalada, lo dice. Las instrucciones a mano van siempre debajo (iPhone no ofrece el boton).
export default function Instalar() {
  const [aviso, setAviso] = useState<AvisoInstalar | null>(null);
  const [instalada, setInstalada] = useState(false);
  useEffect(() => {
    setInstalada(window.matchMedia("(display-mode: standalone)").matches);
    const guardar = (e: Event) => { e.preventDefault(); setAviso(e as AvisoInstalar); };
    const hecha = () => { setInstalada(true); setAviso(null); };
    window.addEventListener("beforeinstallprompt", guardar);
    window.addEventListener("appinstalled", hecha);
    return () => { window.removeEventListener("beforeinstallprompt", guardar); window.removeEventListener("appinstalled", hecha); };
  }, []);
  if (instalada) return <p className="aviso aviso-ok" style={{ margin: 0 }}>Ya la tienes instalada: la estás usando como app.</p>;
  if (!aviso) return null;
  return (
    <button type="button" className="boton boton-amarillo" onClick={async () => { await aviso.prompt(); setAviso(null); }}>
      Instalar Maccabis
    </button>
  );
}
