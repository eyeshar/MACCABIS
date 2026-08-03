# DECISIONS — Proyecto Maccabis

> Decisiones tomadas y su porqué. Para no re-discutir lo ya cerrado y entender el razonamiento.

## D1 — Plataforma con login real (Supabase), no web estática con contraseña
**Decisión:** montar una plataforma Next.js + Supabase con autenticación real y RLS.
**Por qué:** la zona de gestión contendrá información sensible de verdad (tesorería, datos personales, decisiones sobre personas). Una web estática pública (GitHub Pages) no puede guardar secretos: una contraseña en el código JS es un "cartel de no pasar", no una cerradura. Para datos reales hace falta control de acceso de servidor (RLS). Iván eligió esta opción (Opción 2) conscientemente.

## D2 — Reutilizamos la METODOLOGÍA de TCPC, no su STACK completo por defecto
**Decisión:** heredar el flujo de trabajo de Tres Cantos (prompts consolidados, docs de continuidad, Claude Code autónomo, ser crítico, staging antes de prod), y usar su stack (Next.js+Supabase+Vercel) SOLO porque ahora el login lo justifica.
**Por qué:** TCPC usa ese stack por tener 140 jugadores, menores, RLS compleja y APIs de federación en vivo. Maccabis es mucho más pequeño (~24 adultos, sin menores, sin datos en vivo). El stack se adopta por la necesidad de login/gestión, no por imitación. Si esto fuera solo estadísticas, la web estática habría bastado.

## D3 — Sin capa de privacidad de menores
**Decisión:** no replicar la protección de menores de TCPC.
**Por qué:** todos los jugadores de Maccabis son adultos. PERO sí hay datos personales sensibles de adultos (DNIs, teléfonos, nacimiento, tesorería) → van en zona protegida, nunca en la pública.

## D4 — Relación con SportEasy: puente por Excel (Opción A "realista")
**Decisión:** la plataforma "bebe" de SportEasy vía exportación manual a Excel (subir archivo), no en tiempo real. Genera mensajes de WhatsApp y archivos de importación para SportEasy listos para copiar/pegar, pero no envía ni sincroniza sola.
**Por qué:** SportEasy NO tiene API pública (ver SPORTEASY.md). Prometer sincronía en vivo sería engañar. El export/import de Excel es lo que su sistema permite y es estable. Aun así, Iván quiere PRESIONAR por vías alternativas de sacar/subir datos antes de dar Excel por definitivo. Excel es el plan B confirmado si no aparece nada mejor.

## D5 — WhatsApp y SportEasy se mantienen; la plataforma sustituye a los Excel
**Decisión:** no crear una "cuarta herramienta" que competir con las existentes. WhatsApp (día a día) y SportEasy (registro oficial) siguen. La plataforma reemplaza el trabajo manual en Excel y se convierte en el centro de mando.
**Por qué:** si la plataforma no se integrara en el ecosistema, Iván tendría MÁS herramientas que gestionar, no menos. El valor está en matar el Excel manual, no en añadir otra cosa.

## D6 — Orden de construcción: lo público primero, convocatorias al final
**Decisión:** construir en este orden: (1) zona pública estadísticas → (2) histórico del club → (3) login + zona de gestión → (4) convocatorias.
**Por qué:** las convocatorias son el mayor dolor PERO lo menos urgente (la liga empieza en octubre). Empezar por lo público (casi listo) da una victoria rápida, enseña a Iván a trabajar con Claude Code en este stack, y permite diseñar la gestión con pantallas reales delante en vez de en abstracto. Iván reconoce que aún no tiene claridad sobre la zona de gestión; construir lo claro primero da esa claridad.

## D7 — Integrar histórico de temporadas anteriores
**Decisión:** integrar las estadísticas de Carlos (23/24, 24/25, ambos equipos) como temporadas históricas en el modelo de estadísticas, y crear una sección visual "Historia de los Maccabis" (2013-2026) aparte.
**Por qué:** hay material valioso. PERO los formatos de Carlos NO son homogéneos entre temporadas ni entre equipos (los .xlsx de MdA y los .xls de MdL tienen estructuras distintas, con hojas separadas de Puntos/Faltas/Triples/etc.). Requiere normalización cuidadosa temporada por temporada. (Pendiente de decidir si el histórico de Carlos entra en el mismo dashboard con el selector de temporadas o va aparte — se decidirá al construirlo.)
