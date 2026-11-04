import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EstadoMembresia,
  calcularEstado,
  componerNombre,
  crearMembresia,
  esEstadoValido,
} from "../js/domain/membresia.js";

const VENCE_EL_14 = new Date("2026-08-14T05:00:00Z");

describe("calcularEstado", () => {
  it("sigue activa durante todo el día de vencimiento", () => {
    const casiMedianoche = new Date("2026-08-15T04:59:00Z");
    assert.equal(calcularEstado(VENCE_EL_14, null, casiMedianoche), EstadoMembresia.ACTIVA);
  });

  it("vence al empezar el día siguiente en Colombia", () => {
    const díaSiguiente = new Date("2026-08-15T05:01:00Z");
    assert.equal(calcularEstado(VENCE_EL_14, null, díaSiguiente), EstadoMembresia.VENCIDA);
  });

  it("ignora el estado guardado cuando hay fecha, porque puede estar desactualizado", () => {
    const díaSiguiente = new Date("2026-08-20T12:00:00Z");
    assert.equal(calcularEstado(VENCE_EL_14, "activa", díaSiguiente), EstadoMembresia.VENCIDA);
  });

  it("usa el estado guardado solo si no hay fecha", () => {
    assert.equal(calcularEstado(null, "Activa", new Date()), EstadoMembresia.ACTIVA);
    assert.equal(calcularEstado(null, " VENCIDO ", new Date()), EstadoMembresia.VENCIDA);
  });

  it("no inventa un estado cuando no hay información", () => {
    assert.equal(calcularEstado(null, null, new Date()), EstadoMembresia.DESCONOCIDO);
    assert.equal(calcularEstado(null, "otra cosa", new Date()), EstadoMembresia.DESCONOCIDO);
  });

  it("no confunde propiedades heredadas con estados", () => {
    for (const heredada of ["constructor", "toString", "valueOf", "__proto__"]) {
      assert.equal(calcularEstado(null, heredada, new Date()), EstadoMembresia.DESCONOCIDO);
    }
  });
});

describe("componerNombre", () => {
  it("une nombre y apellido", () => {
    assert.equal(componerNombre("Ana", "Gómez"), "Ana Gómez");
  });

  it("tolera campos faltantes o de tipo inesperado", () => {
    assert.equal(componerNombre("Ana", null), "Ana");
    assert.equal(componerNombre("  ", "  "), "Usuario");
    assert.equal(componerNombre(42, undefined), "Usuario");
  });
});

describe("crearMembresia", () => {
  it("construye el modelo a partir de un documento de Firestore", () => {
    const membresia = crearMembresia(
      {
        nombre: "Ana",
        apellido: "Gómez",
        telefono: "3012796566",
        estadoMembresia: "activa",
        fechaFinMembresia: { toDate: () => VENCE_EL_14 },
      },
      new Date("2026-08-10T12:00:00Z")
    );

    assert.deepEqual(membresia, {
      nombreCompleto: "Ana Gómez",
      fechaFin: VENCE_EL_14,
      estado: EstadoMembresia.ACTIVA,
    });
  });

  it("no expone campos adicionales del documento", () => {
    const membresia = crearMembresia({ nombre: "Ana", telefono: "3012796566", saldo: 99 });
    assert.deepEqual(Object.keys(membresia).sort(), ["estado", "fechaFin", "nombreCompleto"]);
  });
});

describe("esEstadoValido", () => {
  it("reconoce los estados del dominio y rechaza el resto", () => {
    assert.equal(esEstadoValido("activa"), true);
    assert.equal(esEstadoValido("desconocido"), true);
    assert.equal(esEstadoValido("cualquier cosa"), false);
    assert.equal(esEstadoValido(undefined), false);
  });
});
