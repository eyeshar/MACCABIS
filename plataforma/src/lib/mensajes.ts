// Mensaje de bienvenida que el gestor manda a cada jugador por privado, con su enlace.
export function mensajeBienvenida(nombre: string, enlace: string) {
  return [
    `Hola, ${nombre}. Esta es tu zona personal de Maccabis:`,
    enlace,
    "",
    "Desde ahí puedes hacer tu pedido de ropa y ver tus estadísticas. Muy pronto también podrás confirmar si vas a los partidos y a los entrenos, y ver las convocatorias.",
    "",
    "El enlace es solo tuyo y funciona como una llave: quien lo tenga entra como tú. No lo reenvíes ni lo pongas en el grupo.",
    "",
    "Guárdalo en la pantalla de inicio del móvil para tenerlo a mano: ábrelo y, en iPhone, pulsa Compartir y \"Añadir a pantalla de inicio\"; en Android, abre el menú del navegador y \"Añadir a pantalla de inicio\".",
    "",
    "Si lo pierdes o crees que otra persona lo tiene, avísanos y te hacemos uno nuevo (el viejo deja de funcionar).",
  ].join("\n");
}

// Enlace de WhatsApp para enviar el mensaje a un telefono concreto (en privado).
export function enlaceWhatsApp(telefono: string, texto: string) {
  let digitos = telefono.replace(/\D/g, "");
  if (digitos.length === 9) digitos = `34${digitos}`; // movil espanol sin prefijo
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`;
}

export const URL_DASHBOARD = "https://eyeshar.github.io/MACCABIS/";
export const fichaEstadisticas = (personId: string) => `${URL_DASHBOARD}?p=jugador&j=${encodeURIComponent(personId)}`;
