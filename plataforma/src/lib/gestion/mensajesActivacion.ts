// Mensajes de WhatsApp del recuadro «Respuestas en la web» (y de la ficha de respuestas): singular si es una persona,
// plural si son varias. Texto de la noche segun D155 (avisos en el momento salvo 22:30–08:00; de noche solo si el
// partido es en pocas horas).

/** A quien aun no ha activado los avisos en el movil. */
export function mensajeSinAvisos(nombres: string[], web: string) {
  const uno = nombres.length === 1;
  return `Hola, ${nombres.join(", ")}: aún no ${uno ? "has activado" : "tenéis activados"} los avisos de Maccabis en el móvil. Así ${uno ? "te" : "os"} llega cuándo hay que responder y si cambia la hora o la pista (de noche solo si el partido es en pocas horas). Es un minuto: ${web}/avisos`;
}

/** A quien aun no ha entrado nunca en la web. */
export function mensajeFaltanEntrar(nombres: string[], web: string) {
  const uno = nombres.length === 1;
  return uno
    ? `Hola, ${nombres[0]}: aún no has entrado en la web de Maccabis. Entra una vez con tu correo (te llega un código) para tenerlo listo: ${web}/entrar. Si puedes, instálala en el móvil y activa los avisos: ${web}/avisos`
    : `Hola, ${nombres.join(", ")}: aún no habéis entrado en la web de Maccabis. Entrad una vez con vuestro correo (os llega un código) para tenerlo listo: ${web}/entrar. Si podéis, instaladla en el móvil y activad los avisos: ${web}/avisos`;
}

/** A quien pidio acceso (le llego el correo) pero no llego a entrar: que pida el codigo otra vez y escriba los numeros (D157). */
export function mensajePidieronNoEntraron(nombres: string[], web: string) {
  return nombres.length === 1
    ? `Hola, ${nombres[0]}: te llegó el correo pero no llegaste a entrar. Pide el código otra vez en ${web}/entrar y escribe los 6 números.`
    : `Hola, ${nombres.join(", ")}: os llegó el correo pero no llegasteis a entrar. Pedid el código otra vez en ${web}/entrar y escribid los 6 números.`;
}
