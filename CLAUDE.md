# CLAUDE.md — Maccabis

Lo lee toda sesión de Claude Code. Contexto del proyecto: `docs/MEMORIA.md`, `docs/ESTADO.md`, `docs/DECISIONS.md` y
`docs/NORMAS_DE_TRABAJO.md` (normas de trabajo con Iván; esto no las sustituye).

## Pruebas por niveles (D149)

La batería completa ya no se pasa en local en cada bloque. **Nivel 1 en local, nivel 2 en GitHub Actions.**

### Nivel 1 — en local, en cada cambio (objetivo: menos de 3 minutos)

```
npm run pruebas:rapidas                 # desde la raíz o desde plataforma/
npm run pruebas:rapidas -- --lista      # solo dice qué pasaría y por qué
npm run pruebas:rapidas -- --suite pruebas:grupos   # añadir una a mano
```

Es **lo único que Code ejecuta y espera**. Compara la rama con `origin/main` (más lo no guardado) y elige solo:

- `typecheck` si cambia algo de `plataforma/`. (No hay lint en el proyecto.)
- **La lógica tocada:** la suite que importa directamente el fichero cambiado (`src/lib/…`, `src/components/…`,
  `scripts/…`) y la propia suite si la has tocado.
- **Pantallas, solo las tocadas:** de cada fichero de `src/` sigue los imports hasta las páginas de `src/app/` que lo usan
  y pasa las suites que visitan esas rutas (las rutas de cada suite salen de su código: `${APP}/gestion/eventos`…).
- **Estadísticas y liga** (`test:regresion`, `test:liga`, `test:privacidad`, `pruebas:liga`, y con `test:privacidad`
  siempre `pruebas:privacidad`): **solo** si el cambio toca datos (`data/`, `plataforma/src/data/`, `fuentes_fbm`), el
  pipeline (`scripts/`, `index.html`), las migraciones o las pantallas de estadísticas y liga (`/liga`, `/historia`,
  `/plantilla`, `/jugador`, `/mis-numeros`, `/gestion/liga`, `/gestion/scouting`).
- **Las `-real`** (solo lectura contra el Supabase real) **solo** si hay migración o cambio de permisos
  (`plataforma/supabase/`), y solo si hay `plataforma/.env.local`.

Si `--lista` elige algo que no encaja o se queda corto, añade con `--suite`. Si tocas la infraestructura de pruebas
(`plataforma/pruebas/infra/`, `pila.mjs`, `comun_e2e.mjs`), pasa `npm run pruebas:completas`.

### Si tocas X, pasa Y

| Si tocas… | Zona | Pasa (lo elige `pruebas:rapidas`) |
|---|---|---|
| Cualquier `.ts/.tsx` de `plataforma/` | plataforma | `typecheck` |
| `src/app/gestion/(panel)/eventos/…`, pistas, importar | plataforma | `pruebas:eventos-pantallas`, `pruebas:tablero`, `pruebas:numeros`, `pruebas:dudas`, `pruebas:ubicacion`, `pruebas:disponibilidad-pantallas`… (las que visitan `/gestion/eventos`) |
| `src/app/gestion/(panel)/convocatoria/…`, `src/lib/convocatoria/` | plataforma | `pruebas:convocatoria-pantallas`, `pruebas:convocatoria-motor`, `pruebas:proyeccion`, `pruebas:avisos-logica`, `pruebas:numeros`… |
| `src/app/gestion/(panel)/tablero`, `grupos`, `src/lib/grupos/` | plataforma | `pruebas:tablero`, `pruebas:grupos`, `pruebas:safe-area`, `pruebas:disponibilidad-pantallas` |
| `src/app/mi-zona/…`, `agenda`, `src/components/inicio/`, respuestas | plataforma | `pruebas:respuestas-pantallas`, `pruebas:inicio-personal`, `pruebas:domingo`, `pruebas:dudas`… |
| `src/app/entrar`, `cuenta`, `auth`, la navegación (`src/components/nav/`) | plataforma | `pruebas`, `pruebas:navegacion` (y las que entran con código) |
| `src/app/page.tsx`, `layout.tsx`, `globals.css` (raíz) | plataforma | `pruebas:portada`, `pruebas:navegacion` (+ las que usen lo tocado) |
| `src/app/asistente`, `api/chat`, `src/lib/chat/` | plataforma | `pruebas:chat-ia` |
| `src/lib/avisos/`, `api/avisos`, avisos | plataforma | `pruebas:avisos-logica`, `pruebas:respuestas-pantallas`, `pruebas:dudas`… |
| `src/app/liga…`, `historia`, `plantilla`, `jugador`, `gestion/liga`, `gestion/scouting`, `src/components/liga/` | **estadísticas** | sus suites web (`pruebas:pantallas`, `pruebas:liga-partidos`, `pruebas:cuadre`, `pruebas:privacidad`…) **+** `test:regresion`, `test:liga`, `test:privacidad`, `pruebas:liga` |
| `data/`, `scripts/` (raíz), `index.html`, `plataforma/src/data/` | **estadísticas** | las comprobaciones de la raíz (`check:*`, `test:*`) + `pruebas:liga` |
| `plataforma/supabase/migrations/` (o permisos) | las dos | todas las de la pila local (`pruebas:eventos`, `pruebas:planes`, `pruebas:convocatoria-rls`…) + estadísticas + las `-real` |
| Una suite de `plataforma/pruebas/` | — | esa suite |
| Solo `docs/` | — | nada |

### Nivel 2 — GitHub Actions (`.github/workflows/pruebas.yml`)

- **La batería completa se ejecuta sola al subir (push) cualquier rama que no sea `main`**, repartida en 4 grupos en
  paralelo. **Code no la espera.** En `main` no se ejecuta (ya se probó en la rama).
- **Antes de mergear**, Code comprueba que la última ejecución de esa rama, para su último commit, está en verde:
  `npm run ci:estado` (usa `gh` con el token que ya guarda Git; `-- --esperar` espera a que acabe). **Si está en rojo,
  se arregla en la rama** y se vuelve a subir. Iván lo ve también en GitHub → Actions.
- En local, lo mismo que Actions: `npm run pruebas:completas` (`-- --grupo k/4` para un grupo; `-- --locales` añade
  las de solo local).

### Solo en local, antes del merge cuando el cambio las toque

No van a Actions porque necesitan claves de Supabase o datos que no están en git (el repositorio es público):

| Suite | Por qué |
|---|---|
| `test:regresion` | lee `.cache-jdm/` y `data/raw/` (fuera de git) |
| `test:liga` | lee las hojas de `fuentes_fbm/` (fuera de git) |
| `pruebas:eventos-real`, `pruebas:respuestas-real`, `pruebas:convocatoria-real`, `pruebas:inicio-real` | solo lectura contra el Supabase real: claves de `plataforma/.env.local` |
| `pruebas:solo-ficha-real` | ídem, y la foto previa de `privado/backups/` (prueba de la migración de D148) |

`pruebas:rapidas` las incluye cuando toca (estadísticas o migraciones). Las de `verificar_*` (producción, vista previa)
siguen siendo manuales.

### Reglas de las pruebas

- **Privacidad en Actions:** los registros son públicos. Ninguna prueba puede imprimir niveles, notas, posiciones, DNIs,
  tesorería ni nada de `privado/` o de `jugadores_privado`. En Actions no hay `privado/` ni `.env.local`: la pila local se
  llena con `data/` (público) y jugadores sintéticos (`sint-…`). Un FALLO dice qué y dónde, no el dato
  (`privacidad_paginas.mjs` oculta el valor si `CI`). Sin capturas (`CI` las desactiva) ni artefactos.
- **Coste cero:** solo `ubuntu-latest` (nunca servidores grandes ni de pago), `concurrency` por rama con
  `cancel-in-progress` y `timeout-minutes`. **Es gratis porque el repositorio es público**; si algún día pasa a privado,
  hay que revisarlo antes (gastaría la bolsa de minutos de la cuenta, que comparte Web TCPC). No tocar `salud-avisos.yml`.
- **Sin esperas fijas** (`waitForTimeout`): tras un clic que guarda, `trasAccion(p, () => …click())`; para algo de la
  interfaz, `hasta(() => condición)` (`plataforma/pruebas/infra/esperas.mjs`).
- **Capturas:** solo si se pide (`PRUEBAS_CAPTURAS=1`, o una suite suelta con `npm run pruebas:<suite>`; en las tandas,
  `-- --capturas`).
- **No se borra ni se desactiva una prueba** sin decirlo en el resumen del bloque, con el motivo.

## Puertos y procesos de las pruebas

- Cada worktree tiene **su bloque de 100 puertos en 41000-48999** (derivado de su carpeta; `npm run pruebas:completas --
  --lista` lo dice). Lejos de Web TCPC (3000-3500, 4173, 5432) y de Supabase local (54321…). Dos worktrees pasan pruebas a
  la vez sin chocar. `PRUEBAS_PUERTO_BASE=45000` fija otro bloque; `PRUEBAS_PUERTO_APP` cambia solo el de la app.
  (`PILA_PUERTO_BASE` ya no existe.)
- **Si un puerto está ocupado, la prueba se para al momento:** «PUERTO OCUPADO: puerto X ocupado por otro proceso (PID,
  programa)». Nunca prueba contra lo que esté escuchando ahí. Si es de otro proyecto o de otra sesión, **no lo cierres**:
  usa otro bloque.
- **Al terminar no queda nada encendido**, tampoco si falla, con Ctrl+C o si la matan de golpe (un vigía aparte lo
  limpia). Si aun así queda algo de ESTE worktree: `npm run pruebas:limpiar` (solo toca lo suyo).

## Worktrees (una sesión, un worktree; norma 11)

**Preparar uno nuevo** (desde la carpeta principal, que se queda en `main`):

```
git fetch
git worktree add ../Maccabis-<tema> -b <rama> origin/main
cd ../Maccabis-<tema>
npm ci                      # instalación PROPIA, raíz
cd plataforma && npm ci     # instalación PROPIA, plataforma (no enlazar node_modules: un enlace rompe `next build`)
```

Y copiar lo que no está en git (si falta, algunas pruebas fallan sin que el código tenga la culpa):
`plataforma/.env.local`, `privado/` **sin `backups/` ni `tmp/`** (`robocopy <origen> <destino> /E /XD backups tmp`),
`fuentes_fbm/` al día, `.cache-jdm/`, `data/raw/` y `plataforma/pruebas/.bin/` (PostgREST; si no está, se descarga).
`next-env.d.ts` lo crea `pruebas:rapidas` si falta.

**Cerrarlo:** primero quitar los enlaces que haya (junction o symlink a la carpeta principal: `privado/`, `node_modules`…)
**sin seguirlos** — en PowerShell `(Get-Item <enlace>).Delete()`, o `cmd /c rmdir <enlace>` —, nunca `Remove-Item
-Recurse` ni `rm -rf` sobre un enlace (borraría el original). Después `git worktree remove ../Maccabis-<tema>` (con
`--force` solo si lo que queda son copias ignoradas que ya no hacen falta) y `git branch -d <rama>` si ya está mergeada.

## Decisiones (DECISIONS.md) con sesiones en paralelo

Antes de numerar una decisión nueva: `git fetch` y mirar `main` **y las ramas remotas abiertas**
(`git branch -r`, `git log origin/<rama> -- docs/DECISIONS.md`). Se toma el siguiente número libre entre todas. Al
mergear, si otra rama ya usó ese número, se renumera la tuya (y sus referencias en ESTADO, BACKLOG y el código).
