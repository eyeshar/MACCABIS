# ESTADO — Proyecto Maccabis

> Foto de qué está hecho HOY. Se actualiza en cada sesión.

_Última actualización: cierre de la conversación inicial de diseño (chat de arranque)._

## Hecho y funcionando

### Dashboard de estadísticas 25/26 (v1, web estática)
- **Publicado y en vivo** en GitHub Pages: `https://eyeshar.github.io/MACCABIS/`
- Repositorio GitHub: `eyeshar/MACCABIS` (público).
- Arquitectura actual: web estática de un solo archivo (`index.html`) que carga datos por `fetch` desde `data/`. Estructura multitemporada ya preparada (selector de temporada, `data/index.json` + `data/season_2025-26.json`).
- **Esta v1 será migrada** al nuevo stack (Next.js+Supabase) como zona pública. La web estática fue el punto de partida; el proyecto real es la plataforma.

### Datos procesados y verificados de la temporada 25/26
- **42 actas PDF** de la FBM procesadas (MdA 22 partidos = 20 liga + 2 playoff; MdL 20 = 19 + 1 incomparecencia 0-0 sin stats).
- **41 hojas de estadística** oficiales (App Afición FBM) procesadas y **verificadas contra el marcador de cada acta** (la suma de puntos por jugador cuadra con el tanteo). MdA 20 hojas, MdL 19 (falta la del 0-0 por incomparecencia, que no genera hoja).
- **24 jugadores** reales consolidados (plantilla combinada MdA+MdL).
- Parciales por cuarto extraídos de las 42 actas y verificados (suma = marcador), 42/42 OK.
- Datos de asistencia (partidos y entrenamientos) de SportEasy vinculados por jugador.

### Contenido del dashboard v1 (pestañas)
Equipo (balance, racha, tabla de partidos con boxscore desplegable al clic) · Jugadores (ranking ordenable por columna) · Ficha de jugador (tarjetas, desglose de tiro, partido a partido con DNP) · Rankings (Top 5/10 de cada métrica) · Por cuartos (rendimiento del equipo por periodo) · Asistencia (partidos y entrenamientos) · Comparativa (radar jugador vs jugador, vs media, evolución — con Chart.js) · Gestión (zona privada con contraseña — SOLO placeholder, notas en localStorage; se reemplazará por la zona de gestión real con login).

## En curso / decidido pero no empezado

- **Migración al stack Next.js + Supabase + Vercel.** Arquitectura aprobada. No iniciada.
- **Orden acordado:** (1) zona pública (estadísticas + histórico) primero; (2) histórico del club; (3) login + zona de gestión; (4) convocatorias (esperan a octubre, inicio de liga — lo menos urgente).

## Reglas de negocio ya establecidas (de las estadísticas)

- Columnas siempre a cero se descartan (rebotes, asistencias, robos, pérdidas, tapones, faltas recibidas). La liga solo registra: puntos, tiros de 2, de 3, tiros libres, faltas cometidas (FC), valoración (VAL), +/−.
- Las medias se calculan SOLO sobre partidos con minutos jugados. Los DNP (0 minutos) cuentan como convocatoria/asistencia, pero NO entran en el denominador de las medias.
- Notación de las actas: canasta normal = 2 puntos; con círculo = triple (3); precedida de paréntesis = tiro libre (1). Formato "tanteo arrastrado".
- El entrenador **Carlos Barreiro** se excluye de las estadísticas de jugadores.
- Errata "DE CARVLHO" (acta partido 1 MdL) fusionada con "DE CARVALHO RODRIGUES, JULIO CESAR".
- Nombres display: completos y en formato Título (Nombre + Apellidos). Mapa de nombres coloquiales (SportEasy) → formales (FBM) confirmado: Nacho Mileo=Ignacio Mileo, Manu Cala=Calahorro, Edu=Martín-Ortega Eduardo.

## Datos importantes de fiabilidad

- Los puntos por jugador NO se extraen de las actas PDF (formato "tanteo arrastrado" no fiable a ojo ni por parsing). Se usan las **hojas de estadística XLSX** de la app, que sí son limpias y verificables.
- Los parciales por cuarto SÍ se extraen bien del pie de las actas ("Tanteos: Cuarto n A:x B:y").
