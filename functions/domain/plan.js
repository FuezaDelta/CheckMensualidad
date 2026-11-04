// Archivo generado por scripts/build.mjs — no editar a mano.
// Copia de js/domain/plan.js

/**
 * Modelo y reglas de negocio de un plan de membresía.
 */

/**
 * @typedef {object} Plan
 * @property {string} nombre
 * @property {number|null} precio
 * @property {number} duracionDias
 */

/**
 * @param {string} id Identificador del documento, usado como nombre de respaldo.
 * @param {Record<string, unknown>} datos
 * @returns {Plan}
 */
export function crearPlan(id, datos) {
  const precioCrudo = Number(datos?.precio);
  const duracionCruda = Number(datos?.duracionDias);

  return {
    nombre: typeof datos?.nombre === "string" && datos.nombre.trim() ? datos.nombre.trim() : id,
    precio: Number.isFinite(precioCrudo) ? precioCrudo : null,
    duracionDias: Number.isFinite(duracionCruda) ? duracionCruda : 0,
  };
}

/**
 * Del plan más corto al más largo, que es como el cliente espera compararlos.
 *
 * @param {Plan[]} planes
 * @returns {Plan[]} Un arreglo nuevo; no muta la entrada.
 */
export function ordenarPlanes(planes) {
  return [...planes].sort(
    (a, b) => a.duracionDias - b.duracionDias || a.nombre.localeCompare(b.nombre, "es")
  );
}
