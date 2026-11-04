/**
 * Transición de salida al navegar entre páginas del sitio.
 *
 * La animación de entrada la hace el CSS por sí solo: si estos scripts fallan o
 * tardan, el contenido igual se ve.
 */

const PAGINAS_INTERNAS = new Set(["", "index.html", "horarios.html", "contactenos.html"]);
const DURACION_SALIDA_MS = 220;

const prefiereMenosMovimiento = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * @param {string} href
 * @returns {URL|null}
 */
function resolverUrl(href) {
  try {
    return new URL(href, window.location.href);
  } catch {
    return null;
  }
}

/**
 * @param {URL} url
 * @returns {boolean}
 */
function esPaginaInterna(url) {
  if (url.origin !== window.location.origin) return false;
  return PAGINAS_INTERNAS.has(url.pathname.split("/").pop() ?? "");
}

/**
 * El usuario pidió abrir el enlace de otra forma (nueva pestaña, descarga…),
 * así que la navegación no nos corresponde.
 *
 * @param {MouseEvent} evento
 * @returns {boolean}
 */
function tieneIntencionAlterna(evento) {
  return (
    evento.defaultPrevented ||
    evento.button !== 0 ||
    evento.metaKey ||
    evento.ctrlKey ||
    evento.shiftKey ||
    evento.altKey
  );
}

export function activarTransiciones() {
  document.addEventListener("click", (evento) => {
    if (tieneIntencionAlterna(evento)) return;

    const enlace = /** @type {HTMLElement} */ (evento.target)?.closest?.("a[href]");
    if (!enlace) return;

    const ancla = /** @type {HTMLAnchorElement} */ (enlace);
    if (ancla.target && ancla.target !== "_self") return;
    if (ancla.hasAttribute("download")) return;

    const destino = resolverUrl(ancla.getAttribute("href") ?? "");
    if (!destino || !esPaginaInterna(destino)) return;
    if (destino.pathname === window.location.pathname) return;

    evento.preventDefault();

    if (prefiereMenosMovimiento()) {
      window.location.href = destino.href;
      return;
    }

    document.body.classList.add("page-exit");
    window.setTimeout(() => {
      window.location.href = destino.href;
    }, DURACION_SALIDA_MS);
  });

  // Al volver con el botón "atrás" el navegador puede restaurar la página desde
  // la caché con la clase de salida aún puesta, dejándola invisible.
  window.addEventListener("pageshow", () => {
    document.body.classList.remove("page-exit");
  });
}
