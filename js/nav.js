/**
 * Navegación: sidebar móvil y accesibilidad
 */
(function () {
  const btnHamburger = document.getElementById("btn-hamburger");
  const sidebar = document.getElementById("sidebar");
  const sidebarCerrar = document.getElementById("sidebar-cerrar");
  const sidebarBackdrop = document.getElementById("sidebar-backdrop");

  if (!sidebar) return;

  function abrirSidebar() {
    sidebar.classList.add("sidebar--open");
    sidebar.setAttribute("aria-hidden", "false");
    if (btnHamburger) {
      btnHamburger.setAttribute("aria-expanded", "true");
    }
    document.body.classList.add("sidebar-open");
  }

  function cerrarSidebar() {
    sidebar.classList.remove("sidebar--open");
    sidebar.setAttribute("aria-hidden", "true");
    if (btnHamburger) {
      btnHamburger.setAttribute("aria-expanded", "false");
    }
    document.body.classList.remove("sidebar-open");
  }

  function toggleSidebar() {
    if (sidebar.classList.contains("sidebar--open")) {
      cerrarSidebar();
    } else {
      abrirSidebar();
    }
  }

  if (btnHamburger) {
    btnHamburger.addEventListener("click", toggleSidebar);
  }

  if (sidebarCerrar) {
    sidebarCerrar.addEventListener("click", cerrarSidebar);
  }

  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener("click", cerrarSidebar);
  }

  // Cerrar al hacer clic en un enlace del sidebar (navegación)
  sidebar.querySelectorAll(".sidebar-link, .sidebar-btn-planes").forEach(function (el) {
    el.addEventListener("click", function () {
      cerrarSidebar();
    });
  });

  // Cerrar con Escape
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && sidebar.classList.contains("sidebar--open")) {
      cerrarSidebar();
    }
  });
})();
