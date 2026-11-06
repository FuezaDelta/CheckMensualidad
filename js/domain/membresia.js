/**
 * Modelo y reglas de negocio de una membresía.
 */

import { aDate, diasEntre, esMismoDiaOPosterior } from "./fecha.js";

/** @typedef {"activa"|"vencida"|"desconocido"} Estado */

export const EstadoMembresia = Object.freeze({
  ACTIVA: "activa",
  VENCIDA: "vencida",
  DESCONOCIDO: "desconocido",
});

const ESTADOS_REGISTRADOS = Object.freeze({
  activa: EstadoMembresia.ACTIVA,
  activo: EstadoMembresia.ACTIVA,
  vigente: EstadoMembresia.ACTIVA,
  vencida: EstadoMembresia.VENCIDA,
  vencido: EstadoMembresia.VENCIDA,
  inactiva: EstadoMembresia.VENCIDA,
  inactivo: EstadoMembresia.VENCIDA,
});

const NOMBRE_POR_DEFECTO = "Usuario";

/**
 * La fecha de vencimiento es la única fuente de verdad. El campo `estado`
 * guardado en la base de datos solo se consulta cuando no hay fecha utilizable,
 * porque puede haber quedado desactualizado al pasar el tiempo.
 *
 * @param {Date|null} fechaFin
 * @param {unknown} estadoRegistrado
 * @param {Date} [ahora]
 * @returns {Estado}
 */
export function calcularEstado(fechaFin, estadoRegistrado, ahora = new Date()) {
  if (fechaFin) {
    return esMismoDiaOPosterior(fechaFin, ahora)
      ? EstadoMembresia.ACTIVA
      : EstadoMembresia.VENCIDA;
  }

  if (typeof estadoRegistrado === "string") {
    // `hasOwn` y no `in`: el valor viene de la base de datos y con `in` una
    // cadena como "constructor" o "toString" acertaría contra el prototipo.
    const clave = estadoRegistrado.trim().toLowerCase();
    if (Object.hasOwn(ESTADOS_REGISTRADOS, clave)) return ESTADOS_REGISTRADOS[clave];
  }

  return EstadoMembresia.DESCONOCIDO;
}

/** Con esta cantidad de días o menos, una membresía activa se avisa como próxima a vencer. */
export const DIAS_AVISO_VENCIMIENTO = 5;

/**
 * Días que le quedan a la membresía. Usa la misma regla que `calcularEstado`:
 * el día del vencimiento todavía cuenta, así que 0 significa "vence hoy" y la
 * membresía está activa si y solo si el resultado es 0 o más.
 *
 * @param {Date|null} fechaFin
 * @param {Date} [ahora]
 * @returns {number|null} Negativo: días desde que venció. null si no hay fecha.
 */
export function diasRestantes(fechaFin, ahora = new Date()) {
  return fechaFin ? diasEntre(ahora, fechaFin) : null;
}

/**
 * @param {unknown} valor
 * @returns {valor is Estado}
 */
export function esEstadoValido(valor) {
  return Object.values(EstadoMembresia).includes(/** @type {Estado} */ (valor));
}

/**
 * @param {unknown} nombre
 * @param {unknown} apellido
 * @returns {string}
 */
export function componerNombre(nombre, apellido) {
  const partes = [nombre, apellido]
    .filter((parte) => typeof parte === "string")
    .map((parte) => parte.trim())
    .filter(Boolean);

  return partes.join(" ") || NOMBRE_POR_DEFECTO;
}

/**
 * @typedef {object} Membresia
 * @property {string} nombreCompleto
 * @property {Date|null} fechaFin
 * @property {Estado} estado
 */

/**
 * Convierte un documento crudo (Firestore o respuesta del backend) en el modelo
 * que consume la interfaz. Ignora cualquier campo adicional del documento para
 * que la vista no dependa de la forma exacta de la base de datos.
 *
 * @param {Record<string, unknown>} datos
 * @param {Date} [ahora]
 * @returns {Membresia}
 */
export function crearMembresia(datos, ahora = new Date()) {
  const fechaFin = aDate(datos?.fechaFinMembresia);

  return {
    nombreCompleto: componerNombre(datos?.nombre, datos?.apellido),
    fechaFin,
    estado: calcularEstado(fechaFin, datos?.estadoMembresia, ahora),
  };
}
