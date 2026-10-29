// Punto de entrada del Worker «maccabis-chat» (D142). Solo el default: la logica (y lo que importan las pruebas) esta en
// logica.js, porque el runtime toma cada export con nombre de este modulo por un punto de entrada.
import { atender } from "./logica.js";

export default { fetch: (request, env) => atender(request, env) };
