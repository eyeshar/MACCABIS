# Prueba en móviles de verdad: instalar la web, entrar y recibir avisos (paso 3, D99)

> Para Iván, en un **iPhone** y un **Android** reales, **con «respuestas en la web» apagado** (no hace falta encenderlo:
> instalar, activar y el aviso de prueba funcionan apagado, D99.12). Antes: claves en Vercel y redeploy
> (`plataforma/LEEME.md`, apartado 8). Marca cada casilla; si algo falla, anota el paso y una captura.

## iPhone (iOS 16.4 o posterior; Safari)
- [ ] 1. Ajustes → General → Información: la versión de iOS es **16.4 o más** (antes no hay avisos web).
- [ ] 2. Abre **Safari** (no Chrome) y entra en `maccabis.vercel.app/avisos`. Sin sesión, te lleva a «Acceso»: entra **con el código por correo** (no con Google) y vuelve a `/avisos`.
- [ ] 3. Ves «En iPhone, primero instálala» con **tres pasos numerados**.
- [ ] 4. Compartir (el cuadrado con la flecha) → **«Añadir a pantalla de inicio»** → «Añadir». Sale el **escudo** como icono y el nombre **Maccabis**.
- [ ] 5. Cierra Safari y abre **Maccabis desde el icono**: se abre a pantalla completa, sin barra de Safari.
- [ ] 6. Si dentro de la app instalada **pide entrar otra vez** (según la versión de iOS, la app instalada no siempre conserva la sesión de Safari; anota qué pasa en el tuyo), entra con **«Enviarme el código»**: escribe tu correo, abre el correo en la app Mail **sin salir del todo** de Maccabis, copia los 6 dígitos y vuelve a Maccabis. **No uses «Continuar con Google» aquí**: suele abrirse fuera de la app y la sesión se queda en Safari.
- [ ] 7. Ve a tu menú (tu inicial arriba) → **«Instalar en el móvil»**. Ahora sale el botón **«Activar avisos en este móvil»**.
- [ ] 8. Pulsa el botón → iPhone pregunta si permites notificaciones → **Permitir**. Sale «Avisos activados en este móvil».
- [ ] 9. Pulsa **«Mandarme un aviso de prueba»** → en unos segundos llega «Aviso de prueba» con el escudo, también con la pantalla bloqueada.
- [ ] 10. Toca el aviso: abre Maccabis en «Avisos en el móvil».
- [ ] 11. En Mi zona **ya no sale** la banda amarilla «Activa los avisos en este móvil» (en este móvil).
- [ ] 12. (Opcional) Ajustes → Notificaciones → Maccabis existe y está activado.
- [ ] 13. (Opcional, para probar el «No permitir») Desactívalas ahí, vuelve a `/avisos`: sale el bloque «Si dijiste No permitir» con el camino de Ajustes.

## Android (Chrome)
- [ ] 1. Abre **Chrome** en `maccabis.vercel.app/avisos` y entra (Google o código, los dos valen en Android).
- [ ] 2. Sale directamente **«Activar avisos en este móvil»** (en Android no hace falta instalarla para recibir avisos).
- [ ] 3. Pulsa el botón → **Permitir**. Sale «Avisos activados en este móvil».
- [ ] 4. **«Mandarme un aviso de prueba»** → llega con el escudo. Tócalo: abre `/avisos`.
- [ ] 5. (Recomendado) Menú ⋮ → **«Instalar aplicación»** (o «Añadir a pantalla de inicio»). Abre desde el icono: la sesión sigue y la banda amarilla ya no sale.
- [ ] 6. Mantén pulsado el icono → Información de la aplicación → Notificaciones: activadas.

## En Gestión, después
- [ ] Gestión → Panel → «Respuestas en la web: activar»: la condición 3 cuenta **1** (o 2) con avisos activados.
- [ ] En un evento → Respuestas, tu fila dice **Avisos: Sí**.

## Si algo no va
- No llega el aviso de prueba: en la base, `avisos_registro` (última fila, `resultado` y `fallidos`) y `suscripciones_avisos` (`activa`, `motivo_baja`). Si pone `caducada`, desactiva y vuelve a activar en ese móvil.
- iPhone sin el botón tras instalar: estás en Safari, no en la app del icono (paso 5).
- Se pierde la sesión al entrar con Google en la app de iPhone: es lo esperado; entra con el código (paso 6).
