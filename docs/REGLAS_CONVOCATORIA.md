# Reglas de convocatoria — versión 0

_25/09/2026. Dictadas por Iván. **Sólo documentadas: no hay nada construido.** Se validan con las jornadas 1 y 2 (4/10 y siguiente), que Iván convoca con ayuda del chat de diseño aplicando estas reglas a mano (D40). La convocatoria nueva se estrena en la jornada 3 (D34)._

> **Privacidad.** Este documento no lleva nombres de jugadores ni niveles. Los datos por jugador (posición, si es base secundario, nivel A/B/C, si puede doblar, si entrena) los guarda Iván en `privado/`, que está fuera de git (`.gitignore`). **Nunca** entran en el repositorio ni se copian a `data/`. Los niveles son confidenciales: sólo acceden Iván, Carlos Barreiro y Eduardo Martín-Ortega (D39).

> **Actualizado el 26/09/2026** (bloque "Plataforma v0"): tamaño de la convocatoria, quién solo entrena, bases, interiores y exteriores, suelo por equipo y doblaje. El motor se construye por fases (D48): en la J3 solo estas restricciones duras; nivel y rotación entre la J4 y la J6.

## 1. Límites duros

1. **Máximo 10 por equipo por defecto.** Más de 10 solo si ese fin de semana hay **más de 20 disponibles**, y nunca más de **12** (tope de la ficha de partido).
2. **Con 20 o más disponibles, los que solo entrenan no van convocados.**
3. **Suelo por equipo: 7 jugadores. Ideal: 10.**
4. **Doblaje (D33):** un jugador solo juega con el MdA y el MdL el mismo domingo si **los horarios no se solapan** y **puede doblar** (dato privado). Qué margen cuenta como "no solapar" sigue por fijar (pregunta 7).
5. **Hay jugadores con ficha en un solo equipo** (en 26/27, dos solo tienen ficha del MdA). Solo pueden ir convocados con ese equipo.
6. **Sancionados (D51):** un jugador marcado "sancionado hasta la jornada X" no se convoca.

## 2. Posiciones (en cada equipo convocado)

- **Bases, por orden de preferencia:** 2 bases puros > 1 puro + 1 de reserva > 2 de reserva. Lo último es **excepcional y lleva aviso** al gestor.
  - "Base de reserva" = exterior capaz de subir el balón (el antiguo "base secundario"). Si hace de base, cuenta como base, no como exterior.
- **Interiores** (pívots y ala-pívots, intercambiables): **mínimo 3, ideal 4**.
- **Exteriores** (escoltas y aleros, intercambiables): **ideal 4**; si faltan, **los bases cuentan como exteriores**.
- Fuera de esa excepción, los bases no cambian de posición (regla v0).

## Datos por jugador

Posición, si es base de reserva, nivel, si puede doblar y si entrena están en **`privado/`** y **nunca entran en git** (D39). En la plataforma vivirán solo en la zona de gestión y nunca se enseñan a los jugadores (D46).

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
6. ~~(De la regla 2) ¿Se confirma la interpretación de los bases secundarios?~~ **Resuelta (26/09/2026):** orden de preferencia de bases en el apartado 2.
7. (De D33) ¿Cuántos minutos de margen hacen falta entre los dos partidos de un mismo domingo para poder doblar?

## Qué datos harán falta para automatizarlo (cuando toque)

| Dato | De dónde | ¿Público? |
|---|---|---|
| Calendario con hora y pista | Datos abiertos 211549 o calendario manual (`data/calendario_2026-27.json`) | Sí |
| Fichas de cada jugador (MdA, MdL o ambas) | Hojas de inscripción (`data/fichas_inscripcion.json`, `plantilla` de `season_2026-27.json`) | Sí |
| Partidos jugados y doblajes por jugador | Estadísticas (`data/season_2026-27.json`) | Sí |
| Disponibilidad de la semana | La plataforma, desde la J2 ("Mi semana", D44) | Los jugadores ven quién va, no va o no ha contestado (D46) |
| Asistencia a entrenamientos | SportEasy (export del balance) | Ya se publica agregada |
| Posición, base secundario, nivel, puede doblar, entrena | `privado/` (Iván) | **No. Nunca en git.** |
| Dificultad de cada rival | Propuesta desde Rivales 26/27, corregida por Iván | Por decidir (la propuesta sí; la corrección, de gestión) |
