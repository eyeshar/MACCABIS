import type { Metadata } from "next";
import Link from "next/link";
import { exigirSesion } from "@/lib/sesion";
import ActivarAvisos from "@/components/avisos/ActivarAvisos";
import "@/components/respuestas/respuestas.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Avisos en el móvil · Maccabis", robots: { index: false, follow: false } };

// Activar avisos (D99, 3.1): enlazada desde el menu de usuario («Instalar en el móvil»), Mi cuenta y la banda de Mi
// zona. Funciona con «respuestas en la web» apagado: instalar, activar y recibir el aviso de prueba (D99.12).
export default async function Avisos() {
  await exigirSesion();
  return (
    <main className="pagina av-pagina">
      <h1>Avisos en el móvil</h1>
      <p className="av-intro">Solo te avisamos si te falta responder, si cambia la hora o la pista y si se cancela algo. <strong>Nunca de noche.</strong></p>
      <ActivarAvisos />
      <details className="tarjeta av-ajustes">
        <summary><h2>Si dijiste «No permitir»</h2></summary>
        <ul>
          <li><strong>iPhone:</strong> Ajustes → Notificaciones → <strong>Maccabis</strong> → activa «Permitir notificaciones». Si no aparece, borra el icono de Maccabis, vuelve a añadirlo desde Safari y actívalos otra vez aquí.</li>
          <li><strong>Android (Chrome):</strong> mantén pulsado el icono de Maccabis → Información de la aplicación → Notificaciones → actívalas. O en Chrome: ⋮ → Configuración → Configuración de sitios → Notificaciones → maccabis.vercel.app → Permitir.</li>
        </ul>
      </details>
      <p className="pie"><Link href="/mi-zona">Volver a Mi zona</Link> · <Link href="/cuenta">Mi cuenta</Link></p>
    </main>
  );
}
