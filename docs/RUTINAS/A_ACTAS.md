# RUTINA A — Actas y estadísticas (procedimiento, 02/10/2026)

**Cuándo:** lunes por la mañana (tras la jornada del domingo).

**Vía:** Enlace Móvil de Windows ("Aplicaciones"), con el Samsung S22 Ultra de Iván (D70, matiza D69). Claude abre Afición FBM del móvil en una ventana del PC y la maneja con el control del ordenador. Probado el 02/10/2026: la app carga y responde.

**Condición:** el móvil encendido, con wifi y cerca del PC (puede estar bloqueado).

## Procedimiento técnico

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

Cada lunes, además de nuestras actas y hojas, se bajan **todas las hojas de estadística de la jornada de los dos grupos** (G1 y G2: 5 partidos por jornada y grupo, 10 en total; el equipo que descansa no tiene hoja). En la app: Buscador → Partidos → el partido de cada pareja → hoja de estadística. Las actas de los partidos ajenos **no** hacen falta. Todo a Descargas, sin renombrar.

`npm run jornada` hace el resto:
- Las hojas de partidos donde no jugamos van a `fuentes_fbm/2026-27/liga/` como `liga_J01_G1_<local>_vs_<visitante>_<hash>.xlsx` (copia segura, fuera de git). La jornada se infiere por fecha (la última ya jugada del grupo); si bajas hojas atrasadas, usa `npm run jornada -- --jornada N`.
- Regenera `data/liga_2026-27.json` (resultados, clasificación calculada y estadísticas por equipo) tras validar que la suma por jugador es el total de cada equipo. Si algo no cuadra, **no escribe nada** y avisa.
- Qué se publica: solo ese JSON (datos por equipo). Los datos por jugador de los rivales **no** se publican: se cargan a Supabase con `npm run db:liga` en `plataforma/` (rama `feat/plataforma-v0`), solo visibles para gestores (D73).
- **Si falta una hoja** (un partido sin descargar), el resumen avisa "faltan hojas" en esa jornada y la clasificación queda incompleta hasta que llegue.
- **Incomparecencias (D74):** no generan hoja (D29). Se anotan en `temporadas.json` (`liga.incomparecencias`: grupo, jornada, local, visitante, no_presentado); el partido se marca y los puntos del equipo que no se presentó se toman de la clasificación oficial de Deportes/web (la de los jueves, rutina B), en `liga.puntos_oficiales`. Hasta entonces, su casilla dice "pendiente de la oficial".
- Tras `npm run jornada`, para llevar los datos por jugador a Supabase: `npm run db:liga` en `plataforma/` (reemplaza la temporada entera).
- **Portada de la web (D76):** tras `npm run jornada`, `npm run datos:sync` en `plataforma/` y commit de `plataforma/src/data/`: así la portada de `maccabis.vercel.app` muestra los resultados, la clasificación y los líderes nuevos al desplegar. Las pruebas de la plataforma fallan si se olvida.
