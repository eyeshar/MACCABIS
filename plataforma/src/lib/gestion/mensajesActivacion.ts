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
