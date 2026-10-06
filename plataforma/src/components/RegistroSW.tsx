"use client";

import { useEffect } from "react";

// Web instalable (D76): registra un service worker minimo (public/sw.js), sin cache ni avisos todavia. Es la base para
// los avisos del paso 3; hoy no cambia nada de como carga la web.
export default function RegistroSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
  }, []);
  return null;
}
