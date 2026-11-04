/**
 * Formulario de consulta del estado de una membresía.
 */

import { EstadoMembresia } from "../domain/membresia.js";
import { crear, porId, reemplazarContenido } from "../lib/dom.js";
import { formatearFecha } from "../lib/format.js";
import { CodigoError } from "../services/errores.js";
import { consultarMembresia } from "../services/membresias.js";

const MENSAJE_INICIAL = "Escribe tu número de celular y presiona Consultar.";
const MENSAJE_BUSCANDO = "Buscando membresía...";
const MENSAJE_ENCONTRADA = "Membresía encontrada.";

const MENSAJES_ERROR = Object.freeze({
  [CodigoError.TELEFONO_INVALIDO]:
    "Ingresa un número de celular válido de 10 dígitos (ej. 3113215432).",
  [CodigoError.NO_ENCONTRADA]:
    "No se encontró ninguna membresía con ese número de celular.",
  [CodigoError.SIN_INFORMACION]:
    "No pudimos determinar el estado de tu membresía. Comunícate con el gimnasio por WhatsApp.",
  [CodigoError.NO_DISPONIBLE]:
    "El servicio no está disponible en este momento. Intenta de nuevo en unos minutos.",
  [CodigoError.DEMASIADAS_CONSULTAS]:
    "Se hicieron muchas consultas seguidas. Espera un minuto y vuelve a intentarlo.",
  [CodigoError.DESCONOCIDO]:
    "Ocurrió un error al consultar la membresía. Intenta de nuevo en unos momentos.",
});

const ETIQUETAS_ESTADO = Object.freeze({
  [EstadoMembresia.ACTIVA]: "ACTIVA",
  [EstadoMembresia.VENCIDA]: "VENCIDA",
});

const CLASES_ESTADO = Object.freeze({
  [EstadoMembresia.ACTIVA]: "activa",
  [EstadoMembresia.VENCIDA]: "vencida",
});

export function crearFormularioConsulta() {
  const formulario = porId("consulta-form");
  const entradaTelefono = porId("telefono");
  const estado = porId("status");
  const resultado = porId("resultado");
  const boton = porId("btn-consultar");

  if (!formulario || !entradaTelefono || !estado || !resultado) return null;

  // Descarta respuestas de consultas que ya fueron reemplazadas por otra más
  // reciente, para que nunca se pinte un resultado obsoleto.
  let consultaActual = 0;

  function mostrarEstado(mensaje, tipo = "info") {
    estado.textContent = mensaje ?? "";
    estado.classList.toggle("status--error", tipo === "error");
    estado.classList.toggle("status--info", tipo !== "error");
  }

  function limpiarResultado() {
    resultado.classList.remove("visible");
    reemplazarContenido(resultado, []);
  }

  /**
   * @param {import("../domain/membresia.js").Membresia} membresia
   */
  function mostrarResultado(membresia) {
    const encabezado = crear("div", { clase: "resultado-header" }, [
      crear("div", { clase: "resultado-nombre", texto: membresia.nombreCompleto }),
      crear("span", {
        clase: `badge-estado ${CLASES_ESTADO[membresia.estado]}`,
        texto: ETIQUETAS_ESTADO[membresia.estado],
      }),
    ]);

    const vencimiento = crear("p", { clase: "resultado-item" }, [
      crear("strong", { texto: "Fecha de vencimiento:" }),
      ` ${formatearFecha(membresia.fechaFin)}`,
    ]);

    reemplazarContenido(resultado, [encabezado, vencimiento]);
    resultado.classList.add("visible");
  }

  async function alEnviar(evento) {
    evento.preventDefault();

    const consulta = ++consultaActual;
    limpiarResultado();
    mostrarEstado(MENSAJE_BUSCANDO);
    formulario.setAttribute("aria-busy", "true");
    if (boton) /** @type {HTMLButtonElement} */ (boton).disabled = true;

    try {
      const membresia = await consultarMembresia(
        /** @type {HTMLInputElement} */ (entradaTelefono).value
      );
      if (consulta !== consultaActual) return;

      if (membresia.estado === EstadoMembresia.DESCONOCIDO) {
        mostrarEstado(MENSAJES_ERROR[CodigoError.SIN_INFORMACION], "error");
        return;
      }

      mostrarEstado(MENSAJE_ENCONTRADA);
      mostrarResultado(membresia);
    } catch (error) {
      if (consulta !== consultaActual) return;

      if (error?.codigo !== CodigoError.NO_ENCONTRADA) {
        console.error("Error al consultar membresía:", error);
      }
      mostrarEstado(
        MENSAJES_ERROR[error?.codigo] ?? MENSAJES_ERROR[CodigoError.DESCONOCIDO],
        "error"
      );
    } finally {
      if (consulta === consultaActual) {
        formulario.removeAttribute("aria-busy");
        if (boton) /** @type {HTMLButtonElement} */ (boton).disabled = false;
      }
    }
  }

  formulario.addEventListener("submit", alEnviar);
  mostrarEstado(MENSAJE_INICIAL);

  return { formulario };
}
