/**
 * Tarjetas de planes en la portada. Usa el mismo servicio (y la misma caché)
 * que el panel desplegable, así que abrir el panel no repite la lectura.
 */

import { crear, porId, reemplazarContenido } from "../lib/dom.js";
import { formatearDuracion, formatearPrecio } from "../lib/format.js";
import { obtenerPlanesActivos } from "../services/planes.js";

const WHATSAPP = "573103982286";

/**
 * El nombre del plan viene de la base de datos: va codificado dentro del
 * parámetro `text`, nunca como parte de la ruta, así que no puede cambiar el
 * destino del enlace.
 *
 * @param {string} nombrePlan
 * @returns {string}
 */
function enlaceWhatsapp(nombrePlan) {
  const mensaje = `Hola, me interesa el plan ${nombrePlan} de Fuerza Delta 💪`;
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
}

/**
 * @param {import("../domain/plan.js").Plan} plan
 * @returns {HTMLElement}
 */
function crearTarjeta(plan) {
  return crear("article", { clase: "plan" }, [
    crear("h3", { clase: "plan-nombre", texto: plan.nombre }),
    crear("p", { clase: "plan-precio", texto: formatearPrecio(plan.precio) }),
    crear("p", { clase: "plan-duracion", texto: formatearDuracion(plan.duracionDias) }),
    crear("div", { clase: "plan-accion" }, [
      crear("a", {
        clase: "btn btn--primario",
        texto: "Lo quiero",
        atributos: {
          href: enlaceWhatsapp(plan.nombre),
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    ]),
  ]);
}

/**
 * @param {string} texto
 * @param {boolean} [esError]
 */
function crearMensaje(texto, esError = false) {
  return crear("p", {
    clase: esError ? "planes-mensaje planes-mensaje--error" : "planes-mensaje",
    texto,
  });
}

export async function crearSeccionPlanes() {
  const contenedor = porId("planes-grid");
  if (!contenedor) return;

  try {
    const planes = await obtenerPlanesActivos();

    if (planes.length === 0) {
      reemplazarContenido(contenedor, [
        crearMensaje("Pronto publicaremos nuestros planes. Escríbenos por WhatsApp."),
      ]);
      return;
    }

    reemplazarContenido(contenedor, planes.map(crearTarjeta));
  } catch (error) {
    console.error("Error al cargar planes:", error);
    reemplazarContenido(contenedor, [
      crearMensaje("No se pudieron cargar los planes. Intenta más tarde.", true),
    ]);
  }
}
