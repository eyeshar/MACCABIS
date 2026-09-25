# Reglas de convocatoria — versión 0

_25/09/2026. Dictadas por Iván. **Sólo documentadas: no hay nada construido.** Se validan con las jornadas 1 y 2 (4/10 y siguiente), que Iván convoca con ayuda del chat de diseño aplicando estas reglas a mano (D40). La convocatoria nueva se estrena en la jornada 3 (D34)._

> **Privacidad.** Este documento no lleva nombres de jugadores ni niveles. Los datos por jugador (posición, si es base secundario, nivel A/B/C, si puede doblar, si entrena) los guarda Iván en `privado/`, que está fuera de git (`.gitignore`). **Nunca** entran en el repositorio ni se copian a `data/`. Los niveles son confidenciales: sólo acceden Iván, Carlos Barreiro y Eduardo Martín-Ortega (D39).

## 1. Límites duros

1. **Máximo 12 jugadores por partido.**
2. **Doble ficha (D33):** un jugador puede jugar con el MdA y con el MdL el mismo domingo **sólo si los horarios no se solapan**. Qué margen cuenta como "no solapar" (duración de un partido, cambio de pista) está por fijar; el calendario ya calcula los minutos entre los dos partidos de cada domingo.
3. **Hay jugadores con ficha en un solo equipo** (en 26/27, dos jugadores sólo tienen ficha del MdA). Sólo pueden ir convocados con ese equipo.

## 2. Mínimos por posición (en cada equipo convocado)

- **2 bases, 4 exteriores y 4 interiores** como mínimo.
- **Exteriores** = escoltas y aleros: intercambiables entre sí.
- **Interiores** = pívots y ala-pívots: intercambiables entre sí.
- **Los bases no cambian de posición.**
- **Bases secundarios:** exteriores capaces de subir el balón.
  - _Interpretación pendiente de confirmar por Iván:_ cada equipo necesita **al menos 1 base puro**, y el segundo base puede ser puro o secundario. Un secundario que hace de base **cuenta como base, no como exterior** (no computa dos veces).

## 3. Niveles y dificultad

- **Niveles de jugador:** A (titular) / B / C. Confidenciales (ver arriba).
- **Dificultad del rival:** alta / media / baja. La plataforma la **propone** a partir del histórico de rivales (pestaña Rivales 26/27: trayectoria, balance en pista y cara a cara) e **Iván la corrige**.
- **Más jugadores A en el partido más difícil** del domingo.

## 4. Rotación

- **Prioridad a quien menos ha jugado.**
- **Quien sólo entrena** entra sólo para **cubrir un hueco de posición**.
- **Doblajes sólo para cubrir mínimos**, empezando por **quien menos ha doblado**, y sólo entre quienes **pueden doblar**.

## 5. Quién decide

- **Iván decide siempre.** La plataforma propone y él ajusta.
- **Cada ajuste se anota con su motivo**, para afinar las reglas con el tiempo (qué regla se quedó corta, qué faltaba).

## 6. Preguntas abiertas (las responde Iván)

1. ¿Cuántos jugadores A según la dificultad del rival (alta / media / baja)?
2. ¿Qué prioridad hay entre el MdA (G1) y el MdL (G2) cuando no se llega a todo?
3. ¿Qué significa exactamente "quien no ha jugado esa semana"? (¿partidos del domingo anterior?, ¿ninguno de los dos equipos?)
4. A igual nivel, ¿quien no entrena va por detrás de quien entrena?
5. Cuando no se llega a los mínimos, ¿qué se sacrifica primero? (¿el máximo de doblajes, un mínimo de posición, el reparto de niveles?)
6. (De la regla 2) ¿Se confirma la interpretación de los bases secundarios?
7. (De D33) ¿Cuántos minutos de margen hacen falta entre los dos partidos de un mismo domingo para poder doblar?

## Qué datos harán falta para automatizarlo (cuando toque)

| Dato | De dónde | ¿Público? |
|---|---|---|
| Calendario con hora y pista | Datos abiertos 211549 o calendario manual (`data/calendario_2026-27.json`) | Sí |
| Fichas de cada jugador (MdA, MdL o ambas) | Hojas de inscripción (`data/fichas_inscripcion.json`, `plantilla` de `season_2026-27.json`) | Sí |
| Partidos jugados y doblajes por jugador | Estadísticas (`data/season_2026-27.json`) | Sí |
| Disponibilidad de la semana | SportEasy (export, si trae eventos futuros) o función propia (ver BACKLOG) | No: gestión |
| Asistencia a entrenamientos | SportEasy (export del balance) | Ya se publica agregada |
| Posición, base secundario, nivel, puede doblar, entrena | `privado/` (Iván) | **No. Nunca en git.** |
| Dificultad de cada rival | Propuesta desde Rivales 26/27, corregida por Iván | Por decidir (la propuesta sí; la corrección, de gestión) |
