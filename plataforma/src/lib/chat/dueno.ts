import "server-only";
import { createHash } from "node:crypto";

/** Marca de la cuenta para la conversacion guardada en el navegador (D142): un resumen, no el correo. */
export const duenoConversacion = (email: string) => createHash("sha256").update(`maccabis-asistente:${email.toLowerCase()}`).digest("hex").slice(0, 16);
