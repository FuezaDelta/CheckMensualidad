import { db } from "./firebase-app.js";
import {
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const panelPlanes = document.getElementById("panel-planes");
const panelPlanesLista = document.getElementById("panel-planes-lista");
const btnPlanes = document.getElementById("btn-planes");
const btnCerrarPlanes = document.getElementById("btn-cerrar-planes");
const btnPlanesSidebar = document.getElementById("btn-planes-sidebar");

if (!panelPlanes || !panelPlanesLista) {
  console.warn("Panel de planes no encontrado en esta página.");
} else {
  function formatearPrecio(num) {
    if (num == null || Number.isNaN(Number(num))) return "—";
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(Number(num));
  }

  function abrirPanelPlanes() {
    panelPlanes.classList.add("visible");
    panelPlanes.setAttribute("aria-hidden", "false");
    if (btnPlanes) btnPlanes.setAttribute("aria-expanded", "true");
    cargarPlanes();
  }

  function cerrarPanelPlanes() {
    panelPlanes.classList.remove("visible");
    panelPlanes.setAttribute("aria-hidden", "true");
    if (btnPlanes) btnPlanes.setAttribute("aria-expanded", "false");
  }

  async function cargarPlanes() {
    panelPlanesLista.innerHTML = '<p class="panel-planes-cargando">Cargando planes…</p>';

    try {
      const colRef = collection(db, "planes");
      const q = query(colRef, where("activo", "==", true));
      const snap = await getDocs(q);

      if (snap.empty) {
        panelPlanesLista.innerHTML =
          '<p class="panel-planes-error">No hay planes disponibles.</p>';
        return;
      }

      const items = snap.docs
        .map((doc) => {
          const d = doc.data();
          return {
            nombre: d.nombre ?? doc.id,
            precio: d.precio,
            duracionDias: d.duracionDias ?? 0,
          };
        })
        .sort((a, b) => (a.duracionDias || 0) - (b.duracionDias || 0));

      panelPlanesLista.innerHTML = items
        .map(
          (p) =>
            `<div class="panel-plan-item">
          <span class="nombre">${p.nombre}</span>
          <span class="precio-dias">${formatearPrecio(p.precio)} ${p.duracionDias} días</span>
        </div>`
        )
        .join("");
    } catch (err) {
      console.error("Error al cargar planes:", err);
      panelPlanesLista.innerHTML =
        '<p class="panel-planes-error">No se pudieron cargar los planes. Intenta más tarde.</p>';
    }
  }

  function togglePanelPlanes() {
    if (panelPlanes.classList.contains("visible")) {
      cerrarPanelPlanes();
    } else {
      abrirPanelPlanes();
    }
  }

  if (btnPlanes) {
    btnPlanes.addEventListener("click", togglePanelPlanes);
  }

  if (btnPlanesSidebar) {
    btnPlanesSidebar.addEventListener("click", () => {
      abrirPanelPlanes();
      const sidebar = document.getElementById("sidebar");
      if (sidebar) {
        sidebar.classList.remove("sidebar--open");
        document.body.classList.remove("sidebar-open");
      }
      const hamburger = document.getElementById("btn-hamburger");
      if (hamburger) hamburger.setAttribute("aria-expanded", "false");
    });
  }

  if (btnCerrarPlanes) {
    btnCerrarPlanes.addEventListener("click", cerrarPanelPlanes);
  }

  document.addEventListener("click", (e) => {
    if (!panelPlanes.classList.contains("visible")) return;
    if (panelPlanes.contains(e.target)) return;
    if (btnPlanes && btnPlanes.contains(e.target)) return;
    if (btnPlanesSidebar && btnPlanesSidebar.contains(e.target)) return;
    cerrarPanelPlanes();
  });

  if (window.location.hash === "#planes") {
    abrirPanelPlanes();
  }
}
