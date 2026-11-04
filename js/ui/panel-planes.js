/**
 * Panel desplegable con los planes disponibles.
 *
 * Es un "disclosure" (no un diálogo modal): no bloquea el resto de la página,
 * así que mueve el foco al abrirse y lo devuelve al cerrarse, pero no lo atrapa.
 */

import { crear, porId, reemplazarContenido } from "../lib/dom.js";
import { formatearDuracion, formatearPrecio } from "../lib/format.js";
import { obtenerPlanesActivos } from "../services/planes.js";

const CLASE_VISIBLE = "visible";

/**
 * @param {import("../domain/plan.js").Plan} plan
 * @returns {HTMLElement}
 */
function crearItemPlan(plan) {
  return crear("div", { clase: "panel-plan-item" }, [
    crear("span", { clase: "nombre", texto: plan.nombre }),
    crear("span", {
      clase: "precio-dias",
      texto: `${formatearPrecio(plan.precio)} ${formatearDuracion(plan.duracionDias)}`,
    }),
  ]);
}

/**
 * @param {string} clase
 * @param {string} texto
 * @returns {HTMLElement}
 */
function crearMensaje(clase, texto) {
  return crear("p", { clase, texto });
}

/**
 * @param {{navegacion?: import("./navegacion.js").Navegacion|null}} [opciones]
 */
export function crearPanelPlanes({ navegacion = null } = {}) {
  const panel = porId("panel-planes");
  const lista = porId("panel-planes-lista");
  if (!panel || !lista) return null;

  const botonAbrir = porId("btn-planes");
  const botonAbrirSidebar = porId("btn-planes-sidebar");
  const botonCerrar = porId("btn-cerrar-planes");
  const botonHamburguesa = porId("btn-hamburger");

  /** @type {HTMLElement|null} */
  let disparador = null;

  const estaAbierto = () => panel.classList.contains(CLASE_VISIBLE);

  /**
   * En móvil, el botón de la barra superior está oculto por CSS y el del menú
   * lateral desaparece al cerrarse el menú; enfocar cualquiera de los dos no
   * haría nada y el foco caería en el body.
   *
   * @param {...(HTMLElement|null)} candidatos
   * @returns {HTMLElement|null}
   */
  function primeroVisible(...candidatos) {
    return candidatos.find((elemento) => elemento && elemento.offsetParent !== null) ?? null;
  }

  async function cargarPlanes() {
    reemplazarContenido(lista, [
      crearMensaje("panel-planes-cargando", "Cargando planes…"),
    ]);

    try {
      const planes = await obtenerPlanesActivos();

      if (planes.length === 0) {
        reemplazarContenido(lista, [
          crearMensaje("panel-planes-error", "No hay planes disponibles."),
        ]);
        return;
      }

      reemplazarContenido(lista, planes.map(crearItemPlan));
    } catch (error) {
      console.error("Error al cargar planes:", error);
      reemplazarContenido(lista, [
        crearMensaje(
          "panel-planes-error",
          "No se pudieron cargar los planes. Intenta más tarde."
        ),
      ]);
    }
  }

  /**
   * @param {HTMLElement|null} [origen] Elemento al que se devuelve el foco al cerrar.
   */
  function abrir(origen = null) {
    disparador = origen;
    panel.classList.add(CLASE_VISIBLE);
    panel.setAttribute("aria-hidden", "false");
    panel.removeAttribute("inert");
    botonAbrir?.setAttribute("aria-expanded", "true");
    botonCerrar?.focus();
    void cargarPlanes();
  }

  function cerrar() {
    if (!estaAbierto()) return;

    panel.classList.remove(CLASE_VISIBLE);
    panel.setAttribute("aria-hidden", "true");
    panel.setAttribute("inert", "");
    botonAbrir?.setAttribute("aria-expanded", "false");
    primeroVisible(disparador, botonAbrir, botonHamburguesa)?.focus();
    disparador = null;
  }

  botonAbrir?.addEventListener("click", () => {
    if (estaAbierto()) cerrar();
    else abrir(botonAbrir);
  });

  botonAbrirSidebar?.addEventListener("click", () => {
    navegacion?.cerrar();
    abrir(botonAbrirSidebar);
  });

  botonCerrar?.addEventListener("click", cerrar);

  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") cerrar();
  });

  document.addEventListener("click", (evento) => {
    if (!estaAbierto()) return;

    const objetivo = /** @type {Node} */ (evento.target);
    if (panel.contains(objetivo)) return;
    if (botonAbrir?.contains(objetivo) || botonAbrirSidebar?.contains(objetivo)) return;

    cerrar();
  });

  if (window.location.hash === "#planes") {
    abrir(botonAbrir);
  }

  return { abrir, cerrar, estaAbierto };
}
