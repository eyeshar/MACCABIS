# RUTINA A — Actas y estadísticas (procedimiento, 02/10/2026; reparto actas/hojas del 23/10/2026, D106; publicación automática del 24/10/2026, D66)

**Cuándo:** lunes (tras la jornada del domingo), con una segunda pasada el jueves para lo que llegue tarde.

**Reparto desde el 24/10/2026 (quién hace qué):**
| Quién | Qué | Cuándo |
|---|---|---|
| **Claude** (tarea programada «Maccabis · actas del lunes», en el Chrome de Iván) | Baja de gesdeportiva.fbm.es las **actas** que falten a Descargas | Lunes y jueves, 9:30 |
| **Iván** | Baja las **hojas de estadística** (las nuestras y las de liga) de la app **Afición FBM** del móvil y las deja en Descargas del PC | Domingo noche o lunes por la mañana |
| **`scripts/rutina_a_publicar.ps1`** (Programador de tareas de Windows, sin agentes) | Procesa (`npm run jornada -- --no-interactivo`) y, **si todo cuadra, publica solo** (D66); si no, para sin publicar nada | Lunes y jueves, 13:00 |

**Reparto de fuentes (D106, 23/10/2026):**
| Qué | De dónde | Cómo |
|---|---|---|
| **Actas** (`Acta-Partido-<nº>.pdf`, las de MdA y MdL) | Web **gesdeportiva.fbm.es/clubes** → Competiciones → Resultados y actas (una sola cuenta ve los dos equipos) | Iván inicia sesión en su Chrome (clave en el gestor de contraseñas); Claude descarga desde ahí con la extensión. Claude **nunca** maneja la clave ni resuelve el «no soy un robot»: si salen, para y avisa. |
| **Hojas de estadística** (las nuestras y las de toda la liga, D73) | App **Afición FBM** (la web no las ofrece, ni partidos de otros equipos) | Enlace Móvil de Windows con el S22 Ultra (D70), como hasta ahora. |
| Clasificación y listado completo de partidos (CSV) | La misma web | Pendiente de evaluar para la rutina B (contraste con la oficial, D74). |

Todo a **Descargas**, sin renombrar. Si en Descargas quedan hojas de jornadas anteriores, `npm run jornada` se ejecuta con `--desde` una carpeta que solo tenga los ficheros nuevos (así se hizo con la J2 y con las actas de J1 y J2 el 23/10).

## Actas: web gesdeportiva.fbm.es (D106)

1. Iván abre Chrome con la sesión de gesdeportiva.fbm.es/clubes iniciada (clave del gestor de contraseñas).
2. Claude: Competiciones → **Resultados y actas** → jornada → **acta** de cada partido de MdA y MdL (`Acta-Partido-<nº>.pdf`, a Descargas).
3. Si la web pide la clave o un «no soy un robot», Claude para y se lo dice a Iván.
4. Primera ejecución: 23/10/2026 (4 actas de J1 y J2, las 4 cuadran).
5. **Desde el 24/10/2026 lo hace una tarea programada de Claude**, «Maccabis · actas del lunes» (lunes y jueves a las 9:30 desde el 26/10/2026; antes 8:34): baja solo las actas que falten en Descargas. Necesita el Chrome de Iván abierto con la sesión iniciada.

## Publicación automática: `scripts/rutina_a_publicar.ps1` (D66, 24/10/2026)

Tarea **«\Maccabis\Rutina A - publicar jornada»** del Programador de tareas de Windows: lunes y jueves a las 13:00, solo con la sesión de Iván iniciada; si el PC estaba apagado a esa hora, se ejecuta al encenderlo. Ejecuta `scripts\rutina_a_publicar.ps1` de la **copia dedicada `C:\Users\Iván\Proyectos\Maccabis-rutina-a`** (directorio de trabajo de la tarea: esa misma carpeta), **nunca de la carpeta de trabajo** (D114). Es un script determinista: no usa agentes.

**La copia dedicada** (24/10/2026): un **clon aparte** del repositorio (no un worktree: un worktree no puede tener `main` mientras la carpeta del proyecto también lo tiene), **solo para publicar y siempre en `main`**. Nadie trabaja en ella. Lo que no está en git:
| Qué | Cómo | Por qué |
|---|---|---|
| `privado/` | **Enlazado** (unión de directorios) a `C:\Users\Iván\Proyectos\Maccabis\privado` | Un solo registro (`registro_rutina_a.log`) y una sola asistencia privada (la que lee `db:asistencia`) |
| `fuentes_fbm/` | **Enlazado** (unión de directorios) a `C:\Users\Iván\Proyectos\Maccabis\fuentes_fbm` | `npm run jornada` decide qué ficheros son nuevos mirando lo que ya hay ahí: con una copia aparte volvería a cargarlo todo |
| `plataforma/.env.local` | **Copiado** de la carpeta del proyecto | Un enlace de fichero pide permisos de administrador. Si cambian las claves, se borra en la copia y el script la vuelve a copiar |
| `node_modules` (raíz y `plataforma/`) | `npm ci` propio | |
El script crea lo que falte (enlaces, `.env.local`, `npm ci`) al empezar; todo está en `.gitignore` y nada sube a git.

0. **La copia:** para si se lanza desde otra carpeta que no sea `Maccabis-rutina-a`; **para y avisa si la copia tiene cambios locales** (no toca nada); `git checkout main` y `git pull --ff-only`; enlaza o copia lo que falte (tabla de arriba); `npm ci` si faltan los `node_modules` o si el pull ha cambiado un `package-lock.json`.
1. **main al día:** para si hay commits sin subir.
2. **`npm run jornada -- --no-interactivo`:** ante cualquier duda **para con código distinto de 0** en lugar de seguir: un nombre que no está en `personas.json`, una hoja que no es de la jornada, un acta que no cuadra con su hoja, un fichero que no se puede leer, una hoja de liga sin jornada, un partido nuestro **sin hoja** (aún no bajada de Afición FBM) o **sin acta** (la excepción D71 no se aplica sola). Antes de escribir genera en seco; si para, deshace las copias que hizo en `fuentes_fbm/`, para que la siguiente pasada vuelva a ver esos ficheros como nuevos. **Sin ficheros nuevos, sale sin hacer nada** («Nada nuevo»).
3. **Pruebas:** `test:regresion`, `test:liga`, `test:privacidad` y `check:copias`.
4. **Publica:** commit de `data/` y `plataforma/src/data/` con el mensaje «datos(2026-27): jornada N (automático)» y push a `main`.
5. **En `plataforma/`:** `npm run db:liga`, `npm run db:asistencia` y, tras 4 minutos para que Vercel despliegue (y un segundo intento si falla), `node pruebas/verificar_produccion.mjs`. Lo ya publicado no se deshace: un fallo aquí se avisa.

**Si falla antes del push no publica nada** y deja el repositorio como estaba (`git reset --hard` al commit de partida y limpieza de `data/` y `plataforma/src/data/`).

**Registro:** cada ejecución añade fecha, resultado (`PUBLICADA`, `NADA NUEVO`, `PARADA`, `PUBLICADA CON FALLOS`…) y resumen a `privado/registro_rutina_a.log` (fuera de git); si para, también las últimas líneas del paso que falló.

**Aviso:** notificación de Windows al terminar: «Jornada N publicada: MdA x–y Rival · Rival x–y MdL» (el local primero) o «Rutina A parada: <motivo>». Sin ficheros nuevos no avisa (queda en el registro).

**A mano:** desde `C:\Users\Iván\Proyectos\Maccabis-rutina-a`, `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\rutina_a_publicar.ps1` (de verdad) o con `-Dry` (en seco: no hace checkout ni pull, no enlaza, no copia ni escribe nada; la carpeta, la rama y los cambios locales solo se avisan). Probado en seco el 24/10/2026 sobre lo ya cargado: «Nada nuevo».

**Si para:** mirar el motivo en el aviso o en el registro, arreglar (bajar la hoja que falta, confirmar un nombre nuevo en `personas.json`…) y relanzar a mano o esperar a la pasada del jueves. Las dudas las resuelve una persona: el script nunca adivina.

## Hojas: app Afición FBM por Enlace Móvil (D70)

**Vía:** Enlace Móvil de Windows ("Aplicaciones"), con el Samsung S22 Ultra de Iván (D70, matiza D69). Claude abre Afición FBM del móvil en una ventana del PC y la maneja con el control del ordenador. Probado el 02/10/2026: la app carga y responde.

**Condición:** el móvil encendido, con wifi y cerca del PC (puede estar bloqueado).

## Procedimiento técnico (app)

1. Cerrar WhatsApp Desktop (y apps WebView2 como Teams u Outlook nuevo) si tapan la pantalla a Claude.
2. Abrir "Enlace Móvil"; si está maximizado, restaurarlo (doble clic en la barra de título) para que quede a la derecha.
3. Pestaña **Aplicaciones** → buscar **"FBM"** (con "aficion" no la encuentra) → Afición FBM.
4. La ventana de la app debe quedar en la **mitad derecha** del monitor principal: el tercio izquierdo queda tapado para Claude por una ventana de otro proceso.
5. En la app: menú ☰ → Inicio, Próximos Partidos, Buscador (Partidos / Equipos / Jugadores / Clubes), Mis Equipos (hoy solo "DRINK TEAM"). **El camino hasta el acta y la hoja de estadística lo enseña Iván en la sesión del lunes 5/10.**
6. **Pendiente de averiguar:** dónde guarda el móvil los ficheros descargados y cómo llegan al PC (el móvil aparece en el Explorador como "S22 Ultra de Ivan" vía Enlace a Windows), para que `npm run jornada` los recoja y publique si todo cuadra (D66).

## Reserva descartada por ahora: emulador Android (D69)

Play Store no deja instalar Afición FBM en emuladores ("This app won't work for your device", probado en Android 15 y Android 17 con traducción ARM). Copiarla desde el móvil con adb no fue posible: el cable USB de Iván solo carga, y la depuración inalámbrica falla en su red. Android Studio, el SDK y los dos móviles virtuales siguen instalados en F: por si se retoma con un cable de datos que sí transfiera.

## Aprendizaje

Lunes 5/10/2026: sesión de aprendizaje con las actas de la J1. Iván enseña el camino hasta el acta y la hoja de estadística dentro de Afición FBM; Claude lo registra aquí tras la sesión.

## Alcance desde la J2: todas las hojas de la jornada, de los dos grupos (D73, 06/10/2026)

Cada lunes, además de nuestras actas (web, D106) y hojas, se bajan **todas las hojas de estadística de la jornada de los dos grupos** (G1 y G2: 5 partidos por jornada y grupo, 10 en total; el equipo que descansa no tiene hoja). En la app: Buscador → Partidos → el partido de cada pareja → hoja de estadística. Las actas de los partidos ajenos **no** hacen falta. Todo a Descargas, sin renombrar.

`npm run jornada` hace el resto:
- Las hojas de partidos donde no jugamos van a `fuentes_fbm/2026-27/liga/` como `liga_J01_G1_<local>_vs_<visitante>_<hash>.xlsx` (copia segura, fuera de git). La jornada se infiere por fecha (la última ya jugada del grupo); si bajas hojas atrasadas, usa `npm run jornada -- --jornada N`.
- Regenera `data/liga_2026-27.json` (resultados, clasificación calculada y estadísticas por equipo) tras validar que la suma por jugador es el total de cada equipo. Si algo no cuadra, **no escribe nada** y avisa.
- Qué se publica: solo ese JSON (datos por equipo). Los datos por jugador de los rivales **no** se publican: se cargan a Supabase con `npm run db:liga` en `plataforma/` (rama `feat/plataforma-v0`), solo visibles para gestores (D73).
- **Si falta una hoja** (un partido sin descargar), el resumen avisa "faltan hojas" en esa jornada y la clasificación queda incompleta hasta que llegue.
- **Incomparecencias (D74):** no generan hoja (D29). Se anotan en `temporadas.json` (`liga.incomparecencias`: grupo, jornada, local, visitante, no_presentado); el partido se marca y los puntos del equipo que no se presentó se toman de la clasificación oficial de Deportes/web (la de los jueves, rutina B), en `liga.puntos_oficiales`. Hasta entonces, su casilla dice "pendiente de la oficial".
- Tras `npm run jornada`, para llevar los datos por jugador a Supabase: `npm run db:liga` en `plataforma/` (reemplaza la temporada entera).
- **Portada de la web y privacidad (D84, D82):** `npm run jornada`, si todo cuadra, comprueba que ningún JSON público lleve motivos de ausencia y sincroniza solo las copias de `plataforma/src/data/` (portada: resultados, clasificación, líderes). Publicar = commit de `data/` y de `plataforma/src/data/`. La asistencia con motivos queda en `privado/asistencia/asistencia_<temporada>.json` (fuera de git): cargarla en Supabase con `npm run db:asistencia` en `plataforma/` (solo gestores, cuando la tabla esté en real).
