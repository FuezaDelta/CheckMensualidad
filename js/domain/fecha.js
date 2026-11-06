/**
 * Manejo de fechas anclado a la zona horaria del gimnasio.
 *
 * El vencimiento de una membresía es un día de calendario, no un instante: si
 * vence el 14 de agosto, sigue activa durante todo ese día en Apartadó sin
 * importar dónde ni con qué reloj esté configurado el dispositivo del usuario.
 */

export const ZONA_HORARIA = "America/Bogota";

/** Colombia no tiene horario de verano: el desfase es fijo todo el año. */
const DESFASE_COLOMBIA = "-05:00";

/** "YYYY-MM-DD" sin hora: un día de calendario, no un instante. */
const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

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

  // JavaScript interpreta "2026-08-14" como medianoche UTC, que en Colombia
  // todavía es el día 13: la membresía vencería un día antes. Se ancla al
  // inicio de ese día en la hora de Colombia.
  if (typeof valor === "string" && SOLO_FECHA.test(valor.trim())) {
    const dia = valor.trim();
    const fecha = new Date(`${dia}T00:00:00${DESFASE_COLOMBIA}`);
    // El navegador convierte "2026-02-30" en el 2 de marzo; un día que no
    // existe en el calendario es un error de captura, no una fecha.
    return !Number.isNaN(fecha.getTime()) && diaCalendario(fecha) === dia ? fecha : null;
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

const MS_POR_DIA = 86_400_000;

/**
 * Días de calendario entre dos fechas en la zona del gimnasio, sin importar
 * la hora de cada una: del lunes a las 23:59 al martes a las 00:01 hay 1 día.
 *
 * @param {Date} desde
 * @param {Date} hasta
 * @returns {number} Negativo si `hasta` es anterior a `desde`.
 */
export function diasEntre(desde, hasta) {
  const aDiaUtc = (fecha) => {
    const [anio, mes, dia] = diaCalendario(fecha).split("-").map(Number);
    return Date.UTC(anio, mes - 1, dia);
  };
  return Math.round((aDiaUtc(hasta) - aDiaUtc(desde)) / MS_POR_DIA);
}

/**
 * @param {Date} fecha
 * @param {Date} referencia
 * @returns {boolean} true si `fecha` cae en el mismo día o después que `referencia`.
 */
export function esMismoDiaOPosterior(fecha, referencia) {
  return diaCalendario(fecha) >= diaCalendario(referencia);
}
