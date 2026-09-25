// Plantilla 2026/27 confirmada (docs/PLANTILLA_26-27.md) para la semilla de la plataforma.
// Solo identidad, fichas y rol. SIN niveles ni posiciones (D39). El nombre oficial
// se lee de data/personas.json. `visible` es el mote de la tabla de PLANTILLA_26-27.md;
// quien no tiene mote lleva su nombre de pila. "Julio", "Luis" y "Carlos (entrenador)",
// confirmados por Ivan el 26/09/2026.
// Los gestores pueden cambiar el nombre visible desde la zona de gestion.

export const PLANTILLA_2026_27 = [
  { person_id: 'banos-gallego-carlos',              visible: 'Carlos',         mda: true,  mdl: true,  rol: 'jugador' },
  { person_id: 'calahorro-sanchez-manuel',          visible: 'Manu',           mda: true,  mdl: true,  rol: 'jugador' },
  { person_id: 'de-carvalho-rodrigues-julio-cesar', visible: 'Julio',          mda: true,  mdl: true,  rol: 'jugador' },
  { person_id: 'de-maria-sanchez-jaime',            visible: 'Jaime',          mda: true,  mdl: true,  rol: 'jugador' },
  { person_id: 'esteban-jon',                       visible: 'Jon',            mda: true,  mdl: true,  rol: 'jugador' },
  { person_id: 'galan-domingo-guillermo',           visible: 'Guillermo',      mda: true,  mdl: false, rol: 'jugador' },
  { person_id: 'garcia-gijon-eduardo',              visible: 'Eduardo',        mda: true,  mdl: true,  rol: 'jugador' },
  { person_id: 'gianatti-adriano',                  visible: 'Adriano',        mda: true,  mdl: true,  rol: 'jugador' },
  { person_id: 'jorba-lopez-sergi',                 visible: 'Sergi',          mda: true,  mdl: true,  rol: 'jugador' },
  { person_id: 'lopez-lucero-alfredo-david',        visible: 'David',          mda: true,  mdl: true,  rol: 'jugador' },
  { person_id: 'martinez-martinez-andres',          visible: 'Andrés',         mda: true,  mdl: true,  rol: 'jugador' },
  { person_id: 'martinez-martinez-victor',          visible: 'Victor',         mda: true,  mdl: true,  rol: 'jugador' },
  { person_id: 'martin-ortega-rico-eduardo',        visible: 'Edu',            mda: true,  mdl: true,  rol: 'jugador' },
  { person_id: 'mendez-escandon-fernando',          visible: 'Fernando M.',    mda: true,  mdl: true,  rol: 'solo_entreno' },
  { person_id: 'mileo-ignacio-agustin',             visible: 'Nacho',          mda: true,  mdl: true,  rol: 'jugador' },
  { person_id: 'perez-nunez-victor',                visible: 'Wall',           mda: true,  mdl: true,  rol: 'jugador' },
  { person_id: 'romero-barrueco-alonso',            visible: 'Alonso',         mda: true,  mdl: true,  rol: 'jugador' },
  { person_id: 'santos-artiles-enyel-geuris',       visible: 'Enyel',          mda: true,  mdl: true,  rol: 'jugador' },
  { person_id: 'tejeiro-perez-de-agreda-fernando',  visible: 'Fernando T.',    mda: true,  mdl: true,  rol: 'jugador' },
  { person_id: 'teruel-fernandez-tomas',            visible: 'Tomás',          mda: true,  mdl: true,  rol: 'jugador' },
  { person_id: 'vallesi-daniele',                   visible: 'Daniele',        mda: true,  mdl: true,  rol: 'jugador' },
  { person_id: 'varas-garcia-luis-alberto',         visible: 'Luis',           mda: true,  mdl: false, rol: 'jugador' },
  { person_id: 'villa-guerrero-edwin',              visible: 'Edwin',          mda: true,  mdl: true,  rol: 'jugador' },
  { person_id: 'villaescusa-silva-ivan',            visible: 'Iván',           mda: true,  mdl: true,  rol: 'jugador' },
  // Entrenador y delegado de los dos equipos (no figura en las hojas como deportista).
  { person_id: 'barreiro-carballal-carlos-jose',    visible: 'Carlos (entrenador)', mda: false, mdl: false, rol: 'entrenador' },
];

export const CAMPANA_INICIAL = {
  nombre: 'Ropa 2026/27',
  // Referencia 24/25 (orientativa, "por confirmar"): camiseta, pantalon y cubre ~14 €; sudadera ~25 €.
  precios: { camiseta: 14, pantalon: 14, cubre: 14, sudadera: 25 },
  // Guia de tallas: pagina propia con las tablas de medidas de VIVE.
  guia: '/guia-tallas',
};
