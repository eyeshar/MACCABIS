// Mensaje de bienvenida que el gestor manda a cada jugador por privado, con
// el correo que tenemos suyo (D68: login con Google o con un codigo a ese correo).
export function mensajeBienvenida(nombre: string, email: string, urlEntrar: string) {
  return [
    `Hola, ${nombre}. Ya puedes entrar en la plataforma de Maccabis:`,
    urlEntrar,
    "",
    `Entra con Google (con la cuenta de ${email}) o, si no usas Google, pide un código a ese mismo correo.`,
    "",
    "Desde ahí puedes hacer tu pedido de ropa y ver tus estadísticas. Muy pronto también podrás confirmar si vas a los partidos y a los entrenos, y ver las convocatorias.",
    "",
    "Guárdalo en la pantalla de inicio del móvil para tenerlo a mano: ábrelo y, en iPhone, pulsa Compartir y \"Añadir a pantalla de inicio\"; en Android, abre el menú del navegador y \"Añadir a pantalla de inicio\".",
    "",
    "Si tu correo cambia o no te deja entrar, avísanos.",
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
