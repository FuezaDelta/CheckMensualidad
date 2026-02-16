/**
 * Transiciones entre páginas (entrada y salida)
 * Funciona en desktop y móvil.
 */
(function () {
  const INTERNAL_PAGES = ["index.html", "horarios.html", "contactenos.html"];
  const EXIT_DURATION_MS = 220;

  function isInternalPage(url) {
    try {
      const path = typeof url === "string" ? url : url.href;
      const name = path.split("/").pop().split("?")[0].split("#")[0];
      return INTERNAL_PAGES.some(function (p) {
        return name === p || name === "" || name === "index.html";
      });
    } catch (_) {
      return false;
    }
  }

  function getLinkTarget(link) {
    const href = link.getAttribute("href");
    if (!href || link.target === "_blank" || link.getAttribute("rel") === "external") {
      return null;
    }
    return href;
  }

  function handleClick(e) {
    const link = e.target.closest("a");
    if (!link) return;

    const href = getLinkTarget(link);
    if (!href || !isInternalPage(href)) return;

    var destPath = href.split("?")[0].split("#")[0].split("/").pop() || "index.html";
    var currentPath = window.location.pathname.split("/").pop() || "index.html";
    if (destPath === currentPath) return;

    e.preventDefault();
    document.body.classList.add("page-exit");

    setTimeout(function () {
      window.location.href = href;
    }, EXIT_DURATION_MS);
  }

  document.addEventListener("click", handleClick, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      requestAnimationFrame(function () {
        document.body.classList.add("page-loaded");
      });
    });
  } else {
    requestAnimationFrame(function () {
      document.body.classList.add("page-loaded");
    });
  }
})();
