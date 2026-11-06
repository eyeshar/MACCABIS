"use client";

import { salir } from "@/app/entrar/acciones";
import { borrarConversacion } from "@/components/asistente/conversacion";

/** Salir: cierra la sesión y borra la conversación del asistente de esta pestaña (como hacía el menú de usuario, D142). */
export default function Salir() {
  return <form action={salir} onSubmit={borrarConversacion}><button className="boton boton-claro yo-salir" type="submit">Salir</button></form>;
}
