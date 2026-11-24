"use client";

import FalloPantalla from "@/components/carga/FalloPantalla";

export default function Fallo(props: { error: Error & { digest?: string }; reset: () => void; retry?: () => void }) {
  return <FalloPantalla {...props} que="el evento" />;
}
