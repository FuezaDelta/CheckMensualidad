// Archivo generado por scripts/build.mjs — no editar a mano.
// Copia de js/domain/telefono.js

/**
 * Reglas de negocio para números de celular colombianos.
 * Módulo puro: no toca el DOM ni la red, por lo que es testeable en Node.
 */

export const INDICATIVO_COLOMBIA = "57";
export const LONGITUD_NACIONAL = 10;

/**
 * Deja el número en su forma nacional canónica (10 dígitos, sin indicativo).
 * Acepta las formas en que la gente escribe su celular: con espacios, guiones,
 * paréntesis, con "+57", con "0057" o sin nada.
 *
 * @param {unknown} entrada
 * @returns {string} Solo dígitos; cadena vacía si la entrada no es utilizable.
 */
export function normalizarTelefono(entrada) {
  if (typeof entrada !== "string" && typeof entrada !== "number") return "";

  let digitos = String(entrada).replace(/\D/g, "");

  if (digitos.length === LONGITUD_NACIONAL + 4 && digitos.startsWith(`00${INDICATIVO_COLOMBIA}`)) {
    digitos = digitos.slice(4);
  } else if (
    digitos.length === LONGITUD_NACIONAL + 2 &&
    digitos.startsWith(INDICATIVO_COLOMBIA)
  ) {
    digitos = digitos.slice(2);
  }

  return digitos;
}

/**
 * Un celular colombiano son 10 dígitos que empiezan por 3.
 *
 * @param {string} telefonoNormalizado
 * @returns {boolean}
 */
export function esTelefonoValido(telefonoNormalizado) {
  return /^3\d{9}$/.test(telefonoNormalizado);
}

/**
 * Formas en que el mismo número puede estar almacenado en la base de datos.
 * Se consultan todas porque no hay garantía histórica de un único formato.
 *
 * @param {string} telefonoNormalizado
 * @returns {string[]}
 */
export function variantesTelefono(telefonoNormalizado) {
  if (!telefonoNormalizado) return [];
  return [telefonoNormalizado, `${INDICATIVO_COLOMBIA}${telefonoNormalizado}`];
}
