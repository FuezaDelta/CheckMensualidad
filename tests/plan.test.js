import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { crearPlan, ordenarPlanes } from "../js/domain/plan.js";

describe("crearPlan", () => {
  it("normaliza los campos del documento", () => {
    assert.deepEqual(crearPlan("mensual", { nombre: " Mensual ", precio: "80000", duracionDias: 30 }), {
      nombre: "Mensual",
      precio: 80000,
      duracionDias: 30,
    });
  });

  it("usa el id del documento cuando falta el nombre", () => {
    assert.equal(crearPlan("quincenal", {}).nombre, "quincenal");
  });

  it("no propaga valores numéricos inválidos", () => {
    const plan = crearPlan("mensual", { precio: "gratis", duracionDias: null });
    assert.equal(plan.precio, null);
    assert.equal(plan.duracionDias, 0);
  });
});

describe("ordenarPlanes", () => {
  it("ordena del plan más corto al más largo", () => {
    const planes = [
      { nombre: "Anual", precio: 1, duracionDias: 365 },
      { nombre: "Mensual", precio: 1, duracionDias: 30 },
      { nombre: "Semanal", precio: 1, duracionDias: 7 },
    ];

    assert.deepEqual(
      ordenarPlanes(planes).map((plan) => plan.nombre),
      ["Semanal", "Mensual", "Anual"]
    );
  });

  it("desempata por nombre y no muta la entrada", () => {
    const planes = [
      { nombre: "Premium", precio: 2, duracionDias: 30 },
      { nombre: "Básico", precio: 1, duracionDias: 30 },
    ];
    const original = [...planes];

    assert.deepEqual(
      ordenarPlanes(planes).map((plan) => plan.nombre),
      ["Básico", "Premium"]
    );
    assert.deepEqual(planes, original);
  });
});
