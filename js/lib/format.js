/**
 * Formateo de valores para mostrar en pantalla, con la configuración regional
 * del negocio (Colombia) en un único lugar.
 */

import { ZONA_HORARIA } from "../domain/fecha.js";

export const LOCALE = "es-CO";
export const MONEDA = "COP";

const SIN_FECHA = "Sin fecha registrada";
const SIN_DATO = "—";

const formateadorFecha = new Intl.DateTimeFormat(LOCALE, {
  timeZone: ZONA_HORARIA,
  year: "numeric",
  month: "long",
  day: "numeric",
});

const formateadorPrecio = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: MONEDA,
  maximumFractionDigits: 0,
});

/**
 * @param {Date|null} fecha
 * @returns {string}
 */
export function formatearFecha(fecha) {
  if (!fecha) return SIN_FECHA;
  return formateadorFecha.format(fecha);
}

/**
 * @param {number|null} precio
 * @returns {string}
 */
export function formatearPrecio(precio) {
  if (precio == null || !Number.isFinite(precio)) return SIN_DATO;
  return formateadorPrecio.format(precio);
}

/**
 * @param {number} dias
 * @returns {string}
 */
export function formatearDuracion(dias) {
  if (!Number.isFinite(dias) || dias <= 0) return SIN_DATO;
  return `${dias} ${dias === 1 ? "día" : "días"}`;
}
