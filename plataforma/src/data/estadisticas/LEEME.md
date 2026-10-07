# Copia generada: no se edita a mano

Estos ficheros son copias exactas de `data/` (`season_*.json`, `index.json`, `rivales_2026-27_web.json`), que alimentan
GitHub Pages y esta web. La plataforma se despliega con `plataforma/` como raíz y no puede importar `../data`.

- Se regeneran con `npm run datos:sync` (en `plataforma/`), que ya forma parte de `npm run jornada` y de `npm run build:datos`.
- `npm run check:copias` (raíz) y `npm run pruebas:cuadre` fallan si alguna difiere de su fuente.
- Cambia siempre el original en `data/` (o el script que lo genera) y vuelve a sincronizar.
