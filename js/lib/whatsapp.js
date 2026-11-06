/**
 * Enlaces a WhatsApp con un mensaje ya escrito.
 */

import { config } from "../config.js";

/**
 * El mensaje puede llevar datos de la base de datos (nombres de clientes o de
 * planes): va codificado dentro del parámetro `text`, nunca como parte de la
 * ruta, así que no puede cambiar el destino del enlace.
 *
 * @param {string} mensaje
 * @returns {string}
 */
export function enlaceWhatsapp(mensaje) {
  return `https://wa.me/${config.contacto.whatsapp}?text=${encodeURIComponent(mensaje)}`;
}
