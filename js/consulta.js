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
  // Si ya tienes un campo `estadoMembresia` tipo "activa"/"vencida", usamos eso.
  if (typeof estadoMembresia === "string") {
    const e = estadoMembresia.trim().toLowerCase();
    if (e === "activa" || e === "activo") return true;
    if (e === "vencida" || e === "vencido") return false;
  }

  // Como respaldo, evaluamos por fecha de vencimiento si existe
  if (!fechaFin) return false;

  let fecha;
  if (typeof fechaFin.toDate === "function") {
    fecha = fechaFin.toDate();
  } else {
    fecha = new Date(fechaFin);
  }

  if (Number.isNaN(fecha.getTime())) return false;

  const hoy = new Date();
  // Consideramos "activa" si la fechaFin es hoy o en el futuro
  return fecha >= new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
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
    estadoMembresia,
    fechaFinMembresia,
    telefono,
  } = usuario;

  const activa = estadoEsActiva(estadoMembresia, fechaFinMembresia);
  const textoEstado = activa ? "ACTIVA" : "VENCIDA";
  const claseEstado = activa ? "activa" : "vencida";
  const fechaFormateada = formatearFecha(fechaFinMembresia);

  resultadoEl.innerHTML = `
    <div class="resultado-header">
      <div class="resultado-nombre">${nombre}</div>
      <span class="badge-estado ${claseEstado}">
        ${textoEstado}
      </span>
    </div>
    <p class="resultado-item">
      <strong>Teléfono:</strong> ${telefono || "No registrado"}
    </p>
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

// Mensaje inicial
setStatus("Escribe tu número de celular y presiona Consultar.", "info");

