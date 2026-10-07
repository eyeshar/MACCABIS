# Último paso: activar redirecciones y retirar la barra de GitHub Pages

Solo cuando Iván dé el OK final (Liga, Plantilla, Ficha e Historia ya están en la web nueva, D91-D93).

## Activar (un solo commit)
```
node scripts/activar_redirecciones.js              # enseña qué cambiaría
node scripts/activar_redirecciones.js --aplicar    # lo aplica
git add data/redireccion_web.js index.html
git commit -m "feat: activar redirecciones de GitHub Pages a la web nueva (retira la barra)"
git push origin main                               # GitHub Pages se republica con el merge a main
```
Qué hace: `data/redireccion_web.js` pasa a `ESTA_ACTIVA = true` (cada pestaña, `?t=`, `#2013-14`, `?j=` y `?p=` salta a su página en maccabis.vercel.app) y se quita de `index.html` la barra «← Volver a Maccabis» (CSS, marcado y script). Nada más.

## Revertir (un solo commit)
```
git revert <commit de la activación>
git push origin main
```
GitHub Pages queda como antes: con su barra y sin redirigir.

## Comprobar
- Antes: `npm run pruebas:activacion` (sobre una copia: aplica, comprueba que index.html sigue siendo válido y que cada URL antigua salta a su página).
- Después: `npm run pruebas:navegacion` y `node plataforma/pruebas/verificar_produccion.mjs` omiten solos las pruebas de la barra de GitHub Pages; `npm run pruebas:cuadre` sigue comparando con la web anterior (desactiva la redirección en su navegador).
- La web nueva ya no enlaza a GitHub Pages desde la cabecera, el pie, `/club` ni la portada. Queda el aviso del fichero `plataforma/src/lib/web.ts` (`URL_ESTADISTICAS`), que ya solo lo usa la función `estadisticas()` sin llamadas.
