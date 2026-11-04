// Archivo generado por scripts/build.mjs — no editar a mano.
// Copia de js/domain/fecha.js

/**
 * Manejo de fechas anclado a la zona horaria del gimnasio.
 *
 * El vencimiento de una membresía es un día de calendario, no un instante: si
 * vence el 14 de agosto, sigue activa durante todo ese día en Apartadó sin
 * importar dónde ni con qué reloj esté configurado el dispositivo del usuario.
 */

export const ZONA_HORARIA = "America/Bogota";

const formateadorDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_HORARIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Convierte los distintos formatos en que puede llegar una fecha (Timestamp de
 * Firestore, Date, ISO string, epoch en milisegundos) a un Date válido.
 *
 * @param {unknown} valor
 * @returns {Date|null} null si el valor no representa una fecha utilizable.
 */
export function aDate(valor) {
  if (valor == null) return null;

  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : valor;
  }

  // Firestore Timestamp, tanto del SDK web como del Admin SDK.
  if (typeof valor === "object" && typeof (/** @type {any} */ (valor).toDate) === "function") {
    return aDate(/** @type {any} */ (valor).toDate());
  }

  // Timestamp serializado como {seconds, nanoseconds} al cruzar la red.
  if (typeof valor === "object" && typeof (/** @type {any} */ (valor).seconds) === "number") {
    return aDate(new Date(/** @type {any} */ (valor).seconds * 1000));
  }

  if (typeof valor === "number" || typeof valor === "string") {
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  return null;
}

/**
 * Día de calendario en la zona del gimnasio, como "YYYY-MM-DD".
 * El formato ISO permite comparar dos días con operadores de cadena.
 *
 * @param {Date} fecha
 * @returns {string}
 */
export function diaCalendario(fecha) {
  const partes = formateadorDia.formatToParts(fecha);
  const buscar = (tipo) => partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `${buscar("year")}-${buscar("month")}-${buscar("day")}`;
}

/**
 * @param {Date} fecha
 * @param {Date} referencia
 * @returns {boolean} true si `fecha` cae en el mismo día o después que `referencia`.
 */
export function esMismoDiaOPosterior(fecha, referencia) {
  return diaCalendario(fecha) >= diaCalendario(referencia);
}
