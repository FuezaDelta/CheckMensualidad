/**
 * Errores de la capa de servicios.
 *
 * La interfaz decide qué mensaje mostrar a partir del código, en lugar de
 * recibir textos ya redactados desde capas que no saben nada de la vista.
 */

export const CodigoError = Object.freeze({
  TELEFONO_INVALIDO: "telefono-invalido",
  NO_ENCONTRADA: "no-encontrada",
  SIN_INFORMACION: "sin-informacion",
  NO_DISPONIBLE: "no-disponible",
  DEMASIADAS_CONSULTAS: "demasiadas-consultas",
  DESCONOCIDO: "desconocido",
});

export class ErrorServicio extends Error {
  /**
   * @param {string} codigo
   * @param {string} [mensaje]
   * @param {{cause?: unknown}} [opciones]
   */
  constructor(codigo, mensaje = codigo, opciones = {}) {
    super(mensaje, opciones);
    this.name = "ErrorServicio";
    this.codigo = codigo;
  }
}

/**
 * @param {unknown} error
 * @returns {ErrorServicio}
 */
export function comoErrorServicio(error) {
  if (error instanceof ErrorServicio) return error;

  const codigo = /** @type {any} */ (error)?.code;
  if (codigo === "functions/not-found" || codigo === "not-found") {
    return new ErrorServicio(CodigoError.NO_ENCONTRADA, "Membresía no encontrada", {
      cause: error,
    });
  }
  if (codigo === "functions/invalid-argument" || codigo === "invalid-argument") {
    return new ErrorServicio(CodigoError.TELEFONO_INVALIDO, "Teléfono inválido", { cause: error });
  }
  if (codigo === "functions/unavailable" || codigo === "unavailable") {
    return new ErrorServicio(CodigoError.NO_DISPONIBLE, "Servicio no disponible", { cause: error });
  }
  if (codigo === "functions/resource-exhausted" || codigo === "resource-exhausted") {
    return new ErrorServicio(CodigoError.DEMASIADAS_CONSULTAS, "Límite de consultas alcanzado", {
      cause: error,
    });
  }

  return new ErrorServicio(CodigoError.DESCONOCIDO, "Error inesperado", { cause: error });
}
