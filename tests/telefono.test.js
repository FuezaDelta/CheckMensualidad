import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  esTelefonoValido,
  normalizarTelefono,
  variantesTelefono,
} from "../js/domain/telefono.js";

describe("normalizarTelefono", () => {
  it("quita separadores comunes", () => {
    assert.equal(normalizarTelefono("301 279 65 66"), "3012796566");
    assert.equal(normalizarTelefono("(301) 279-6566"), "3012796566");
  });

  it("quita el indicativo de país en sus distintas formas", () => {
    assert.equal(normalizarTelefono("+57 301 279 6566"), "3012796566");
    assert.equal(normalizarTelefono("573012796566"), "3012796566");
    assert.equal(normalizarTelefono("00573012796566"), "3012796566");
  });

  it("no confunde un número nacional con uno que empieza por 57", () => {
    assert.equal(normalizarTelefono("3157123456"), "3157123456");
  });

  it("devuelve cadena vacía para entradas no utilizables", () => {
    assert.equal(normalizarTelefono(null), "");
    assert.equal(normalizarTelefono(undefined), "");
    assert.equal(normalizarTelefono("sin números"), "");
    assert.equal(normalizarTelefono({}), "");
  });
});

describe("esTelefonoValido", () => {
  it("acepta celulares colombianos de 10 dígitos", () => {
    assert.equal(esTelefonoValido("3012796566"), true);
  });

  it("rechaza longitudes incorrectas y números que no son de celular", () => {
    assert.equal(esTelefonoValido("30127965"), false);
    assert.equal(esTelefonoValido("30127965667"), false);
    assert.equal(esTelefonoValido("6045551234"), false);
    assert.equal(esTelefonoValido(""), false);
  });
});

describe("variantesTelefono", () => {
  it("cubre el número con y sin indicativo, porque la base de datos tiene ambos", () => {
    assert.deepEqual(variantesTelefono("3012796566"), ["3012796566", "573012796566"]);
  });

  it("no genera variantes de una entrada vacía", () => {
    assert.deepEqual(variantesTelefono(""), []);
  });
});
