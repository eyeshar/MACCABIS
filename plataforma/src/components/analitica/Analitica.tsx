"use client";
// Web Analytics de Vercel (D188), con la URL limpia (lib/analitica.ts). Solo se monta si ANALITICA_ACTIVA. Va a
// /_vercel/insights del mismo dominio: la CSP no cambia (script-src y connect-src 'self').
import { Analytics } from "@vercel/analytics/next";
import { antesDeEnviar } from "@/lib/analitica";

export default function Analitica() {
  return <Analytics beforeSend={antesDeEnviar} />;
}
