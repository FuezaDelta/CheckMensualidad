/**
 * Acceso a los datos de membresías.
 *
 * Aísla a la interfaz de dónde vienen los datos: hoy una Cloud Function y, en
 * modo de transición, Firestore directo. La vista solo conoce el modelo de
 * dominio `Membresia`.
 */

import { doc, getDoc } from "../vendor/firebase-firestore.js";
import { config } from "../config.js";
import { aDate } from "../domain/fecha.js";
import { crearMembresia, esEstadoValido } from "../domain/membresia.js";
import { esTelefonoValido, normalizarTelefono } from "../domain/telefono.js";
import { llamarFuncion, obtenerFirestore } from "../lib/firebase.js";
import { CodigoError, ErrorServicio, comoErrorServicio } from "./errores.js";

const COLECCION_USUARIOS = "usuarios";
const NOMBRE_FUNCION = "consultarMembresia";

/**
 * El servidor ya resolvió el estado con su propio reloj, que es la única fuente
 * de tiempo en la que se puede confiar.
 *
 * @param {string} telefono
 * @returns {Promise<import("../domain/membresia.js").Membresia>}
 */
async function consultarEnBackend(telefono) {
  const respuesta = await llamarFuncion(NOMBRE_FUNCION, { telefono });

  if (!respuesta || !esEstadoValido(respuesta.estado)) {
    throw new ErrorServicio(CodigoError.SIN_INFORMACION, "Respuesta del backend incompleta");
  }

  return {
    nombreCompleto: String(respuesta.nombreCompleto ?? "Usuario"),
    fechaFin: aDate(respuesta.fechaFin),
    estado: respuesta.estado,
  };
}

/**
 * Lectura directa desde el navegador, pidiendo el documento por su
 * identificador, que es el teléfono normalizado.
 *
 * Que sea una lectura por identificador y no una búsqueda es justamente lo que
 * hace seguro este camino: `firestore.rules` permite `get` pero prohíbe `list`,
 * así que solo se puede obtener el registro de un número que ya se conoce y
 * nadie puede descargar la colección completa. Una búsqueda por el campo
 * `telefono` exigiría permitir `list` y con ello la descarga masiva.
 *
 * A cambio, el estado se calcula con el reloj del dispositivo. Un cliente que
 * atrase su reloj puede ver como vigente una membresía vencida; es el precio de
 * no tener servidor y no compromete los datos de nadie más.
 *
 * @param {string} telefono
 * @returns {Promise<import("../domain/membresia.js").Membresia>}
 */
async function consultarEnFirestore(telefono) {
  const db = await obtenerFirestore();
  const documento = await getDoc(doc(db, COLECCION_USUARIOS, telefono));

  if (!documento.exists()) {
    throw new ErrorServicio(CodigoError.NO_ENCONTRADA, "Membresía no encontrada");
  }

  return crearMembresia(documento.data());
}

/**
 * @param {string} entrada Lo que el usuario escribió, en cualquier formato.
 * @returns {Promise<import("../domain/membresia.js").Membresia>}
 * @throws {ErrorServicio}
 */
export async function consultarMembresia(entrada) {
  const telefono = normalizarTelefono(entrada);

  if (!esTelefonoValido(telefono)) {
    throw new ErrorServicio(CodigoError.TELEFONO_INVALIDO, "Número de celular inválido");
  }

  try {
    return config.membresias.backend === "firestore"
      ? await consultarEnFirestore(telefono)
      : await consultarEnBackend(telefono);
  } catch (error) {
    throw comoErrorServicio(error);
  }
}
