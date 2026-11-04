/**
 * Menú lateral (móvil).
 *
 * Expone una API para que otros componentes lo cierren sin manipular sus clases
 * por su cuenta; cuando cada módulo tocaba el DOM del sidebar directamente era
 * fácil olvidar alguno de los atributos de accesibilidad.
 */

import { atraparFoco, porId } from "../lib/dom.js";

/**
 * @typedef {object} Navegacion
 * @property {() => void} abrir
 * @property {() => void} cerrar
 * @property {() => void} alternar
 * @property {() => boolean} estaAbierta
 */

const CLASE_ABIERTO = "sidebar--open";
const CLASE_BODY = "sidebar-open";

/**
 * @returns {Navegacion|null} null si la página no tiene menú lateral.
 */
export function crearNavegacion() {
  const sidebar = porId("sidebar");
  if (!sidebar) return null;

  const botonHamburguesa = porId("btn-hamburger");
  const botonCerrar = porId("sidebar-cerrar");
  const fondo = porId("sidebar-backdrop");
  const contenido = sidebar.querySelector(".sidebar-inner") ?? sidebar;

  /** @type {(() => void)|null} */
  let liberarFoco = null;

  const estaAbierta = () => sidebar.classList.contains(CLASE_ABIERTO);

  function abrir() {
    if (estaAbierta()) return;

    sidebar.classList.add(CLASE_ABIERTO);
    sidebar.setAttribute("aria-hidden", "false");
    sidebar.removeAttribute("inert");
    botonHamburguesa?.setAttribute("aria-expanded", "true");
    document.body.classList.add(CLASE_BODY);
    liberarFoco = atraparFoco(/** @type {HTMLElement} */ (contenido));
  }

  function cerrar() {
    if (!estaAbierta()) return;

    sidebar.classList.remove(CLASE_ABIERTO);
    sidebar.setAttribute("aria-hidden", "true");
    sidebar.setAttribute("inert", "");
    botonHamburguesa?.setAttribute("aria-expanded", "false");
    document.body.classList.remove(CLASE_BODY);
    liberarFoco?.();
    liberarFoco = null;
  }

  function alternar() {
    if (estaAbierta()) cerrar();
    else abrir();
  }

  botonHamburguesa?.addEventListener("click", alternar);
  botonCerrar?.addEventListener("click", cerrar);
  fondo?.addEventListener("click", cerrar);

  for (const enlace of sidebar.querySelectorAll(".sidebar-link")) {
    enlace.addEventListener("click", cerrar);
  }

  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") cerrar();
  });

  return { abrir, cerrar, alternar, estaAbierta };
}
