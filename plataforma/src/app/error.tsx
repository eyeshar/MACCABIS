"use client";

import FalloPantalla from "@/components/carga/FalloPantalla";

// D198: cualquier pantalla sin su propio error.tsx cae aquí (dentro del layout: con la cabecera y la barra de abajo).
export default function Fallo(props: { error: Error & { digest?: string }; reset: () => void; retry?: () => void }) {
  return <FalloPantalla {...props} />;
}
