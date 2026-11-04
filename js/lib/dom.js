/**
 * Utilidades de DOM.
 *
 * Todo el contenido dinámico se construye con nodos y `textContent` en lugar de
 * `innerHTML`: los datos vienen de la base de datos y no son confiables, así que
 * interpolarlos como HTML abriría la puerta a XSS almacenado.
 */

/**
 * @param {string} id
 * @param {ParentNode} [raiz]
 * @returns {HTMLElement|null}
 */
export function porId(id, raiz = document) {
  return /** @type {HTMLElement|null} */ (raiz.querySelector(`#${CSS.escape(id)}`));
}

/**
 * @param {string} etiqueta
 * @param {{clase?: string, texto?: string, atributos?: Record<string, string>}} [opciones]
 * @param {Array<Node|string>} [hijos]
 * @returns {HTMLElement}
 */
export function crear(etiqueta, opciones = {}, hijos = []) {
  const elemento = document.createElement(etiqueta);

  if (opciones.clase) elemento.className = opciones.clase;
  if (opciones.texto != null) elemento.textContent = opciones.texto;

  for (const [nombre, valor] of Object.entries(opciones.atributos ?? {})) {
    elemento.setAttribute(nombre, valor);
  }

  for (const hijo of hijos) {
    elemento.append(hijo);
  }

  return elemento;
}

/**
 * @param {Element} contenedor
 * @param {Array<Node|string>} hijos
 */
export function reemplazarContenido(contenedor, hijos) {
  contenedor.replaceChildren(...hijos);
}

const SELECTOR_ENFOCABLES = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * @param {Element} contenedor
 * @returns {HTMLElement[]}
 */
export function elementosEnfocables(contenedor) {
  return /** @type {HTMLElement[]} */ (
    Array.from(contenedor.querySelectorAll(SELECTOR_ENFOCABLES))
  ).filter((elemento) => elemento.offsetParent !== null || elemento === document.activeElement);
}

/**
 * Mantiene el foco dentro de un contenedor mientras esté abierto y lo devuelve
 * al elemento que lo tenía al cerrarse.
 *
 * @param {HTMLElement} contenedor
 * @returns {() => void} Función para liberar el foco.
 */
export function atraparFoco(contenedor) {
  const anterior = /** @type {HTMLElement|null} */ (document.activeElement);

  function alPresionarTab(evento) {
    if (evento.key !== "Tab") return;

    const enfocables = elementosEnfocables(contenedor);
    if (enfocables.length === 0) return;

    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];

    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  contenedor.addEventListener("keydown", alPresionarTab);
  elementosEnfocables(contenedor)[0]?.focus();

  return function liberar() {
    contenedor.removeEventListener("keydown", alPresionarTab);
    anterior?.focus?.();
  };
}
