import { firebaseConfig } from "./firebase-config.js";

import {
  initializeApp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Inicializar Firebase y Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Helpers
function normalizarTelefono(raw) {
  if (!raw) return "";
  // Quitar espacios, guiones, paréntesis y otros símbolos comunes
  const soloDigitos = raw.replace(/[^\d]/g, "");
  return soloDigitos;
}

function formatearFecha(fechaFirestore) {
  if (!fechaFirestore) return "Sin fecha registrada";

  let date;
  // Firestore Timestamp tiene toDate()
  if (typeof fechaFirestore.toDate === "function") {
    date = fechaFirestore.toDate();
  } else {
    // Por si estuviera guardado como string/Date
    date = new Date(fechaFirestore);
  }

  if (Number.isNaN(date.getTime())) return "Fecha no válida";

  return date.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function estadoEsActiva(estadoMembresia, fechaFin) {
  // La fecha de vencimiento es la fuente de verdad: si existe, decidimos por ella
  if (fechaFin) {
    let fecha;
    if (typeof fechaFin.toDate === "function") {
      fecha = fechaFin.toDate();
    } else {
      fecha = new Date(fechaFin);
    }

    if (!Number.isNaN(fecha.getTime())) {
      const hoyInicio = new Date();
      hoyInicio.setHours(0, 0, 0, 0);
      const vencimientoInicio = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
      // Activa solo si la fecha de vencimiento es hoy o en el futuro (el día de vencimiento aún cuenta como activa)
      return vencimientoInicio >= hoyInicio;
    }
  }

  // Si no hay fecha válida, usar estado guardado en BD como respaldo
  if (typeof estadoMembresia === "string") {
    const e = estadoMembresia.trim().toLowerCase();
    if (e === "activa" || e === "activo") return true;
    if (e === "vencida" || e === "vencido") return false;
  }

  return false;
}

// Referencias al DOM
const form = document.getElementById("consulta-form");
const inputTel = document.getElementById("telefono");
const statusEl = document.getElementById("status");
const helperEl = document.getElementById("helper");
const resultadoEl = document.getElementById("resultado");
const btnConsultar = document.getElementById("btn-consultar");

function setStatus(mensaje, tipo = "info") {
  statusEl.textContent = mensaje || "";
  statusEl.classList.remove("status--info", "status--error");
  if (tipo === "error") {
    statusEl.classList.add("status--error");
  } else {
    statusEl.classList.add("status--info");
  }
}

function limpiarResultado() {
  resultadoEl.classList.remove("visible");
  resultadoEl.innerHTML = "";
}

function mostrarResultado(usuario) {
  const {
    nombre = "Usuario",
    apellido,
    estadoMembresia,
    fechaFinMembresia,
  } = usuario;

  const nombreCompleto = [nombre, apellido].filter(Boolean).join(" ").trim() || nombre;

  const activa = estadoEsActiva(estadoMembresia, fechaFinMembresia);
  const textoEstado = activa ? "ACTIVA" : "VENCIDA";
  const claseEstado = activa ? "activa" : "vencida";
  const fechaFormateada = formatearFecha(fechaFinMembresia);

  resultadoEl.innerHTML = `
    <div class="resultado-header">
      <div class="resultado-nombre">${nombreCompleto}</div>
      <span class="badge-estado ${claseEstado}">
        ${textoEstado}
      </span>
    </div>
    <p class="resultado-item">
      <strong>Fecha de vencimiento:</strong> ${fechaFormateada}
    </p>
  `;

  resultadoEl.classList.add("visible");
}

async function consultarPorTelefono(event) {
  event.preventDefault();
  limpiarResultado();

  const telNormalizado = normalizarTelefono(inputTel.value);

  if (!telNormalizado) {
    setStatus("Ingresa un número de celular válido.", "error");
    return;
  }

  try {
    btnConsultar.disabled = true;
    setStatus("Buscando membresía...", "info");

    const colRef = collection(db, "usuarios");
    const q = query(colRef, where("telefono", "==", telNormalizado));
    const snap = await getDocs(q);

    if (snap.empty) {
      setStatus(
        "No se encontró ninguna membresía con ese número de celular.",
        "error"
      );
      return;
    }

    // En la práctica debería haber solo un documento por teléfono,
    // así que tomamos el primero.
    const doc = snap.docs[0];
    const data = doc.data();

    setStatus("Membresía encontrada.");
    mostrarResultado(data);
  } catch (error) {
    console.error("Error al consultar membresía:", error);
    setStatus(
      "Ocurrió un error al consultar la membresía. Intenta de nuevo en unos momentos.",
      "error"
    );
  } finally {
    btnConsultar.disabled = false;
  }
}

form.addEventListener("submit", consultarPorTelefono);

// --- Panel flotante de planes (desde Firestore) ---
const btnPlanes = document.getElementById("btn-planes");
const panelPlanes = document.getElementById("panel-planes");
const panelPlanesLista = document.getElementById("panel-planes-lista");
const btnCerrarPlanes = document.getElementById("btn-cerrar-planes");

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
  btnPlanes.setAttribute("aria-expanded", "true");
  cargarPlanes();
}

function cerrarPanelPlanes() {
  panelPlanes.classList.remove("visible");
  panelPlanes.setAttribute("aria-hidden", "true");
  btnPlanes.setAttribute("aria-expanded", "false");
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
        (p) => `
        <div class="panel-plan-item">
          <span class="nombre">${p.nombre}</span>
          <span class="precio-dias">${formatearPrecio(p.precio)} ${p.duracionDias} días</span>
        </div>
      `
      )
      .join("");
  } catch (err) {
    console.error("Error al cargar planes:", err);
    panelPlanesLista.innerHTML =
      '<p class="panel-planes-error">No se pudieron cargar los planes. Intenta más tarde.</p>';
  }
}

btnPlanes.addEventListener("click", () => {
  if (panelPlanes.classList.contains("visible")) {
    cerrarPanelPlanes();
  } else {
    abrirPanelPlanes();
  }
});

btnCerrarPlanes.addEventListener("click", cerrarPanelPlanes);

// Cerrar al hacer clic fuera del panel
document.addEventListener("click", (e) => {
  if (
    panelPlanes.classList.contains("visible") &&
    !panelPlanes.contains(e.target) &&
    !btnPlanes.contains(e.target)
  ) {
    cerrarPanelPlanes();
  }
});

// Mensaje inicial
setStatus("Escribe tu número de celular y presiona Consultar.", "info");

